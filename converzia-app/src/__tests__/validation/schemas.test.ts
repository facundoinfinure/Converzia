import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  phoneSchema,
  emailSchema,
  uuidSchema,
  paginationSchema,
  createOfferSchema,
} from "@/lib/validation/schemas";

// Local schemas for testing
const tenantIdSchema = uuidSchema;
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

describe("Validation Schemas", () => {
  describe("phoneSchema", () => {
    it("should accept valid phone numbers", () => {
      const result = phoneSchema.safeParse("+5491112345678");
      expect(result.success).toBe(true);
    });

    it("should accept phones without country code", () => {
      const result = phoneSchema.safeParse("1112345678");
      expect(result.success).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      const result = phoneSchema.safeParse("abc123");
      expect(result.success).toBe(false);
    });

    it("should reject empty strings", () => {
      const result = phoneSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("emailSchema", () => {
    it("should accept valid emails", () => {
      expect(emailSchema.safeParse("test@example.com").success).toBe(true);
      expect(emailSchema.safeParse("user.name@domain.co").success).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(emailSchema.safeParse("notanemail").success).toBe(false);
      expect(emailSchema.safeParse("@nodomain").success).toBe(false);
      expect(emailSchema.safeParse("no@").success).toBe(false);
    });
  });

  describe("uuidSchema", () => {
    it("should accept valid UUIDs", () => {
      const result = uuidSchema.safeParse("123e4567-e89b-12d3-a456-426614174000");
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
      expect(uuidSchema.safeParse("123456").success).toBe(false);
    });
  });

  describe("tenantIdSchema", () => {
    it("should accept valid tenant IDs (UUIDs)", () => {
      const result = tenantIdSchema.safeParse("123e4567-e89b-12d3-a456-426614174000");
      expect(result.success).toBe(true);
    });
  });

  describe("paginationSchema", () => {
    it("should parse valid pagination params", () => {
      const result = paginationSchema.safeParse({ page: "2", pageSize: "20" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it("should use defaults for missing params", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20); // Default is 20 per schema
      }
    });

    it("should cap pageSize at 100", () => {
      const result = paginationSchema.safeParse({ pageSize: "500" });
      // Zod .max(100) will fail validation for values > 100, not cap them
      expect(result.success).toBe(false);
    });
  });

  describe("createOfferSchema", () => {
    it("should accept valid offer data", () => {
      const result = createOfferSchema.safeParse({
        tenant_id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Offer",
        slug: "test-offer",
        offer_type: "PROPERTY",
      });
      expect(result.success).toBe(true);
    });

    it("should require tenant_id", () => {
      const result = createOfferSchema.safeParse({
        name: "Test Offer",
        slug: "test-offer",
      });
      expect(result.success).toBe(false);
    });

    it("should require name", () => {
      const result = createOfferSchema.safeParse({
        tenant_id: "123e4567-e89b-12d3-a456-426614174000",
        slug: "test-offer",
      });
      expect(result.success).toBe(false);
    });

    it("should validate slug format", () => {
      const result = createOfferSchema.safeParse({
        tenant_id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        slug: "invalid slug with spaces",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept valid login data", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should require email", () => {
      const result = loginSchema.safeParse({
        password: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("should require password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should validate email format", () => {
      const result = loginSchema.safeParse({
        email: "notanemail",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });
  });
});
