-- ============================================
-- Converzia: Database Functions & Triggers
-- Migration: 008_functions
-- ============================================

-- ============================================
-- UTILITY: Update timestamp trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenant_members_updated_at BEFORE UPDATE ON tenant_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_offer_variants_updated_at BEFORE UPDATE ON offer_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lead_offers_updated_at BEFORE UPDATE ON lead_offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenant_pricing_updated_at BEFORE UPDATE ON tenant_pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stripe_customers_updated_at BEFORE UPDATE ON stripe_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_billing_orders_updated_at BEFORE UPDATE ON billing_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rag_sources_updated_at BEFORE UPDATE ON rag_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rag_documents_updated_at BEFORE UPDATE ON rag_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_scoring_templates_updated_at BEFORE UPDATE ON scoring_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- USER PROFILE: Auto-create on auth.users insert
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail user creation
    -- The RLS policy should allow this insert, but if it fails, we log and continue
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PHONE NORMALIZATION: Ensure E.164 format
-- ============================================
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
BEGIN
  -- Remove all non-digit characters except leading +
  cleaned := regexp_replace(phone, '[^0-9+]', '', 'g');
  
  -- Ensure + prefix
  IF NOT cleaned LIKE '+%' THEN
    -- Assume Argentina if no country code
    IF length(cleaned) = 10 THEN
      cleaned := '+54' || cleaned;
    ELSIF length(cleaned) = 11 AND cleaned LIKE '54%' THEN
      cleaned := '+' || cleaned;
    ELSIF length(cleaned) > 10 THEN
      cleaned := '+' || cleaned;
    END IF;
  END IF;
  
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- LEAD: Auto-normalize phone on insert/update
-- ============================================
CREATE OR REPLACE FUNCTION normalize_lead_phone()
RETURNS TRIGGER AS $$
BEGIN
  NEW.phone := normalize_phone(NEW.phone);
  NEW.phone_normalized := regexp_replace(NEW.phone, '^\+', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_normalize_phone
  BEFORE INSERT OR UPDATE OF phone ON leads
  FOR EACH ROW EXECUTE FUNCTION normalize_lead_phone();

-- ============================================
-- LEAD OFFER: Track status changes
-- ============================================
CREATE OR REPLACE FUNCTION track_lead_offer_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.previous_status := OLD.status;
    NEW.status_changed_at := NOW();
    
    -- Insert audit event
    INSERT INTO lead_events (
      lead_id,
      lead_offer_id,
      tenant_id,
      event_type,
      details,
      actor_type
    ) VALUES (
      NEW.lead_id,
      NEW.id,
      NEW.tenant_id,
      'STATUS_CHANGE',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status
      ),
      'SYSTEM'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_offers_status_change
  BEFORE UPDATE OF status ON lead_offers
  FOR EACH ROW EXECUTE FUNCTION track_lead_offer_status_change();

-- ============================================
-- LEAD: Handle opt-out
-- ============================================
CREATE OR REPLACE FUNCTION handle_lead_opt_out()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opted_out = TRUE AND OLD.opted_out = FALSE THEN
    NEW.opted_out_at := NOW();
    
    -- Update all active lead_offers to STOPPED
    UPDATE lead_offers
    SET status = 'STOPPED'
    WHERE lead_id = NEW.id
      AND status NOT IN ('STOPPED', 'SENT_TO_DEVELOPER', 'DISQUALIFIED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_opt_out
  BEFORE UPDATE OF opted_out ON leads
  FOR EACH ROW EXECUTE FUNCTION handle_lead_opt_out();

-- ============================================
-- CREDIT LEDGER: Calculate running balance
-- ============================================
CREATE OR REPLACE FUNCTION calculate_credit_balance()
RETURNS TRIGGER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance for tenant
  SELECT COALESCE(balance_after, 0)
  INTO current_balance
  FROM credit_ledger
  WHERE tenant_id = NEW.tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;
  
  -- Calculate new balance
  NEW.balance_after := current_balance + NEW.amount;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_ledger_balance
  BEFORE INSERT ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION calculate_credit_balance();

-- ============================================
-- FUNCTION: Get tenant credit balance
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_credits(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(balance_after, 0)
  INTO balance
  FROM credit_ledger
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Consume credit (atomic)
-- ============================================
CREATE OR REPLACE FUNCTION consume_credit(
  p_tenant_id UUID,
  p_delivery_id UUID,
  p_lead_offer_id UUID,
  p_description TEXT DEFAULT 'Lead delivery'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  message TEXT
) AS $$
DECLARE
  current_balance INTEGER;
  new_entry_id UUID;
BEGIN
  -- Lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text));
  
  -- Get current balance
  current_balance := get_tenant_credits(p_tenant_id);
  
  IF current_balance <= 0 THEN
    RETURN QUERY SELECT FALSE, current_balance, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;
  
  -- Insert consumption entry
  INSERT INTO credit_ledger (
    tenant_id,
    transaction_type,
    amount,
    delivery_id,
    lead_offer_id,
    description
  ) VALUES (
    p_tenant_id,
    'CREDIT_CONSUMPTION',
    -1,
    p_delivery_id,
    p_lead_offer_id,
    p_description
  )
  RETURNING id INTO new_entry_id;
  
  -- Return success with new balance
  RETURN QUERY 
  SELECT 
    TRUE, 
    get_tenant_credits(p_tenant_id),
    'Credit consumed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Add credits (from purchase)
-- ============================================
CREATE OR REPLACE FUNCTION add_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_billing_order_id UUID,
  p_description TEXT DEFAULT 'Credit purchase'
)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  INSERT INTO credit_ledger (
    tenant_id,
    transaction_type,
    amount,
    billing_order_id,
    description
  ) VALUES (
    p_tenant_id,
    'CREDIT_PURCHASE',
    p_amount,
    p_billing_order_id,
    p_description
  );
  
  RETURN get_tenant_credits(p_tenant_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refund credit
-- ============================================
CREATE OR REPLACE FUNCTION refund_credit(
  p_tenant_id UUID,
  p_delivery_id UUID,
  p_lead_offer_id UUID,
  p_reason TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
BEGIN
  INSERT INTO credit_ledger (
    tenant_id,
    transaction_type,
    amount,
    delivery_id,
    lead_offer_id,
    description,
    notes,
    created_by
  ) VALUES (
    p_tenant_id,
    'CREDIT_REFUND',
    1,
    p_delivery_id,
    p_lead_offer_id,
    'Credit refund',
    p_reason,
    p_created_by
  );
  
  -- Update delivery status
  UPDATE deliveries
  SET status = 'REFUNDED', refunded_at = NOW()
  WHERE id = p_delivery_id;
  
  RETURN get_tenant_credits(p_tenant_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Check for duplicate lead
-- ============================================
CREATE OR REPLACE FUNCTION is_duplicate_lead(
  p_phone TEXT,
  p_tenant_id UUID,
  p_offer_id UUID,
  p_window_days INTEGER DEFAULT 90
)
RETURNS BOOLEAN AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO existing_count
  FROM lead_offers lo
  JOIN leads l ON l.id = lo.lead_id
  WHERE l.phone = normalize_phone(p_phone)
    AND lo.tenant_id = p_tenant_id
    AND (p_offer_id IS NULL OR lo.offer_id = p_offer_id)
    AND lo.created_at > NOW() - (p_window_days || ' days')::INTERVAL
    AND lo.status NOT IN ('DISQUALIFIED', 'STOPPED');
  
  RETURN existing_count > 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Generate order number
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  seq_num INTEGER;
BEGIN
  year_prefix := to_char(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(substring(order_number from 6) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM billing_orders
  WHERE order_number LIKE year_prefix || '-%';
  
  RETURN year_prefix || '-' || lpad(seq_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BILLING ORDERS: Auto-generate order number
-- ============================================
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_billing_orders_number
  BEFORE INSERT ON billing_orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- ============================================
-- CONVERSATION: Update message count
-- ============================================
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.sent_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_count
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

-- ============================================
-- FUNCTION: Get user's accessible tenants
-- ============================================
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT tenant_id
  FROM tenant_members
  WHERE user_id = p_user_id
    AND status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- FUNCTION: Check if user is Converzia admin
-- ============================================
CREATE OR REPLACE FUNCTION is_converzia_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_user_id AND is_converzia_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get user role in tenant
-- ============================================
CREATE OR REPLACE FUNCTION get_user_tenant_role(p_user_id UUID, p_tenant_id UUID)
RETURNS tenant_role AS $$
DECLARE
  user_role tenant_role;
BEGIN
  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND status = 'ACTIVE';
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
















