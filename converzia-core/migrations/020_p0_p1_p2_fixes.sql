-- ============================================
-- Migration 020: P0, P1, P2 Audit Fixes
-- ============================================
-- This migration addresses critical issues identified in architecture audit:
-- P0: Atomic delivery + credit consumption
-- P0: Meta idempotency race condition fix
-- P1: State machine transition validation
-- P2: Trace ID persistence
-- ============================================

-- ============================================
-- P0 FIX 1: Atomic delivery completion with credit consumption
-- ============================================
-- Problem: delivery.ts does credit consumption and status update in separate queries
-- Solution: Single atomic function that does both or neither

CREATE OR REPLACE FUNCTION complete_delivery_and_consume_credit(
    p_delivery_id UUID,
    p_integrations_succeeded TEXT[],
    p_integrations_failed TEXT[],
    p_final_status TEXT  -- 'DELIVERED' or 'PARTIAL'
)
RETURNS TABLE (
    success BOOLEAN,
    credit_consumed BOOLEAN,
    new_balance INTEGER,
    message TEXT,
    credit_ledger_id UUID
) AS $$
DECLARE
    v_delivery RECORD;
    v_current_balance INTEGER;
    v_new_ledger_id UUID;
    v_existing_ledger UUID;
BEGIN
    -- Lock the delivery row to prevent concurrent modifications
    SELECT d.*, lo.id as lead_offer_id, lo.status as lo_status
    INTO v_delivery
    FROM deliveries d
    JOIN lead_offers lo ON lo.id = d.lead_offer_id
    WHERE d.id = p_delivery_id
    FOR UPDATE OF d, lo;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, FALSE, 0, 'Delivery not found'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    -- Idempotency: already processed
    IF v_delivery.status IN ('DELIVERED', 'PARTIAL', 'DEAD_LETTER') THEN
        RETURN QUERY SELECT TRUE, FALSE, 0, 'Delivery already processed'::TEXT, v_delivery.credit_ledger_id;
        RETURN;
    END IF;
    
    -- Check for existing credit consumption (idempotency)
    SELECT id INTO v_existing_ledger
    FROM credit_ledger
    WHERE delivery_id = p_delivery_id
      AND transaction_type = 'CREDIT_CONSUMPTION';
    
    IF v_existing_ledger IS NOT NULL THEN
        -- Credit already consumed, just update delivery status
        UPDATE deliveries
        SET status = p_final_status::delivery_status,
            integrations_succeeded = p_integrations_succeeded,
            integrations_failed = p_integrations_failed,
            delivered_at = NOW(),
            updated_at = NOW()
        WHERE id = p_delivery_id;
        
        UPDATE lead_offers
        SET status = 'SENT_TO_DEVELOPER',
            billing_eligibility = 'CHARGEABLE',
            status_changed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_delivery.lead_offer_id;
        
        SELECT balance_after INTO v_current_balance
        FROM credit_ledger WHERE id = v_existing_ledger;
        
        RETURN QUERY SELECT TRUE, TRUE, v_current_balance, 'Already consumed (idempotent)'::TEXT, v_existing_ledger;
        RETURN;
    END IF;
    
    -- Lock tenant to prevent race conditions on credit balance
    PERFORM pg_advisory_xact_lock(hashtext(v_delivery.tenant_id::text));
    
    -- Get current balance
    v_current_balance := get_tenant_credits(v_delivery.tenant_id);
    
    IF v_current_balance < 1 THEN
        -- Insufficient credits - update delivery as failed
        UPDATE deliveries
        SET status = 'FAILED',
            error_message = 'Insufficient credits',
            retry_count = COALESCE(retry_count, 0) + 1,
            updated_at = NOW()
        WHERE id = p_delivery_id;
        
        UPDATE lead_offers
        SET billing_eligibility = 'PENDING',
            billing_notes = 'Insufficient credits for delivery'
        WHERE id = v_delivery.lead_offer_id;
        
        RETURN QUERY SELECT FALSE, FALSE, v_current_balance, 'Insufficient credits'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    -- ====== ATOMIC: All updates happen in same transaction ======
    
    -- 1. Consume credit
    INSERT INTO credit_ledger (
        tenant_id,
        transaction_type,
        amount,
        delivery_id,
        lead_offer_id,
        description
    ) VALUES (
        v_delivery.tenant_id,
        'CREDIT_CONSUMPTION',
        -1,
        p_delivery_id,
        v_delivery.lead_offer_id,
        'Lead delivery'
    )
    RETURNING id INTO v_new_ledger_id;
    
    -- 2. Update delivery status
    UPDATE deliveries
    SET status = p_final_status::delivery_status,
        integrations_succeeded = p_integrations_succeeded,
        integrations_failed = p_integrations_failed,
        delivered_at = NOW(),
        credit_ledger_id = v_new_ledger_id,
        updated_at = NOW()
    WHERE id = p_delivery_id;
    
    -- 3. Update lead offer status
    UPDATE lead_offers
    SET status = 'SENT_TO_DEVELOPER',
        billing_eligibility = 'CHARGEABLE',
        status_changed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_delivery.lead_offer_id;
    
    -- 4. Log event
    INSERT INTO lead_events (
        lead_id,
        lead_offer_id,
        tenant_id,
        event_type,
        details,
        actor_type
    ) VALUES (
        v_delivery.lead_id,
        v_delivery.lead_offer_id,
        v_delivery.tenant_id,
        'DELIVERY_COMPLETED',
        jsonb_build_object(
            'delivery_id', p_delivery_id,
            'status', p_final_status,
            'integrations_succeeded', p_integrations_succeeded,
            'integrations_failed', p_integrations_failed,
            'credit_consumed', TRUE
        ),
        'SYSTEM'
    );
    
    -- Get new balance
    v_current_balance := get_tenant_credits(v_delivery.tenant_id);
    
    RETURN QUERY SELECT TRUE, TRUE, v_current_balance, 'Delivery completed and credit consumed'::TEXT, v_new_ledger_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_delivery_and_consume_credit IS 
