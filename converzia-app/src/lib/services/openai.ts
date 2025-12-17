import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/server";
import type { QualificationFields, Offer, ScoreBreakdown } from "@/types";
import { readFile } from "node:fs/promises";
import path from "node:path";

// ============================================
// OpenAI Service
// ============================================

let cachedQualificationSystemPromptTemplate: string | null = null;
let cachedQualificationSystemPromptTemplateAt = 0;
const QUALIFICATION_PROMPT_CACHE_TTL_MS = 5 * 60 * 1000;

async function getQualificationPromptTemplate(): Promise<string> {
  const now = Date.now();
  if (
    cachedQualificationSystemPromptTemplate &&
    now - cachedQualificationSystemPromptTemplateAt < QUALIFICATION_PROMPT_CACHE_TTL_MS
  ) {
    return cachedQualificationSystemPromptTemplate;
  }

  // 1) Converzia Admin-configurable prompt (stored in app_settings)
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "qualification_system_prompt_md")
      .single();

    const fromDb = (data as any)?.value;
    if (typeof fromDb === "string" && fromDb.trim().length > 0) {
      cachedQualificationSystemPromptTemplate = fromDb;
      cachedQualificationSystemPromptTemplateAt = now;
      return fromDb;
    }
  } catch {
    // ignore and fallback to file
  }

  // 2) Fallback prompt bundled with the app
  const promptPath = path.join(process.cwd(), "prompts", "qualification_system_prompt.md");
  const template = await readFile(promptPath, "utf-8");

  cachedQualificationSystemPromptTemplate = template;
  cachedQualificationSystemPromptTemplateAt = now;

  return template;
}

function interpolatePrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "";
  });
}

const tenantNameCache = new Map<string, { value: string; at: number }>();
const TENANT_NAME_CACHE_TTL_MS = 10 * 60 * 1000;

async function getTenantName(tenantId: string): Promise<string> {
  const now = Date.now();
  const cached = tenantNameCache.get(tenantId);
  if (cached && now - cached.at < TENANT_NAME_CACHE_TTL_MS) return cached.value;

  const supabase = createAdminClient();
  const { data } = await supabase.from("tenants").select("name").eq("id", tenantId).single();
  const name = data?.name || "la desarrolladora";

  tenantNameCache.set(tenantId, { value: name, at: now });
  return name;
}

