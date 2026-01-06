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
