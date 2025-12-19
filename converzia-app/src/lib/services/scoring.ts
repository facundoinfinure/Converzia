import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import type { QualificationFields, Offer, ScoreBreakdown, OfferType } from "@/types";

// ============================================
// Scoring Engine Service
// Uses scoring templates from database
// ============================================

export interface ScoringTemplate {
  id: string;
  offer_type: OfferType;
  tenant_id: string | null;
  name: string;
  weights: ScoringWeights;
  rules: ScoringRules;
  lead_ready_threshold: number;
  is_default: boolean;
}

export interface ScoringWeights {
  budget_fit: { max_points: number; weight: number };
  zone_fit: { max_points: number; weight: number };
  typology_fit: { max_points: number; weight: number };
  timing_fit: { max_points: number; weight: number };
  intent_strength: { max_points: number; weight: number };
  conversation_quality: { max_points: number; weight: number };
}

export interface ScoringRules {
  budget_fit: BudgetFitRules;
  zone_fit: ZoneFitRules;
  typology_fit: TypologyFitRules;
  timing_fit: TimingFitRules;
  intent_strength: IntentRules;
  conversation_quality: ConversationQualityRules;
}

interface BudgetFitRules {
  type: string;
  scoring: {
    perfect_match: number;
    within_20_percent: number;
    within_50_percent: number;
    out_of_range: number;
    no_data: number;
  };
}

interface ZoneFitRules {
  type: string;
  scoring: {
    exact_match: number;
    adjacent_zone: number;
    same_city: number;
    no_match: number;
    no_data: number;
  };
}

interface TypologyFitRules {
  type: string;
  scoring: {
    exact_match: number;
    close_match: number;
    partial_match: number;
    no_match: number;
    no_data: number;
  };
}

interface TimingFitRules {
  type: string;
  scoring: {
    immediate: number;
    within_6_months: number;
    within_1_year: number;
    flexible: number;
    long_term: number;
    no_data: number;
  };
}

interface IntentRules {
  type: string;
  scoring: {
    ready_to_buy: number;
    actively_looking: number;
    exploring: number;
    just_curious: number;
    no_data: number;
  };
}

interface ConversationQualityRules {
  type: string;
  scoring: {
    highly_engaged: number;
    good_engagement: number;
    moderate: number;
    low_engagement: number;
    friction: number;
  };
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  explanation: ScoreExplanation;
  isReady: boolean;
  threshold: number;
}

export interface ScoreExplanation {
  summary: string;
  details: {
    dimension: string;
    score: number;
    maxScore: number;
    reason: string;
  }[];
}

// ============================================
// Main Scoring Function
// ============================================

export async function calculateLeadScore(
  fields: QualificationFields,
  offer: Offer | null,
  tenantId: string,
  conversationMetrics?: ConversationMetrics
): Promise<ScoreResult> {
  // Load scoring template
  const template = await loadScoringTemplate(
    offer?.offer_type || "PROPERTY",
    tenantId
  );

  const breakdown: ScoreBreakdown = {};
  const explanationDetails: ScoreExplanation["details"] = [];

  // Score each dimension
  const budgetResult = scoreBudgetFit(fields, offer, template.rules.budget_fit);
  breakdown.budget = budgetResult.score;
  explanationDetails.push({
    dimension: "Presupuesto",
    score: budgetResult.score,
    maxScore: template.weights.budget_fit.max_points,
    reason: budgetResult.reason,
  });

  const zoneResult = scoreZoneFit(fields, offer, template.rules.zone_fit);
  breakdown.zone = zoneResult.score;
  explanationDetails.push({
    dimension: "Zona",
    score: zoneResult.score,
    maxScore: template.weights.zone_fit.max_points,
    reason: zoneResult.reason,
  });

  const typologyResult = scoreTypologyFit(fields, offer, template.rules.typology_fit);
  breakdown.typology = typologyResult.score;
  explanationDetails.push({
    dimension: "Tipología",
    score: typologyResult.score,
    maxScore: template.weights.typology_fit.max_points,
    reason: typologyResult.reason,
  });

  const timingResult = scoreTimingFit(fields, template.rules.timing_fit);
  breakdown.timing = timingResult.score;
  explanationDetails.push({
    dimension: "Timing",
    score: timingResult.score,
    maxScore: template.weights.timing_fit.max_points,
    reason: timingResult.reason,
  });

  const intentResult = scoreIntentStrength(fields, template.rules.intent_strength);
  breakdown.intent = intentResult.score;
  explanationDetails.push({
    dimension: "Intención",
    score: intentResult.score,
    maxScore: template.weights.intent_strength.max_points,
    reason: intentResult.reason,
  });

  const qualityResult = scoreConversationQuality(
    conversationMetrics,
    template.rules.conversation_quality
  );
  breakdown.conversation_quality = qualityResult.score;
  explanationDetails.push({
    dimension: "Calidad de conversación",
    score: qualityResult.score,
    maxScore: template.weights.conversation_quality.max_points,
    reason: qualityResult.reason,
  });

  // Fine-prefs completeness bonus (max 10 points)
  const finePrefsResult = scoreFinePrefsCompleteness(fields);
  breakdown.fine_prefs = finePrefsResult.score;
  explanationDetails.push({
    dimension: "Preferencias finas",
    score: finePrefsResult.score,
    maxScore: 10,
    reason: finePrefsResult.reason,
  });

  // Calculate total score
  const totalScore = Object.values(breakdown).reduce((sum: number, val) => sum + (val || 0), 0);
  const cappedScore = Math.min(totalScore, 100);

  // Generate summary
  const summary = generateScoreSummary(cappedScore, template.lead_ready_threshold, fields);

  return {
    score: cappedScore,
    breakdown,
    explanation: {
      summary,
      details: explanationDetails,
    },
    isReady: cappedScore >= template.lead_ready_threshold,
    threshold: template.lead_ready_threshold,
  };
}

