// ============================================
// User & Auth Types
// ============================================

export type UserRole = "OWNER" | "ADMIN" | "BILLING" | "VIEWER";
export type MembershipStatus = "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED" | "REVOKED";

export type Permission =
  | "leads:read"
  | "leads:export"
  | "offers:read"
  | "offers:manage"
  | "users:read"
  | "users:invite"
  | "users:manage"
  | "billing:view"
  | "billing:manage"
  | "settings:read"
  | "settings:manage"
  | "*";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: ["*"],
  ADMIN: [
    "leads:read",
    "leads:export",
    "offers:read",
    "offers:manage",
    "users:read",
    "users:invite",
    "users:manage",
    "billing:view",
    "settings:read",
    "settings:manage",
  ],
  BILLING: [
    "leads:read",
    "offers:read",
    "billing:view",
    "billing:manage",
  ],
  VIEWER: [
    "leads:read",
    "offers:read",
  ],
};

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  is_converzia_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: UserRole;
  status: MembershipStatus;
  created_at: string;
  tenant: Tenant;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: UserProfile | null;
  memberships: TenantMembership[];
  isConverziaAdmin: boolean;
}

// ============================================
// Tenant Types
// ============================================

export type TenantStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "ARCHIVED" | "CHURNED" | "TRIAL";

export interface TenantWithStats extends Tenant {
  _count?: {
    leads?: number;
    offers?: number;
    members?: number;
  };
  credit_balance?: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: TenantStatus;
  timezone: string;
  score_threshold: number;
  default_score_threshold?: number;
  duplicate_window_hours: number;
  duplicate_window_days?: number;
  stripe_customer_id: string | null;
  activated_at?: string | null;
  // Trial credits
  trial_credits_granted?: boolean;
  trial_credits_amount?: number;
  trial_granted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantPricing {
  id: string;
  tenant_id: string;
  pricing_model: "CREDIT" | "SUBSCRIPTION" | "HYBRID";
  charge_model?: "PER_LEAD" | "PER_SALE" | "MONTHLY";
  credit_price?: number;
  cost_per_lead?: number;
  low_credit_threshold?: number;
  auto_refund_duplicates?: boolean;
  auto_refund_spam?: boolean;
  packages: CreditPackage[];
  created_at: string;
  updated_at: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  discount_pct?: number;
  is_popular?: boolean;
}

export interface TenantIntegration {
  id: string;
  tenant_id: string;
  integration_type: "GOOGLE_SHEETS" | "TOKKO" | "WEBHOOK";
  name: string;
  config: GoogleSheetsConfig | TokkoConfig | WebhookConfig;
  oauth_tokens?: GoogleOAuthTokens | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleSheetsConfig {
  spreadsheet_id: string;
  sheet_name: string;
  column_mapping: Record<string, string>;
  // Legacy: Service Account (optional, for backwards compatibility)
  service_account_json?: string;
}

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  email: string;
  token_type: string;
  scope: string;
}

export interface TokkoConfig {
  api_key: string;
  api_url: string;
  field_mapping: Record<string, string>;
}

export interface WebhookConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  auth_type: string;
  auth_value?: string;
}

// ============================================
// Offer Types
// ============================================

export type OfferStatus = "ACTIVE" | "DRAFT" | "PAUSED" | "ARCHIVED";
export type OfferType = "PROPERTY" | "AUTO" | "LOAN" | "INSURANCE";

export type OfferApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface Offer {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  offer_type: OfferType;
  status: OfferStatus;
  // Approval workflow (for tenant-created offers)
  approval_status?: OfferApprovalStatus;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  // Content
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  country: string;
  city: string | null;
  zone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  currency: string;
  price_from: number | null;
  price_to: number | null;
  priority: number;
  created_at: string;
  updated_at: string;
  // Relations (populated by queries)
  tenant?: { id: string; name: string };
  _count?: { variants?: number; leads?: number; ads?: number };
}

export interface OfferVariant {
  id: string;
  offer_id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  currency: string;
  price_from: number | null;
  price_to: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  offer_id: string;
  variant_id: string;
  unit_number: string;
  floor: number | null;
  currency: string;
  price: number | null;
  is_available: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Lead Types
// ============================================

export type LeadOfferStatus =
  | "PENDING_MAPPING"
  | "TO_BE_CONTACTED"
  | "CONTACTED"
  | "ENGAGED"
  | "QUALIFYING"
  | "SCORED"
  | "LEAD_READY"
  | "SENT_TO_DEVELOPER"
  | "COOLING"
  | "REACTIVATION"
  | "DEAD";

export interface Lead {
  id: string;
  phone: string;
  phone_normalized: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  country_code: string;
  first_contact_at: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadOffer {
  id: string;
  lead_id: string;
  tenant_id: string | null;
  offer_id: string | null;
  lead_source_id: string | null;
  status: LeadOfferStatus;
  qualification_fields: QualificationFields | null;
  score_total: number | null;
  score_breakdown: ScoreBreakdown | null;
  scored_at: string | null;
  qualified_at: string | null;
  billing_eligibility: string | null;
  billing_notes: string | null;
  contact_attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  first_response_at: string | null;
  reactivation_count: number;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
  lead?: Lead;
  offer?: Offer;
  tenant?: Tenant;
}

export interface QualificationFields {
  // Identity (some from Meta form, rest captured in conversation)
  name?: string;
  email?: string;
  dni?: string; // only for scoring/financing, with consent

