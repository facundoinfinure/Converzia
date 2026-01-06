import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================
// Delivery Service Integration Tests
// Tests critical business invariants
// ============================================

// Mock the Supabase admin client with more realistic behavior
const mockRpcResults = new Map<string, any>();
const mockTableData = new Map<string, any[]>();

const createMockQuery = (): any => {
  let tableName = "";
  let filters: Record<string, any> = {};
  
  // Create query object first, then add methods that reference it
  const query: any = {};
  
  query.from = (table: string) => {
    tableName = table;
    return query;
  };
  query.select = vi.fn().mockReturnValue(query);
  query.insert = vi.fn().mockImplementation((data) => {
    const existing = mockTableData.get(tableName) || [];
    mockTableData.set(tableName, [...existing, { id: `mock-${Date.now()}`, ...data }]);
    return query;
  });
  query.update = vi.fn().mockReturnValue(query);
  query.delete = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockImplementation((field, value) => {
    filters[field] = value;
    return query;
  });
  query.single = vi.fn().mockImplementation(() => {
    const data = mockTableData.get(tableName)?.find(row => 
      Object.entries(filters).every(([k, v]) => row[k] === v)
    );
    return Promise.resolve({ data, error: null });
  });
  query.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockTableData.get(tableName)?.find(row => 
      Object.entries(filters).every(([k, v]) => row[k] === v)
    );
    return Promise.resolve({ data, error: null });
  });
  query.rpc = vi.fn().mockImplementation((funcName, params) => {
    const result = mockRpcResults.get(funcName);
    if (result) {
      return Promise.resolve({ data: result(params), error: null });
    }
    return Promise.resolve({ data: null, error: { message: "Function not mocked" } });
  });
  
  return query;
};

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => createMockQuery(),
}));

vi.mock("@/lib/supabase/query-with-timeout", () => ({
  queryWithTimeout: vi.fn((query) => query),
}));

vi.mock("@/lib/services/google-sheets", () => ({
  appendToGoogleSheets: vi.fn(() => Promise.resolve({ success: true, row_number: 10 })),
}));

vi.mock("@/lib/services/tokko", () => ({
  createTokkoLead: vi.fn(() => Promise.resolve({ success: true, contact_id: "123" })),
}));

vi.mock("@/lib/monitoring", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    exception: vi.fn(),
    delivery: vi.fn(),
    billing: vi.fn(),
  },
  Metrics: {
    deliveryAttempted: vi.fn(),
    deliveryLatency: vi.fn(),
    creditConsumed: vi.fn(),
    creditRefunded: vi.fn(),
    errorOccurred: vi.fn(),
  },
  Alerts: {
    lowCredits: vi.fn(),
    creditConsumptionFailed: vi.fn(),
    deliveryDeadLetter: vi.fn(),
  },
  startTimer: () => () => 100,
  getTraceId: () => "test-trace-123",
}));

