-- ============================================
-- Converzia: Storage RLS Policies
-- Migration: 022_storage_rls_policies
-- ============================================
-- 
-- This migration creates RLS policies for the rag-documents storage bucket.
-- These policies allow Converzia admins to upload, read, and delete files.
--
-- NOTE: This migration needs to be run in Supabase directly or via the 
-- Supabase dashboard because storage.objects policies require special handling.
-- ============================================

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Drop existing policies if they exist (for idempotency)
-- ============================================
DROP POLICY IF EXISTS "rag_documents_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "rag_documents_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "rag_documents_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "rag_documents_delete_admin" ON storage.objects;

-- ============================================
-- RAG Documents Bucket Policies
-- ============================================

-- Policy: Allow Converzia admins to insert (upload) files to rag-documents bucket
CREATE POLICY "rag_documents_insert_admin" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'rag-documents' 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND is_converzia_admin = TRUE
    )
  );

-- Policy: Allow Converzia admins to select (read/download) files from rag-documents bucket
CREATE POLICY "rag_documents_select_admin" ON storage.objects
  FOR SELECT 
  USING (
    bucket_id = 'rag-documents' 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND is_converzia_admin = TRUE
    )
  );

-- Policy: Allow Converzia admins to update files in rag-documents bucket
CREATE POLICY "rag_documents_update_admin" ON storage.objects
  FOR UPDATE 
  USING (
    bucket_id = 'rag-documents' 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND is_converzia_admin = TRUE
    )
  );

-- Policy: Allow Converzia admins to delete files from rag-documents bucket
CREATE POLICY "rag_documents_delete_admin" ON storage.objects
  FOR DELETE 
  USING (
    bucket_id = 'rag-documents' 
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND is_converzia_admin = TRUE
    )
  );

-- ============================================
-- Alternative: Allow tenant members to access their own folders
-- (Uncomment if you want tenant users to manage their own RAG documents)
-- ============================================

-- -- Policy: Allow tenant members to insert files to their tenant folder
-- CREATE POLICY "rag_documents_insert_tenant" ON storage.objects
--   FOR INSERT 
--   WITH CHECK (
--     bucket_id = 'rag-documents' 
--     AND (storage.foldername(name))[1] IN (
--       SELECT tenant_id::text FROM tenant_members 
--       WHERE user_id = auth.uid() AND status = 'ACTIVE'
--     )
--   );

-- -- Policy: Allow tenant members to read files from their tenant folder  
-- CREATE POLICY "rag_documents_select_tenant" ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'rag-documents' 
--     AND (storage.foldername(name))[1] IN (
--       SELECT tenant_id::text FROM tenant_members 
--       WHERE user_id = auth.uid() AND status = 'ACTIVE'
--     )
--   );

