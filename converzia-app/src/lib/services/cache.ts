/**
 * Redis Cache Service
 * 
 * Provides a caching layer using Upstash Redis for API responses.
 * Falls back to in-memory cache for development.
 */

import { Redis } from "@upstash/redis";

// ============================================
// Cache Configuration
// ============================================

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix?: string; // Key prefix for namespace isolation
}

// Default TTLs for different data types (in seconds)
export const CacheTTL = {
  STATS: 60, // 1 minute - frequently changing data
  FUNNEL: 120, // 2 minutes - aggregated data
  REVENUE: 300, // 5 minutes - summary data
  TENANT_INFO: 600, // 10 minutes - rarely changing
  LEAD_LIST: 30, // 30 seconds - user-facing data
  OFFERS: 300, // 5 minutes - product data
} as const;

// ============================================
// Redis Client
// ============================================

const useRedis = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!useRedis) {
    return null;
  }
  
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  
  return redis;
}

// ============================================
// In-Memory Fallback Cache
// ============================================

interface InMemoryCacheEntry {
  value: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, InMemoryCacheEntry>();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiresAt < now) {
        memoryCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ============================================
// Cache Service
// ============================================

export const cacheService = {
  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getRedis();
    
    if (client) {
      try {
        const value = await client.get<T>(key);
        return value;
      } catch (error) {
        console.warn("[Cache] Redis get error:", error);
        return null;
      }
    }
    
    // Fallback to memory cache
    const entry = memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value as T;
    }
    
    memoryCache.delete(key);
    return null;
  },

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = getRedis();
    
    if (client) {
      try {
        await client.set(key, value, { ex: ttlSeconds });
      } catch (error) {
        console.warn("[Cache] Redis set error:", error);
      }
    }
    
    // Always set in memory cache as backup
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  /**
   * Delete a specific key from cache
   */
  async del(key: string): Promise<void> {
    const client = getRedis();
    
    if (client) {
      try {
        await client.del(key);
      } catch (error) {
        console.warn("[Cache] Redis del error:", error);
      }
    }
    
    memoryCache.delete(key);
  },

  /**
   * Delete all keys matching a pattern (invalidate namespace)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const client = getRedis();
    
    if (client) {
      try {
        // Use SCAN for production-safe pattern deletion
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch (error) {
        console.warn("[Cache] Redis invalidatePattern error:", error);
      }
    }
    
    // Clear memory cache matching pattern
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  },

  /**
   * Get or set a value with a callback
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const value = await fetchFn();

    // Cache the result
    await this.set(key, value, ttlSeconds);

    return value;
  },
};

// ============================================
// Cache Key Builders
// ============================================

export const cacheKeys = {
  // Tenant-scoped keys
  tenantStats: (tenantId: string) => `tenant:${tenantId}:stats`,
  tenantFunnel: (tenantId: string, days: number) => 
    `tenant:${tenantId}:funnel:${days}d`,
  tenantLeads: (tenantId: string, category: string, page: number) =>
    `tenant:${tenantId}:leads:${category}:p${page}`,
  tenantOffers: (tenantId: string) => `tenant:${tenantId}:offers`,
  tenantCredits: (tenantId: string) => `tenant:${tenantId}:credits`,
  
  // Admin keys
  adminRevenue: (period: string) => `admin:revenue:${period}`,
  adminTenantList: (page: number, status?: string) =>
    `admin:tenants:p${page}:${status || "all"}`,
  adminPendingApprovals: () => `admin:pending-approvals`,
  
  // Global keys
  appSettings: () => `app:settings`,
};

// ============================================
// Cache Invalidation Helpers
// ============================================

export const invalidateCache = {
  /**
   * Invalidate all tenant-related caches
   */
  async tenant(tenantId: string): Promise<void> {
    await cacheService.invalidatePattern(`tenant:${tenantId}:*`);
  },

  /**
   * Invalidate lead-related caches for a tenant
   */
  async tenantLeads(tenantId: string): Promise<void> {
    await Promise.all([
      cacheService.del(cacheKeys.tenantStats(tenantId)),
      cacheService.invalidatePattern(`tenant:${tenantId}:leads:*`),
      cacheService.invalidatePattern(`tenant:${tenantId}:funnel:*`),
    ]);
  },

  /**
   * Invalidate credit-related caches
   */
  async tenantCredits(tenantId: string): Promise<void> {
    await cacheService.del(cacheKeys.tenantCredits(tenantId));
  },

  /**
   * Invalidate admin revenue caches
   */
  async adminRevenue(): Promise<void> {
    await cacheService.invalidatePattern(`admin:revenue:*`);
  },

  /**
   * Invalidate all admin caches
   */
  async admin(): Promise<void> {
    await cacheService.invalidatePattern(`admin:*`);
  },
};

export default cacheService;
