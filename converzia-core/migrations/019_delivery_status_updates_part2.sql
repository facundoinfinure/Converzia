-- ============================================
-- Migration 019 Part 2: Tables, Functions, Views
-- ============================================
-- Run this AFTER Part 1 has been committed

-- 2. Add columns to deliveries table for better tracking
ALTER TABLE deliveries
ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT,
ADD COLUMN IF NOT EXISTS integrations_attempted JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS integrations_succeeded JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS integrations_failed JSONB DEFAULT '[]'::jsonb;

-- 3. Add unique constraint on credit_ledger for idempotency
-- This prevents double-charging for the same delivery
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_delivery_consumption
ON credit_ledger(delivery_id)
WHERE transaction_type = 'CREDIT_CONSUMPTION' AND delivery_id IS NOT NULL;

-- 4. Add message delivery tracking columns
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS chatwoot_message_id TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Index for Chatwoot message ID lookups
CREATE INDEX IF NOT EXISTS idx_messages_chatwoot_id
ON messages(chatwoot_message_id)
WHERE chatwoot_message_id IS NOT NULL;

-- 5. Add summary column to conversations for rolling summary
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS summary TEXT;

-- 6. Create system_metrics table for metrics storage
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('counter', 'gauge', 'histogram')),
    value NUMERIC NOT NULL,
    labels JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by time for efficient querying and cleanup
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp
ON system_metrics(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp
ON system_metrics(name, timestamp DESC);

-- 7. Add function to move delivery to dead letter
CREATE OR REPLACE FUNCTION move_to_dead_letter(
    p_delivery_id UUID,
    p_reason TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE deliveries
    SET 
        status = 'DEAD_LETTER',
        dead_letter_at = NOW(),
        dead_letter_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_delivery_id
    AND status != 'DEAD_LETTER';
    
    -- Log the event
    INSERT INTO lead_events (
        lead_id,
        lead_offer_id,
        event_type,
        details,
        actor_type
    )
    SELECT 
        lead_id,
        lead_offer_id,
        'DELIVERY_DEAD_LETTER',
        jsonb_build_object(
            'delivery_id', p_delivery_id,
            'reason', p_reason
        ),
        'SYSTEM'
    FROM deliveries
    WHERE id = p_delivery_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Add trigger to prevent modifying dead letter deliveries
CREATE OR REPLACE FUNCTION prevent_dead_letter_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'DEAD_LETTER' AND NEW.status != 'REFUNDED' THEN
        RAISE EXCEPTION 'Cannot modify dead letter delivery unless refunding';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_dead_letter_modification_trigger ON deliveries;
CREATE TRIGGER prevent_dead_letter_modification_trigger
    BEFORE UPDATE ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_dead_letter_modification();

-- 9. Create view for monitoring dead letter queue
CREATE OR REPLACE VIEW dead_letter_queue AS
SELECT 
    d.id,
    d.tenant_id,
    d.lead_id,
    d.lead_offer_id,
    d.dead_letter_at,
    d.dead_letter_reason,
    d.retry_count,
    d.error_message,
    d.integrations_failed,
    t.name as tenant_name,
    l.phone as lead_phone,
    o.name as offer_name
FROM deliveries d
LEFT JOIN tenants t ON t.id = d.tenant_id
LEFT JOIN leads l ON l.id = d.lead_id
LEFT JOIN offers o ON o.id = d.offer_id
WHERE d.status = 'DEAD_LETTER'
ORDER BY d.dead_letter_at DESC;

-- 10. Grant permissions
GRANT SELECT ON dead_letter_queue TO authenticated;
GRANT SELECT, INSERT ON system_metrics TO service_role;

COMMENT ON TABLE system_metrics IS 'Time-series metrics storage for observability';
COMMENT ON VIEW dead_letter_queue IS 'View of all deliveries in dead letter status for investigation';







