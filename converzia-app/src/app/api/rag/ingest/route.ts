import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestFromUrl, ingestManualContent, ingestDocument } from "@/lib/services/rag";

// ============================================
// RAG Ingest API
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated and is Converzia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_converzia_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_converzia_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { source_id, source_type, tenant_id, offer_id, content, title, url, doc_type } = body;

    let result;

    if (source_id) {
      // Ingest into existing source
      if (source_type === "URL" && url) {
        result = await ingestFromUrl(source_id, url);
      } else if (content) {
        result = await ingestDocument(source_id, content, {
          title: title || "Untitled",
          url,
          doc_type: doc_type || "MANUAL",
        });
      } else {
        return NextResponse.json({ error: "Content or URL required" }, { status: 400 });
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