// ============================================
// Dimension Scoring Functions
// ============================================

function scoreBudgetFit(
  fields: QualificationFields,
  offer: Offer | null,
  rules: BudgetFitRules
): { score: number; reason: string } {
  if (!fields.budget?.min && !fields.budget?.max) {
    return { score: rules.scoring.no_data, reason: "Presupuesto no especificado" };
  }

  if (!offer?.price_from && !offer?.price_to) {
    // No offer price to compare, give partial score
    return { score: rules.scoring.within_20_percent, reason: "Presupuesto informado, sin referencia de oferta" };
  }

  const leadBudgetMin = fields.budget.min || 0;
  const leadBudgetMax = fields.budget.max || leadBudgetMin * 1.5;
  const offerPriceMin = offer.price_from || 0;
  const offerPriceMax = offer.price_to || offerPriceMin * 1.2;

  // Check for overlap
  const hasOverlap = leadBudgetMax >= offerPriceMin && leadBudgetMin <= offerPriceMax;

  if (hasOverlap) {
    // Perfect or near match
    const overlapRatio = calculateOverlapRatio(
      leadBudgetMin,
      leadBudgetMax,
      offerPriceMin,
      offerPriceMax
    );

    if (overlapRatio >= 0.8) {
      return { score: rules.scoring.perfect_match, reason: "Presupuesto encaja perfectamente" };
    } else if (overlapRatio >= 0.5) {
      return { score: rules.scoring.within_20_percent, reason: "Presupuesto compatible" };
    } else {
      return { score: rules.scoring.within_50_percent, reason: "Presupuesto parcialmente compatible" };
    }
  }

  // Check how far off
  const percentOff = Math.abs(
    ((leadBudgetMax - offerPriceMin) / offerPriceMin) * 100
  );

  if (percentOff <= 20) {
    return { score: rules.scoring.within_20_percent, reason: "Presupuesto cerca del rango" };
  } else if (percentOff <= 50) {
    return { score: rules.scoring.within_50_percent, reason: "Presupuesto alejado pero no descartable" };
  }

  return { score: rules.scoring.out_of_range, reason: "Presupuesto fuera de rango" };
}

