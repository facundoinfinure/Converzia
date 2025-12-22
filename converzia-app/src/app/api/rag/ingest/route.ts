import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { 
  ingestFromUrl, 
  ingestManualContent, 
  ingestDocument,
  ingestFromPdf 
} from "@/lib/services/rag";

// ============================================
// RAG Ingest API
// ============================================

// Increase body size limit for PDF uploads
// Vercel Pro allows up to 4.5MB for serverless, Vercel Enterprise allows 50MB
// For larger files, we'll return an error with instructions
export const maxDuration = 60;

// Configure route segment for larger body
export const dynamic = 'force-dynamic';

// This tells Next.js to accept larger request bodies
export const runtime = 'nodejs'; // Use Node.js runtime for better file handling

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated and is Converzia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile for RAG ingest"
    );

    if (!(profile as any)?.is_converzia_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Check if this is a multipart form (PDF upload) or JSON
    // Note: multipart/form-data includes boundary in the header
    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      // Handle PDF file upload
      return handlePdfUpload(request);
    }

    // Handle JSON body (existing flow)
    let body;
    try {
      body = await request.json();
    } catch (error) {
      // If JSON parsing fails, might be multipart without proper header
      // Try to handle as form data
      if (contentType.includes("form") || !contentType) {
        return handlePdfUpload(request);
      }
      throw error;
    }
    const { source_id, source_type, tenant_id, offer_id, content, title, url, doc_type, storage_path } = body;

    let result;

    if (source_id) {
      // Ingest into existing source
      if (source_type === "URL" && url) {
        result = await ingestFromUrl(source_id, url);
      } else if (source_type === "PDF" && storage_path) {
        // PDF already uploaded to Supabase Storage - download and process
        result = await handlePdfFromStorage(source_id, storage_path, title);
      } else if (content) {
        result = await ingestDocument(source_id, content, {
          title: title || "Untitled",
          url,
          doc_type: doc_type || "MANUAL",
        });
      } else {
        return NextResponse.json({ error: "Content, URL, or storage_path required" }, { status: 400 });
      }
    } else {
      // Create new source and ingest
      if (!tenant_id) {
        return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
      }

      result = await ingestManualContent(
        tenant_id,
        offer_id || null,
        content,
        title,
        doc_type || "FAQ"
      );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        sourceId: "sourceId" in result ? result.sourceId : undefined,
        chunkCount: "chunkCount" in result ? result.chunkCount : 0,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("RAG ingest error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ============================================
// PDF from Storage Handler (for large files uploaded directly by client)
// ============================================

async function handlePdfFromStorage(
  sourceId: string,
  storagePath: string,
  title?: string
): Promise<{ success: true; chunkCount: number } | { success: false; error: string }> {
  try {
    const supabase = createAdminClient();

    // Download PDF from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("rag-documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      return { 
        success: false, 
        error: `Error al descargar PDF: ${downloadError?.message || "No se encontró el archivo"}` 
      };
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the PDF
    const result = await ingestFromPdf(
      sourceId,
      buffer,
      title || "PDF Document"
    );

    // Update last_processed_at
    await supabase
      .from("rag_sources")
      .update({ last_processed_at: new Date().toISOString() })
      .eq("id", sourceId);

    return result;
  } catch (error) {
    console.error("PDF from storage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al procesar PDF desde storage",
    };
  }
}

// ============================================
// PDF Upload Handler (legacy - for small files via formData)
// ============================================

async function handlePdfUpload(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    
    const file = formData.get("file") as File | null;
    const tenantId = formData.get("tenant_id") as string | null;
    const offerId = formData.get("offer_id") as string | null;
    const title = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "tenant_id is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB for processing)
    // Vercel serverless limit is 4.5MB, but we try with larger files first
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `Archivo demasiado grande (máx ${Math.round(maxSize / 1024 / 1024)}MB). Intentá con un PDF más pequeño o dividilo en partes.` },
        { status: 413 }
      );
    }
    
    // Warning if file is large (might fail on Vercel free/hobby plans)
    if (file.size > 4 * 1024 * 1024) {
      console.warn(`Large file upload: ${(file.size / 1024 / 1024).toFixed(2)}MB - may fail on Vercel free plan`);
    }

    const supabase = createAdminClient();

    // Create RAG source record
    const { data: source, error: sourceError } = await queryWithTimeout(
      supabase
        .from("rag_sources")
        .insert({
          tenant_id: tenantId,
          offer_id: offerId || null,
          source_type: "PDF",
          name: title || file.name.replace(".pdf", ""),
          is_active: true,
        })
        .select()
        .single(),
      30000,
      "create RAG source for PDF"
    );

    if (sourceError || !source) {
      return NextResponse.json(
        { success: false, error: sourceError?.message || "Failed to create source" },
        { status: 500 }
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const sourceId = (source as any).id;
    const storagePath = `${tenantId}/${sourceId}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("rag-documents")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      // Clean up the source if upload fails
      await queryWithTimeout(
        supabase.from("rag_sources").delete().eq("id", sourceId),
        10000,
        "cleanup failed RAG source"
      );
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Update source with storage path
    await queryWithTimeout(
      supabase
        .from("rag_sources")
        .update({ storage_path: storagePath })
        .eq("id", sourceId),
      10000,
      "update RAG source storage path"
    );

    // Ingest the PDF content
    const result = await ingestFromPdf(
      sourceId,
      buffer,
      title || file.name.replace(".pdf", "")
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        sourceId: sourceId,
        chunkCount: result.chunkCount,
      });
    } else {
      return NextResponse.json({
        success: false,
        sourceId: sourceId,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("PDF upload error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

