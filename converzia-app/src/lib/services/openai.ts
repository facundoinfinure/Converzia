import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import type { QualificationFields, Offer, ScoreBreakdown } from "@/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger, Metrics, Alerts, startTimer } from "@/lib/monitoring";
import { embeddingCache } from "./rag-cache";

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
  const { data } = await queryWithTimeout(
    supabase.from("tenants").select("name").eq("id", tenantId).single(),
    10000,
    `get tenant name ${tenantId}`
  ) as { data: { name: string } | null };
  const name = data?.name || "la desarrolladora";

  tenantNameCache.set(tenantId, { value: name, at: now });
  return name;
}

export async function buildQualificationSystemPrompt(params: {
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

export async function getOpenAI(): Promise<OpenAI> {
  const supabase = createAdminClient();

  const { data: setting } = await queryWithTimeout(
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "openai_api_key")
      .single(),
    10000,
    "get OpenAI API key",
    false // Don't retry settings
  ) as { data: { value: string } | null };

  const apiKey = setting?.value || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  return new OpenAI({ apiKey });
}

export async function getModel(type: "extraction" | "response" | "embedding"): Promise<string> {
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

  const { data: setting } = await queryWithTimeout(
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", keyMap[type])
      .single(),
    10000,
    `get OpenAI model for ${type}`,
    false // Don't retry settings
  ) as { data: { value: string } | null };

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

  const timer = startTimer();

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

    Metrics.openaiRequest(model, "extraction");
    Metrics.openaiLatency(model, timer());

    const content = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    logger.exception("Error extracting fields", error);
    Metrics.errorOccurred("openai", "extraction");
    if ((error as Error).message?.includes("rate limit")) {
      Alerts.openaiRateLimited(model);
    }
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

  const timer = startTimer();

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

    Metrics.openaiRequest(model, "response");
    Metrics.openaiLatency(model, timer());

    return completion.choices[0]?.message?.content || "Gracias por tu mensaje. ¿En qué puedo ayudarte?";
  } catch (error) {
    logger.exception("Error generating response", error);
    Metrics.errorOccurred("openai", "response");
    if ((error as Error).message?.includes("rate limit")) {
      Alerts.openaiRateLimited(model);
    }
    return "Gracias por tu mensaje. Un asesor te contactará pronto.";
  }
}

// ============================================
// Calculate Lead Score - DEPRECATED
// ============================================
// NOTE: This function is deprecated. Use calculateLeadScore from scoring.ts instead.
// Keeping for backwards compatibility but will be removed in next major version.
// The scoring.ts implementation is more complete with configurable templates.

/**
 * @deprecated Use calculateLeadScore from scoring.ts instead
 */
export async function calculateScore(
  fields: QualificationFields,
  offer?: Offer
): Promise<{ score: number; breakdown: ScoreBreakdown }> {
  // Import dynamically to avoid circular deps, but prefer direct usage of scoring.ts
  const { calculateLeadScore } = await import("./scoring");
  
  // Fallback tenant ID - this should be passed explicitly in real usage
  const tenantId = offer?.tenant_id || "default";
  
  const result = await calculateLeadScore(fields, offer || null, tenantId);
  
  return {
    score: result.score,
    breakdown: result.breakdown,
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
    logger.exception("Error generating conversation summary", error);
    return `Conversación con ${messageHistory.length} mensajes intercambiados.`;
  }
}

// ============================================
// Generate Rolling Summary for Long Conversations
// ============================================

const ROLLING_SUMMARY_THRESHOLD = 20; // Start summarizing after this many messages
const MESSAGES_TO_KEEP = 6; // Keep last N messages in full

export async function generateRollingSummary(
  existingSummary: string | null,
  newMessages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const openai = await getOpenAI();
  const model = await getModel("extraction");

  const newMessagesText = newMessages
    .map((m) => `${m.role === "user" ? "Lead" : "Bot"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `Actualizá el resumen de conversación incorporando los nuevos mensajes.
Mantené la información importante:
- Datos de calificación del lead (presupuesto, zona, timing, etc.)
- Preferencias mencionadas
- Preguntas pendientes o temas de interés
- Estado general de la conversación

El resumen debe ser conciso (máximo 5 oraciones).
Respondé directamente con el resumen actualizado.`;

  const userContent = existingSummary
    ? `RESUMEN ANTERIOR:\n${existingSummary}\n\nNUEVOS MENSAJES:\n${newMessagesText}`
    : `NUEVOS MENSAJES:\n${newMessagesText}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content || existingSummary || "";
  } catch (error) {
    logger.exception("Error generating rolling summary", error);
    return existingSummary || "";
  }
}

