// Database types - Generated from Supabase schema
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: "PENDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
          default_score_threshold: number;
          duplicate_window_days: number;
          timezone: string;
          contact_email: string | null;
          contact_phone: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
          activated_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["tenants"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          is_converzia_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: "OWNER" | "ADMIN" | "BILLING" | "VIEWER";
          status: "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | "REVOKED";
          invited_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tenant_members"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tenant_members"]["Insert"]>;
      };
      offers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          slug: string;
          offer_type: "PROPERTY" | "AUTO" | "LOAN" | "INSURANCE";
          status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
          description: string | null;
          short_description: string | null;
          image_url: string | null;
          address: string | null;
          city: string | null;
          zone: string | null;
          country: string;
          latitude: number | null;
          longitude: number | null;
          price_from: number | null;
          price_to: number | null;
          currency: string;
          priority: number;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["offers"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["offers"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          phone: string;
          phone_normalized: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          full_name: string | null;
          opted_out: boolean;
          opted_out_at: string | null;
          opt_out_reason: string | null;
          country_code: string;
          language: string;
          created_at: string;
          updated_at: string;
          first_contact_at: string | null;
          last_contact_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      lead_offers: {
        Row: {
          id: string;
          lead_id: string;
          offer_id: string | null;
          tenant_id: string;
          lead_source_id: string | null;
          status: string;
          previous_status: string | null;
          status_changed_at: string;
          qualification_fields: Json;
          score_total: number | null;
          score_breakdown: Json;
          scored_at: string | null;
          billing_eligibility: string;
          billing_notes: string | null;
          recommended_offer_id: string | null;
          alternative_offers: Json;
          contact_attempts: number;
          last_attempt_at: string | null;
          next_attempt_at: string | null;
          reactivation_count: number;
          created_at: string;
          updated_at: string;
          first_response_at: string | null;
          qualified_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["lead_offers"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["lead_offers"]["Insert"]>;
      };
      conversations: {
        Row: {
          id: string;
          lead_id: string;
          tenant_id: string;
          chatwoot_conversation_id: string;
          chatwoot_contact_id: string | null;
          chatwoot_inbox_id: string | null;
          is_active: boolean;
          summary: string | null;
          summary_generated_at: string | null;
          message_count: number;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["conversations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          lead_id: string;
          chatwoot_message_id: string | null;
          direction: "INBOUND" | "OUTBOUND";
          sender: "LEAD" | "BOT" | "OPERATOR";
          content: string;
          media_type: string | null;
          media_url: string | null;
          processed: boolean;
          extracted_data: Json;
          sent_at: string;
          delivered_at: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      deliveries: {
        Row: {
          id: string;
          lead_offer_id: string;
          lead_id: string;
          tenant_id: string;
          offer_id: string | null;
          status: "PENDING" | "DELIVERED" | "FAILED" | "REFUNDED";
          payload: Json;
          sheets_row_id: string | null;
          sheets_delivered_at: string | null;
          crm_record_id: string | null;
          crm_delivered_at: string | null;
          error_message: string | null;
          retry_count: number;
          credit_ledger_id: string | null;
          created_at: string;
          delivered_at: string | null;
          refunded_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["deliveries"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["deliveries"]["Insert"]>;
      };
      credit_ledger: {
        Row: {
          id: string;
          tenant_id: string;
          transaction_type: "CREDIT_PURCHASE" | "CREDIT_CONSUMPTION" | "CREDIT_REFUND" | "CREDIT_ADJUSTMENT" | "CREDIT_BONUS";
          amount: number;
          balance_after: number;
          billing_order_id: string | null;
          delivery_id: string | null;
          lead_offer_id: string | null;
          description: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["credit_ledger"]["Row"], "id" | "created_at" | "balance_after">;
        Update: Partial<Database["public"]["Tables"]["credit_ledger"]["Insert"]>;
      };
    };
    Views: {
      tenant_credit_balance: {
        Row: {
          tenant_id: string;
          current_balance: number;
          total_purchased: number;
          total_consumed: number;
          total_refunded: number;
        };
      };
    };
    Functions: {
      get_tenant_credits: {
        Args: { p_tenant_id: string };
        Returns: number;
      };
      consume_credit: {
        Args: {
          p_tenant_id: string;
          p_delivery_id: string;
          p_lead_offer_id: string;
          p_description?: string;
        };
        Returns: { success: boolean; new_balance: number; message: string }[];
      };
    };
  };
};