async function buildQualificationSystemPrompt(params: {
  offer: Offer | null;
  currentFields: QualificationFields;
  missingFields: string[];
}): Promise<string> {
  const template = await getQualificationPromptTemplate();
  const tenantName = params.offer?.tenant_id ? await getTenantName(params.offer.tenant_id) : "la desarrolladora";

  const offerName = params.offer?.name || "";
  const leadName = params.currentFields.name || "";
  const qualificationFieldsJson = JSON.stringify(params.currentFields, null, 2);

  const base = interpolatePrompt(template, {
    tenant_name: tenantName,
    offer_name: offerName,
    lead_name: leadName,
    qualification_fields: qualificationFieldsJson,
    variants: "",
    rag_context: "",
  });

  const contextBlock = [
    "",
    "## Runtime Context (internal)",
    params.offer
      ? `Oferta actual: ${params.offer.name}\nUbicación: ${params.offer.city || ""} ${params.offer.zone || ""}\nPrecio: ${
          params.offer.price_from ? `Desde USD ${params.offer.price_from}` : "A consultar"
        }`
      : "",
    "",
    "Información recopilada del cliente:",
    qualificationFieldsJson,
    "",
    `Información faltante: ${params.missingFields.join(", ") || "Ninguna - el lead está calificado"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `${base}\n${contextBlock}`.trim();
}

async function getOpenAI(): Promise<OpenAI> {
  const supabase = createAdminClient();

  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "openai_api_key")
    .single();

  const apiKey = setting?.value || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  return new OpenAI({ apiKey });
}

async function getModel(type: "extraction" | "response" | "embedding"): Promise<string> {
  const supabase = createAdminClient();

  const keyMap = {
    extraction: "openai_model_extraction",
    response: "openai_model_response",
    embedding: "openai_model_embedding",
  };

  const defaultMap = {
    extraction: "gpt-4o-mini",
    response: "gpt-4o",
    embedding: "text-embedding-ada-002",
  };

  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", keyMap[type])
    .single();

  return setting?.value || defaultMap[type];
}

// ============================================
// Extract Qualification Fields
// ============================================

export async function extractQualificationFields(
  message: string,
  currentFields: QualificationFields
): Promise<Partial<QualificationFields>> {
  const openai = await getOpenAI();
  const model = await getModel("extraction");

  const systemPrompt = `Sos un asistente que extrae información de calificación de mensajes de clientes interesados en inmuebles.

Extraé los siguientes campos si se mencionan:

### Identidad
- name: nombre del cliente
- email: correo electrónico
- dni: DNI (solo si el usuario lo comparte Y acepta que lo usemos para financiación)

### Búsqueda principal
- budget: presupuesto { min?: number, max?: number, currency?: string } en USD salvo que indique otra moneda
- zone: zonas de interés (lista de strings)
- bedrooms: cantidad de ambientes (número entero)
- bathrooms: cantidad de baños
- property_type: tipo de propiedad (departamento, casa, ph, etc)
- timing: urgencia o timing (inmediato, 3 meses, 6 meses, 1 año, no definido)
- purpose: propósito (vivienda, inversion, ambos)

### Preferencias finas
- garage: boolean
- garage_spaces: número
- amenities: lista de strings (pileta, gym, sum, rooftop, seguridad 24hs, etc.)
- floor_preference: string (bajo, medio, alto, indistinto)
- orientation: string (frente, contrafrente, lateral, indistinto)
- balcony: boolean
- terrace: boolean
- pets_allowed: boolean
- m2_min: metros cuadrados mínimos
- m2_max: metros cuadrados máximos

### Financiación
- financing: boolean (si necesita financiamiento)
- financing_type: string (credito_hipotecario, desarrollador, pozo)
- pre_approved: boolean (si ya tiene pre-aprobación bancaria)

### Perfil inversor
- is_investor: boolean

### Consentimiento (importante)
- credit_bureau_consent: true solo si el usuario EXPLÍCITAMENTE acepta que consultemos su historial crediticio o comparte su DNI para ese fin.
- credit_bureau_consent_at: timestamp ISO si credit_bureau_consent es true (usar "${new Date().toISOString()}")

Campos ya recopilados:
${JSON.stringify(currentFields, null, 2)}

Reglas:
1. Respondé SOLO con JSON.
2. Si no hay información nueva, respondé {}.
3. No inventes datos. Solo extraé lo que el usuario menciona.
4. Para budget, convertí montos en pesos a USD si es posible usando 1 USD ~ 1200 ARS (aproximado).
5. Si el usuario menciona "cochera" o "garage" poné garage: true.
6. Si el usuario dice que no quiere algo, NO lo pongas como false salvo que sea claro (ej: "no necesito cochera" → garage: false).
7. credit_bureau_consent SOLO se pone en true con aceptación explícita. Si el usuario simplemente da su DNI sin contexto de crédito, no pongas consent.

Respondé SOLO con JSON válido.`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error("Error extracting fields:", error);
    return {};
  }
}

// ============================================
// Generate Qualification Response
// ============================================

export async function generateQualificationResponse(
  userMessage: string,
  currentFields: QualificationFields,
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>,
  offer: Offer | null
): Promise<string> {
  const openai = await getOpenAI();
  const model = await getModel("response");

  const missingFields = getMissingFields(currentFields);

  const systemPrompt = await buildQualificationSystemPrompt({
    offer,
    currentFields,
    missingFields,
  });

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messageHistory.slice(-6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || "Gracias por tu mensaje. ¿En qué puedo ayudarte?";
  } catch (error) {
    console.error("Error generating response:", error);
    return "Gracias por tu mensaje. Un asesor te contactará pronto.";
  }
}

// ============================================
// Calculate Lead Score
// ============================================

export async function calculateScore(
  fields: QualificationFields,
  offer?: Offer
): Promise<{ score: number; breakdown: ScoreBreakdown }> {
  const breakdown: ScoreBreakdown = {};
  let totalScore = 0;

  // Budget score (0-25 points)
  if (fields.budget?.min || fields.budget?.max) {
    const budgetScore = 25;
    if (offer?.price_from && fields.budget.min && fields.budget.min < offer.price_from * 0.5) {
      // Budget too low
      breakdown.budget = Math.round(budgetScore * 0.3);
    } else {
      breakdown.budget = budgetScore;
    }
    totalScore += breakdown.budget;
  }

  // Zone score (0-25 points)
  if (fields.zone && fields.zone.length > 0) {
    breakdown.zone = 25;
    totalScore += breakdown.zone;
  }

  // Timing score (0-25 points)
  if (fields.timing) {
    const timingScores: Record<string, number> = {
      inmediato: 25,
      immediate: 25,
      "1_mes": 25,
      "3_meses": 20,
      "6_meses": 15,
      "1_year": 10,
      no_definido: 5,
    };
    breakdown.timing = timingScores[fields.timing.toLowerCase()] || 15;
    totalScore += breakdown.timing;
  }

  // Completeness score (0-25 points)
  const completenessFields = [
    !!fields.name,
    !!(fields.budget?.min || fields.budget?.max),
    !!(fields.zone && fields.zone.length > 0),
    !!fields.timing,
    !!fields.bedrooms,
    !!fields.property_type,
  ];
  const filledCount = completenessFields.filter(Boolean).length;
  breakdown.completeness = Math.round((filledCount / completenessFields.length) * 25);
  totalScore += breakdown.completeness;

  // Bonus for investors
  if (fields.is_investor) {
    breakdown.investor_bonus = 10;
    totalScore += 10;
  }

  // Cap at 100
  return {
    score: Math.min(totalScore, 100),
    breakdown,
  };
}

// ============================================
// Generate Conversation Summary
// ============================================

export async function generateConversationSummary(
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  if (messageHistory.length === 0) {
    return "Sin conversación registrada.";
  }

  const openai = await getOpenAI();
  const model = await getModel("extraction");

  const conversationText = messageHistory
    .map((m) => `${m.role === "user" ? "Lead" : "Bot"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `Generá un resumen breve (máximo 3 oraciones) de la siguiente conversación de calificación inmobiliaria. 
Enfocate en:
- Qué busca el cliente (tipo de propiedad, zona, presupuesto)
- Nivel de interés/urgencia
- Cualquier preferencia especial mencionada

Respondé directamente con el resumen, sin introducciones.`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: conversationText },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || "Conversación de calificación realizada.";
  } catch (error) {
    console.error("Error generating conversation summary:", error);
    return `Conversación con ${messageHistory.length} mensajes intercambiados.`;
  }
}

