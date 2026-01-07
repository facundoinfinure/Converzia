# Row Level Security (RLS) Policies Documentation

## Overview

Converzia uses PostgreSQL Row Level Security (RLS) to enforce tenant isolation and access control. All tables have RLS enabled, and policies define who can access what data.

## Core Principles

1. **Tenant Isolation**: Users can only access data from tenants they are members of
2. **Admin Access**: Converzia platform admins (`is_converzia_admin = true`) can access all data
3. **Role-Based Access**: Different roles (OWNER, ADMIN, BILLING, VIEWER) have different permissions
4. **Data Privacy**: Lead PII is only accessible after delivery to the tenant

## Table Access Policies

### User Profiles (`user_profiles`)

- **SELECT**: Users can see their own profile. Admins can see all profiles.
- **INSERT**: Trigger creates profile on user signup. Admins can manually insert.
- **UPDATE**: Users can update their own profile. Admins can update any profile.

**Policies:**
- `user_profiles_select_own`: `auth.uid() = id`
- `user_profiles_admin_select`: `is_converzia_admin(auth.uid())`
- `user_profiles_update_own`: `auth.uid() = id`
- `user_profiles_admin_update`: `is_converzia_admin(auth.uid())`
- `user_profiles_admin_insert`: `is_converzia_admin(auth.uid())`

### Tenants (`tenants`)

- **SELECT**: Users can see tenants they are members of. Admins can see all.
- **INSERT/UPDATE/DELETE**: Only Converzia admins.

**Policies:**
- `tenants_select_member`: `id IN (SELECT get_user_tenants(auth.uid())) OR is_converzia_admin(auth.uid())`
- `tenants_admin_insert/update/delete`: `is_converzia_admin(auth.uid())`

### Tenant Members (`tenant_members`)

- **SELECT**: Users can see memberships for their tenants, their own membership, or all (admins).
- **INSERT**: Tenant OWNER/ADMIN can invite. Admins can insert.
- **UPDATE**: Only Converzia admins (for approval/status changes).

**Policies:**
- `tenant_members_select`: `tenant_id IN (SELECT get_user_tenants(auth.uid())) OR user_id = auth.uid() OR is_converzia_admin(auth.uid())`
- `tenant_members_insert`: `(tenant_id IN (SELECT get_user_tenants(auth.uid())) AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN')) OR is_converzia_admin(auth.uid())`
- `tenant_members_update`: `is_converzia_admin(auth.uid())`

### Offers (`offers`)

- **SELECT**: Users can see offers from their tenants. Admins can see all.
- **INSERT/UPDATE/DELETE**: Only Converzia admins.

**Policies:**
- `offers_select`: `tenant_id IN (SELECT get_user_tenants(auth.uid())) OR is_converzia_admin(auth.uid())`
- `offers_insert/update/delete`: `is_converzia_admin(auth.uid())`

### Leads (`leads`)

- **SELECT**: Admins can see all. Tenants can only see delivered leads (via deliveries table).
- **INSERT/UPDATE/DELETE**: Only Converzia admins.

**Policies:**
- `leads_admin`: `is_converzia_admin(auth.uid())` - Full access for admins
- `leads_tenant_delivered`: `id IN (SELECT lead_id FROM deliveries WHERE tenant_id IN (SELECT get_user_tenants(auth.uid())) AND status = 'DELIVERED')`

**Critical**: This ensures tenants cannot see lead PII until the lead is delivered.

### Lead Offers (`lead_offers`)

- **SELECT**: Admins can see all. Tenants can only see delivered lead_offers.
- **INSERT/UPDATE/DELETE**: Only Converzia admins (via application logic).

**Policies:**
- `lead_offers_admin`: `is_converzia_admin(auth.uid())` - Full access
- `lead_offers_tenant_delivered`: `tenant_id IN (SELECT get_user_tenants(auth.uid())) AND status = 'SENT_TO_DEVELOPER'`

### Conversations & Messages

- **SELECT**: Admins can see all. Tenants can only see conversations/messages for delivered leads.
- **INSERT/UPDATE/DELETE**: Only Converzia admins (via application logic).

**Policies:**
- `conversations_admin`: `is_converzia_admin(auth.uid())`
- `conversations_tenant_delivered`: `tenant_id IN (SELECT get_user_tenants(auth.uid())) AND lead_id IN (SELECT lead_id FROM deliveries WHERE tenant_id IN (SELECT get_user_tenants(auth.uid())) AND status = 'DELIVERED')`
- Similar pattern for `messages_*` policies

### Deliveries (`deliveries`)

- **SELECT**: Admins can see all. Tenants can see their own deliveries.
- **INSERT/UPDATE/DELETE**: Only Converzia admins (via application logic).

**Policies:**
- `deliveries_admin`: `is_converzia_admin(auth.uid())`
- `deliveries_tenant`: `tenant_id IN (SELECT get_user_tenants(auth.uid()))`

### Credit Ledger (`credit_ledger`)

- **SELECT**: Admins can see all. Tenants can see their own ledger entries.
- **INSERT/UPDATE/DELETE**: Only via database functions (RPC), not direct table access.

**Policies:**
- `credit_ledger_admin`: `is_converzia_admin(auth.uid())`
- `credit_ledger_tenant`: `tenant_id IN (SELECT get_user_tenants(auth.uid()))`