'Atomically completes a delivery and consumes credit. All operations succeed or none do.';


-- ============================================
-- P0 FIX 2: Idempotent lead source insertion
-- ============================================
-- Problem: Race condition between SELECT and INSERT on lead_sources
-- Solution: Function that uses INSERT ... ON CONFLICT DO NOTHING RETURNING

CREATE OR REPLACE FUNCTION upsert_lead_source(
    p_lead_id UUID,
    p_tenant_id UUID,
    p_leadgen_id TEXT,
    p_platform TEXT,
    p_ad_id TEXT,
    p_campaign_id TEXT,
    p_adset_id TEXT,
    p_form_id TEXT,
    p_form_data JSONB
)
RETURNS TABLE (
    lead_source_id UUID,
    was_created BOOLEAN
) AS $$
DECLARE
    v_existing_id UUID;
    v_new_id UUID;
BEGIN
    -- First try to find existing
    SELECT id INTO v_existing_id
    FROM lead_sources
    WHERE tenant_id = p_tenant_id 
      AND leadgen_id = p_leadgen_id
      AND leadgen_id IS NOT NULL;
    
    IF v_existing_id IS NOT NULL THEN
        RETURN QUERY SELECT v_existing_id, FALSE;
        RETURN;
    END IF;
    
    -- Insert with conflict handling
    INSERT INTO lead_sources (
        lead_id,
        tenant_id,
        platform,
        ad_id,
        campaign_id,
        adset_id,
        form_id,
        leadgen_id,
        form_data
    ) VALUES (
        p_lead_id,
        p_tenant_id,
        p_platform,
        p_ad_id,
        p_campaign_id,
        p_adset_id,
        p_form_id,
        p_leadgen_id,
        p_form_data
    )
    ON CONFLICT (tenant_id, leadgen_id) WHERE leadgen_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_new_id;
    
    -- If insert was skipped due to conflict, get existing id
    IF v_new_id IS NULL THEN
        SELECT id INTO v_new_id
        FROM lead_sources
        WHERE tenant_id = p_tenant_id 
          AND leadgen_id = p_leadgen_id;
        
        RETURN QUERY SELECT v_new_id, FALSE;
    ELSE
        RETURN QUERY SELECT v_new_id, TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_lead_source IS 
'Idempotent upsert of lead_source. Returns existing ID if leadgen_id already processed.';


-- ============================================
-- P1 FIX: State Machine Transition Validation
-- ============================================
-- Problem: No validation of valid state transitions
-- Solution: Trigger that validates transitions

