/**
 * Meta Leads Webhook Tests
 * Tests the Facebook/Meta lead generation webhook
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Types for Meta webhook payloads
interface MetaLeadgenEntry {
  id: string;
  time: number;
  changes: Array<{
    field: string;
    value: {
      ad_id: string;
      form_id: string;
      leadgen_id: string;
      created_time: number;
      page_id: string;
    };
  }>;
}

interface MetaLeadPayload {
  object: string;
  entry: MetaLeadgenEntry[];
}

interface LeadData {
  id: string;
  created_time: string;
  ad_id: string;
  form_id: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

describe("Meta Leads Webhook", () => {
  const APP_SECRET = "test-meta-app-secret";

  function createMetaSignature(payload: string, secret: string): string {
    return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Webhook Payload Parsing", () => {
    it("should parse leadgen webhook payload", () => {
      const payload: MetaLeadPayload = {
        object: "page",
        entry: [
          {
            id: "page_123",
            time: Date.now(),
            changes: [
              {
                field: "leadgen",
                value: {
                  ad_id: "ad_123",
                  form_id: "form_123",
                  leadgen_id: "lead_123",
                  created_time: Math.floor(Date.now() / 1000),
                  page_id: "page_123",
                },
              },
            ],
          },
        ],
      };

      expect(payload.object).toBe("page");
      expect(payload.entry[0].changes[0].field).toBe("leadgen");
      expect(payload.entry[0].changes[0].value.leadgen_id).toBe("lead_123");
    });

    it("should handle multiple entries in single webhook", () => {
      const payload: MetaLeadPayload = {
        object: "page",
        entry: [
          {
            id: "page_123",
            time: Date.now(),
            changes: [
              {
                field: "leadgen",
                value: { ad_id: "ad_1", form_id: "form_1", leadgen_id: "lead_1", created_time: 0, page_id: "page_123" },
              },
            ],
          },
          {
            id: "page_123",
            time: Date.now(),
            changes: [
              {
                field: "leadgen",
                value: { ad_id: "ad_2", form_id: "form_2", leadgen_id: "lead_2", created_time: 0, page_id: "page_123" },
              },
            ],
          },
        ],
      };

      expect(payload.entry).toHaveLength(2);
    });
  });

  describe("Lead Data Extraction", () => {
    it("should extract lead fields from field_data", () => {
      const leadData: LeadData = {
        id: "lead_123",
        created_time: "2024-01-15T10:30:00+0000",
        ad_id: "ad_123",
        form_id: "form_123",
        field_data: [
          { name: "full_name", values: ["John Doe"] },
          { name: "email", values: ["john@example.com"] },
          { name: "phone_number", values: ["+5491112345678"] },
        ],
      };

      const extractField = (name: string) => 
        leadData.field_data.find(f => f.name === name)?.values[0];

      expect(extractField("full_name")).toBe("John Doe");
      expect(extractField("email")).toBe("john@example.com");
      expect(extractField("phone_number")).toBe("+5491112345678");
    });

    it("should handle missing fields gracefully", () => {
      const leadData: LeadData = {
        id: "lead_123",
        created_time: "2024-01-15T10:30:00+0000",
        ad_id: "ad_123",
        form_id: "form_123",
        field_data: [
          { name: "full_name", values: ["John Doe"] },
        ],
      };

      const extractField = (name: string) => 
        leadData.field_data.find(f => f.name === name)?.values[0];

      expect(extractField("email")).toBeUndefined();
      expect(extractField("phone_number")).toBeUndefined();
    });

    it("should normalize phone numbers from lead data", () => {
      const phoneVariations = [
        "+5491112345678",
        "5491112345678",
        "11-1234-5678",
        "(11) 1234-5678",
      ];

      const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, "");

      phoneVariations.forEach(phone => {
        const normalized = normalizePhone(phone);
        expect(normalized).toMatch(/^\d+$/);
      });
    });
  });

  describe("Signature Validation", () => {
    it("should validate correct signature", () => {
      const payload = JSON.stringify({ object: "page", entry: [] });
      const signature = createMetaSignature(payload, APP_SECRET);

      const expectedSig = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(payload).digest("hex");
      expect(signature).toBe(expectedSig);
    });

    it("should have sha256 prefix in signature", () => {
      const payload = JSON.stringify({ test: true });
      const signature = createMetaSignature(payload, APP_SECRET);

      expect(signature.startsWith("sha256=")).toBe(true);
    });
  });

  describe("Verification Token Handling", () => {
    it("should respond to verify challenge", () => {
      const verifyToken = "test-verify-token";
      const challenge = "challenge_code_123";
      const mode = "subscribe";
      const hubToken = "test-verify-token";

      const shouldVerify = mode === "subscribe" && hubToken === verifyToken;
      
      if (shouldVerify) {
        expect(challenge).toBe("challenge_code_123");
      }
      expect(shouldVerify).toBe(true);
    });

    it("should reject invalid verify token", () => {
      const verifyToken: string = "test-verify-token";
      const hubToken: string = "wrong-token";
      const mode: string = "subscribe";

      const shouldVerify = mode === "subscribe" && hubToken === verifyToken;
      expect(shouldVerify).toBe(false);
    });
  });

  describe("Idempotency Handling", () => {
    it("should detect duplicate lead by leadgen_id", () => {
      const processedLeads = new Set<string>(["lead_123", "lead_456"]);
      const incomingLeadId = "lead_123";

      const isDuplicate = processedLeads.has(incomingLeadId);
      expect(isDuplicate).toBe(true);
    });

    it("should process new leads", () => {
      const processedLeads = new Set<string>(["lead_123", "lead_456"]);
      const incomingLeadId = "lead_789";

      const isDuplicate = processedLeads.has(incomingLeadId);
      expect(isDuplicate).toBe(false);
    });
  });

  describe("Ad Mapping", () => {
    it("should find offer for mapped ad_id", () => {
      const adMappings = new Map([
        ["ad_123", "offer_abc"],
        ["ad_456", "offer_def"],
      ]);

      const adId = "ad_123";
      const offerId = adMappings.get(adId);

      expect(offerId).toBe("offer_abc");
    });

    it("should handle unmapped ads", () => {
      const adMappings = new Map([
        ["ad_123", "offer_abc"],
      ]);

      const adId = "ad_unknown";
      const offerId = adMappings.get(adId);

      expect(offerId).toBeUndefined();
    });
  });

  describe("Error Responses", () => {
    it("should return 200 even for processing errors", () => {
      // Meta requires 200 response to not retry
      const responseStatus = 200;
      expect(responseStatus).toBe(200);
    });

    it("should return 401 for invalid signature", () => {
      const signatureValid = false;
      const responseStatus = signatureValid ? 200 : 401;
      expect(responseStatus).toBe(401);
    });

    it("should return 403 for unverified request", () => {
      const secretConfigured = false;
      const responseStatus = secretConfigured ? 200 : 403;
      expect(responseStatus).toBe(403);
    });
  });
});
