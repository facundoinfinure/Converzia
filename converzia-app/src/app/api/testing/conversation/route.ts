import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { searchKnowledge } from "@/lib/services/rag";
import { extractQualificationFields, generateQualificationResponse, buildQualificationSystemPrompt } from "@/lib/services/openai";
import { calculateLeadScore } from "@/lib/services/scoring";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import type { Offer, QualificationFields } from "@/types";

// ============================================
// Testing Conversation API
// Allows admins to test conversation processing
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
      "get user profile for testing"
    );

    if (!(profile as any)?.is_converzia_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { tenant_id, offer_id, message, conversation_history } = body;

    if (!tenant_id || !message) {
      return NextResponse.json(
        { error: "tenant_id and message are required" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const result: any = {
      response: null,
      rag_chunks: [],
      system_prompt: null,
      extracted_fields: {},
      score: null,
      errors: [],
    };

    try {
      // Get tenant and offer info
      const { data: tenant } = await queryWithTimeout(
        adminSupabase
          .from("tenants")
          .select("id, name")
          .eq("id", tenant_id)
          .single(),
        10000,
        "get tenant for testing"
      );

      let offer: Offer | null = null;
      if (offer_id) {
        const { data: offerData } = await queryWithTimeout(
          adminSupabase
            .from("offers")
            .select("*")
            .eq("id", offer_id)
            .single(),
          10000,
          "get offer for testing"
        );
        offer = offerData as Offer;
      }

      // Search RAG
      try {
        const ragResults = await searchKnowledge(message, tenant_id, offer_id || undefined, 5);
        result.rag_chunks = ragResults.map((r) => ({
          content: r.content,
          similarity: r.similarity,
          document_id: r.document_id,
        }));
      } catch (error) {
        result.errors.push(`RAG search error: ${error instanceof Error ? error.message : "Unknown"}`);
      }

      // Extract qualification fields
      try {
        const extracted = await extractQualificationFields(message, {});
        result.extracted_fields = extracted;
      } catch (error) {
        result.errors.push(`Extraction error: ${error instanceof Error ? error.message : "Unknown"}`);
      }

      // Calculate score if we have enough fields
      try {
        if (Object.keys(result.extracted_fields).length > 0) {
          const scoreResult = await calculateLeadScore(
            result.extracted_fields as QualificationFields,
            offer as Offer | null,
            tenant_id,
            { messageCount: (conversation_history?.length || 0) + 1, responseTime: 30 }
          );
          result.score = {
            total: scoreResult.score,
            breakdown: scoreResult.breakdown,
          };
        }
      } catch (error) {
        result.errors.push(`Scoring error: ${error instanceof Error ? error.message : "Unknown"}`);
      }

      // Generate response
      try {
        // Note: generateQualificationResponse doesn't take ragContext directly
        // The RAG context should be included in the system prompt via buildQualificationSystemPrompt
        const response = await generateQualificationResponse(
          message,
          result.extracted_fields as QualificationFields,
          conversation_history || [],
          offer as Offer | null
        );

        result.response = response;
      } catch (error) {
        result.errors.push(`Response generation error: ${error instanceof Error ? error.message : "Unknown"}`);
      }

      // Get system prompt (with RAG context if available)
      try {
        const currentFields = result.extracted_fields as QualificationFields;
        const ragContext = result.rag_chunks
          .map((c: any) => c.content)
          .join("\n\n");
        
        // Build system prompt - we need to manually add RAG context
        let systemPrompt = await buildQualificationSystemPrompt({
          offer: offer as Offer | null,
          currentFields,
          missingFields: [], // For testing, we don't calculate missing fields
        });
        
        // Add RAG context if available
        if (ragContext) {
          systemPrompt += `\n\n## Contexto de Conocimiento (RAG)\n${ragContext}`;
        }
        
        result.system_prompt = systemPrompt;
      } catch (error) {
        result.errors.push(`System prompt error: ${error instanceof Error ? error.message : "Unknown"}`);
      }

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          errors: [error instanceof Error ? error.message : "Unknown error"],
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

