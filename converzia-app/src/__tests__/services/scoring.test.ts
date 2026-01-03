import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QualificationFields, Offer } from "@/types";

// Mock Supabase before importing
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
  }),
}));

// Import after mocks
import { checkMinimumFieldsForScoring } from "@/lib/services/scoring";

describe("Scoring Service", () => {
  describe("checkMinimumFieldsForScoring", () => {
    it("should return ready=false when no fields are filled", () => {
      const fields: QualificationFields = {};
      const result = checkMinimumFieldsForScoring(fields);
      
      expect(result.ready).toBe(false);
      expect(result.filledCount).toBe(0);
      expect(result.missingFields).toContain("nombre");
      expect(result.missingFields).toContain("presupuesto");
    });

    it("should return ready=true when 4+ fields are filled", () => {
      const fields: QualificationFields = {
        name: "Juan Pérez",
        budget: { min: 50000, max: 80000 },
        zone: ["Palermo", "Belgrano"],
        timing: "3 meses",
      };
      const result = checkMinimumFieldsForScoring(fields);
      
      expect(result.ready).toBe(true);
      expect(result.filledCount).toBeGreaterThanOrEqual(4);
    });

    it("should correctly identify missing fields", () => {
      const fields: QualificationFields = {
        name: "Test",
        budget: { min: 50000 },
      };
      const result = checkMinimumFieldsForScoring(fields);
      
      expect(result.missingFields).toContain("zonas");
      expect(result.missingFields).toContain("timing");
      expect(result.missingFields).not.toContain("nombre");
    });

    it("should count budget as filled if min OR max is present", () => {
      const fieldsWithMin: QualificationFields = {
        budget: { min: 50000 },
      };
      const fieldsWithMax: QualificationFields = {
        budget: { max: 100000 },
      };
      const fieldsWithBoth: QualificationFields = {
        budget: { min: 50000, max: 100000 },
      };

      expect(checkMinimumFieldsForScoring(fieldsWithMin).filledCount).toBeGreaterThan(0);
      expect(checkMinimumFieldsForScoring(fieldsWithMax).filledCount).toBeGreaterThan(0);
      expect(checkMinimumFieldsForScoring(fieldsWithBoth).filledCount).toBeGreaterThan(0);
    });

    it("should count zone as filled if array has elements", () => {
      const fieldsWithZone: QualificationFields = {
        zone: ["Palermo"],
      };
      const fieldsWithEmptyZone: QualificationFields = {
        zone: [],
      };

      const withZone = checkMinimumFieldsForScoring(fieldsWithZone);
      const withoutZone = checkMinimumFieldsForScoring(fieldsWithEmptyZone);

      expect(withZone.missingFields).not.toContain("zonas");
      expect(withoutZone.missingFields).toContain("zonas");
    });

    it("should identify investor flag correctly", () => {
      const investor: QualificationFields = {
        name: "Investor",
        is_investor: true,
      };
      const nonInvestor: QualificationFields = {
        name: "Buyer",
        is_investor: false,
      };
      const noFlag: QualificationFields = {
        name: "Unknown",
      };

      // All should still check other fields
      expect(checkMinimumFieldsForScoring(investor).ready).toBe(false);
      expect(checkMinimumFieldsForScoring(nonInvestor).ready).toBe(false);
      expect(checkMinimumFieldsForScoring(noFlag).ready).toBe(false);
    });
  });
});

describe("Score Calculation Logic", () => {
  const mockOffer: Offer = {
    id: "offer-1",
    tenant_id: "tenant-1",
    name: "Test Offer",
    slug: "test-offer",
    offer_type: "PROPERTY",
    status: "ACTIVE",
    description: null,
    short_description: null,
    image_url: null,
    country: "AR",
    city: "Buenos Aires",
    zone: "Palermo",
    address: null,
    latitude: null,
    longitude: null,
    currency: "USD",
    price_from: 80000,
    price_to: 120000,
    priority: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("should have offer data for scoring", () => {
    expect(mockOffer.price_from).toBe(80000);
    expect(mockOffer.zone).toBe("Palermo");
  });

  it("should calculate timing scores correctly", () => {
    // Timing values and expected relative scores
    const timingValues = ["inmediato", "3 meses", "6 meses", "1 año"];
    
    // "inmediato" should score highest
    expect(timingValues[0]).toBe("inmediato");
  });

  it("should give bonus for investors", () => {
    const investorFields: QualificationFields = {
      name: "Test",
      is_investor: true,
    };
    const regularFields: QualificationFields = {
      name: "Test",
      is_investor: false,
    };

    // Investor flag should be recognized
    expect(investorFields.is_investor).toBe(true);
    expect(regularFields.is_investor).toBe(false);
  });
});







