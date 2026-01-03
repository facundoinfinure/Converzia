import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { searchKnowledge } from "@/lib/services/rag";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

// ============================================
// Testing RAG API
// Allows admins to test RAG search
// ============================================

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin access
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile for RAG testing"
    );

    if (!(profile as any)?.is_converzia_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { tenant_id, offer_id, query } = body;

    if (!tenant_id || !query) {
      return NextResponse.json(
        { error: "tenant_id and query are required" },
        { status: 400 }
      );
    }

    try {
      const chunks = await searchKnowledge(
        query,
        tenant_id,
        offer_id || undefined,
        10 // Get more results for testing
      );

      return NextResponse.json({
        chunks: chunks.map((c) => ({
          content: c.content,
          similarity: c.similarity,
          document_id: c.document_id,
          chunk_id: c.chunk_id,
          metadata: c.metadata,
        })),
        query,
        tenant_id,
        offer_id: offer_id || null,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          chunks: [],
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

