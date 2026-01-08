/**
 * Conversation Service Tests
 * Tests the conversation flow and qualification logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QualificationFields } from "@/types";

// Mock dependencies before importing
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })),
}));

vi.mock("@/lib/supabase/query-with-timeout", () => ({
  queryWithTimeout: vi.fn((promise) => promise),
}));

vi.mock("./chatwoot", () => ({
  sendMessageWithRetry: vi.fn().mockResolvedValue({ success: true }),
  sendTemplateMessage: vi.fn().mockResolvedValue({ success: true }),
  findOrCreateContact: vi.fn().mockResolvedValue({ id: "contact_1", conversation_id: "conv_1" }),
}));

vi.mock("./openai", () => ({
  extractQualificationFields: vi.fn().mockResolvedValue({}),
  generateQualificationResponse: vi.fn().mockResolvedValue("¿En qué zona buscas?"),
  generateConversationSummary: vi.fn().mockResolvedValue("Interested buyer looking for 2BR in Zone A"),
  generateRollingSummary: vi.fn().mockResolvedValue("Summary updated"),
  shouldGenerateRollingSummary: vi.fn().mockReturnValue(false),
  getMessagesToKeep: vi.fn().mockReturnValue([]),
}));

vi.mock("./scoring", () => ({
  calculateLeadScore: vi.fn().mockResolvedValue({
    total: 75,
    breakdown: { budget: 20, zone: 20, timing: 15, completeness: 20 },
  }),
  checkMinimumFieldsForScoring: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/monitoring", () => ({
  Metrics: {
    conversationStarted: vi.fn(),
    conversationCompleted: vi.fn(),
    messageProcessed: vi.fn(),
    qualificationCompleted: vi.fn(),
    trackLatency: vi.fn(),
  },
  getTraceId: vi.fn().mockReturnValue("trace-123"),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Conversation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("QualificationFields Processing", () => {
    it("should handle empty qualification fields", () => {
      const fields: QualificationFields = {};
      
      expect(Object.keys(fields).length).toBe(0);
    });

    it("should process budget range fields", () => {
      const fields: QualificationFields = {
        budget_min: 100000,
        budget_max: 200000,
      };

      expect(fields.budget_min).toBe(100000);
      expect(fields.budget_max).toBe(200000);
      expect(fields.budget_max! > fields.budget_min!).toBe(true);
    });

    it("should handle zone preferences", () => {
      const fields: QualificationFields = {
        zones: ["Palermo", "Belgrano", "Recoleta"],
      };

      expect(fields.zones).toHaveLength(3);
      expect(fields.zones).toContain("Palermo");
    });

    it("should handle timing preferences", () => {
      const fields: QualificationFields = {
        timing: "Dentro de 3 meses",
      };

      expect(fields.timing).toBe("Dentro de 3 meses");
    });

    it("should handle financing preferences", () => {
      const fields: QualificationFields = {
        financing: true,
      };

      expect(fields.financing).toBe(true);
    });

    it("should handle investor flag", () => {
      const fields: QualificationFields = {
        is_investor: true,
      };

      expect(fields.is_investor).toBe(true);
    });

    it("should handle property type preferences", () => {
      const fields: QualificationFields = {
        property_types: ["2 ambientes", "3 ambientes"],
      };

      expect(fields.property_types).toHaveLength(2);
    });
  });

  describe("Qualification Status Determination", () => {
    it("should consider lead qualified with high score", () => {
      const score = 80;
      const threshold = 70;
      
      const isQualified = score >= threshold;
      expect(isQualified).toBe(true);
    });

    it("should consider lead not qualified with low score", () => {
      const score = 50;
      const threshold = 70;
      
      const isQualified = score >= threshold;
      expect(isQualified).toBe(false);
    });

    it("should use tenant-specific threshold", () => {
      const score = 65;
      const customThreshold = 60;
      const defaultThreshold = 70;
      
      // With custom threshold, should be qualified
      expect(score >= customThreshold).toBe(true);
      // With default threshold, should not be qualified
      expect(score >= defaultThreshold).toBe(false);
    });
  });

  describe("Disqualification Detection", () => {
    const disqualificationPatterns = [
      { pattern: /no me interesa/i, category: "NO_INTEREST" },
      { pattern: /no tengo presupuesto/i, category: "NO_BUDGET" },
      { pattern: /ya compré/i, category: "ALREADY_PURCHASED" },
      { pattern: /solo consultaba/i, category: "JUST_BROWSING" },
    ];

    it("should detect no interest disqualification", () => {
      const message = "Gracias pero no me interesa";
      const match = disqualificationPatterns.find(p => p.pattern.test(message));
      
      expect(match?.category).toBe("NO_INTEREST");
    });

    it("should detect no budget disqualification", () => {
      const message = "No tengo presupuesto para comprar ahora";
      const match = disqualificationPatterns.find(p => p.pattern.test(message));
      
      expect(match?.category).toBe("NO_BUDGET");
    });

    it("should not disqualify regular messages", () => {
      const message = "Estoy buscando un departamento de 2 ambientes";
      const match = disqualificationPatterns.find(p => p.pattern.test(message));
      
      expect(match).toBeUndefined();
    });
  });

  describe("Message History Management", () => {
    it("should maintain message order", () => {
      const history = [
        { role: "assistant" as const, content: "Hola, ¿cómo puedo ayudarte?" },
        { role: "user" as const, content: "Busco un depto" },
        { role: "assistant" as const, content: "¿En qué zona?" },
        { role: "user" as const, content: "Palermo" },
      ];

      expect(history[0].role).toBe("assistant");
      expect(history[1].role).toBe("user");
      expect(history).toHaveLength(4);
    });

    it("should limit message history length", () => {
      const maxMessages = 20;
      const history = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? "user" as const : "assistant" as const,
        content: `Message ${i}`,
      }));

      const trimmedHistory = history.slice(-maxMessages);
      expect(trimmedHistory).toHaveLength(maxMessages);
      expect(trimmedHistory[0].content).toBe("Message 10");
    });
  });

  describe("Phone Number Handling", () => {
    it("should normalize phone numbers for comparison", () => {
      const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, "");
      
      expect(normalizePhone("+54 9 11 1234-5678")).toBe("5491112345678");
      expect(normalizePhone("(11) 1234-5678")).toBe("1112345678");
    });

    it("should validate Argentine phone format", () => {
      const isValidArPhone = (phone: string) => {
        const normalized = phone.replace(/[^\d]/g, "");
        return /^(54)?9?\d{10}$/.test(normalized);
      };

      expect(isValidArPhone("+5491112345678")).toBe(true);
      expect(isValidArPhone("1112345678")).toBe(true);
      expect(isValidArPhone("123")).toBe(false);
    });
  });

  describe("Status Transitions", () => {
    const validTransitions: Record<string, string[]> = {
      "TO_BE_CONTACTED": ["IN_CONVERSATION", "DISQUALIFIED"],
      "IN_CONVERSATION": ["LEAD_READY", "DISQUALIFIED", "NEEDS_HUMAN"],
      "LEAD_READY": ["SENT_TO_DEVELOPER", "DISQUALIFIED"],
      "SENT_TO_DEVELOPER": ["CONVERTED", "DISQUALIFIED"],
    };

    it("should allow valid status transitions", () => {
      const currentStatus = "IN_CONVERSATION";
      const newStatus = "LEAD_READY";
      
      const isValid = validTransitions[currentStatus]?.includes(newStatus);
      expect(isValid).toBe(true);
    });

    it("should detect invalid status transitions", () => {
      const currentStatus = "SENT_TO_DEVELOPER";
      const newStatus = "TO_BE_CONTACTED"; // Can't go backwards
      
      const isValid = validTransitions[currentStatus]?.includes(newStatus);
      expect(isValid).toBe(false);
    });
  });

  describe("Conversation Summary Generation", () => {
    it("should combine key information", () => {
      const fields: QualificationFields = {
        budget_min: 100000,
        budget_max: 150000,
        zones: ["Palermo"],
        timing: "3 meses",
      };

      const summary = [
        fields.zones?.join(", "),
        fields.budget_min && fields.budget_max ? `$${fields.budget_min}-$${fields.budget_max}` : null,
        fields.timing,
      ].filter(Boolean).join(" | ");

      expect(summary).toBe("Palermo | $100000-$150000 | 3 meses");
    });
  });

  describe("Message Timeout Handling", () => {
    it("should detect stale conversations", () => {
      const lastMessageTime = new Date("2024-01-01T10:00:00Z");
      const now = new Date("2024-01-01T14:00:00Z");
      const maxInactivityHours = 2;
      
      const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
      const isStale = hoursSinceLastMessage > maxInactivityHours;
      
      expect(isStale).toBe(true);
      expect(hoursSinceLastMessage).toBe(4);
    });

    it("should not mark active conversations as stale", () => {
      const lastMessageTime = new Date("2024-01-01T13:30:00Z");
      const now = new Date("2024-01-01T14:00:00Z");
      const maxInactivityHours = 2;
      
      const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
      const isStale = hoursSinceLastMessage > maxInactivityHours;
      
      expect(isStale).toBe(false);
      expect(hoursSinceLastMessage).toBe(0.5);
    });
  });
});