export function shouldGenerateRollingSummary(messageCount: number): boolean {
  return messageCount >= ROLLING_SUMMARY_THRESHOLD;
}

export function getMessagesToKeep(): number {
  return MESSAGES_TO_KEEP;
}

// ============================================
// Generate Embeddings for RAG (with cache)
// ============================================

export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cached = embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  const timer = startTimer();
  const openai = await getOpenAI();
  const model = await getModel("embedding");

  try {
    const response = await openai.embeddings.create({
      model,
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Cache the result
    embeddingCache.set(text, embedding);

    Metrics.openaiRequest(model, "embedding");
    Metrics.openaiLatency(model, timer());

    return embedding;
  } catch (error) {
    if ((error as Error).message?.includes("rate limit")) {
      Alerts.openaiRateLimited(model);
    }
    Metrics.errorOccurred("openai", "embedding");
    throw error;
  }
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
  interface KnowledgeChunk {
    content: string;
    similarity: number;
  }
  const rpcResult = await (supabase.rpc as any)("match_knowledge_chunks", {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
    p_tenant_id: tenantId,
    p_offer_id: offerId || null,
  });
  const chunks = (rpcResult.data || []) as KnowledgeChunk[];

  return chunks.map((chunk) => ({
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

// ============================================
// Disqualification Categories
// ============================================

export const DISQUALIFICATION_CATEGORIES = [
  'PRICE_TOO_HIGH',
  'PRICE_TOO_LOW', 
  'WRONG_ZONE',
  'WRONG_TYPOLOGY',
  'NO_RESPONSE',
  'NOT_INTERESTED',
  'MISSING_AMENITY',
  'DUPLICATE',
  'OTHER'
] as const;

export type DisqualificationCategory = typeof DISQUALIFICATION_CATEGORIES[number];

export interface DisqualificationResult {
  shouldDisqualify: boolean;
  category?: DisqualificationCategory;
  reason?: string;
}

/**
 * Evaluate if a lead should be disqualified based on their qualification fields
 * compared to the offer's requirements. Also extracts the category and reason.
 */
export async function evaluateDisqualification(
  fields: QualificationFields,
  offer: Offer | null,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<DisqualificationResult> {
  // Quick checks that don't need LLM
  
  // 1. Check if lead explicitly said not interested
  const lastUserMessages = conversationHistory
    .filter(m => m.role === "user")
    .slice(-3)
    .map(m => m.content.toLowerCase());
  
  const notInterestedPhrases = [
    "no me interesa",
    "no estoy interesado",
    "no quiero",
    "no gracias",
    "dejá de escribirme",
    "no me contacten",
  ];
  
  for (const msg of lastUserMessages) {
    if (notInterestedPhrases.some(phrase => msg.includes(phrase))) {
      return {
        shouldDisqualify: true,
        category: "NOT_INTERESTED",
        reason: "El lead indicó explícitamente que no está interesado",
      };
    }
  }

  // If no offer, can't do offer-specific disqualification
  if (!offer) {
    return { shouldDisqualify: false };
  }

  // 2. Budget check
  if (fields.budget && offer.price_from) {
    const maxBudget = fields.budget.max || fields.budget.min;
    const minOfferPrice = offer.price_from;
    
    // If lead's max budget is significantly less than offer's minimum price
    if (maxBudget && maxBudget < minOfferPrice * 0.7) {
      return {
        shouldDisqualify: true,
        category: "PRICE_TOO_HIGH",
        reason: `Presupuesto máximo del lead (${maxBudget}) muy por debajo del precio mínimo del proyecto (${minOfferPrice})`,
      };
    }
    
    // If lead's min budget is way above offer's max price
    if (fields.budget.min && offer.price_to && fields.budget.min > offer.price_to * 1.5) {
      return {
        shouldDisqualify: true,
        category: "PRICE_TOO_LOW",
        reason: `Presupuesto mínimo del lead (${fields.budget.min}) muy por encima del precio máximo del proyecto (${offer.price_to})`,
      };
    }
  }

  // 3. Zone check
  if (fields.zone && fields.zone.length > 0 && offer.city) {
    const offerLocation = `${offer.city} ${offer.zone || ""}`.toLowerCase();
    const leadZones = fields.zone.map(z => z.toLowerCase());
    
    // If lead has specific zones and none match the offer location
    const hasMatch = leadZones.some(zone => 
      offerLocation.includes(zone) || zone.includes(offer.city?.toLowerCase() || "")
    );
    
    if (!hasMatch && leadZones.length <= 3) {
      // Only disqualify if they have specific zones (not just "anywhere")
      const anywhereIndicators = ["cualquier", "donde sea", "no importa", "toda", "todos"];
      const isFlexible = leadZones.some(z => anywhereIndicators.some(i => z.includes(i)));
      
      if (!isFlexible) {
        return {
          shouldDisqualify: true,
          category: "WRONG_ZONE",
          reason: `El lead busca en ${fields.zone.join(", ")} pero el proyecto está en ${offer.city}`,
        };
      }
    }
  }

  // 4. Typology check (if offer specifies and lead has preferences)
  // This would need offer variants data - skip for now

  return { shouldDisqualify: false };
}

/**
 * Determine disqualification from conversation using LLM
 * Use this for more nuanced cases that rule-based checks can't handle
 */
export async function determineDisqualificationFromConversation(
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  fields: QualificationFields,
  offer: Offer | null
): Promise<DisqualificationResult> {
  // First try rule-based evaluation
  const ruleBasedResult = await evaluateDisqualification(fields, offer, conversationHistory);
  if (ruleBasedResult.shouldDisqualify) {
    return ruleBasedResult;
  }

  // If rule-based doesn't disqualify, and we have enough context, use LLM
  if (conversationHistory.length < 4) {
    return { shouldDisqualify: false };
  }

  const openai = await getOpenAI();
  const model = await getModel("extraction");

  const conversationText = conversationHistory
    .slice(-8)
    .map(m => `${m.role === "user" ? "Lead" : "Bot"}: ${m.content}`)
    .join("\n");

  const offerContext = offer 
    ? `Proyecto: ${offer.name} en ${offer.city || "ubicación no especificada"}. Precio: ${offer.price_from ? `desde ${offer.price_from} USD` : "a consultar"}.`
    : "Sin proyecto específico asignado.";

  const systemPrompt = `Analizá esta conversación de calificación inmobiliaria y determiná si el lead debe ser descalificado.

Contexto del proyecto:
${offerContext}

Información del lead:
${JSON.stringify(fields, null, 2)}

Categorías de descalificación válidas:
- PRICE_TOO_HIGH: el presupuesto del lead está muy por debajo del precio del proyecto
- PRICE_TOO_LOW: el presupuesto del lead está muy por encima (busca algo más caro)
- WRONG_ZONE: el lead busca en zonas muy diferentes a donde está el proyecto
- WRONG_TYPOLOGY: el lead busca un tipo de propiedad que no ofrecemos (ej: casa en un edificio)
- NO_RESPONSE: el lead dejó de responder después de múltiples intentos
- NOT_INTERESTED: el lead indicó que no le interesa
- MISSING_AMENITY: el lead requiere algo específico que no tenemos (ej: pileta, cochera)
- OTHER: otro motivo de descalificación

Respondé en JSON con el formato:
{
  "shouldDisqualify": boolean,
  "category": "CATEGORY_NAME" | null,
  "reason": "explicación breve" | null
}

IMPORTANTE:
- Solo descalificá si hay evidencia clara en la conversación
- Si hay duda, NO descalifiques (shouldDisqualify: false)
- No descalifiques solo porque faltan datos - eso es normal en calificación`;

  const timer = startTimer();

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `CONVERSACIÓN:\n${conversationText}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    Metrics.openaiRequest(model, "disqualification");
    Metrics.openaiLatency(model, timer());

    const content = completion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);

    return {
      shouldDisqualify: result.shouldDisqualify || false,
      category: DISQUALIFICATION_CATEGORIES.includes(result.category) ? result.category : undefined,
      reason: result.reason || undefined,
    };
  } catch (error) {
    logger.exception("Error determining disqualification", error);
    return { shouldDisqualify: false };
  }
}
