# Converzia Performance Guide

## Overview

This guide documents performance optimizations, monitoring practices, and query analysis for the Converzia application.

## Database Performance

### Existing Indexes

The following migrations have added critical indexes:

1. **Migration 031**: Query optimization indexes for lead_offers, tenant_members
2. **Migration 033**: Additional indexes for billing, deliveries, lead_sources
3. **Migration 023**: Performance indexes for common queries
4. **Migration 035**: Materialized view for tenant stats

### Enabling pg_stat_statements

To analyze slow queries in production, enable `pg_stat_statements`:

```sql
-- Enable the extension (run as superuser)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View top slow queries
SELECT 
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  round(mean_exec_time::numeric, 2) as mean_time_ms,
  round(max_exec_time::numeric, 2) as max_time_ms,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- View most called queries
SELECT 
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;
```

### Query Analysis Checklist

For each slow query identified:

1. **EXPLAIN ANALYZE**: Run to see execution plan
2. **Check indexes**: Verify appropriate indexes exist
3. **Check row estimates**: Planner estimates should be close to actual
4. **Check for seq scans**: Large table sequential scans are red flags
5. **Check for nested loops**: Can be slow with large datasets

### Common Query Patterns

| Query Pattern | Expected Index | Migration |
|---------------|----------------|-----------|
| `lead_offers WHERE tenant_id AND status` | idx_lead_offers_tenant_status_updated | 031 |
| `credit_ledger WHERE tenant_id` | idx_credit_ledger_tenant_type_created | 033 |
| `deliveries WHERE status` | idx_deliveries_status_created | 033 |
| `lead_sources WHERE leadgen_id` | idx_lead_sources_leadgen_id | 033 |
| `ad_offer_map WHERE ad_id` | idx_ad_offer_map_ad_id | 033 |

## API Performance

### queryWithTimeout Usage

All critical API endpoints use `queryWithTimeout` for:
- Default 10-second timeout
- 1 retry on timeout
- Structured error logging

### Critical API Endpoints

| Endpoint | Timeout | Description |
|----------|---------|-------------|
| `/api/portal/leads/stats` | 10s | Funnel statistics |
| `/api/portal/leads` | 10s | Lead list with filters |
| `/api/portal/funnel` | 10s | Funnel visualization |
| `/api/admin/revenue` | 10s | Revenue metrics |
| `/api/webhooks/meta-leads` | 5s | Lead ingestion |

### Response Time Targets

| Endpoint Type | Target P50 | Target P95 | Target P99 |
|---------------|------------|------------|------------|
| Read (simple) | < 100ms | < 300ms | < 500ms |
| Read (complex) | < 300ms | < 1s | < 2s |
| Write | < 200ms | < 500ms | < 1s |
| Webhook | < 500ms | < 2s | < 5s |

## Caching Strategy

### Current Caching

1. **Materialized Views**: `tenant_stats_materialized` for dashboard data
2. **Database Views**: Pre-computed joins with SECURITY_INVOKER

### Proposed Redis Caching

For high-frequency endpoints:

```typescript
// Cache keys pattern
const CACHE_KEYS = {
  tenantStats: (tenantId: string) => `tenant:${tenantId}:stats`,
  funnelData: (tenantId: string) => `tenant:${tenantId}:funnel`,
  revenueDaily: (date: string) => `revenue:${date}`,
};

// TTL by data type
const TTL = {
  stats: 60, // 1 minute
  funnel: 120, // 2 minutes
  revenue: 300, // 5 minutes
};
```

### Cache Invalidation

Invalidate cache on:
- Lead status change
- New lead creation
- Credit ledger entry
- Delivery completion

## Monitoring

### Key Metrics to Track

1. **API Latency**: P50, P95, P99 by endpoint
2. **Database Query Time**: Average and max query time
3. **Error Rate**: 4xx and 5xx responses
4. **Queue Depth**: Pending webhooks and deliveries
5. **Cache Hit Rate**: When caching is implemented

### Sentry Performance

Current Sentry configuration tracks:
- Transaction traces
- Database query spans
- External API calls

### Proposed OpenTelemetry Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'converzia-api',
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
```

## Performance Testing

### Load Testing

Use k6 or Artillery for load testing:

```javascript
// k6 example
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3000/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Benchmarks

Run periodically:
1. Lead list query with 1000+ leads
2. Stats aggregation with 30-day range
3. Webhook processing throughput
4. Concurrent user sessions

## Recommendations

### Immediate Improvements

1. ✅ Add queryWithTimeout to all API routes
2. ✅ Add comprehensive database indexes
3. ⬜ Implement Redis caching for stats endpoints
4. ⬜ Add OpenTelemetry for distributed tracing

### Future Improvements

1. Implement read replicas for heavy read queries
2. Consider connection pooling with PgBouncer
3. Evaluate edge caching for static assets
4. Consider GraphQL for flexible queries

## Troubleshooting

### Slow API Responses

1. Check Sentry for performance traces
2. Review pg_stat_statements for slow queries
3. Verify connection pool isn't exhausted
4. Check for N+1 query patterns

### Database Connection Issues

1. Check max connections limit
2. Review connection pool settings
3. Look for long-running transactions
4. Check for lock contention
