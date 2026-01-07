import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { searchKnowledge } from "@/lib/services/rag";
import { extractQualificationFields, generateQualificationResponse, buildQualificationSystemPrompt } from "@/lib/services/openai";
import { calculateLeadScore } from "@/lib/services/scoring";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { Offer, QualificationFields } from "@/types";
import { isAdminProfile } from "@/types/supabase-helpers";
import type { Tenant } from "@/types/database";
import { validateBody, testingConversationBodySchema } from "@/lib/validation/schemas";

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
      return handleUnauthorized("Debes iniciar sesión para probar conversaciones");
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

    if (!isAdminProfile(profile as { is_converzia_admin?: boolean } | null)) {
      return handleForbidden("Solo administradores pueden probar conversaciones");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, testingConversationBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { tenant_id, offer_id, message, conversation_history } = bodyValidation.data;

    const adminSupabase = createAdminClient();
    interface TestResult {
      response: string | null;
      rag_chunks: Array<{ content: string; similarity: number; document_id: string }>;
      system_prompt: string | null;
      extracted_fields: Partial<QualificationFields>;
      score: { total: number; breakdown: Record<string, number> } | null;
      errors: string[];
    }
    
    const result: TestResult = {
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
      ) as { data: Tenant | null; error: unknown };

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
        ) as { data: Offer | null; error: unknown };
        offer = offerData;
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
          // Convert ScoreBreakdown to Record<string, number> by filtering undefined values
          const breakdown: Record<string, number> = {};
          for (const [key, value] of Object.entries(scoreResult.breakdown)) {
            if (value !== undefined) {
              breakdown[key] = value;
            }
          }
          
          result.score = {
            total: scoreResult.score,
            breakdown,
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
          .map((c) => c.content)
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

      return apiSuccess(result);
    } catch (error) {
      return handleApiError(error, {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "Error en el test de conversación",
        context: { tenant_id, offer_id },
      });
    }
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al procesar la solicitud de testing de conversación",
      context: { operation: "conversation_testing" },
    });
  }
}

