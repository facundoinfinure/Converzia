-- ============================================
-- Converzia: GDPR Data Deletion Functions
-- Migration: 018_gdpr_functions
-- ============================================

-- ============================================
-- FUNCTION: Delete Lead PII (GDPR Right to Erasure)
-- Anonymizes lead data while preserving audit trail
-- ============================================
CREATE OR REPLACE FUNCTION delete_lead_pii(
  p_lead_id UUID,
  p_reason TEXT,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lead_exists BOOLEAN;
  v_deleted_phone TEXT;
BEGIN
  -- Check if lead exists
  SELECT EXISTS(SELECT 1 FROM leads WHERE id = p_lead_id) INTO v_lead_exists;
  
  IF NOT v_lead_exists THEN
    RAISE EXCEPTION 'Lead not found: %', p_lead_id;
  END IF;
  
  -- Generate anonymized phone (unique identifier preserved for referential integrity)
  v_deleted_phone := 'DELETED_' || p_lead_id::TEXT;
  
  -- Anonymize lead PII
  UPDATE leads SET
    phone = v_deleted_phone,
    phone_normalized = REPLACE(v_deleted_phone, 'DELETED_', ''),
    email = NULL,
    first_name = NULL,
    last_name = NULL,
    full_name = '[ELIMINADO]',
    opted_out = TRUE,
    opted_out_at = NOW(),
    opt_out_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_lead_id;
  
  -- Remove sensitive form_data from lead_sources
  UPDATE lead_sources SET
    form_data = jsonb_build_object(
      'deleted', TRUE,
      'deleted_at', NOW()::TEXT,
      'deletion_reason', p_reason
    )
  WHERE lead_id = p_lead_id;
  
  -- Clear qualification_fields sensitive data from lead_offers
  UPDATE lead_offers SET
    qualification_fields = jsonb_build_object(
      'deleted', TRUE,
      'name', '[ELIMINADO]'
    ),
    updated_at = NOW()
  WHERE lead_id = p_lead_id;
  
  -- Clear message content (preserve structure for audit)
  UPDATE messages SET
    content = '[CONTENIDO ELIMINADO POR GDPR]',
    media_url = NULL
  WHERE lead_id = p_lead_id;
  
  -- Clear conversation summary
  UPDATE conversations SET
    summary = '[RESUMEN ELIMINADO POR GDPR]',
    updated_at = NOW()
  WHERE lead_id = p_lead_id;
  
  -- Clear delivery payload PII
  UPDATE deliveries SET
    payload = jsonb_set(
      jsonb_set(
        payload,
        '{lead}',
        jsonb_build_object('name', '[ELIMINADO]', 'phone', '[ELIMINADO]', 'email', NULL)
      ),
      '{deleted}',
      'true'::jsonb
    )
  WHERE lead_id = p_lead_id;
  
  -- Log the deletion event
  INSERT INTO lead_events (
    lead_id,
    tenant_id,
    event_type,
    details,
    actor_type,
    actor_id
  )
  SELECT 
    p_lead_id,
    lo.tenant_id,
    'PII_DELETED',
    jsonb_build_object(
      'reason', p_reason,
      'deleted_at', NOW(),
      'deleted_by', p_deleted_by,
      'gdpr_compliant', TRUE
    ),
    CASE WHEN p_deleted_by IS NOT NULL THEN 'ADMIN' ELSE 'SYSTEM' END,
    p_deleted_by
  FROM lead_offers lo
  WHERE lo.lead_id = p_lead_id
  LIMIT 1;
  
  -- If no lead_offer found, still log the event
  IF NOT FOUND THEN
    INSERT INTO lead_events (
      lead_id,
      event_type,
      details,
      actor_type,
      actor_id
    ) VALUES (
      p_lead_id,
      'PII_DELETED',
      jsonb_build_object(
        'reason', p_reason,
        'deleted_at', NOW(),
        'deleted_by', p_deleted_by,
        'gdpr_compliant', TRUE
      ),
      CASE WHEN p_deleted_by IS NOT NULL THEN 'ADMIN' ELSE 'SYSTEM' END,
      p_deleted_by
    );
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Bulk delete leads older than retention period
-- For automated GDPR compliance
-- ============================================
CREATE OR REPLACE FUNCTION delete_leads_by_retention(
  p_retention_days INTEGER DEFAULT 730, -- 2 years default
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  deleted_count INTEGER,
  lead_ids UUID[]
) AS $$
DECLARE
  v_lead_ids UUID[];
  v_deleted_count INTEGER := 0;
  v_lead_id UUID;
BEGIN
  -- Find leads older than retention period that haven't been converted
  SELECT ARRAY_AGG(l.id)
  INTO v_lead_ids
  FROM leads l
  WHERE l.created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    AND l.opted_out = FALSE -- Not already deleted
    AND NOT EXISTS (
      -- Exclude leads with successful conversions
      SELECT 1 FROM deliveries d
      WHERE d.lead_id = l.id AND d.status = 'DELIVERED'
    )
  LIMIT p_limit;
  
  IF v_lead_ids IS NOT NULL THEN
    FOREACH v_lead_id IN ARRAY v_lead_ids
    LOOP
      PERFORM delete_lead_pii(
        v_lead_id,
        'Automatic retention policy deletion after ' || p_retention_days || ' days',
        NULL
      );
      v_deleted_count := v_deleted_count + 1;
    END LOOP;
  END IF;
  
  RETURN QUERY SELECT v_deleted_count, v_lead_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Export lead data (GDPR Right to Access)
-- ============================================
CREATE OR REPLACE FUNCTION export_lead_data(p_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'lead', (
      SELECT row_to_json(l.*)::jsonb
      FROM leads l WHERE l.id = p_lead_id
    ),
    'lead_offers', (
      SELECT COALESCE(jsonb_agg(row_to_json(lo.*)), '[]'::jsonb)
      FROM lead_offers lo WHERE lo.lead_id = p_lead_id
    ),
    'lead_sources', (
      SELECT COALESCE(jsonb_agg(row_to_json(ls.*)), '[]'::jsonb)
      FROM lead_sources ls WHERE ls.lead_id = p_lead_id
    ),
    'conversations', (
      SELECT COALESCE(jsonb_agg(row_to_json(c.*)), '[]'::jsonb)
      FROM conversations c WHERE c.lead_id = p_lead_id
    ),
    'messages', (
      SELECT COALESCE(jsonb_agg(row_to_json(m.*)), '[]'::jsonb)
      FROM messages m WHERE m.lead_id = p_lead_id
    ),
    'events', (
      SELECT COALESCE(jsonb_agg(row_to_json(e.*)), '[]'::jsonb)
      FROM lead_events e WHERE e.lead_id = p_lead_id
    ),
    'exported_at', NOW()
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Grant execute to authenticated users
-- (RLS will further restrict access)
-- ============================================
GRANT EXECUTE ON FUNCTION delete_lead_pii TO authenticated;
GRANT EXECUTE ON FUNCTION export_lead_data TO authenticated;
-- Bulk delete only for service role
GRANT EXECUTE ON FUNCTION delete_leads_by_retention TO service_role;