function scoreZoneFit(
  fields: QualificationFields,
  offer: Offer | null,
  rules: ZoneFitRules
): { score: number; reason: string } {
  if (!fields.zone || fields.zone.length === 0) {
    return { score: rules.scoring.no_data, reason: "Zonas de interés no especificadas" };
  }

  if (!offer?.zone && !offer?.city) {
    return { score: rules.scoring.same_city, reason: "Zonas informadas, sin referencia de oferta" };
  }

  const leadZones = fields.zone.map((z) => z.toLowerCase().trim());
  const offerZone = offer.zone?.toLowerCase().trim() || "";
  const offerCity = offer.city?.toLowerCase().trim() || "";

  // Exact match
  if (leadZones.some((z) => z === offerZone || offerZone.includes(z) || z.includes(offerZone))) {
    return { score: rules.scoring.exact_match, reason: `Zona coincide: ${offer.zone}` };
  }

  // City match
  if (leadZones.some((z) => z === offerCity || offerCity.includes(z) || z.includes(offerCity))) {
    return { score: rules.scoring.same_city, reason: `Ciudad coincide: ${offer.city}` };
  }

  // Adjacent zone detection (simplified - could use geo data)
  const adjacentZones: Record<string, string[]> = {
    palermo: ["belgrano", "colegiales", "villa crespo", "recoleta"],
    belgrano: ["palermo", "nuñez", "colegiales", "coghlan"],
    recoleta: ["palermo", "barrio norte", "retiro"],
    caballito: ["flores", "almagro", "parque chacabuco", "villa crespo"],
    // Add more as needed
  };

  if (
    adjacentZones[offerZone] &&
    leadZones.some((z) => adjacentZones[offerZone].includes(z))
  ) {
    return { score: rules.scoring.adjacent_zone, reason: "Zona adyacente a la preferida" };
  }

  return { score: rules.scoring.no_match, reason: "Zonas no coinciden" };
}

function scoreTypologyFit(
  fields: QualificationFields,
  offer: Offer | null,
  rules: TypologyFitRules
): { score: number; reason: string } {
  if (!fields.bedrooms && !fields.property_type) {
    return { score: rules.scoring.no_data, reason: "Preferencias de tipología no especificadas" };
  }

  // If we have property type preference
  if (fields.property_type) {
    // For now, assume it matches (would need to compare with offer variants)
    return { score: rules.scoring.partial_match, reason: `Busca: ${fields.property_type}` };
  }

  // If we have bedroom preference, would need to check against offer variants
  if (fields.bedrooms) {
    return { score: rules.scoring.partial_match, reason: `Busca: ${fields.bedrooms} ambientes` };
  }

  return { score: rules.scoring.no_data, reason: "Sin información de tipología" };
}

function scoreTimingFit(
  fields: QualificationFields,
  rules: TimingFitRules
): { score: number; reason: string } {
  if (!fields.timing) {
    return { score: rules.scoring.no_data, reason: "Timing no especificado" };
  }

  const timing = fields.timing.toLowerCase();

  // Map common timing phrases
  if (
    timing.includes("inmediato") ||
    timing.includes("ya") ||
    timing.includes("ahora") ||
    timing.includes("urgente") ||
    timing.includes("esta semana")
  ) {
    return { score: rules.scoring.immediate, reason: "Búsqueda inmediata" };
  }

  if (
    timing.includes("1 mes") ||
    timing.includes("2 mes") ||
    timing.includes("3 mes") ||
    timing.includes("este trimestre") ||
    timing.includes("próximos meses")
  ) {
    return { score: rules.scoring.within_6_months, reason: "Dentro de 6 meses" };
  }

  if (
    timing.includes("6 mes") ||
    timing.includes("este año") ||
    timing.includes("fin de año") ||
    timing.includes("año que viene")
  ) {
    return { score: rules.scoring.within_1_year, reason: "Dentro de 1 año" };
  }

  if (timing.includes("flexible") || timing.includes("no tengo apuro")) {
    return { score: rules.scoring.flexible, reason: "Timing flexible" };
  }

  if (timing.includes("largo plazo") || timing.includes("no sé") || timing.includes("explorando")) {
    return { score: rules.scoring.long_term, reason: "Búsqueda a largo plazo" };
  }

  // Default: parse as somewhat flexible
  return { score: rules.scoring.flexible, reason: `Timing: ${fields.timing}` };
}

