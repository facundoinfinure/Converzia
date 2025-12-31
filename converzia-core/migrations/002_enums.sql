-- ============================================
-- Converzia: Enum Types
-- Migration: 002_enums
-- ============================================

-- Offer types (multi-vertical ready)
CREATE TYPE offer_type AS ENUM (
  'PROPERTY',
  'AUTO',
  'LOAN',
  'INSURANCE'
);

-- Offer status
CREATE TYPE offer_status AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED'
);

-- Lead-Offer state machine
CREATE TYPE lead_offer_status AS ENUM (
  'PENDING_MAPPING',
  'TO_BE_CONTACTED',
  'CONTACTED',
  'ENGAGED',
  'QUALIFYING',
  'SCORED',
  'LEAD_READY',
  'SENT_TO_DEVELOPER',
  'COOLING',
  'REACTIVATION',
  'DISQUALIFIED',
  'STOPPED',
  'HUMAN_HANDOFF'
);

-- Tenant membership status
CREATE TYPE membership_status AS ENUM (
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
);

-- Tenant member roles
CREATE TYPE tenant_role AS ENUM (
  'OWNER',
  'ADMIN',
  'BILLING',
  'VIEWER'
);

-- Billing charge model
CREATE TYPE charge_model AS ENUM (
  'PER_LEAD',
  'PER_SALE',
  'SUBSCRIPTION'
);

-- Billing eligibility status
CREATE TYPE billing_eligibility AS ENUM (
  'CHARGEABLE',
  'NOT_CHARGEABLE_DUPLICATE',
  'NOT_CHARGEABLE_SPAM',
  'NOT_CHARGEABLE_INCOMPLETE',
  'NOT_CHARGEABLE_OUT_OF_ZONE',
  'PENDING'
);

-- Credit ledger transaction types
CREATE TYPE credit_transaction_type AS ENUM (
  'CREDIT_PURCHASE',
  'CREDIT_CONSUMPTION',
  'CREDIT_REFUND',
  'CREDIT_ADJUSTMENT',
  'CREDIT_BONUS'
);

-- Delivery status
CREATE TYPE delivery_status AS ENUM (
  'PENDING',
  'DELIVERED',
  'FAILED',
  'REFUNDED'
);

-- RAG source types
CREATE TYPE rag_source_type AS ENUM (
  'PDF',
  'URL',
  'WEBSITE_SCRAPE',
  'MANUAL'
);

-- RAG document status
CREATE TYPE rag_document_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- Tenant status
CREATE TYPE tenant_status AS ENUM (
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

-- Message direction
CREATE TYPE message_direction AS ENUM (
  'INBOUND',
  'OUTBOUND'
);

-- Message sender type
CREATE TYPE message_sender AS ENUM (
  'LEAD',
  'BOT',
  'OPERATOR'
);

-- Event types for audit
CREATE TYPE lead_event_type AS ENUM (
  'CREATED',
  'STATUS_CHANGE',
  'FIELD_UPDATED',
  'SCORE_CALCULATED',
  'MESSAGE_SENT',
  'MESSAGE_RECEIVED',
  'DELIVERY_ATTEMPTED',
  'DELIVERY_COMPLETED',
  'DELIVERY_FAILED',
  'CREDIT_CONSUMED',
  'CREDIT_REFUNDED',
  'OPT_OUT',
  'REACTIVATION_STARTED',
  'MANUAL_ACTION'
);