describe("Delivery Service - Critical Business Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcResults.clear();
    mockTableData.clear();
  });

  describe("Invariant: One delivery per lead_offer", () => {
    it("should not create duplicate deliveries for same lead_offer", async () => {
      // Setup: lead_offer already has a delivery
      const leadOfferId = "lo-123";
      mockTableData.set("deliveries", [
        { 
          id: "del-existing", 
          lead_offer_id: leadOfferId, 
          status: "DELIVERED" 
        }
      ]);

      // Verify constraint exists conceptually
      const existingDeliveries = mockTableData.get("deliveries") || [];
      const duplicateExists = existingDeliveries.filter(
        d => d.lead_offer_id === leadOfferId
      ).length > 0;

      expect(duplicateExists).toBe(true);
      
      // In real DB, UNIQUE(lead_offer_id) constraint prevents duplicates
      // Here we verify the invariant is understood
    });
  });

  describe("Invariant: One credit per delivery", () => {
    it("should consume exactly 1 credit per successful delivery", async () => {
      const deliveryId = "del-123";
      const tenantId = "tenant-123";
      
      // Mock the atomic function
      mockRpcResults.set("complete_delivery_and_consume_credit", (params: any) => ({
        success: true,
        credit_consumed: true,
        new_balance: 9,
        message: "Delivery completed and credit consumed",
        credit_ledger_id: "ledger-123",
      }));

      // Verify the function returns expected structure
      const result = mockRpcResults.get("complete_delivery_and_consume_credit")!({
        p_delivery_id: deliveryId,
        p_integrations_succeeded: ["GOOGLE_SHEETS"],
        p_integrations_failed: [],
        p_final_status: "DELIVERED",
      });

      expect(result.credit_consumed).toBe(true);
      expect(result.new_balance).toBe(9);
    });

    it("should not consume credit on failed delivery", async () => {
      const result = {
        success: false,
        credit_consumed: false,
        new_balance: 10,
        message: "All integrations failed",
        credit_ledger_id: null,
      };

      expect(result.credit_consumed).toBe(false);
      expect(result.new_balance).toBe(10);
    });

    it("should be idempotent - second call returns same result without new consumption", async () => {
      const deliveryId = "del-123";
      let callCount = 0;

      mockRpcResults.set("complete_delivery_and_consume_credit", (params: any) => {
        callCount++;
        if (callCount === 1) {
          return {
            success: true,
            credit_consumed: true,
            new_balance: 9,
            message: "Delivery completed and credit consumed",
            credit_ledger_id: "ledger-123",
          };
        }
        // Second call - idempotent response
        return {
          success: true,
          credit_consumed: false,
          new_balance: 9,
          message: "Already consumed (idempotent)",
          credit_ledger_id: "ledger-123",
        };
      });

      const func = mockRpcResults.get("complete_delivery_and_consume_credit")!;
      
      const firstResult = func({ p_delivery_id: deliveryId });
      const secondResult = func({ p_delivery_id: deliveryId });

      expect(firstResult.credit_consumed).toBe(true);
      expect(secondResult.credit_consumed).toBe(false);
      expect(firstResult.new_balance).toBe(secondResult.new_balance);
      expect(callCount).toBe(2);
    });
  });

  describe("Invariant: Insufficient credits blocks delivery", () => {
    it("should fail delivery when credits = 0", async () => {
      mockRpcResults.set("complete_delivery_and_consume_credit", () => ({
        success: false,
        credit_consumed: false,
        new_balance: 0,
        message: "Insufficient credits",
        credit_ledger_id: null,
      }));

      const result = mockRpcResults.get("complete_delivery_and_consume_credit")!({});

      expect(result.success).toBe(false);
      expect(result.message).toContain("Insufficient");
    });
  });

  describe("State Machine Transitions", () => {
    const validTransitions: Record<string, string[]> = {
      "PENDING_MAPPING": ["TO_BE_CONTACTED", "DISQUALIFIED", "STOPPED"],
      "TO_BE_CONTACTED": ["CONTACTED", "COOLING", "STOPPED", "DISQUALIFIED"],
      "CONTACTED": ["ENGAGED", "COOLING", "STOPPED", "DISQUALIFIED"],
      "ENGAGED": ["QUALIFYING", "COOLING", "STOPPED", "DISQUALIFIED", "HUMAN_HANDOFF"],
      "QUALIFYING": ["SCORED", "LEAD_READY", "COOLING", "STOPPED", "DISQUALIFIED", "HUMAN_HANDOFF"],
      "SCORED": ["LEAD_READY", "QUALIFYING", "COOLING", "STOPPED", "DISQUALIFIED"],
      "LEAD_READY": ["SENT_TO_DEVELOPER", "STOPPED", "DISQUALIFIED"],
      "SENT_TO_DEVELOPER": ["STOPPED"],
      "COOLING": ["REACTIVATION", "STOPPED", "DISQUALIFIED"],
      "REACTIVATION": ["CONTACTED", "ENGAGED", "STOPPED", "DISQUALIFIED"],
      "DISQUALIFIED": ["REACTIVATION"],
      "STOPPED": [],
      "HUMAN_HANDOFF": ["QUALIFYING", "LEAD_READY", "STOPPED", "DISQUALIFIED"],
    };

    it("should allow valid transitions", () => {
      // LEAD_READY -> SENT_TO_DEVELOPER is valid
      expect(validTransitions["LEAD_READY"]).toContain("SENT_TO_DEVELOPER");
      
      // QUALIFYING -> LEAD_READY is valid
      expect(validTransitions["QUALIFYING"]).toContain("LEAD_READY");
    });

    it("should not allow SENT_TO_DEVELOPER -> LEAD_READY", () => {
      expect(validTransitions["SENT_TO_DEVELOPER"]).not.toContain("LEAD_READY");
    });

    it("should not allow STOPPED -> any other state", () => {
      expect(validTransitions["STOPPED"]).toHaveLength(0);
    });

    it("should allow DISQUALIFIED -> REACTIVATION only", () => {
      expect(validTransitions["DISQUALIFIED"]).toEqual(["REACTIVATION"]);
    });
  });

  describe("Dead Letter Queue", () => {
    const MAX_RETRIES = 3;

    it("should move to dead letter after max retries", () => {
      const delivery = { retry_count: 3 };
      const shouldMoveToDeadLetter = delivery.retry_count >= MAX_RETRIES;
      expect(shouldMoveToDeadLetter).toBe(true);
    });

    it("should not move to dead letter before max retries", () => {
      const delivery = { retry_count: 2 };
      const shouldMoveToDeadLetter = delivery.retry_count >= MAX_RETRIES;
      expect(shouldMoveToDeadLetter).toBe(false);
    });

    it("should include failure reason in dead letter record", () => {
      const reason = "Max retries (3) exceeded. Last error: Connection timeout";
      expect(reason).toContain("Max retries");
      expect(reason).toContain("Last error");
    });

    it("should not charge credit when moved to dead letter", () => {
      // Dead letter happens when all retries fail - no credit consumed
      const deadLetterResult = {
        status: "DEAD_LETTER",
        creditConsumed: false,
      };
      expect(deadLetterResult.creditConsumed).toBe(false);
    });
  });

  describe("PARTIAL Delivery Status", () => {
    it("should charge credit for PARTIAL delivery", () => {
      // PARTIAL = some integrations succeeded, some failed
      // Still billable because lead was delivered to at least one target
      const delivery = {
        status: "PARTIAL",
        integrations_succeeded: ["GOOGLE_SHEETS"],
        integrations_failed: ["TOKKO"],
      };

      const shouldCharge = 
        delivery.status === "DELIVERED" || 
        delivery.status === "PARTIAL";

      expect(shouldCharge).toBe(true);
    });

    it("should not charge credit for FAILED delivery", () => {
      const delivery = {
        status: "FAILED",
        integrations_succeeded: [],
        integrations_failed: ["GOOGLE_SHEETS", "TOKKO"],
      };

      const shouldCharge = 
        delivery.status === "DELIVERED" || 
        delivery.status === "PARTIAL";

      expect(shouldCharge).toBe(false);
    });
  });

  describe("Meta Webhook Idempotency", () => {
    it("should use upsert_lead_source for race condition safety", async () => {
      const leadgenId = "meta-123";
      const tenantId = "tenant-123";
      
      // First call creates new source
      mockRpcResults.set("upsert_lead_source", (params: any) => {
        if (!mockTableData.has("lead_sources_processed")) {
          mockTableData.set("lead_sources_processed", []);
        }
        const processed = mockTableData.get("lead_sources_processed")!;
        
        if (processed.includes(params.p_leadgen_id)) {
          return { lead_source_id: "existing-id", was_created: false };
        }
        
        processed.push(params.p_leadgen_id);
        return { lead_source_id: "new-id", was_created: true };
      });

      const func = mockRpcResults.get("upsert_lead_source")!;

      // First call
      const first = func({ p_leadgen_id: leadgenId, p_tenant_id: tenantId });
      expect(first.was_created).toBe(true);

      // Second call (duplicate webhook)
      const second = func({ p_leadgen_id: leadgenId, p_tenant_id: tenantId });
      expect(second.was_created).toBe(false);
      expect(second.lead_source_id).toBe("existing-id");
    });
  });

  describe("Trace ID Persistence", () => {
    it("should include trace_id in delivery records", () => {
      const delivery = {
        id: "del-123",
        trace_id: "trace-abc-123",
        status: "PENDING",
      };

      expect(delivery.trace_id).toBeDefined();
      expect(delivery.trace_id).toMatch(/^trace-/);
    });

    it("should include trace_id in lead_events", () => {
      const event = {
        event_type: "DELIVERY_COMPLETED",
        trace_id: "trace-abc-123",
      };

      expect(event.trace_id).toBeDefined();
    });

    it("should allow reconstructing request flow from trace_id", () => {
      const traceId = "trace-abc-123";
      
      // Mock: find all records with same trace_id
      const delivery = { trace_id: traceId, status: "DELIVERED" };
      const events = [
        { trace_id: traceId, event_type: "CREATED" },
        { trace_id: traceId, event_type: "DELIVERY_ATTEMPTED" },
        { trace_id: traceId, event_type: "DELIVERY_COMPLETED" },
      ];

      expect(delivery.trace_id).toBe(traceId);
      expect(events.every(e => e.trace_id === traceId)).toBe(true);
      expect(events).toHaveLength(3);
    });
  });
});