function scoreIntentStrength(
  fields: QualificationFields,
  rules: IntentRules
): { score: number; reason: string } {
  // Check for investor profile (high intent)
  if (fields.is_investor) {
    return { score: rules.scoring.ready_to_buy, reason: "Perfil inversor - alta intención" };
  }

  // Check for financing need (indicates serious intent)
  if (fields.financing === true) {
    return { score: rules.scoring.actively_looking, reason: "Busca financiamiento - intención seria" };
  }

  // If we have good qualification data, assume active
  const hasGoodData = 
    fields.name && 
    (fields.budget?.min || fields.budget?.max) && 
    fields.zone && fields.zone.length > 0;

  if (hasGoodData) {
    return { score: rules.scoring.actively_looking, reason: "Datos completos - activamente buscando" };
  }

  // Partial data
  const hasPartialData = fields.name || fields.budget?.min || fields.budget?.max || fields.zone;
  if (hasPartialData) {
    return { score: rules.scoring.exploring, reason: "Explorando opciones" };
  }

  return { score: rules.scoring.no_data, reason: "Intención no determinada" };
}

interface ConversationMetrics {
  messageCount: number;
  responseTime: number; // average in seconds
  sentimentScore?: number; // -1 to 1
  engagementLevel?: "high" | "medium" | "low";
}

function scoreConversationQuality(
  metrics: ConversationMetrics | undefined,
  rules: ConversationQualityRules
): { score: number; reason: string } {
  if (!metrics) {
    return { score: rules.scoring.moderate, reason: "Sin métricas de conversación" };
  }

  // High engagement: many messages, fast responses
  if (metrics.messageCount >= 10 && metrics.responseTime < 60) {
    return { score: rules.scoring.highly_engaged, reason: "Conversación fluida y comprometida" };
  }

  if (metrics.messageCount >= 5 && metrics.responseTime < 120) {
    return { score: rules.scoring.good_engagement, reason: "Buen nivel de engagement" };
  }

  if (metrics.messageCount >= 3) {
    return { score: rules.scoring.moderate, reason: "Engagement moderado" };
  }

  if (metrics.messageCount >= 1) {
    return { score: rules.scoring.low_engagement, reason: "Bajo engagement" };
  }

  return { score: rules.scoring.friction, reason: "Sin respuestas" };
}

// ============================================
// Helper Functions
// ============================================

async function loadScoringTemplate(
  offerType: OfferType,
  tenantId: string
): Promise<ScoringTemplate> {
  const supabase = createAdminClient();

  // Try to find tenant-specific template first
  const { data: tenantTemplate } = await queryWithTimeout(
    supabase
      .from("scoring_templates")
      .select("*")
      .eq("offer_type", offerType)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single(),
    10000,
    "get tenant scoring template"
  );

  if (tenantTemplate) {
    return tenantTemplate as ScoringTemplate;
  }

  // Fall back to global default template
  const { data: defaultTemplate } = await queryWithTimeout(
    supabase
      .from("scoring_templates")
      .select("*")
      .eq("offer_type", offerType)
      .is("tenant_id", null)
      .eq("is_default", true)
      .single(),
    10000,
    "get default scoring template"
  );

  if (defaultTemplate) {
    return defaultTemplate as ScoringTemplate;
  }

  // If no template found, return hardcoded default
  return getDefaultTemplate(offerType);
}

function getDefaultTemplate(offerType: OfferType): ScoringTemplate {
  return {
    id: "default",
    offer_type: offerType,
    tenant_id: null,
    name: "Default Template",
    lead_ready_threshold: 80,
    is_default: true,
    weights: {
      budget_fit: { max_points: 25, weight: 0.25 },
      zone_fit: { max_points: 20, weight: 0.2 },
      typology_fit: { max_points: 15, weight: 0.15 },
      timing_fit: { max_points: 15, weight: 0.15 },
      intent_strength: { max_points: 15, weight: 0.15 },
      conversation_quality: { max_points: 10, weight: 0.1 },
    },
    rules: {
      budget_fit: {
        type: "range_match",
        scoring: {
          perfect_match: 25,
          within_20_percent: 20,
          within_50_percent: 12,
          out_of_range: 5,
          no_data: 0,
        },
      },
      zone_fit: {
        type: "list_match",
        scoring: {
          exact_match: 20,
          adjacent_zone: 12,
          same_city: 8,
          no_match: 3,
          no_data: 0,
        },
      },
      typology_fit: {
        type: "variant_match",
        scoring: {
          exact_match: 15,
          close_match: 10,
          partial_match: 6,
          no_match: 2,
          no_data: 0,
        },
      },
      timing_fit: {
        type: "timing_match",
        scoring: {
          immediate: 15,
          within_6_months: 12,
          within_1_year: 8,
          flexible: 10,
          long_term: 5,
          no_data: 0,
        },
      },
      intent_strength: {
        type: "intent_classification",
        scoring: {
          ready_to_buy: 15,
          actively_looking: 12,
          exploring: 8,
          just_curious: 4,
          no_data: 0,
        },
      },
      conversation_quality: {
        type: "engagement_score",
        scoring: {
          highly_engaged: 10,
          good_engagement: 7,
          moderate: 5,
          low_engagement: 2,
          friction: 0,
        },
      },
    },
  };
}

