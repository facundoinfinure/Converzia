import { z } from "zod";

// ============================================
// Meta Integration Settings
// ============================================

export const metaSettingsSchema = z.object({
  meta_app_id: z.string().min(1, "App ID es requerido"),
  meta_app_secret: z.string().min(1, "App Secret es requerido"),
  meta_page_access_token: z.string().min(1, "Page Access Token es requerido"),
  meta_webhook_verify_token: z.string().min(1, "Verify Token es requerido"),
});

export type MetaSettingsInput = z.infer<typeof metaSettingsSchema>;

// ============================================
// WhatsApp Integration Settings
// ============================================

export const whatsappSettingsSchema = z.object({
  whatsapp_phone_number_id: z.string().min(1, "Phone Number ID es requerido"),
  whatsapp_business_account_id: z.string().min(1, "Business Account ID es requerido"),
  whatsapp_access_token: z.string().min(1, "Access Token es requerido"),
});

export type WhatsAppSettingsInput = z.infer<typeof whatsappSettingsSchema>;

// ============================================
// Chatwoot Integration Settings
// ============================================

export const chatwootSettingsSchema = z.object({
  chatwoot_base_url: z.string().url("URL base inválida"),
  chatwoot_account_id: z.string().min(1, "Account ID es requerido"),
  chatwoot_api_token: z.string().min(1, "API Token es requerido"),
  chatwoot_inbox_id: z.string().min(1, "Inbox ID es requerido"),
});

export type ChatwootSettingsInput = z.infer<typeof chatwootSettingsSchema>;

// ============================================
// OpenAI Settings
// ============================================

export const openaiSettingsSchema = z.object({
  openai_api_key: z.string().min(1, "API Key es requerido"),
  openai_model_extraction: z.string().default("gpt-4o-mini"),
  openai_model_response: z.string().default("gpt-4o"),
  openai_model_embedding: z.string().default("text-embedding-ada-002"),
});

export type OpenAISettingsInput = z.infer<typeof openaiSettingsSchema>;

// ============================================
// All Settings Combined
// ============================================

export const allSettingsSchema = metaSettingsSchema
  .merge(whatsappSettingsSchema)
  .merge(chatwootSettingsSchema)
  .merge(openaiSettingsSchema)
  .partial();

export type AllSettingsInput = z.infer<typeof allSettingsSchema>;

// ============================================
// WhatsApp Template Schema
// ============================================

export const templateCategorySchema = z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]);
export const templateStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const templateHeaderTypeSchema = z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).optional();

export const templateVariableSchema = z.object({
  position: z.number().min(1),
  type: z.enum(["text", "image", "video", "document"]),
  example: z.string().optional(),
});

export const templateButtonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
  text: z.string().max(25),
  url: z.string().url().optional(),
  phone_number: z.string().optional(),
});

export const createTemplateSchema = z.object({
  template_name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Solo letras minúsculas, números y guiones bajos"),
  template_id: z.string().optional().nullable(),
  language: z.string().default("es"),
  category: templateCategorySchema,
  status: templateStatusSchema.default("PENDING"),
  header_type: templateHeaderTypeSchema.nullable(),
  header_content: z.string().max(60).optional().nullable(),
  body_text: z.string().min(1, "El cuerpo es requerido").max(1024),
  footer_text: z.string().max(60).optional().nullable(),
  buttons: z.array(templateButtonSchema).max(3).default([]),
  variables: z.array(templateVariableSchema).default([]),
  use_for: z.array(z.enum(["INITIAL_CONTACT", "FOLLOW_UP", "REACTIVATION"])).default([]),
  is_active: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial().omit({
  template_name: true,
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;















