import { z } from "zod";

// ============================================
// Offer Schemas
// ============================================

export const offerTypeSchema = z.enum(["PROPERTY", "AUTO", "LOAN", "INSURANCE"]);
export const offerStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);

export const createOfferSchema = z.object({
  tenant_id: z.string().uuid("Tenant ID inválido"),
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(200, "El nombre no puede exceder 200 caracteres"),
  slug: z
    .string()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(100, "El slug no puede exceder 100 caracteres")
    .regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones"),
  offer_type: offerTypeSchema.optional(),
  status: offerStatusSchema.optional(),
  description: z.string().max(5000).optional().nullable(),
  short_description: z.string().max(500).optional().nullable(),
  image_url: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || val.trim() === "" || z.string().url().safeParse(val).success,
      "URL de imagen inválida"
    ),
  // Location
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  zone: z.string().max(100).optional().nullable(),
  country: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  // Pricing
  price_from: z.number().min(0).optional().nullable(),
  price_to: z.number().min(0).optional().nullable(),
  currency: z.string().optional(),
  // Priority
  priority: z.number().min(0).max(1000).optional(),
  // Settings
  settings: z.record(z.unknown()).optional(),
});

export const updateOfferSchema = createOfferSchema.partial().omit({ tenant_id: true });

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

// ============================================
// Property Specific Schema
// ============================================

export const propertySchema = z.object({
  offer_id: z.string().uuid(),
  developer_name: z.string().max(200).optional().nullable(),
  project_stage: z.enum(["PRE_SALE", "CONSTRUCTION", "READY"]).optional().nullable(),
  delivery_date: z.string().optional().nullable(), // ISO date
  total_units: z.number().min(0).optional().nullable(),
  floors: z.number().min(0).optional().nullable(),
  amenities: z.array(z.string()).default([]),
  has_financing: z.boolean().default(false),
  financing_details: z.record(z.unknown()).default({}),
  legal_status: z.string().max(200).optional().nullable(),
});

export type PropertyInput = z.infer<typeof propertySchema>;

// ============================================
// Offer Variant Schemas
// ============================================

export const createVariantSchema = z.object({
  offer_id: z.string().uuid("Offer ID inválido"),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  code: z.string().max(20).optional().nullable(),
  // Specs
  bedrooms: z.number().min(0).optional().nullable(),
  bathrooms: z.number().min(0).optional().nullable(),
  area_m2: z.number().min(0).optional().nullable(),
  area_covered_m2: z.number().min(0).optional().nullable(),
  // Pricing
  price_from: z.number().min(0).optional().nullable(),
  price_to: z.number().min(0).optional().nullable(),
  currency: z.string().default("USD"),
  // Availability
  total_units: z.number().min(0).optional().nullable(),
  available_units: z.number().min(0).optional().nullable(),
  // Display
  floor_plan_url: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  display_order: z.number().default(0),
});

export const updateVariantSchema = createVariantSchema.partial().omit({ offer_id: true });

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

// ============================================
// Unit Schemas
// ============================================

export const createUnitSchema = z.object({
  variant_id: z.string().uuid("Variant ID inválido"),
  offer_id: z.string().uuid("Offer ID inválido"),
  unit_number: z.string().min(1, "El número de unidad es requerido").max(50),
  floor: z.number().optional().nullable(),
  orientation: z.string().max(50).optional().nullable(),
  has_balcony: z.boolean().default(false),
  has_terrace: z.boolean().default(false),
  parking_spaces: z.number().min(0).default(0),
  storage_unit: z.boolean().default(false),
  area_m2: z.number().min(0).optional().nullable(),
  area_covered_m2: z.number().min(0).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  currency: z.string().default("USD"),
  is_available: z.boolean().default(true),
  reserved_until: z.string().optional().nullable(),
  external_id: z.string().optional().nullable(),
});

export const updateUnitSchema = createUnitSchema.partial().omit({
  variant_id: true,
  offer_id: true,
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

// ============================================
// Ad Offer Mapping Schema
// ============================================

export const createAdMappingSchema = z.object({
  tenant_id: z.string().uuid("Tenant ID inválido"),
  offer_id: z.string().uuid("Offer ID inválido"),
  ad_id: z.string().min(1, "Ad ID es requerido"),
  ad_name: z.string().optional().nullable(),
  adset_id: z.string().optional().nullable(),
  adset_name: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
  campaign_name: z.string().optional().nullable(),
  form_id: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateAdMappingSchema = createAdMappingSchema.partial().omit({
  tenant_id: true,
  ad_id: true,
});

export type CreateAdMappingInput = z.infer<typeof createAdMappingSchema>;
export type UpdateAdMappingInput = z.infer<typeof updateAdMappingSchema>;














