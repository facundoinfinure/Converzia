// ============================================
// Supabase Helper Types
// ============================================
// Types to avoid casting to 'any' when working with Supabase queries

import type { Database } from "./database";
import type { UserProfile, TenantMember, Tenant, Offer, LeadOffer, Delivery, Lead } from "./database";
import type { Tables } from "./database";

// ============================================
// Profile Types
// ============================================

export interface AdminProfile extends UserProfile {
  is_converzia_admin: boolean;
}

export interface ProfileWithAdmin extends UserProfile {
  is_converzia_admin: boolean;
}

// ============================================
// Membership Types
// ============================================

export interface MembershipWithRole extends TenantMember {
  role: "OWNER" | "ADMIN" | "BILLING" | "VIEWER";
}

export interface MembershipWithTenant extends TenantMember {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

// ============================================
// Offer Types
// ============================================

export interface OfferWithRelations extends Offer {
  tenant?: {
    id: string;
    name: string;
  };
  _count?: {
    variants?: number;
    leads?: number;
    ads?: number;
  };
}

// ============================================
// Lead Offer Types
// ============================================

export interface LeadOfferWithRelations extends LeadOffer {
  lead?: Lead | Lead[];
  offer?: Offer | Offer[];
  tenant?: Tenant | Tenant[];
}

// Type for Supabase query result with nested relations
export interface LeadOfferQueryResult {
  id: string;
  lead_id: string;
  tenant_id: string | null;
  offer_id: string | null;
  status: string;
  qualification_fields: Record<string, unknown> | null;
  score_total: number | null;
  score_breakdown: Record<string, unknown> | null;
  contact_attempts: number;
  reactivation_count: number;
  alternative_offers: unknown[] | null;
  lead?: Lead | Lead[];
  offer?: Offer | Offer[];
  tenant?: Tenant | Tenant[];
  lead_source?: {
    platform: string;
    ad_id: string | null;
    campaign_id: string | null;
    form_id: string | null;
  } | Array<{
    platform: string;
    ad_id: string | null;
    campaign_id: string | null;
    form_id: string | null;
  }>;
  [key: string]: unknown;
}

// Type for ad_offer_map query result
export interface AdOfferMapping {
  tenant_id: string;
  offer_id: string | null;
}

// Type for app_settings query result
export interface AppSetting {
  value: string | null;
}

// Type for upsert_lead_source RPC result
export interface UpsertLeadSourceResult {
  lead_source_id: string;
  was_created: boolean;
}

// ============================================
// Delivery Types
// ============================================

export interface DeliveryWithRelations extends Delivery {
  lead?: {
    id: string;
    phone: string;
    full_name: string | null;
  };
  offer?: {
    id: string;
    name: string;
  };
  tenant?: {
    id: string;
    name: string;
  };
}

// ============================================
// Supabase Query Response Helpers
// ============================================

export type SupabaseQueryResponse<T> = {
  data: T | null;
  error: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
  } | null;
  count?: number | null;
};

export type SupabaseRPCResponse<T> = {
  data: T | null;
  error: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
  } | null;
};

// ============================================
// Integration Config Types
// ============================================

export interface GoogleSheetsConfig {
  spreadsheet_id: string;
  sheet_name: string;
  column_mapping?: Record<string, string>;
  service_account_json?: string;
}

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email: string;
  token_type: string;
  scope: string;
}

export interface TokkoConfig {
  api_key: string;
  api_url?: string;
  publication_id_field?: string;
  field_mapping?: Record<string, string>;
}

export interface WebhookConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  auth_type: string;
  auth_value?: string;
}

export interface MetaIntegrationConfig {
  user_name?: string;
  selected_ad_accounts?: string[];
  // Historically stored as string[] (IDs) in some tenants; allow both.
  selected_pages?:
    | string[]
    | Array<{
        id: string;
        name: string;
        category?: string;
        access_token?: string;
      }>;
  selected_whatsapp_accounts?:
    | string[]
    | Array<{
        id: string;
        name: string;
        business_name?: string;
        phone_numbers?: Array<{
          id: string;
          phone_number: string;
        }>;
      }>;
  whatsapp_business_accounts?: Array<{
    id: string;
    name: string;
    business_name?: string;
    phone_numbers?: Array<{
      id: string;
      phone_number: string;
    }>;
  }>;
  // Legacy fields for backwards compatibility
  selected_ad_account_id?: string;
  selected_page_id?: string;
  selected_waba_id?: string;
  selected_phone_number_id?: string;
  ad_accounts?: Array<{
    id: string;
    account_id: string;
    name: string;
  }>;
  pages?: Array<{
    id: string;
    name: string;
    category?: string;
    access_token?: string;
  }>;
}

// ============================================
// Integration Types
// ============================================

