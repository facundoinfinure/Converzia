import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ============================================
// Distributed Rate Limiter with Upstash Redis
// Falls back to in-memory for local development
// ============================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Prefix for the rate limit key
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================
// Check if Upstash Redis is configured
// ============================================

const useRedis = !!(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// ============================================
// Upstash Redis Client (Production)
// ============================================

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis && useRedis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis!;
}

// ============================================
// Upstash Rate Limiters (Production)
// Using sliding window algorithm for accuracy
// ============================================

type RateLimiterType = "webhook" | "api" | "login" | "billing" | "heavy";

const upstashLimiters: Map<RateLimiterType, Ratelimit> = new Map();

function getUpstashLimiter(type: RateLimiterType): Ratelimit {
  if (!upstashLimiters.has(type)) {
    const redisClient = getRedis();
    
    const configs: Record<RateLimiterType, { requests: number; window: string }> = {
      webhook: { requests: 100, window: "1m" },
      api: { requests: 60, window: "1m" },
      login: { requests: 5, window: "1m" },
      billing: { requests: 10, window: "1m" },
      heavy: { requests: 5, window: "1m" },
    };
    
    const config = configs[type];
    
    upstashLimiters.set(
      type,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(config.requests, config.window as any),
        analytics: true,
        prefix: `ratelimit:${type}`,
      })
    );
  }
  
  return upstashLimiters.get(type)!;
}

// ============================================
// In-Memory Rate Limiter (Development Fallback)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of inMemoryStore.entries()) {
      if (entry.resetAt < now) {
        inMemoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function checkInMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  let entry = inMemoryStore.get(fullKey);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }

  entry.count++;
  inMemoryStore.set(fullKey, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const success = entry.count <= config.maxRequests;

  return {
    success,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: success ? undefined : Math.ceil((entry.resetAt - now) / 1000),
  };
}

// ============================================
// Get client identifier from request
// ============================================

export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");

  // Use first IP from x-forwarded-for if present
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return vercelForwardedFor || cfConnectingIp || realIp || "unknown";
}

// ============================================
// Check rate limit (unified interface)
// ============================================

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;
  
  if (useRedis) {
    // Use Upstash in production
    const type = (config.keyPrefix || "api") as RateLimiterType;
    const limiter = getUpstashLimiter(type);
    
    const result = await limiter.limit(fullKey);
    
    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } else {
    // Fallback to in-memory for development
    return checkInMemoryRateLimit(key, config);
  }
}

// ============================================
// Middleware-style rate limit check
// Returns NextResponse if limited, null otherwise
// ============================================

export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const clientId = getClientIdentifier(request);
  const result = await checkRateLimit(clientId, config);

  if (!result.success) {
    // Log rate limit hit for security monitoring
    console.warn(`Rate limit exceeded for ${config.keyPrefix || "api"}`, {
      clientId: clientId.substring(0, 8) + "...", // Partial IP for privacy
      remaining: result.remaining,
      retryAfter: result.retryAfter,
    });
    
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

// ============================================
// Predefined Rate Limit Configs
// ============================================

export const RATE_LIMITS = {
  // Webhooks: 100 requests per minute
  webhook: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: "webhook",
  },
  // API general: 60 requests per minute
  api: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: "api",
  },
  // Login attempts: 5 per minute (strict for brute-force protection)
  login: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: "login",
  },
  // Billing/Checkout: 10 per minute
  billing: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "billing",
  },
  // Heavy operations: 5 per minute
  heavy: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: "heavy",
  },
} as const;

// ============================================
// Health check for Redis connection
// ============================================

export async function checkRedisHealth(): Promise<boolean> {
  if (!useRedis) {
    return false; // Using in-memory fallback
  }
  
  try {
    const redisClient = getRedis();
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
}

