import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/utils/logger";
import { handleApiError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";

// Default prompts content (used as fallback if files don't exist)
const DEFAULT_EXTRACTION_PROMPT = `Sos un asistente que extrae información de calificación de mensajes de clientes interesados en inmuebles.

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
- amenities: lista de strings (pileta, gym, sum, rooftop, seguridad 24hs, etc.)
- floor_preference: string (bajo, medio, alto, indistinto)
- orientation: string (frente, contrafrente, lateral, indistinto)
- balcony: boolean
- terrace: boolean

### Financiación
- financing: boolean (si necesita financiamiento)
- financing_type: string (credito_hipotecario, desarrollador, pozo)

Respondé SOLO con JSON válido. Si no hay información nueva, respondé {}.`;

const DEFAULT_SUMMARY_PROMPT = `Generá un resumen breve (máximo 3 oraciones) de la siguiente conversación de calificación inmobiliaria.

Enfocate en:
- Qué busca el cliente (tipo de propiedad, zona, presupuesto)
- Nivel de interés/urgencia
- Cualquier preferencia especial mencionada

Respondé directamente con el resumen, sin introducciones.`;

const DEFAULT_GREETING_TEMPLATE = `¡Hola {{lead_name}}! Gracias por tu interés en {{offer_name}}.

Soy el asistente de {{tenant_name}}. Para poder ayudarte mejor, ¿me contás un poco qué estás buscando?`;

const DEFAULT_DISQUALIFICATION_PROMPT = `Analizá esta conversación de calificación inmobiliaria y determiná si el lead debe ser descalificado.

Categorías de descalificación válidas:
- PRICE_TOO_HIGH: el presupuesto del lead está muy por debajo del precio del proyecto
- PRICE_TOO_LOW: el presupuesto del lead está muy por encima (busca algo más caro)
- WRONG_ZONE: el lead busca en zonas muy diferentes a donde está el proyecto
- WRONG_TYPOLOGY: el lead busca un tipo de propiedad que no ofrecemos
- NO_RESPONSE: el lead dejó de responder después de múltiples intentos
- NOT_INTERESTED: el lead indicó que no le interesa
- MISSING_AMENITY: el lead requiere algo específico que no tenemos
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
- No descalifiques solo porque faltan datos`;

export async function GET() {
  try {
    // Try to read qualification prompt from file
    let qualificationPrompt = "";
    try {
      const promptPath = path.join(process.cwd(), "prompts", "qualification_system_prompt.md");
      qualificationPrompt = await readFile(promptPath, "utf-8");
    } catch {
      // File doesn't exist, leave empty (user should create it)
      qualificationPrompt = "";
    }

    return apiSuccess({
      qualification_system_prompt_md: qualificationPrompt,
      extraction_system_prompt_md: DEFAULT_EXTRACTION_PROMPT,
      conversation_summary_prompt_md: DEFAULT_SUMMARY_PROMPT,
      initial_greeting_template: DEFAULT_GREETING_TEMPLATE,
      disqualification_reason_prompt_md: DEFAULT_DISQUALIFICATION_PROMPT,
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "GET /api/settings/default-prompts" },
    });
  }
}