// ============================================
// Generate Embeddings for RAG
// ============================================

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = await getOpenAI();
  const model = await getModel("embedding");

  const response = await openai.embeddings.create({
    model,
    input: text,
  });

  return response.data[0].embedding;
}

// ============================================
// RAG Search
// ============================================

export async function ragSearch(
  query: string,
  tenantId: string,
  offerId?: string,
  limit: number = 5
): Promise<Array<{ content: string; score: number }>> {
  const supabase = await createAdminClient();

  // Generate embedding for query
  const embedding = await generateEmbedding(query);

  // Search knowledge chunks using vector similarity
  const { data: chunks } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
    p_tenant_id: tenantId,
    p_offer_id: offerId || null,
  });

  return (chunks || []).map((chunk: any) => ({
    content: chunk.content,
    score: chunk.similarity,
  }));
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check which required fields are still missing (core + fine-prefs)
 * Used to guide the conversation towards "Lead Ready".
 */
function getMissingFields(fields: QualificationFields): string[] {
  const missing: string[] = [];

  // Core required
  if (!fields.name) missing.push("nombre");
  if (!fields.budget?.min && !fields.budget?.max) missing.push("presupuesto");
  if (!fields.zone || fields.zone.length === 0) missing.push("zona de interés");
  if (!fields.timing) missing.push("timing/urgencia");
  if (!fields.purpose) missing.push("propósito (vivienda/inversión)");
  if (!fields.bedrooms) missing.push("ambientes");

  // Fine-prefs are optional but tracked
  // (completeness score is calculated in scoring.ts)

  return missing;
}

/**
 * Calculate fine-preference completeness ratio (0.0 – 1.0)
 */
export function calculateFinePrefsCompleteness(fields: QualificationFields): number {
  const finePrefs = [
    fields.garage,
    fields.amenities && fields.amenities.length > 0,
    fields.floor_preference,
    fields.orientation,
    fields.balcony,
    fields.terrace,
    fields.pets_allowed,
    fields.m2_min || fields.m2_max,
    fields.bathrooms,
  ];
  const filled = finePrefs.filter(Boolean).length;
  return filled / finePrefs.length;
}

