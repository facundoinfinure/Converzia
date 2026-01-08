# Converzia Observability Guide

## Overview

This guide describes the observability stack for Converzia, including error tracking, metrics, and tracing.

## Current Stack

### Error Tracking: Sentry

Sentry is already configured for error tracking:

- **Client-side**: `sentry.client.config.ts`
- **Server-side**: `sentry.server.config.ts`
- **Edge**: `sentry.edge.config.ts`

Features:
- Automatic error capture
- Performance monitoring (transactions)
- Session replay (optional)

### Structured Logging

Custom logger with context (`src/lib/monitoring/index.ts`):

```typescript
import { logger } from "@/lib/monitoring";

logger.info("Processing lead", { leadId, tenantId });
logger.error("Delivery failed", error, { deliveryId });
```

Log levels: debug, info, warn, error, exception

### Custom Metrics

Metrics tracking (`src/lib/monitoring/index.ts`):

```typescript
import { Metrics } from "@/lib/monitoring";

Metrics.webhookReceived("meta", "success");
Metrics.leadCreated(tenantId);
Metrics.creditConsumed(tenantId, 1);
```

## Proposed Enhancements

### 1. OpenTelemetry for Distributed Tracing

OpenTelemetry provides vendor-neutral observability. To install:

```bash
npm install @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http
```

Basic setup (create `src/lib/tracing/index.ts`):

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const sdk = new NodeSDK({
  serviceName: "converzia-api",
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### 2. Service Level Objectives (SLOs)

Define SLOs for critical paths:

| Service | Objective | Target |
|---------|-----------|--------|
| Lead Ingestion | Availability | 99.9% |
| Lead Ingestion | Latency (P95) | < 2s |
| Dashboard Load | Availability | 99.5% |
| Dashboard Load | Latency (P95) | < 3s |
| Delivery Success | Success Rate | > 98% |

### 3. Alerting

Configure alerts for:

- **Error rate spike**: > 5% errors in 5 minutes
- **Latency degradation**: P95 > 5s for 5 minutes
- **Dead letter queue growth**: > 10 items in 1 hour
- **Low credits**: Tenant credits < 10
- **Webhook failures**: > 10% failure rate

### 4. Dashboard Metrics

Key metrics to visualize:

1. **Business Metrics**
   - Leads received per hour
   - Leads qualified per hour
   - Leads delivered per hour
   - Conversion rate
   - Revenue per tenant

2. **Technical Metrics**
   - API latency (P50, P95, P99)
   - Error rate by endpoint
   - Database query time
   - Cache hit rate
   - Webhook processing time

3. **Infrastructure Metrics**
   - Memory usage
   - CPU usage
   - Connection pool utilization

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Sentry Error Tracking | ✅ Implemented | Client + Server + Edge |
| Structured Logging | ✅ Implemented | With trace IDs |
| Custom Metrics | ✅ Implemented | In-memory counters |
| OpenTelemetry | ⬜ Planned | Requires package installation |
| Metrics Dashboard | ⬜ Planned | Consider Grafana Cloud |
| Alerting | ⬜ Planned | Consider PagerDuty |

## Recommended Vendors

For a production setup, consider:

1. **Grafana Cloud**: Metrics, logs, traces in one platform
2. **Datadog**: Full observability stack
3. **New Relic**: APM with good Next.js support
4. **Honeycomb**: Event-based observability

## Quick Start

### 1. View Errors in Sentry

Navigate to your Sentry project dashboard to see:
- Error trends
- Performance transactions
- User sessions

### 2. View Logs

In development, logs appear in the terminal.
In production (Vercel), use the Vercel logs dashboard.

### 3. Check API Performance

Use the Sentry Performance tab to:
- View transaction traces
- Identify slow endpoints
- Find N+1 queries

## Future Work

1. Export metrics to Prometheus/Grafana
2. Set up distributed tracing with Jaeger/Zipkin
3. Create custom dashboards for business metrics
4. Implement automated incident response
