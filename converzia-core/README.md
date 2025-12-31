# Converzia Core

Supabase schema, migrations, and database configuration for the Converzia platform.

## Structure

```
converzia-core/
├── migrations/           # SQL migrations (ordered)
├── seed/                 # Seed data for initial setup
├── functions/            # Database functions and triggers
└── policies/             # RLS policies
```

## Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Link to your Supabase project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

3. Run migrations:
```bash
supabase db push
```

## Environments

- **Development**: Local Supabase or dev instance
- **Staging**: `staging` branch deployments
- **Production**: `main` branch deployments

## Key Tables

### Multi-tenant Core
- `tenants` - Tenant organizations
- `tenant_members` - User-tenant relationships with roles
- `users` - Extended user profiles (linked to auth.users)

### Offers & Inventory
- `offers` - Generic offers (PROPERTY, AUTO, LOAN, INSURANCE)
- `properties` - Real estate specific data
- `offer_variants` - Typologies (1BR, 2BR, etc.)
- `units` - Individual units with availability

### Leads
- `leads` - Global leads (phone E.164 as primary identifier)
- `lead_sources` - Meta ads attribution
- `lead_offers` - Lead-offer relationships with state machine
- `lead_events` - Audit trail

### Conversations
- `conversations` - Chatwoot conversation references
- `messages` - Message history

### Billing
- `tenant_pricing` - Per-tenant pricing config
- `stripe_customers` - Stripe customer links
- `billing_orders` - Package purchases
- `credit_ledger` - Auditable credit transactions

### RAG/Knowledge
- `rag_sources` - Knowledge source definitions
- `rag_documents` - Processed documents
- `rag_chunks` - Embedded chunks with vector search