function calculateOverlapRatio(
  leadMin: number,
  leadMax: number,
  offerMin: number,
  offerMax: number
): number {
  const overlapStart = Math.max(leadMin, offerMin);
  const overlapEnd = Math.min(leadMax, offerMax);
  const overlapSize = Math.max(0, overlapEnd - overlapStart);
  const leadRange = leadMax - leadMin || 1;

  return overlapSize / leadRange;
}

/**
 * Score fine-preference completeness (max 10 points)
 * More fine-prefs filled = higher bonus
 */
function scoreFinePrefsCompleteness(
  fields: QualificationFields
): { score: number; reason: string } {
  const finePrefs = [
    { key: "garage", filled: fields.garage !== undefined },
    { key: "amenities", filled: Array.isArray(fields.amenities) && fields.amenities.length > 0 },
    { key: "floor_preference", filled: !!fields.floor_preference },
    { key: "orientation", filled: !!fields.orientation },
    { key: "balcony", filled: fields.balcony !== undefined },
    { key: "terrace", filled: fields.terrace !== undefined },
    { key: "pets_allowed", filled: fields.pets_allowed !== undefined },
    { key: "m2", filled: !!(fields.m2_min || fields.m2_max) },
    { key: "bathrooms", filled: !!fields.bathrooms },
  ];

  const filledCount = finePrefs.filter((p) => p.filled).length;
  const ratio = filledCount / finePrefs.length;

  // Scale 0–10
  const score = Math.round(ratio * 10);

  const filledLabels = finePrefs.filter((p) => p.filled).map((p) => p.key);
  const reason =
    filledCount === 0
      ? "Sin preferencias finas completadas."
      : `${filledCount} preferencias finas (${filledLabels.join(", ")}).`;

  return { score, reason };
}

function generateScoreSummary(
  score: number,
  threshold: number,
  fields: QualificationFields
): string {
  const missingFields: string[] = [];
  
  if (!fields.name) missingFields.push("nombre");
  if (!fields.budget?.min && !fields.budget?.max) missingFields.push("presupuesto");
  if (!fields.zone || fields.zone.length === 0) missingFields.push("zonas");
  if (!fields.timing) missingFields.push("timing");
  if (!fields.purpose) missingFields.push("propósito");
  if (!fields.bedrooms) missingFields.push("ambientes");

  if (score >= threshold) {
    return `Lead calificado con ${score} puntos (umbral: ${threshold}). Listo para entrega.`;
  }

  if (missingFields.length > 0) {
    return `Score: ${score}/${threshold}. Faltan: ${missingFields.join(", ")}.`;
  }

  return `Score: ${score}/${threshold}. Necesita más información para calificar.`;
}

// ============================================
// Export for use in conversation service
// ============================================

export function checkMinimumFieldsForScoring(fields: QualificationFields): {
  ready: boolean;
  missingFields: string[];
  filledCount: number;
} {
  const required = [
    { key: "name", label: "nombre", filled: !!fields.name },
    { key: "budget", label: "presupuesto", filled: !!(fields.budget?.min || fields.budget?.max) },
    { key: "zone", label: "zonas", filled: !!(fields.zone && fields.zone.length > 0) },
    { key: "timing", label: "timing", filled: !!fields.timing },
    { key: "purpose", label: "propósito", filled: !!fields.purpose },
    { key: "bedrooms", label: "ambientes", filled: !!fields.bedrooms },
  ];

  const missing = required.filter((f) => !f.filled).map((f) => f.label);
  const filledCount = required.filter((f) => f.filled).length;

  // Need at least 4 of 6 required fields (relaxed to allow partial progress)
  return {
    ready: filledCount >= 4,
    missingFields: missing,
    filledCount,
  };
}