  // Core search criteria
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  zone?: string[]; // preferred neighborhoods / zones
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string; // "departamento" | "casa" | "ph" | etc.
  timing?: string; // "inmediato" | "3 meses" | "6 meses" | "1 año" | "no definido"
  purpose?: string; // "vivienda" | "inversion" | "ambos"

  // Fine preferences (the more filled, the higher completeness bonus)
  garage?: boolean;
  garage_spaces?: number;
  amenities?: string[]; // ["pileta", "gym", "sum", "rooftop", ...]
  floor_preference?: string; // "bajo", "medio", "alto", "indistinto"
  orientation?: string; // "frente", "contrafrente", "lateral", "indistinto"
  balcony?: boolean;
  terrace?: boolean;
  pets_allowed?: boolean;
  m2_min?: number;
  m2_max?: number;

  // Financing
  financing?: boolean; // needs financing
  financing_type?: string; // "credito_hipotecario" | "desarrollador" | "pozo"
  pre_approved?: boolean;

  // Flags
  is_investor?: boolean;

  // Compliance / consent
  credit_bureau_consent?: boolean; // true when user explicitly agreed to Nosis/Equifax lookup
  credit_bureau_consent_at?: string; // ISO timestamp

  // Free-form
  notes?: string;
  [key: string]: unknown;
}

export interface ScoreBreakdown {
  budget?: number;
  zone?: number;
  timing?: number;
  completeness?: number;
  investor_bonus?: number;
  [key: string]: number | undefined;
}

export interface LeadSource {
  id: string;
  lead_id: string;
  platform: string;
  ad_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  form_id: string | null;
  leadgen_id: string | null;
  page_id: string | null;
  raw_data: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Ad Mapping Types
// ============================================

export interface AdOfferMap {
  id: string;
  tenant_id: string;
  offer_id: string;
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  form_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnmappedAd {
  ad_id: string;
  campaign_id: string | null;
  form_id: string | null;
  lead_count: number;
  first_lead_at: string;
  last_lead_at: string;
}

// ============================================
// Delivery Types
// ============================================

export type DeliveryStatus = "PENDING" | "DELIVERED" | "PARTIAL" | "FAILED" | "DEAD_LETTER" | "REFUNDED";

export interface Delivery {
  id: string;
  lead_offer_id: string;
  lead_id: string;
  tenant_id: string;
  offer_id: string | null;
  status: DeliveryStatus;
  payload: DeliveryPayload;
  sheets_delivered_at: string | null;
  crm_delivered_at: string | null;
  delivered_at: string | null;
  refunded_at: string | null;
  credit_ledger_id: string | null;
  error_message: string | null;
  retry_count: number;
  dead_letter_at: string | null;
  dead_letter_reason: string | null;
  integrations_attempted: string[];
  integrations_succeeded: string[];
  integrations_failed: string[];
  trace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPayload {
  lead: {
    name?: string;
    phone?: string;
    email?: string;
  };
  qualification?: QualificationFields;
  score?: {
    total?: number;
    breakdown?: ScoreBreakdown;
  };
  recommended_offer?: {
    id: string;
    name: string;
  } | null;
  alternatives?: Array<{
    id: string;
    name: string;
  }>;
  conversation_summary?: string | null;
  source?: string | null;
}

// ============================================
// Credit & Billing Types
// ============================================

export type TransactionType =
  | "CREDIT_PURCHASE"
  | "CREDIT_CONSUMPTION"
  | "CREDIT_REFUND"
  | "CREDIT_ADJUSTMENT"
  | "CREDIT_BONUS";

export interface CreditLedgerEntry {
  id: string;
  tenant_id: string;
  transaction_type: TransactionType;
  amount: number;
  balance_after: number;
  lead_offer_id: string | null;
  delivery_id: string | null;
  stripe_payment_id: string | null;
  stripe_session_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================
// Settings Types
// ============================================

export interface AppSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  is_secret: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  meta_app_id: string;
  meta_app_secret: string;
  meta_page_access_token: string;
  meta_webhook_verify_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_business_account_id: string;
  whatsapp_access_token: string;
  chatwoot_base_url: string;
  chatwoot_account_id: string;
  chatwoot_api_token: string;
  chatwoot_inbox_id: string;
  openai_api_key: string;
  openai_model_extraction: string;
  openai_model_response: string;
  openai_model_embedding: string;
  [key: string]: string;
}

// ============================================
// Knowledge / RAG Types
// ============================================

export interface KnowledgeSource {
  id: string;
  tenant_id: string;
  offer_id: string | null;
  source_type: "PDF" | "URL" | "TEXT" | "FAQ";
  title: string;
  content: string | null;
  url: string | null;
  file_path: string | null;
  is_active: boolean;
  last_indexed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  source_id: string;
  tenant_id: string;
  offer_id: string | null;
  chunk_index: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Event Types
// ============================================

export interface LeadEvent {
  id: string;
  lead_id: string;
  lead_offer_id: string | null;
  tenant_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  details: Record<string, unknown> | null;
  actor_type: string | null;
  actor_id: string | null;
  trace_id: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// WhatsApp Template Types
// ============================================

export interface WhatsAppTemplate {
  id: string;
  template_name: string;
  template_id: string | null;
  language: string;
  category: string;
  status: string;
  body_text: string;
  header_type: string | null;
  header_content: string | null;
  footer_text: string | null;
  buttons: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  variables: Array<{
    index: number;
    example: string;
  }>;
  use_for: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

