-- ============================================
-- Converzia: Billing Tables
-- Migration: 005_billing_tables
-- ============================================

-- ============================================
-- TENANT PRICING (per-tenant config)
-- ============================================
CREATE TABLE tenant_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Charge model
  charge_model charge_model NOT NULL DEFAULT 'PER_LEAD',
  
  -- PER_LEAD pricing
  cost_per_lead DECIMAL(10, 2) DEFAULT 10.00,
  currency TEXT DEFAULT 'USD',
  
  -- PER_SALE pricing (future)
  success_fee_percentage DECIMAL(5, 2),
  success_fee_flat DECIMAL(10, 2),
  
  -- Package options
  packages JSONB DEFAULT '[]',
  -- Example:
  -- [
  --   { "credits": 50, "price": 400, "name": "Starter" },
  --   { "credits": 100, "price": 700, "name": "Growth", "discount_pct": 12.5 },
  --   { "credits": 250, "price": 1500, "name": "Scale", "discount_pct": 25 }
  -- ]
  
  -- Thresholds
  low_credit_threshold INTEGER DEFAULT 10,
  
  -- Auto-refund rules
  auto_refund_duplicates BOOLEAN DEFAULT TRUE,
  auto_refund_spam BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_pricing_tenant ON tenant_pricing(tenant_id);

-- ============================================
-- STRIPE CUSTOMERS
-- ============================================
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  stripe_customer_id TEXT NOT NULL UNIQUE,
  
  -- Billing info
  billing_email TEXT,
  billing_name TEXT,
  
  -- Default payment method
  default_payment_method_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_customers_tenant ON stripe_customers(tenant_id);
CREATE INDEX idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);

-- ============================================
-- BILLING ORDERS (package purchases)
-- ============================================
CREATE TABLE billing_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Order details
  order_number TEXT NOT NULL UNIQUE,
  
  -- Package info
  package_name TEXT,
  credits_purchased INTEGER NOT NULL,
  
  -- Pricing
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_checkout_session_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
  paid_at TIMESTAMPTZ,
  
  -- Invoice
  invoice_url TEXT,
  receipt_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_orders_tenant ON billing_orders(tenant_id);
CREATE INDEX idx_billing_orders_status ON billing_orders(status);
CREATE INDEX idx_billing_orders_stripe_pi ON billing_orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_billing_orders_stripe_session ON billing_orders(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

-- ============================================
-- CREDIT LEDGER (immutable audit trail)
-- ============================================
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Transaction
  transaction_type credit_transaction_type NOT NULL,
  amount INTEGER NOT NULL, -- Positive for credit, negative for debit
  
  -- Running balance (denormalized for performance)
  balance_after INTEGER NOT NULL,
  
  -- References
  billing_order_id UUID REFERENCES billing_orders(id),
  delivery_id UUID REFERENCES deliveries(id),
  lead_offer_id UUID REFERENCES lead_offers(id),
  
  -- Details
  description TEXT,
  notes TEXT,
  
  -- Actor
  created_by UUID REFERENCES user_profiles(id),
  
  -- Immutable
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_tenant ON credit_ledger(tenant_id);
CREATE INDEX idx_credit_ledger_type ON credit_ledger(transaction_type);
CREATE INDEX idx_credit_ledger_created ON credit_ledger(created_at);
CREATE INDEX idx_credit_ledger_delivery ON credit_ledger(delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX idx_credit_ledger_order ON credit_ledger(billing_order_id) WHERE billing_order_id IS NOT NULL;

-- ============================================
-- VIEW: Tenant Credit Balance
-- ============================================
CREATE OR REPLACE VIEW tenant_credit_balance AS
SELECT 
  tenant_id,
  COALESCE(
    (SELECT balance_after 
     FROM credit_ledger 
     WHERE credit_ledger.tenant_id = t.id 
     ORDER BY created_at DESC 
     LIMIT 1
    ), 0
  ) AS current_balance,
  COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT_PURCHASE' THEN amount ELSE 0 END), 0) AS total_purchased,
  COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT_CONSUMPTION' THEN ABS(amount) ELSE 0 END), 0) AS total_consumed,
  COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT_REFUND' THEN amount ELSE 0 END), 0) AS total_refunded
FROM tenants t
LEFT JOIN credit_ledger cl ON cl.tenant_id = t.id
GROUP BY t.id, tenant_id;




