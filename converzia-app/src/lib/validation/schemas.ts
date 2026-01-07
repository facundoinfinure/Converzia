/**
 * Zod validation schemas for API endpoints
 * Prevents injection attacks and ensures data integrity
 */

import { z } from 'zod';

// Common reusable schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format');
export const phoneSchema = z.string().min(10).max(20).regex(/^\+?[0-9\s-()]+$/, 'Invalid phone format');
export const urlSchema = z.string().url('Invalid URL format');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Search schema
export const searchSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  search: z.string().min(1).max(200).optional(),
});

// Offer generation schema
export const offerGenerationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  city: z.string().min(1, 'City is required').max(100),
  zone: z.string().max(100).optional(),
  offer_type: z.enum(['PROPERTY', 'AUTO', 'LOAN', 'INSURANCE']),
  description: z.string().max(5000).optional(),
  price_from: z.number().min(0).optional(),
  price_to: z.number().min(0).optional(),
  currency: z.string().length(3).default('ARS'),
  address: z.string().max(500).optional(),
  country: z.string().length(2).default('AR'),
});

// Offer creation schema (for API)
export const createOfferSchema = z.object({
  tenant_id: uuidSchema,
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  offer_type: z.enum(['PROPERTY', 'AUTO', 'LOAN', 'INSURANCE']).default('PROPERTY'),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).default('DRAFT'),
  description: z.string().max(5000).optional(),
  short_description: z.string().max(500).optional(),
  image_url: z.string().url().optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  zone: z.string().max(100).optional(),
  country: z.string().length(2).default('AR'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  price_from: z.number().min(0).optional(),
  price_to: z.number().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  priority: z.number().int().min(0).max(1000).default(100),
  settings: z.record(z.unknown()).optional(),
}).strict();

// Webhook validation schemas
export const metaWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    time: z.number(),
    changes: z.array(z.unknown()).optional(),
  })),
});

export const stripeWebhookHeadersSchema = z.object({
  'stripe-signature': z.string().min(1),
});

export const chatwootWebhookSchema = z.object({
  event: z.string(),
  account: z.object({
    id: z.number(),
  }).optional(),
  conversation: z.object({
    id: z.number(),
  }).optional(),
  message: z.object({
    id: z.number(),
    content: z.string().optional(),
    message_type: z.enum(['incoming', 'outgoing']).optional(),
  }).optional(),
});

// Tenant management schemas
export const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(3, 'Slug must be at least 3 characters').max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  contact_email: emailSchema.optional(),
  contact_phone: phoneSchema.optional(),
  settings: z.record(z.unknown()).optional(),
});

// Full request schema used by /api/tenants (includes defaults)
export const createTenantRequestSchema = createTenantSchema.extend({
  timezone: z.string().optional().default("America/Argentina/Buenos_Aires"),
  default_score_threshold: z.number().int().min(0).max(100).optional().default(80),
  duplicate_window_days: z.number().int().min(1).max(365).optional().default(90),
}).strict();

export const updateTenantSchema = createTenantSchema.partial();

// User profile schemas
export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  avatar_url: urlSchema.optional(),
});

// Lead scoring schemas
export const scoringCriteriaSchema = z.object({
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  points: z.number().int().min(0).max(100),
  condition: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'between']).optional(),
});

export const scoringTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  criteria: z.record(z.array(scoringCriteriaSchema)),
  threshold: z.number().int().min(0).max(100).default(70),
});

// Credit purchase schema
export const creditPurchaseSchema = z.object({
  quantity: z.number().int().min(1).max(10000),
  return_url: urlSchema.optional(),
});

// Ad mapping schema
export const adMappingSchema = z.object({
  ad_id: z.string().min(1),
  offer_id: uuidSchema,
  auto_approve: z.boolean().default(false),
});

// Message schema
export const sendMessageSchema = z.object({
  phone: phoneSchema,
  message: z.string().min(1).max(4096),
  template_name: z.string().max(100).optional(),
  template_params: z.array(z.string()).optional(),
});

// Delivery configuration schema
export const deliveryConfigSchema = z.object({
  type: z.enum(['google_sheets', 'webhook', 'email']),
  enabled: z.boolean().default(true),
  config: z.object({
    spreadsheet_id: z.string().optional(),
    sheet_name: z.string().optional(),
    webhook_url: urlSchema.optional(),
    email: emailSchema.optional(),
  }),
  filters: z.object({
    min_score: z.number().int().min(0).max(100).optional(),
    offer_ids: z.array(uuidSchema).optional(),
    statuses: z.array(z.string()).optional(),
  }).optional(),
});

// Filter schemas for list endpoints
export const leadFilterSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'DELIVERED', 'CONVERTED', 'DISCARDED']).optional(),
  offer_id: uuidSchema.optional(),
  score_min: z.coerce.number().int().min(0).max(100).optional(),
  score_max: z.coerce.number().int().min(0).max(100).optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
});

export const offerFilterSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  offer_type: z.enum(['PROPERTY', 'AUTO', 'LOAN', 'INSURANCE']).optional(),
  city: z.string().max(100).optional(),
});

