# Migration 020: P0/P1/P2 Audit Fixes

## Summary

This migration addresses critical issues identified during the architecture audit. All changes are backwards compatible.

## Changes

### P0 Fixes (Critical - Deploy Immediately)

#### 1. Atomic Delivery + Credit Consumption
- **Problem**: `delivery.ts` performed credit consumption and status update in separate queries, risking inconsistency if one fails
- **Solution**: New function `complete_delivery_and_consume_credit()` that atomically:
  - Consumes 1 credit
  - Updates delivery status
  - Updates lead_offer to SENT_TO_DEVELOPER
  - Logs the event
  - All in a single transaction

#### 2. Meta Lead Ads Idempotency
- **Problem**: Race condition between SELECT and INSERT on `lead_sources` when Meta retries webhooks
- **Solution**: New function `upsert_lead_source()` that uses `INSERT ... ON CONFLICT DO NOTHING` pattern

### P1 Fixes (High Priority)

#### 3. State Machine Validation
- **Problem**: No validation of `lead_offer.status` transitions - any status could transition to any other
- **Solution**: Trigger `validate_lead_offer_status_transition()` enforces valid transitions:
  ```
  PENDING_MAPPING → TO_BE_CONTACTED, DISQUALIFIED, STOPPED
  TO_BE_CONTACTED → CONTACTED, COOLING, STOPPED, DISQUALIFIED
  CONTACTED → ENGAGED, COOLING, STOPPED, DISQUALIFIED
  ENGAGED → QUALIFYING, COOLING, STOPPED, DISQUALIFIED, HUMAN_HANDOFF
  QUALIFYING → SCORED, LEAD_READY, COOLING, STOPPED, DISQUALIFIED, HUMAN_HANDOFF
  SCORED → LEAD_READY, QUALIFYING, COOLING, STOPPED, DISQUALIFIED
  LEAD_READY → SENT_TO_DEVELOPER, STOPPED, DISQUALIFIED
  SENT_TO_DEVELOPER → STOPPED (only)
  COOLING → REACTIVATION, STOPPED, DISQUALIFIED
  REACTIVATION → CONTACTED, ENGAGED, STOPPED, DISQUALIFIED
  DISQUALIFIED → REACTIVATION (only)
  STOPPED → (none - terminal state)
  HUMAN_HANDOFF → QUALIFYING, LEAD_READY, STOPPED, DISQUALIFIED
  ```

#### 4. Scoring Deduplication
- **Problem**: `calculateScore` existed in both `scoring.ts` and `openai.ts`
- **Solution**: Deprecated the version in `openai.ts`, now delegates to `scoring.ts`

### P2 Fixes (Lower Priority)

#### 5. Trace ID Persistence
- **Problem**: Request trace IDs only existed in memory, couldn't reconstruct request flows post-mortem
- **Solution**: Added `trace_id` column to:
  - `deliveries`
  - `lead_events`
  - `messages`
  
  With indexes for efficient lookup

#### 6. Enum Updates
- Added `DEAD_LETTER` and `PARTIAL` to `delivery_status` enum (if not already present)

## Deployment Instructions

### 1. Apply Migration

```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Via psql
psql $DATABASE_URL -f migrations/020_p0_p1_p2_fixes.sql

# Option C: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste contents of 020_p0_p1_p2_fixes.sql
# 3. Run
```

### 2. Verify Migration

Run these queries to verify:

```sql
-- Check functions exist
SELECT proname FROM pg_proc WHERE proname IN (
  'complete_delivery_and_consume_credit',
  'upsert_lead_source',
  'validate_lead_offer_status_transition'
);

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_lead_offers_validate_transition';

-- Check new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'deliveries' AND column_name = 'trace_id';
```

### 3. Deploy Application Code

After migration is applied:

```bash
cd converzia-app
npm run build
# Deploy to Vercel/Railway/etc
```

## Rollback

If needed, the migration can be rolled back:

```sql
-- Remove new functions
DROP FUNCTION IF EXISTS complete_delivery_and_consume_credit;
DROP FUNCTION IF EXISTS upsert_lead_source;
DROP FUNCTION IF EXISTS validate_lead_offer_status_transition;

-- Remove trigger
DROP TRIGGER IF EXISTS trg_lead_offers_validate_transition ON lead_offers;

-- Remove new columns
ALTER TABLE deliveries DROP COLUMN IF EXISTS trace_id;
ALTER TABLE lead_events DROP COLUMN IF EXISTS trace_id;
ALTER TABLE messages DROP COLUMN IF EXISTS trace_id;
```

Note: The application code changes are backwards compatible with the old schema, but the atomic function calls will fail if the functions don't exist.

## Testing

Run the updated test suite:

```bash
cd converzia-app
npm run test
```

Key test file: `src/__tests__/services/delivery-integration.test.ts`

## Invariants Enforced

After this migration, the following invariants are enforced at the database level:

1. ✅ **One delivery per lead_offer** - `UNIQUE(lead_offer_id)` on deliveries
2. ✅ **One credit per delivery** - `UNIQUE INDEX` on `(delivery_id) WHERE transaction_type = 'CREDIT_CONSUMPTION'`
3. ✅ **Atomic delivery completion** - Single transaction for delivery + credit
4. ✅ **Valid state transitions only** - Trigger validates transitions
5. ✅ **Idempotent Meta ingestion** - `ON CONFLICT DO NOTHING` pattern
6. ✅ **Audit trail via trace_id** - All operations traceable




