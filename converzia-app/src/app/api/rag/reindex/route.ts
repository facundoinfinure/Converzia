import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { reindexSource, ingestFromUrl, ingestManualContent } from "@/lib/services/rag";

// ============================================
// RAG Reindex API
// ============================================

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
      "get user profile for RAG reindex"
    );

    if (!(profile as any)?.is_converzia_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { source_id } = body;

    if (!source_id) {
      return NextResponse.json({ error: "source_id is required" }, { status: 400 });
    }

    // Reindex the source
    const result = await reindexSource(source_id);

    if (result.success) {
      return NextResponse.json({
        success: true,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("RAG reindex error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