/**
 * Utility function to validate request body
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `${firstError.path.join('.')}: ${firstError.message}`,
      };
    }
    return { success: false, error: 'Invalid request body' };
  }
}

/**
 * Utility function to validate query params
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const validated = schema.parse(params);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `${firstError.path.join('.')}: ${firstError.message}`,
      };
    }
    return { success: false, error: 'Invalid query parameters' };
  }
}

// ============================================
// Query Parameter Schemas
// ============================================

// Health check query params (none currently, but reserved for future)
export const healthCheckQuerySchema = z.object({}).strict();

// Metrics query params
export const metricsQuerySchema = z.object({
  filters: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();

// Funnel query params
export const funnelQuerySchema = z.object({
  tenant_id: uuidSchema.optional(),
  offer_id: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();

// Funnel insights query params
export const funnelInsightsQuerySchema = z.object({
  offer_id: uuidSchema.optional(),
}).strict();

// Billing consumption query params
export const billingConsumptionQuerySchema = z.object({
  offer_id: uuidSchema.optional(),
  from: z.string().optional(), // Accept ISO date string
  to: z.string().optional(), // Accept ISO date string
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

// Settings query params
export const settingsQuerySchema = z.object({}).strict();

// Storage init body schema
export const storageInitBodySchema = z.object({
  tenant_id: uuidSchema,
  offer_id: uuidSchema.optional(),
}).strict();

// Integrations query params
export const integrationsTestBodySchema = z.object({
  type: z.enum(["TOKKO", "GOOGLE_SHEETS", "WEBHOOK"]),
  config: z.record(z.unknown()),
  tenant_id: uuidSchema,
}).strict();

// Google integrations query params
export const googleSpreadsheetsQuerySchema = z.object({
  tenant_id: uuidSchema,
}).strict();

// Meta integrations query params
// Note: ad-status uses ad_ids as comma-separated, validated manually
export const metaAdsQuerySchema = z.object({
  account_id: z.string().optional(),
}).strict();

export const metaConfigBodySchema = z.object({
  selected_ad_accounts: z.array(z.string()).optional(),
  selected_pages: z.array(z.string()).optional(),
  selected_whatsapp_accounts: z.array(z.string()).optional(),
}).strict();

// Test endpoints query params
export const testCheckConfigQuerySchema = z.object({}).strict();

export const testTriggerConversationBodySchema = z.object({
  leadOfferId: uuidSchema,
}).strict();

// Upload logo - multipart form validation (validated manually)
// Note: For multipart, we validate manually in the handler

// ============================================
// Additional API Endpoint Schemas
// ============================================

// RAG ingestion body schema
export const ragIngestBodySchema = z.object({
  tenant_id: uuidSchema,
  offer_id: uuidSchema.optional(),
  source_type: z.enum(['URL', 'PDF', 'MANUAL']),
  source_url: urlSchema.optional(),
  source_file: z.string().optional(), // Base64 or file path
  content: z.string().optional(),
  title: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

// RAG reindex body schema
export const ragReindexBodySchema = z.object({
  source_id: uuidSchema,
  tenant_id: uuidSchema.optional(),
}).strict();

// GDPR delete body schema
export const gdprDeleteBodySchema = z.object({
  lead_id: uuidSchema,
  reason: z.string().min(1).max(500), // Required for audit trail
}).strict();

// Billing checkout body schema
export const billingCheckoutBodySchema = z.object({
  quantity: z.number().int().min(1).max(10000),
  return_url: urlSchema.optional(),
  success_url: urlSchema.optional(),
  cancel_url: urlSchema.optional(),
}).strict();

// Billing checkout session creation (server validates package_id)
export const billingCheckoutSessionBodySchema = z.object({
  tenant_id: uuidSchema,
  package_id: z.string().min(1),
}).strict();

// Trial credits body schema
export const trialCreditsBodySchema = z.object({
  amount: z.number().int().min(1).max(10000),
  description: z.string().max(500).optional(),
}).strict();

// Tenant notify approval body schema
export const tenantNotifyApprovalBodySchema = z.object({
  tenant_id: uuidSchema,
  tenant_name: z.string().min(1).max(200),
  emails: z.array(z.string().email()).min(1),
  action: z.enum(['APPROVED', 'REJECTED']).optional(),
  message: z.string().max(1000).optional(),
}).strict();

// Testing conversation (init) body schema (legacy / alternate testing flow)
export const testingConversationInitBodySchema = z.object({
  tenant_id: uuidSchema,
  offer_id: uuidSchema.optional(),
  lead_phone: phoneSchema,
  lead_name: z.string().max(100).optional(),
  initial_message: z.string().max(1000).optional(),
}).strict();

// Testing RAG body schema
export const testingRagBodySchema = z.object({
  tenant_id: uuidSchema,
  query: z.string().min(1).max(1000),
  offer_id: uuidSchema.optional(),
  limit: z.number().int().min(1).max(20).default(5),
}).strict();

// Testing conversation body schema
export const testingConversationBodySchema = z.object({
  tenant_id: uuidSchema,
  offer_id: uuidSchema.optional(),
  message: z.string().min(1).max(5000),
  conversation_history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
}).strict();

// Tokko sync body schema
export const tokkoSyncBodySchema = z.object({
  tenant_id: uuidSchema,
  force_full_sync: z.boolean().optional().default(false),
}).strict();

// Google disconnect body schema
export const googleDisconnectBodySchema = z.object({
  tenant_id: uuidSchema,
}).strict();

// Meta costs body schema
export const metaCostsBodySchema = z.object({
  tenant_id: uuidSchema,
  account_id: z.string().min(1),
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  force_refresh: z.boolean().optional().default(false),
}).strict();

// Google spreadsheets POST body schema
export const googleSpreadsheetsPostBodySchema = z.object({
  tenant_id: uuidSchema,
  name: z.string().max(200).optional(),
}).strict();
