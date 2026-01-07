import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

// ============================================
// Supabase Storage Service
// ============================================

const RAG_BUCKET = "rag-documents";

/**
 * Ensures the RAG documents bucket exists.
 * Creates it if it doesn't exist.
 * Should be called at application startup or before first upload.
 */
export async function ensureRagBucketExists(): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      logger.error("Error listing buckets", listError);
      return { success: false, error: listError.message };
    }

    const bucketExists = buckets?.some((b: { name: string }) => b.name === RAG_BUCKET);

    if (!bucketExists) {
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket(RAG_BUCKET, {
        public: false, // Private bucket - files accessed via signed URLs
        fileSizeLimit: 52428800, // 50MB max file size
        allowedMimeTypes: ["application/pdf", "text/plain", "application/json"],
      });

      if (createError) {
        // Bucket might have been created by another request (race condition)
        if (createError.message?.includes("already exists")) {
          logger.info("Bucket already exists (race condition handled)", { bucket: RAG_BUCKET });
          return { success: true };
        }
        logger.error("Error creating bucket", createError, { bucket: RAG_BUCKET });
        return { success: false, error: createError.message };
      }

      logger.info(`Created storage bucket`, { bucket: RAG_BUCKET });
    }

    return { success: true };
  } catch (error) {
    logger.error("Error ensuring bucket exists", error, { bucket: RAG_BUCKET });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Creates a folder structure for a tenant.
 * In Supabase Storage, folders are created implicitly when uploading files,
 * so we create a placeholder file to establish the folder.
 */
export async function initializeTenantStorage(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // First ensure bucket exists
    const bucketResult = await ensureRagBucketExists();
    if (!bucketResult.success) {
      return bucketResult;
    }

    // Create a placeholder file to establish the tenant folder
    // This ensures the folder exists for future uploads
    const placeholderPath = `${tenantId}/.placeholder`;
    const placeholderContent = JSON.stringify({
      created_at: new Date().toISOString(),
      type: "tenant_folder",
      tenant_id: tenantId,
    });

    const { error: uploadError } = await supabase.storage
      .from(RAG_BUCKET)
      .upload(placeholderPath, placeholderContent, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError && !uploadError.message?.includes("already exists")) {
      logger.error("Error creating tenant folder", uploadError, { tenantId });
      return { success: false, error: uploadError.message };
    }

    logger.info(`Initialized storage for tenant`, { tenantId });
    return { success: true };
  } catch (error) {
    logger.error("Error initializing tenant storage", error, { tenantId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Creates a folder structure for an offer within a tenant.
 */
export async function initializeOfferStorage(
  tenantId: string,
  offerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // First ensure bucket exists
    const bucketResult = await ensureRagBucketExists();
    if (!bucketResult.success) {
      return bucketResult;
    }

    // Create a placeholder file to establish the offer folder
    const placeholderPath = `${tenantId}/${offerId}/.placeholder`;
    const placeholderContent = JSON.stringify({
      created_at: new Date().toISOString(),
      type: "offer_folder",
      tenant_id: tenantId,
      offer_id: offerId,
    });

    const { error: uploadError } = await supabase.storage
      .from(RAG_BUCKET)
      .upload(placeholderPath, placeholderContent, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError && !uploadError.message?.includes("already exists")) {
      logger.error("Error creating offer folder", uploadError, { tenantId, offerId });
      return { success: false, error: uploadError.message };
    }

    logger.info(`Initialized storage for offer`, { tenantId, offerId });
    return { success: true };
  } catch (error) {
    logger.error("Error initializing offer storage", error, { tenantId, offerId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Gets the storage path for a RAG document.
 * Structure: {tenant_id}/{offer_id?}/{source_id}/{filename}
 */
export function getRagStoragePath(
  tenantId: string,
  sourceId: string,
  filename: string,
  offerId?: string
): string {
  if (offerId) {
    return `${tenantId}/${offerId}/${sourceId}/${filename}`;
  }
  return `${tenantId}/${sourceId}/${filename}`;
}

/**
 * Deletes a single file from a storage bucket.
 * @param bucket - The bucket name
 * @param filePath - The path to the file (e.g., "tenant-id/logo.jpg")
 */
export async function deleteFile(
  bucket: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (deleteError) {
      logger.error("Error deleting file", deleteError, { bucket, filePath });
      return { success: false, error: deleteError.message };
    }

    logger.info("File deleted successfully", { bucket, filePath });
    return { success: true };
  } catch (error) {
    logger.error("Error deleting file", error, { bucket, filePath });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Deletes all files for a tenant.
 * Use with caution - this is destructive.
 */
export async function deleteTenantStorage(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // List all files in tenant folder
    const { data: files, error: listError } = await supabase.storage
      .from(RAG_BUCKET)
      .list(tenantId, { limit: 1000 });

    if (listError) {
      return { success: false, error: listError.message };
    }

    if (!files || files.length === 0) {
      return { success: true };
    }

    // Delete all files
    const filePaths = files.map((f) => `${tenantId}/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from(RAG_BUCKET)
      .remove(filePaths);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    logger.info(`Deleted storage for tenant`, { tenantId, fileCount: files.length });
    return { success: true };
  } catch (error) {
    logger.error("Error deleting tenant storage", error, { tenantId });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}








