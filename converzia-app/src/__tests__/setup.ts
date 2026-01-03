import { vi } from "vitest";

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.META_APP_SECRET = "test-meta-secret";
process.env.META_WEBHOOK_VERIFY_TOKEN = "test-verify-token";
process.env.CHATWOOT_WEBHOOK_SECRET = "test-chatwoot-secret";
process.env.PII_ENCRYPTION_KEY = "test-encryption-key-32chars!!";

// Global mocks
vi.mock("@/lib/supabase/query-with-timeout", () => ({
  queryWithTimeout: vi.fn((query) => query),
}));

// Mock logger to prevent console spam during tests
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    exception: vi.fn(),
    webhook: vi.fn(),
    delivery: vi.fn(),
    billing: vi.fn(),
    conversation: vi.fn(),
    security: vi.fn(),
  },
  setTraceId: vi.fn(),
  getTraceId: vi.fn(),
  generateTraceId: vi.fn(() => "test-trace-id"),
}));

// Mock monitoring
vi.mock("@/lib/monitoring", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    exception: vi.fn(),
    webhook: vi.fn(),
    delivery: vi.fn(),
    billing: vi.fn(),
    conversation: vi.fn(),
    security: vi.fn(),
  },
  Metrics: {
    webhookReceived: vi.fn(),
    webhookLatency: vi.fn(),
    deliveryAttempted: vi.fn(),
    deliveryLatency: vi.fn(),
    creditConsumed: vi.fn(),
    creditPurchased: vi.fn(),
    creditRefunded: vi.fn(),
    leadCreated: vi.fn(),
    leadQualified: vi.fn(),
    leadScored: vi.fn(),
    messageReceived: vi.fn(),
    messageSent: vi.fn(),
    openaiRequest: vi.fn(),
    openaiLatency: vi.fn(),
    ragSearch: vi.fn(),
    ragCacheHit: vi.fn(),
    ragCacheMiss: vi.fn(),
    errorOccurred: vi.fn(),
  },
  Alerts: {
    deliveryDeadLetter: vi.fn(),
    creditConsumptionFailed: vi.fn(),
    webhookSignatureInvalid: vi.fn(),
    piiEncryptionMissing: vi.fn(),
    lowCredits: vi.fn(),
    highErrorRate: vi.fn(),
    deliveryRetryExceeded: vi.fn(),
    chatwootSendFailed: vi.fn(),
    openaiRateLimited: vi.fn(),
    newTenantRegistered: vi.fn(),
    largeCreditPurchase: vi.fn(),
  },
  setTraceId: vi.fn(),
  getTraceId: vi.fn(),
  generateTraceId: vi.fn(() => "test-trace-id"),
  startTimer: vi.fn(() => () => 100),
}));








