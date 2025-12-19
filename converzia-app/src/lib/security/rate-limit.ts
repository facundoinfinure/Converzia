import { NextRequest, NextResponse } from "next/server";

// ============================================
// In-Memory Rate Limiter
// For production, use Redis (Upstash) or similar
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (works for single-instance deployments)
// For Vercel with multiple instances, use Upstash Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

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

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  let entry = rateLimitStore.get(fullKey);

  // Create new entry if doesn't exist or has expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(fullKey, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const success = entry.count <= config.maxRequests;

  return {
    success,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: success ? undefined : Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Get client identifier from request
 */
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

/**
 * Middleware-style rate limit check that returns a response if limited
 */
export function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): NextResponse | null {
  const clientId = getClientIdentifier(request);
  const result = checkRateLimit(clientId, config);

  if (!result.success) {
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
  // Login attempts: 5 per minute
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
// Upstash Redis Rate Limiter (for production)
// ============================================

// If using Upstash Redis, uncomment and configure:
/*
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const upstashRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
});

export async function checkUpstashRateLimit(key: string) {
  const { success, limit, remaining, reset } = await upstashRateLimiter.limit(key);
  return { success, limit, remaining, reset };
}
*/