-- Define valid transitions matrix
CREATE OR REPLACE FUNCTION validate_lead_offer_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions JSONB := '{
        "PENDING_MAPPING": ["TO_BE_CONTACTED", "DISQUALIFIED", "STOPPED"],
        "TO_BE_CONTACTED": ["CONTACTED", "COOLING", "STOPPED", "DISQUALIFIED"],
        "CONTACTED": ["ENGAGED", "COOLING", "STOPPED", "DISQUALIFIED"],
        "ENGAGED": ["QUALIFYING", "COOLING", "STOPPED", "DISQUALIFIED", "HUMAN_HANDOFF"],
        "QUALIFYING": ["SCORED", "LEAD_READY", "COOLING", "STOPPED", "DISQUALIFIED", "HUMAN_HANDOFF"],
        "SCORED": ["LEAD_READY", "QUALIFYING", "COOLING", "STOPPED", "DISQUALIFIED"],
        "LEAD_READY": ["SENT_TO_DEVELOPER", "STOPPED", "DISQUALIFIED"],
        "SENT_TO_DEVELOPER": ["STOPPED"],
        "COOLING": ["REACTIVATION", "STOPPED", "DISQUALIFIED"],
        "REACTIVATION": ["CONTACTED", "ENGAGED", "STOPPED", "DISQUALIFIED"],
        "DISQUALIFIED": ["REACTIVATION"],
        "STOPPED": [],
        "HUMAN_HANDOFF": ["QUALIFYING", "LEAD_READY", "STOPPED", "DISQUALIFIED"]
    }'::JSONB;
    
    allowed_next_states JSONB;
BEGIN
    -- Skip validation for same status (no-op updates)
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Get allowed transitions for current state
    allowed_next_states := valid_transitions -> OLD.status::text;
    
    -- Check if transition is valid
    IF allowed_next_states IS NULL THEN
        RAISE EXCEPTION 'Unknown status: %', OLD.status;
    END IF;
    
    IF NOT (allowed_next_states ? NEW.status::text) THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %. Allowed: %', 
            OLD.status, NEW.status, allowed_next_states;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status validation
DROP TRIGGER IF EXISTS trg_lead_offers_validate_transition ON lead_offers;
CREATE TRIGGER trg_lead_offers_validate_transition
    BEFORE UPDATE OF status ON lead_offers
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_lead_offer_status_transition();

COMMENT ON FUNCTION validate_lead_offer_status_transition IS 
'Validates that lead_offer status transitions follow the defined state machine.';


-- ============================================
-- P2 FIX: Trace ID Persistence
-- ============================================
-- Problem: Trace ID generated in memory but not persisted
-- Solution: Add trace_id columns for post-mortem debugging

-- Add trace_id to deliveries
ALTER TABLE deliveries
ADD COLUMN IF NOT EXISTS trace_id TEXT;

-- Add trace_id to lead_events
ALTER TABLE lead_events
ADD COLUMN IF NOT EXISTS trace_id TEXT;

-- Add trace_id to messages
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS trace_id TEXT;

-- Index for trace lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_trace_id 
ON deliveries(trace_id) 
WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_events_trace_id 
ON lead_events(trace_id) 
WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_trace_id 
ON messages(trace_id) 
WHERE trace_id IS NOT NULL;

COMMENT ON COLUMN deliveries.trace_id IS 'Request trace ID for debugging and audit trail';
COMMENT ON COLUMN lead_events.trace_id IS 'Request trace ID for debugging and audit trail';
COMMENT ON COLUMN messages.trace_id IS 'Request trace ID for debugging and audit trail';


-- ============================================
-- P2 FIX: Add DEAD_LETTER to delivery_status enum if missing
-- ============================================
DO $$
BEGIN
    -- Check if DEAD_LETTER exists in enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'DEAD_LETTER' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        ALTER TYPE delivery_status ADD VALUE 'DEAD_LETTER';
    END IF;
    
    -- Check if PARTIAL exists in enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PARTIAL' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        ALTER TYPE delivery_status ADD VALUE 'PARTIAL';
    END IF;
EXCEPTION WHEN others THEN
    -- Ignore if already exists
    NULL;
END $$;


-- ============================================
-- VERIFICATION QUERIES (for manual validation)
-- ============================================
-- Run these after migration to verify:
/*
-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'complete_delivery_and_consume_credit';
SELECT proname FROM pg_proc WHERE proname = 'upsert_lead_source';
SELECT proname FROM pg_proc WHERE proname = 'validate_lead_offer_status_transition';

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_lead_offers_validate_transition';

-- Check new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'deliveries' AND column_name = 'trace_id';
*/




