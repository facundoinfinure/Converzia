import { z } from "zod";

// ============================================
// Tenant Schemas
// ============================================

export const tenantStatusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"]);

export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  slug: z
    .string()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(50, "El slug no puede exceder 50 caracteres")
    .regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones"),
  contact_email: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  contact_phone: z
    .string()
    .optional()
    .or(z.literal("")),
  timezone: z.string().optional(),
  default_score_threshold: z
    .number()
    .min(1, "El threshold mínimo es 1")
    .max(100, "El threshold máximo es 100")
    .optional(),
  duplicate_window_days: z
    .number()
    .min(1, "El mínimo es 1 día")
    .max(365, "El máximo es 365 días")
    .optional(),
});

export const updateTenantSchema = createTenantSchema.partial().extend({
  status: tenantStatusSchema.optional(),
  settings: z.record(z.unknown()).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

// ============================================
// Tenant Pricing Schemas
// ============================================

export const chargeModelSchema = z.enum(["PER_LEAD", "PER_SALE", "SUBSCRIPTION"]);

export const creditPackageSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "El nombre es requerido"),
  credits: z.number().min(1, "Mínimo 1 crédito"),
  price: z.number().min(0, "El precio no puede ser negativo"),
  discount_pct: z.number().min(0).max(100).optional(),
  is_popular: z.boolean().optional(),
});

export const tenantPricingSchema = z.object({
  charge_model: chargeModelSchema.default("PER_LEAD"),
  cost_per_lead: z
    .number()
    .min(0, "El costo no puede ser negativo")
    .default(10),
  currency: z.string().default("USD"),
  success_fee_percentage: z.number().min(0).max(100).optional().nullable(),
  success_fee_flat: z.number().min(0).optional().nullable(),
  packages: z.array(creditPackageSchema).default([]),
  low_credit_threshold: z.number().min(0).default(10),
  auto_refund_duplicates: z.boolean().default(true),
  auto_refund_spam: z.boolean().default(true),
});

export type TenantPricingInput = z.infer<typeof tenantPricingSchema>;

// ============================================
// Tenant Member Schemas
// ============================================

export const tenantRoleSchema = z.enum(["OWNER", "ADMIN", "BILLING", "VIEWER"]);
export const membershipStatusSchema = z.enum(["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "REVOKED"]);

export const inviteMemberSchema = z.object({
  email: z.string().email("Email inválido"),
  role: tenantRoleSchema.default("VIEWER"),
});

export const updateMemberSchema = z.object({
  role: tenantRoleSchema.optional(),
  status: membershipStatusSchema.optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ============================================
// Tenant Integration Schemas
// ============================================

export const integrationTypeSchema = z.enum([
  "GOOGLE_SHEETS",
  "TOKKO",
  "PROPERATI",
  "WEBHOOK",
  "ZAPIER",
]);

export const googleSheetsConfigSchema = z.object({
  spreadsheet_id: z.string().min(1, "Spreadsheet ID es requerido"),
  sheet_name: z.string().min(1, "Sheet name es requerido"),
  service_account_json: z.string().optional(),
  column_mapping: z.record(z.string()).default({}),
});

export const tokkoConfigSchema = z.object({
  api_key: z.string().min(1, "API Key es requerido"),
  api_url: z.string().url("URL inválida"),
  field_mapping: z.record(z.string()).default({}),
});

export const webhookConfigSchema = z.object({
  url: z.string().url("URL inválida"),
  method: z.enum(["POST", "PUT"]).default("POST"),
  headers: z.record(z.string()).default({}),
  auth_type: z.enum(["none", "basic", "bearer", "api_key"]).default("none"),
  auth_value: z.string().optional(),
});

export const createIntegrationSchema = z.object({
  integration_type: integrationTypeSchema,
  name: z.string().min(1, "El nombre es requerido"),
  config: z.record(z.unknown()),
  is_active: z.boolean().default(true),
  is_primary: z.boolean().default(false),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;



