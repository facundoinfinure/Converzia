// ============================================
// Converzia: Validation Schemas Index
// ============================================

export * from "./tenant";
export * from "./offer";
export * from "./settings";

// ============================================
// Common Validation Helpers
// ============================================

import { z } from "zod";

// Phone number validation (E.164 format)
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Teléfono debe estar en formato E.164 (ej: +5491123456789)")
  .or(z.string().length(0));

// Normalize phone to E.164
export function normalizePhone(phone: string, defaultCountry = "54"): string {
  // Remove all non-numeric characters except +
  let normalized = phone.replace(/[^\d+]/g, "");

  // If no + prefix, add country code
  if (!normalized.startsWith("+")) {
    // Remove leading 0 if present
    if (normalized.startsWith("0")) {
      normalized = normalized.substring(1);
    }

    // If length suggests it's missing country code
    if (normalized.length <= 12) {
      // Check if it already starts with country code
      if (!normalized.startsWith(defaultCountry)) {
        normalized = defaultCountry + normalized;
      }
    }

    normalized = "+" + normalized;
  }

  return normalized;
}

// Email validation
export const emailSchema = z
  .string()
  .email("Email inválido")
  .transform((v) => v.toLowerCase().trim());

// URL validation with optional protocol
export const urlSchema = z
  .string()
  .transform((v) => {
    if (v && !v.startsWith("http://") && !v.startsWith("https://")) {
      return `https://${v}`;
    }
    return v;
  })
  .pipe(z.string().url("URL inválida"));

// Slug validation
export const slugSchema = z
  .string()
  .min(2, "Mínimo 2 caracteres")
  .max(100, "Máximo 100 caracteres")
  .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones");

// Generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/-+/g, "-") // Replace multiple - with single -
    .replace(/^-|-$/g, ""); // Remove leading/trailing -
}

// Price validation
export const priceSchema = z
  .number()
  .min(0, "El precio no puede ser negativo")
  .transform((v) => Math.round(v * 100) / 100); // Round to 2 decimals

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Search/Filter schema
export const searchSchema = z.object({
  query: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

// Date range schema
export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type DateRangeInput = z.infer<typeof dateRangeSchema>;




