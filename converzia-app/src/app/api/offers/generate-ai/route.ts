import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { searchKnowledge } from "@/lib/services/rag";
import { getOpenAI, getModel } from "@/lib/services/openai";
import { z } from "zod";
import { logger, sanitizeForLogging } from "@/lib/utils/logger";
import { handleApiError, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";

const generateOfferSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant_id format'),
  offer_type: z.enum(['PROPERTY', 'AUTO', 'LOAN', 'INSURANCE']),
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  city: z.string().max(100).optional(),
  zone: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = generateOfferSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      logger.warn('Invalid offer generation request', {
        error: `${firstError.path.join('.')}: ${firstError.message}`,
        body: sanitizeForLogging(body),
      });
      return handleValidationError(`${firstError.path.join('.')}: ${firstError.message}`);
    }

    const { tenant_id, offer_type, name } = validation.data;

    const supabase = createAdminClient();

    // Buscar información relevante del RAG para este tenant
    const query = `Información sobre ${name}, tipo de oferta ${offer_type}`;
    const ragResults = await searchKnowledge(query, tenant_id, undefined, 10);

    // Construir contexto del RAG
    let ragContext = "";
    if (ragResults.length > 0) {
      ragContext = ragResults
        .map((r, i) => {
          const docType = r.metadata?.doc_type || "documento";
          const source = r.metadata?.source || "fuente desconocida";
          return `[${i + 1}] ${docType} (${source}):\n${r.content}\n---`;
        })
        .join("\n\n");
    }

    // Prompt para generar la oferta
    const systemPrompt = `Sos un asistente experto en crear descripciones de ofertas inmobiliarias, automotrices, de préstamos o seguros.

IMPORTANTE: 
- SOLO usá información que esté explícitamente mencionada en el contexto del RAG proporcionado.
- NO inventes datos, precios, ubicaciones, características o cualquier información.
- Si no hay información suficiente en el RAG, indicá que faltan datos en lugar de inventar.
- Para cada dato que uses, mencioná la referencia específica del RAG (número entre corchetes).

Generá una descripción de oferta en formato JSON con los siguientes campos:
{
  "name": "nombre de la oferta (usar exactamente el nombre proporcionado: ${name})",
  "short_description": "descripción corta de máximo 150 caracteres basada SOLO en el RAG",
  "description": "descripción completa y detallada basada SOLO en el RAG. Incluí referencias [1], [2], etc. cuando menciones información específica",
  "city": "ciudad si está mencionada en el RAG, sino null",
  "zone": "zona/barrio si está mencionada en el RAG, sino null",
  "address": "dirección si está mencionada en el RAG, sino null",
  "price_from": "precio mínimo si está mencionado en el RAG (solo número, sin símbolos), sino null",
  "price_to": "precio máximo si está mencionado en el RAG (solo número, sin símbolos), sino null",
  "currency": "moneda si está mencionada (USD o ARS), sino null"
}

${ragContext ? `\n\nCONTEXTO DEL RAG:\n${ragContext}` : "\n\nADVERTENCIA: No se encontró información en el RAG. Generá solo campos básicos sin inventar datos."}`;

    const userPrompt = `Generá la descripción de la oferta "${name}" de tipo "${offer_type}" basándote ÚNICAMENTE en la información del RAG proporcionada.`;

    const openai = await getOpenAI();
    const model = await getModel("response");

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const generatedData = JSON.parse(content) as Record<string, unknown>;

    // Validar y limpiar los datos
    interface GeneratedOfferData {
      name: string;
      short_description?: string | null;
      description?: string | null;
      city?: string | null;
      zone?: string | null;
      address?: string | null;
      price_from?: number | string | null;
      price_to?: number | string | null;
      currency?: string | null;
    }

    const typedData = generatedData as Partial<GeneratedOfferData>;

    interface OfferGenerationResult {
      name: string;
      short_description: string | null;
      description: string | null;
      city: string | null;
      zone: string | null;
      address: string | null;
      price_from: number | null;
      price_to: number | null;
      currency: string | null;
      rag_sources_used: number;
      rag_references: Array<{
        index: number;
        doc_type: string;
        source: string;
        similarity: number;
      }>;
    }

    const result: OfferGenerationResult = {
      name: typedData.name || name,
      short_description: typedData.short_description || null,
      description: typedData.description || null,
      city: typedData.city || null,
      zone: typedData.zone || null,
      address: typedData.address || null,
      price_from: typedData.price_from ? Number(typedData.price_from) : null,
      price_to: typedData.price_to ? Number(typedData.price_to) : null,
      currency: typedData.currency || null,
      rag_sources_used: ragResults.length,
      rag_references: ragResults.map((r, i) => ({
        index: i + 1,
        doc_type: (r.metadata?.doc_type as string) || "unknown",
        source: (r.metadata?.source as string) || "unknown",
        similarity: r.similarity,
      })),
    };

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "POST /api/offers/generate-ai" },
    });
  }
}













