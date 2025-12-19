import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { searchKnowledge } from "@/lib/services/rag";
import { getOpenAI, getModel } from "@/lib/services/openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, offer_type, name } = body;

    if (!tenant_id || !offer_type || !name) {
      return NextResponse.json(
        { error: "tenant_id, offer_type y name son requeridos" },
        { status: 400 }
      );
    }

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
    const generatedData = JSON.parse(content);

    // Validar y limpiar los datos
    const result: any = {
      name: generatedData.name || name,
      short_description: generatedData.short_description || null,
      description: generatedData.description || null,
      city: generatedData.city || null,
      zone: generatedData.zone || null,
      address: generatedData.address || null,
      price_from: generatedData.price_from ? Number(generatedData.price_from) : null,
      price_to: generatedData.price_to ? Number(generatedData.price_to) : null,
      currency: generatedData.currency || null,
      rag_sources_used: ragResults.length,
      rag_references: ragResults.map((r, i) => ({
        index: i + 1,
        doc_type: r.metadata?.doc_type || "unknown",
        source: r.metadata?.source || "unknown",
        similarity: r.similarity,
      })),
    };

    return NextResponse.json(
      { success: true, data: result },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error generating offer with AI:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al generar la oferta con AI" },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}


