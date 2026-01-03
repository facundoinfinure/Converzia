// ============================================
// RAG Embedding Cache
// ============================================
// Simple in-memory LRU cache for query embeddings

import { createHash } from "crypto";
import { Metrics } from "@/lib/monitoring";

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();

  private generateKey(text: string): string {
    // Normalize text and create hash
    const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
    return createHash("sha256").update(normalized).digest("hex").substring(0, 32);
  }

  get(text: string): number[] | null {
    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      Metrics.ragCacheMiss();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      Metrics.ragCacheMiss();
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    Metrics.ragCacheHit();
    return entry.embedding;
  }

  set(text: string, embedding: number[]): void {
    const key = this.generateKey(text);

    // Evict oldest entries if at capacity
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  // Get cache stats for monitoring
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: CACHE_MAX_SIZE,
      hitRate: 0, // Would need to track hits/misses over time
    };
  }
}

// Singleton instance
export const embeddingCache = new EmbeddingCache();








