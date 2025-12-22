// ============================================
// Metrics Collection Module
// ============================================
// In-memory metrics with periodic flush to storage

import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Metric types
type MetricType = "counter" | "gauge" | "histogram";

interface MetricValue {
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

interface HistogramValue {
  sum: number;
  count: number;
  buckets: HistogramBucket[];
}

// In-memory metric storage
const metrics: Map<string, MetricValue[]> = new Map();
const histograms: Map<string, HistogramValue> = new Map();

// Default histogram buckets (in ms for latency)
const DEFAULT_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// ============================================
// Counter Operations
// ============================================

export function incrementCounter(
  name: string,
  labels: Record<string, string> = {},
  value: number = 1
): void {
  const key = `${name}:${JSON.stringify(labels)}`;
  const existing = metrics.get(key);

  if (existing && existing.length > 0) {
    existing[existing.length - 1].value += value;
  } else {
    metrics.set(key, [
      {
        type: "counter",
        value,
        labels,
        timestamp: Date.now(),
      },
    ]);
  }
}

// ============================================
// Gauge Operations
// ============================================

export function setGauge(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const key = `${name}:${JSON.stringify(labels)}`;

  metrics.set(key, [
    {
      type: "gauge",
      value,
      labels,
      timestamp: Date.now(),
    },
  ]);
}

// ============================================
// Histogram Operations
// ============================================

export function observeHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {},
  buckets: number[] = DEFAULT_BUCKETS
): void {
  const key = `${name}:${JSON.stringify(labels)}`;
  const existing = histograms.get(key);

  if (existing) {
    existing.sum += value;
    existing.count += 1;
    for (const bucket of existing.buckets) {
      if (value <= bucket.le) {
        bucket.count += 1;
      }
    }
  } else {
    histograms.set(key, {
      sum: value,
      count: 1,
      buckets: buckets.map((le) => ({
        le,
        count: value <= le ? 1 : 0,
      })),
    });
  }
}

// ============================================
// Timer Helper
// ============================================

export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

export async function timeAsync<T>(
  name: string,
  labels: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const timer = startTimer();
  try {
    const result = await fn();
    observeHistogram(`${name}_duration_ms`, timer(), { ...labels, status: "success" });
    return result;
  } catch (error) {
    observeHistogram(`${name}_duration_ms`, timer(), { ...labels, status: "error" });
    throw error;
  }
}

// ============================================
// Predefined Metrics
// ============================================

export const Metrics = {
  // Webhooks
  webhookReceived: (source: string, status: "success" | "error" | "ignored") =>
    incrementCounter("webhook_received_total", { source, status }),

  webhookLatency: (source: string, durationMs: number) =>
    observeHistogram("webhook_latency_ms", durationMs, { source }),

  // Deliveries
  deliveryAttempted: (status: "success" | "partial" | "failed" | "dead_letter") =>
    incrementCounter("delivery_attempted_total", { status }),

  deliveryLatency: (durationMs: number) =>
    observeHistogram("delivery_latency_ms", durationMs),

  // Billing
  creditConsumed: (tenantId: string) =>
    incrementCounter("credit_consumed_total", { tenant_id: tenantId }),

  creditPurchased: (tenantId: string, amount: number) =>
    incrementCounter("credit_purchased_total", { tenant_id: tenantId }, amount),

  creditRefunded: (tenantId: string) =>
    incrementCounter("credit_refunded_total", { tenant_id: tenantId }),

  // Leads
  leadCreated: (source: string) =>
    incrementCounter("lead_created_total", { source }),

  leadQualified: (isReady: boolean) =>
    incrementCounter("lead_qualified_total", { is_ready: String(isReady) }),

  leadScored: (scoreRange: string) =>
    incrementCounter("lead_scored_total", { score_range: scoreRange }),

  // Conversations
  messageReceived: () =>
    incrementCounter("message_received_total"),

  messageSent: (status: "success" | "error") =>
    incrementCounter("message_sent_total", { status }),

  // OpenAI
  openaiRequest: (model: string, type: string) =>
    incrementCounter("openai_request_total", { model, type }),

  openaiLatency: (model: string, durationMs: number) =>
    observeHistogram("openai_latency_ms", durationMs, { model }),

  // RAG
  ragSearch: (tenantId: string, hasResults: boolean) =>
    incrementCounter("rag_search_total", { tenant_id: tenantId, has_results: String(hasResults) }),

  ragCacheHit: () =>
    incrementCounter("rag_cache_hit_total"),

  ragCacheMiss: () =>
    incrementCounter("rag_cache_miss_total"),

  // Errors
  errorOccurred: (type: string, service: string) =>
    incrementCounter("error_total", { type, service }),
};

// ============================================
// Flush to Storage
// ============================================

export async function flushMetrics(): Promise<void> {
  const supabase = createAdminClient();
  const timestamp = new Date().toISOString();

  const metricsToStore: Array<{
    name: string;
    type: MetricType;
    value: number;
    labels: Record<string, string>;
    timestamp: string;
  }> = [];

  // Collect counters and gauges
  for (const [key, values] of metrics.entries()) {
    const name = key.split(":")[0];
    for (const metric of values) {
      metricsToStore.push({
        name,
        type: metric.type,
        value: metric.value,
        labels: metric.labels,
        timestamp,
      });
    }
  }

  // Collect histograms (store as gauge with percentile labels)
  for (const [key, value] of histograms.entries()) {
    const name = key.split(":")[0];
    const labels = JSON.parse(key.split(":").slice(1).join(":") || "{}");

    // Store sum, count, and p50/p90/p99 if calculable
    metricsToStore.push({
      name: `${name}_sum`,
      type: "gauge",
      value: value.sum,
      labels,
      timestamp,
    });

    metricsToStore.push({
      name: `${name}_count`,
      type: "gauge",
      value: value.count,
      labels,
      timestamp,
    });
  }

  if (metricsToStore.length === 0) {
    return;
  }

  try {
    // Store in a metrics table (create if needed)
    const { error } = await supabase.from("system_metrics").insert(metricsToStore);

    if (error) {
      // Table might not exist, log and continue
      logger.warn("Failed to flush metrics to storage", { error: error.message });
    } else {
      logger.info("Metrics flushed", { count: metricsToStore.length });
    }
  } catch (err) {
    logger.exception("Error flushing metrics", err);
  }

  // Clear in-memory metrics after flush
  metrics.clear();
  histograms.clear();
}

// ============================================
// Get Current Metrics (for API/health checks)
// ============================================

export function getCurrentMetrics(): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, values] of metrics.entries()) {
    const name = key.split(":")[0];
    if (!result[name]) {
      result[name] = [];
    }
    (result[name] as unknown[]).push(...values);
  }

  for (const [key, value] of histograms.entries()) {
    const name = key.split(":")[0];
    result[`${name}_histogram`] = value;
  }

  return result;
}