**Critical**: Credit transactions are created via RPC functions (`add_credits`, etc.) which bypass RLS but have internal validation.

### Billing Orders (`billing_orders`)

- **SELECT**: Admins can see all. Tenants can see their own orders.
- **INSERT**: Tenant OWNER/ADMIN/BILLING can create orders. Admins can insert.
- **UPDATE/DELETE**: Only Converzia admins.

**Policies:**
- `billing_orders_admin`: `is_converzia_admin(auth.uid())`
- `billing_orders_tenant`: `tenant_id IN (SELECT get_user_tenants(auth.uid()))`
- `billing_orders_tenant_insert`: `tenant_id IN (SELECT get_user_tenants(auth.uid())) AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN', 'BILLING')`

### Tenant Integrations (`tenant_integrations`)

- **SELECT**: Admins can see all. Tenants can see their own integrations.
- **INSERT**: Tenant OWNER/ADMIN can create. Admins can insert.
- **UPDATE**: Tenant OWNER/ADMIN can update their integrations. Admins can update all.
- **DELETE**: Tenant OWNER/ADMIN can delete their integrations. Admins can delete all.

**Policies:**
- `tenant_integrations_select`: `tenant_id IN (SELECT get_user_tenants(auth.uid())) OR tenant_id IS NULL OR is_converzia_admin(auth.uid())`
- `tenant_integrations_insert`: `(tenant_id IN (SELECT get_user_tenants(auth.uid())) AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN')) OR tenant_id IS NULL OR is_converzia_admin(auth.uid())`
- `tenant_integrations_update`: `(tenant_id IN (SELECT get_user_tenants(auth.uid())) AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN')) OR tenant_id IS NULL OR is_converzia_admin(auth.uid())`
- `tenant_integrations_delete`: Same as UPDATE

**Note**: `tenant_id IS NULL` allows global integrations (e.g., Meta OAuth).

### RAG Sources/Documents/Chunks

- **SELECT**: Admins can see all. Tenants can see their own RAG data.
- **INSERT/UPDATE/DELETE**: Only Converzia admins (via application logic).

**Policies:**
- `rag_sources/admin/documents/chunks_admin`: `is_converzia_admin(auth.uid())`
- `rag_sources/admin/documents/chunks_tenant`: `tenant_id IN (SELECT get_user_tenants(auth.uid()))`

### Scoring Templates (`scoring_templates`)

- **SELECT**: All authenticated users can see global templates (`tenant_id IS NULL`). Tenants can see their own templates.
- **INSERT/UPDATE/DELETE**: Only Converzia admins.

**Policies:**
- `scoring_templates_global`: `tenant_id IS NULL`
- `scoring_templates_tenant`: `tenant_id IN (SELECT get_user_tenants(auth.uid()))`
- `scoring_templates_admin`: `is_converzia_admin(auth.uid())`

### System Tables (Admin Only)

- `system_metrics`: Only admins can access.
- `platform_costs`: Only admins can access.
- `app_settings`: Only admins can access.

**Policies:**
- All operations: `is_converzia_admin(auth.uid())`

## Helper Functions

### `get_user_tenants(user_id UUID)`

Returns set of tenant IDs the user is an active member of.

**Security**: Uses `SECURITY DEFINER` to bypass RLS when querying `tenant_members`.

### `is_converzia_admin(user_id UUID)`

Returns true if user is a Converzia platform admin.

**Security**: Uses `SECURITY DEFINER` to bypass RLS when querying `user_profiles`.

### `get_user_tenant_role(user_id UUID, tenant_id UUID)`

Returns the user's role in the specified tenant.

**Security**: Uses `SECURITY DEFINER` to bypass RLS when querying `tenant_members`.

## Security Considerations

1. **Service Role Bypass**: Service role key bypasses all RLS. Use only in server-side code with proper authorization checks.

2. **RPC Functions**: Database functions (RPC) can bypass RLS. Ensure they validate permissions internally.

3. **Tenant Isolation**: Always verify `tenant_id` matches user's membership before allowing operations.

4. **Lead PII Protection**: Lead PII is only accessible after `status = 'DELIVERED'` in the deliveries table.

5. **Admin Access**: Converzia admins have full access. Use with caution and audit all admin operations.

## Testing RLS Policies

Run the test script to verify policies:

```bash
npx tsx converzia-core/scripts/test-rls-policies.ts
```

Tests include:
- Cross-tenant isolation (users cannot access other tenants' data)
- Admin access (admins can access all data)
- Role-based permissions (VIEWER cannot create/update)

## Common Vulnerabilities to Watch For

1. **Missing Policies**: If RLS is enabled but no policies exist, no one can access the table.

2. **Overly Permissive Policies**: Policies that allow broader access than intended.

3. **RPC Function Bypass**: Functions that don't validate permissions internally.

4. **Service Role Exposure**: Never use service role in client-side code.

5. **Policy Ordering**: Supabase uses first matching policy. Order matters for complex policies.

## Migration Reference

- `009_rls_policies.sql`: Initial RLS setup and core policies
- `012_integrations_tables.sql`: Integration tables RLS policies
- `016_fix_user_profile_insert.sql`: User profile insert policies
- `022_storage_rls_policies.sql`: Storage bucket RLS policies
- `024_enable_rls_public_tables.sql`: System tables RLS policies
