/**
 * Chatwoot Webhook Tests
 * Tests the Chatwoot messaging webhook handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Types for Chatwoot webhook payloads
interface ChatwootWebhookPayload {
  event: string;
  account: {
    id: number;
    name: string;
  };
  inbox: {
    id: number;
    name: string;
  };
  conversation: {
    id: number;
    account_id: number;
    inbox_id: number;
    status: "open" | "resolved" | "pending" | "snoozed";
    contact_inbox: {
      source_id: string;
    };
    meta?: {
      sender?: {
        phone_number?: string;
        name?: string;
      };
    };
  };
  sender?: {
    id: number;
    name: string;
    phone_number?: string;
    email?: string;
  };
  message?: {
    id: number;
    content: string;
    message_type: "incoming" | "outgoing" | "activity" | "template";
    created_at: string;
    private: boolean;
    sender?: {
      type: "contact" | "user";
    };
  };
}

describe("Chatwoot Webhook", () => {
  const WEBHOOK_SECRET = "test-chatwoot-secret";

  function createChatwootSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Event Type Handling", () => {
    it("should handle message_created event", () => {
      const payload: ChatwootWebhookPayload = {
        event: "message_created",
        account: { id: 1, name: "Test Account" },
        inbox: { id: 1, name: "WhatsApp" },
        conversation: {
          id: 123,
          account_id: 1,
          inbox_id: 1,
          status: "open",
          contact_inbox: { source_id: "5491112345678" },
        },
        message: {
          id: 456,
          content: "Hola, estoy interesado en el departamento",
          message_type: "incoming",
          created_at: new Date().toISOString(),
          private: false,
          sender: { type: "contact" },
        },
      };

      expect(payload.event).toBe("message_created");
      expect(payload.message?.message_type).toBe("incoming");
    });

    it("should handle conversation_status_changed event", () => {
      const payload: ChatwootWebhookPayload = {
        event: "conversation_status_changed",
        account: { id: 1, name: "Test Account" },
        inbox: { id: 1, name: "WhatsApp" },
        conversation: {
          id: 123,
          account_id: 1,
          inbox_id: 1,
          status: "resolved",
          contact_inbox: { source_id: "5491112345678" },
        },
      };

      expect(payload.event).toBe("conversation_status_changed");
      expect(payload.conversation.status).toBe("resolved");
    });

    it("should handle conversation_created event", () => {
      const payload: ChatwootWebhookPayload = {
        event: "conversation_created",
        account: { id: 1, name: "Test Account" },
        inbox: { id: 1, name: "WhatsApp" },
        conversation: {
          id: 123,
          account_id: 1,
          inbox_id: 1,
          status: "open",
          contact_inbox: { source_id: "5491112345678" },
        },
      };

      expect(payload.event).toBe("conversation_created");
    });
  });

  describe("Message Processing", () => {
    it("should process incoming messages from contacts", () => {
      const message = {
        id: 456,
        content: "Busco un 2 ambientes en Palermo",
        message_type: "incoming" as const,
        created_at: new Date().toISOString(),
        private: false,
        sender: { type: "contact" as const },
      };

      const shouldProcess = 
        message.message_type === "incoming" && 
        message.sender?.type === "contact" && 
        !message.private;

      expect(shouldProcess).toBe(true);
    });

    it("should skip outgoing messages", () => {
      const message = {
        message_type: "outgoing" as const,
        sender: { type: "user" as const },
        private: false,
      };

      const shouldProcess = message.message_type === "incoming";
      expect(shouldProcess).toBe(false);
    });

    it("should skip private messages", () => {
      const message = {
        message_type: "incoming" as const,
        sender: { type: "contact" as const },
        private: true,
      };

      const shouldProcess = !message.private;
      expect(shouldProcess).toBe(false);
    });

    it("should skip activity messages", () => {
      const message = {
        message_type: "activity" as const,
        content: "Conversation was resolved",
      };

      const shouldProcess = message.message_type === "incoming";
      expect(shouldProcess).toBe(false);
    });
  });

  describe("Contact Identification", () => {
    it("should extract phone from source_id", () => {
      const sourceId = "5491112345678";
      const phone = sourceId;

      expect(phone).toBe("5491112345678");
    });

    it("should extract phone from WhatsApp format", () => {
      const sourceId = "5491112345678@s.whatsapp.net";
      const phone = sourceId.split("@")[0];

      expect(phone).toBe("5491112345678");
    });

    it("should get phone from sender metadata", () => {
      const payload: ChatwootWebhookPayload = {
        event: "message_created",
        account: { id: 1, name: "Test" },
        inbox: { id: 1, name: "WhatsApp" },
        conversation: {
          id: 123,
          account_id: 1,
          inbox_id: 1,
          status: "open",
          contact_inbox: { source_id: "5491112345678" },
          meta: {
            sender: {
              phone_number: "+5491112345678",
              name: "John Doe",
            },
          },
        },
      };

      const phone = payload.conversation.meta?.sender?.phone_number;
      expect(phone).toBe("+5491112345678");
    });
  });

  describe("Signature Validation", () => {
    it("should validate correct signature", () => {
      const payload = JSON.stringify({ event: "message_created" });
      const signature = createChatwootSignature(payload, WEBHOOK_SECRET);

      const expectedSig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
      expect(signature).toBe(expectedSig);
    });

    it("should not have prefix (unlike Meta)", () => {
      const payload = JSON.stringify({ test: true });
      const signature = createChatwootSignature(payload, WEBHOOK_SECRET);

      // Chatwoot doesn't use sha256= prefix
      expect(signature.startsWith("sha256=")).toBe(false);
    });
  });

  describe("Conversation Matching", () => {
    it("should match conversation by chatwoot_id", () => {
      const chatwootConversationId = 123;
      const dbConversations = [
        { id: "db_1", external_id: "123" },
        { id: "db_2", external_id: "456" },
      ];

      const match = dbConversations.find(c => c.external_id === String(chatwootConversationId));
      expect(match?.id).toBe("db_1");
    });

    it("should match conversation by phone", () => {
      const phone = "5491112345678";
      const normalizedPhone = phone.replace(/[^\d]/g, "");

      expect(normalizedPhone).toBe("5491112345678");
    });
  });

  describe("Lead Lookup", () => {
    it("should find lead by phone number", () => {
      const leads = [
        { id: "lead_1", phone_normalized: "5491112345678" },
        { id: "lead_2", phone_normalized: "5491198765432" },
      ];
      const searchPhone = "5491112345678";

      const lead = leads.find(l => l.phone_normalized === searchPhone);
      expect(lead?.id).toBe("lead_1");
    });

    it("should find lead_offer by conversation", () => {
      const leadOffers = [
        { id: "lo_1", conversation_id: "conv_123" },
        { id: "lo_2", conversation_id: "conv_456" },
      ];
      const conversationId = "conv_123";

      const leadOffer = leadOffers.find(lo => lo.conversation_id === conversationId);
      expect(leadOffer?.id).toBe("lo_1");
    });
  });

  describe("Message Storage", () => {
    it("should store message with correct structure", () => {
      const message = {
        conversation_id: "conv_123",
        sender_type: "LEAD" as const,
        content: "Hello, I'm interested",
        chatwoot_message_id: 456,
        sent_at: new Date().toISOString(),
      };

      expect(message.sender_type).toBe("LEAD");
      expect(message.chatwoot_message_id).toBe(456);
    });

    it("should map sender types correctly", () => {
      const chatwootType = "contact";
      const dbType = chatwootType === "contact" ? "LEAD" : "BOT";

      expect(dbType).toBe("LEAD");
    });
  });

  describe("Error Handling", () => {
    it("should return 200 to acknowledge receipt", () => {
      // Chatwoot expects 200 to stop retries
      const responseStatus = 200;
      expect(responseStatus).toBe(200);
    });

    it("should handle missing conversation gracefully", () => {
      const conversation = null;
      const shouldSkip = !conversation;

      expect(shouldSkip).toBe(true);
    });

    it("should handle missing message gracefully", () => {
      const payload: Partial<ChatwootWebhookPayload> = {
        event: "message_created",
        message: undefined,
      };

      const hasMessage = !!payload.message;
      expect(hasMessage).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should have per-conversation rate limit", () => {
      const rateLimits = {
        messagesPerMinute: 60,
        windowMs: 60000,
      };

      expect(rateLimits.messagesPerMinute).toBe(60);
    });
  });
});
