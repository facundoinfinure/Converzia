-- ============================================
-- Converzia: RAG Sources Approval Workflow
-- Migration: 030_rag_sources_approval
-- ============================================
-- This migration adds:
-- 1. Approval workflow for RAG sources (similar to offers)
-- 2. Functions to submit/approve/reject RAG sources
-- 3. Indexes for performance
-- ============================================

-- ============================================
-- 1. ADD APPROVAL FIELDS TO rag_sources
-- ============================================

ALTER TABLE rag_sources 
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Set existing sources as APPROVED (backward compatibility)
UPDATE rag_sources SET approval_status = 'APPROVED' WHERE approval_status IS NULL;

-- Approval status: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
COMMENT ON COLUMN rag_sources.approval_status IS 'DRAFT = tenant editing, PENDING_APPROVAL = waiting for Converzia, APPROVED = ready for processing, REJECTED = needs changes';

CREATE INDEX IF NOT EXISTS idx_rag_sources_approval_status ON rag_sources(approval_status);

-- ============================================
-- 2. FUNCTION TO SUBMIT RAG SOURCE FOR APPROVAL
-- ============================================

CREATE OR REPLACE FUNCTION submit_rag_source_for_approval(p_source_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_source rag_sources%ROWTYPE;
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get the source
  SELECT * INTO v_source FROM rag_sources WHERE id = p_source_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'RAG source not found');
  END IF;
  
  -- Check if user has access to this tenant
  SELECT tm.tenant_id INTO v_tenant_id
  FROM tenant_members tm
  WHERE tm.user_id = v_user_id 
    AND tm.tenant_id = v_source.tenant_id
    AND tm.status = 'ACTIVE'
    AND tm.role IN ('OWNER', 'ADMIN');
    
  IF v_tenant_id IS NULL THEN
    -- Check if Converzia admin
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id AND is_converzia_admin = TRUE) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;
  
  -- Check current status
  IF v_source.approval_status NOT IN ('DRAFT', 'REJECTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'RAG source cannot be submitted in current state');
  END IF;
  
  -- Update to pending approval
  UPDATE rag_sources 
  SET 
    approval_status = 'PENDING_APPROVAL',
    submitted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_source_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'RAG source submitted for approval');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. FUNCTION TO APPROVE RAG SOURCE (Admin only)
-- ============================================

CREATE OR REPLACE FUNCTION approve_rag_source(p_source_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if Converzia admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id AND is_converzia_admin = TRUE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Converzia admins can approve RAG sources');
  END IF;
  
  -- Update to approved
  UPDATE rag_sources 
  SET 
    approval_status = 'APPROVED',
    approved_at = NOW(),
    approved_by = v_user_id,
    rejection_reason = NULL,
    updated_at = NOW()
  WHERE id = p_source_id AND approval_status = 'PENDING_APPROVAL';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'RAG source not found or not pending approval');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'RAG source approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. FUNCTION TO REJECT RAG SOURCE (Admin only)
-- ============================================

CREATE OR REPLACE FUNCTION reject_rag_source(p_source_id UUID, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if Converzia admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id AND is_converzia_admin = TRUE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Converzia admins can reject RAG sources');
  END IF;
  
  -- Update to rejected
  UPDATE rag_sources 
  SET 
    approval_status = 'REJECTED',
    rejection_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_source_id AND approval_status = 'PENDING_APPROVAL';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'RAG source not found or not pending approval');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'RAG source rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION submit_rag_source_for_approval(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_rag_source(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_rag_source(UUID, TEXT) TO authenticated;