export interface TenantIntegrationWithTokens {
  id: string;
  tenant_id: string | null; // null for global integrations
  integration_type: "GOOGLE_SHEETS" | "TOKKO" | "WEBHOOK" | "META_ADS";
  name: string;
  config: GoogleSheetsConfig | TokkoConfig | WebhookConfig | MetaIntegrationConfig;
  oauth_tokens?: GoogleOAuthTokens | MetaOAuthTokens | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaOAuthTokens {
  access_token: string;
  token_type: string;
  expires_at: number;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

// ============================================
// Billing Types
// ============================================

export interface CreditLedgerEntry {
  id: string;
  tenant_id: string;
  transaction_type: "CREDIT_PURCHASE" | "CREDIT_CONSUMPTION" | "CREDIT_REFUND" | "CREDIT_ADJUSTMENT" | "CREDIT_BONUS";
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

export interface BillingConsumptionItem {
  ledger_id: string;
  tenant_id: string;
  transaction_type: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  created_at: string;
  description: string | null;
  // Purchase fields
  package_name?: string | null;
  total?: number | null;
  currency?: string | null;
  credits_purchased?: number | null;
  cost_per_credit?: number | null;
  purchaser_name?: string | null;
  purchaser_email?: string | null;
  billing_order_id?: string | null;
  invoice_url?: string | null;
  // Consumption fields
  offer_id?: string | null;
  offer_name?: string | null;
  lead_offer_id?: string | null;
  lead_id?: string | null;
  lead_display_name?: string | null;
  lead_status?: string | null;
  delivery_id?: string | null;
}

// ============================================
// Revenue Types
// ============================================

export interface RevenueMetric {
  tenant_id: string;
  tenant_name: string;
  payments_received: number;
  leads_ready_count: number;
  leads_ready_value: number;
  leads_delivered_count: number;
  leads_delivered_value: number;
  attributed_spend: number;
  platform_spend: number;
  leads_raw_count: number;
  profit: number;
  margin_pct: number;
}

// ============================================
// OpenAI Response Types
// ============================================

export interface OpenAIQualificationResponse {
  fields: {
    name?: string;
    email?: string;
    budget?: {
      min?: number;
      max?: number;
      currency?: string;
    };
    zone?: string[];
    bedrooms?: number;
    bathrooms?: number;
    property_type?: string;
    timing?: string;
    purpose?: string;
    financing?: boolean;
    is_investor?: boolean;
    [key: string]: unknown;
  };
  confidence: number;
  missing_fields: string[];
}

export interface OpenAIResponseResponse {
  message: string;
  should_ask_followup: boolean;
  followup_question?: string;
}

export interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// Meta API Response Types
// ============================================

export interface MetaAdAccount {
  id: string;
  account_id: string;
  name: string;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

export interface MetaWhatsAppAccount {
  id: string;
  name: string;
  phone_number_id: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
  };
  created_time: string;
}

// ============================================
// Meta Webhook Types
// ============================================

export interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      value: {
        leadgen_id?: string;
        form_id?: string;
        ad_id?: string;
        adgroup_id?: string;
        adset_id?: string;
        campaign_id?: string;
        created_time?: number;
        page_id?: string;
      };
      field: string;
    }>;
  }>;
}

export interface MetaLeadData {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: Array<{
    name: string;
    values: string[];
  }>;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  created_time: string;
}

// ============================================
// Tokko API Response Types
// ============================================

export interface TokkoPublication {
  id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  zone?: string;
  price_from?: number;
  price_to?: number;
  currency?: string;
  image_url?: string;
  updated_at?: string;
}

export interface TokkoTypology {
  id: number;
  name: string;
  bedrooms?: number;
  bathrooms?: number;
  area_m2?: number;
  price_from?: number;
  price_to?: number;
  currency?: string;
  total_units?: number;
  available_units?: number;
}

export interface TokkoWebContactResponse {
  id?: string;
  contact_id?: string;
  success?: boolean;
  message?: string;
  error?: string;
}

// ============================================
// RAG Types
// ============================================

export interface RagSourceRow {
  id: string;
  tenant_id: string;
  offer_id: string | null;
  source_type: "PDF" | "URL" | "WEBSITE_SCRAPE" | "MANUAL";
  name: string;
  source_url?: string;
  storage_path?: string;
  approval_status?: "PENDING" | "APPROVED" | "REJECTED";
  is_active: boolean;
  last_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RagDocumentRow {
  id: string;
  source_id: string;
  tenant_id: string;
  offer_id: string | null;
  title: string;
  url?: string;
  raw_content: string;
  cleaned_content: string;
  content_hash: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  doc_type: string;
  word_count: number;
  chunk_count?: number;
  is_current?: boolean;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RagSearchRow {
  chunk_id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  combined_score?: number;
  vector_score?: number;
}

// Re-export Tenant from database types
export type { Tenant } from "./database";

// ============================================
// Billing Consumption Types
// ============================================

export interface BillingOrderRow {
  id: string;
  package_name: string | null;
  credits_purchased: number;
  total: number;
  currency: string;
  invoice_url: string | null;
  stripe_invoice_id: string | null;
  stripe_checkout_session_id: string | null;
}

export interface PurchaserRow {
  full_name: string | null;
  email: string;
}

export interface DeliveryRow {
  id: string;
  lead_offer_id: string;
  status: string;
}

export interface OfferRow {
  name: string;
}

export interface LeadRow {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
}

export interface LeadOfferRow {
  id: string;
  offer_id: string | null;
  status: string;
  offer?: OfferRow | OfferRow[];
  lead?: LeadRow | LeadRow[];
}

export interface CreditLedgerRowWithRelations {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
  billing_order_id: string | null;
  delivery_id: string | null;
  lead_offer_id: string | null;
  created_by: string | null;
  billing_order?: BillingOrderRow | BillingOrderRow[] | null;
  purchaser?: PurchaserRow | PurchaserRow[] | null;
  delivery?: DeliveryRow | DeliveryRow[] | null;
  lead_offer?: LeadOfferRow | LeadOfferRow[] | null;
}

// ============================================
// Utility Type Guards
// ============================================

export function isAdminProfile(profile: UserProfile | null | { is_converzia_admin?: boolean }): profile is AdminProfile {
  return profile !== null && 
         typeof profile === 'object' && 
         "is_converzia_admin" in profile && 
         profile.is_converzia_admin === true;
}

export function hasOAuthTokens(integration: TenantIntegrationWithTokens): integration is TenantIntegrationWithTokens & { oauth_tokens: GoogleOAuthTokens } {
  return integration.oauth_tokens !== null && integration.oauth_tokens !== undefined;
}