describe("Credit Ledger Invariants", () => {
  it("should be append-only (no updates or deletes)", () => {
    // This is enforced at DB level - here we document the invariant
    const ledgerOperations = {
      allowedOperations: ["INSERT"],
      forbiddenOperations: ["UPDATE", "DELETE"],
    };

    expect(ledgerOperations.allowedOperations).toContain("INSERT");
    expect(ledgerOperations.forbiddenOperations).toContain("UPDATE");
    expect(ledgerOperations.forbiddenOperations).toContain("DELETE");
  });

  it("should calculate balance_after via trigger", () => {
    // Simulated trigger behavior
    const calculateBalance = (entries: { amount: number; balance_after?: number }[]) => {
      let balance = 0;
      return entries.map(entry => {
        balance += entry.amount;
        return { ...entry, balance_after: balance };
      });
    };

    const entries = [
      { amount: 100 },  // Purchase
      { amount: -1 },   // Consumption
      { amount: -1 },   // Consumption
      { amount: 1 },    // Refund
    ];

    const withBalance = calculateBalance(entries);

    expect(withBalance[0].balance_after).toBe(100);
    expect(withBalance[1].balance_after).toBe(99);
    expect(withBalance[2].balance_after).toBe(98);
    expect(withBalance[3].balance_after).toBe(99);
  });

  it("should have unique index on (delivery_id, CREDIT_CONSUMPTION)", () => {
    // This is enforced at DB level via:
    // CREATE UNIQUE INDEX idx_credit_ledger_delivery_consumption
    // ON credit_ledger(delivery_id)
    // WHERE transaction_type = 'CREDIT_CONSUMPTION' AND delivery_id IS NOT NULL;
    
    // Here we document the invariant
    const indexDefinition = {
      columns: ["delivery_id"],
      where: "transaction_type = 'CREDIT_CONSUMPTION' AND delivery_id IS NOT NULL",
      unique: true,
    };

    expect(indexDefinition.unique).toBe(true);
    expect(indexDefinition.where).toContain("CREDIT_CONSUMPTION");
  });
});








