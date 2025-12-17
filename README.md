# Converzia

Multi-tenant lead qualification platform for real estate (and multi-vertical ready).

## ✨ Features

- **Multi-tenant architecture** with Row Level Security (RLS)
- **AI-powered lead qualification** using OpenAI GPT-4
- **RAG (Retrieval Augmented Generation)** for contextual responses
- **Real-time scoring engine** with configurable templates
- **WhatsApp automation** via Chatwoot integration
- **CRM integrations**: Tokko CRM, Google Sheets, Webhooks
- **Credit-based billing** with Stripe integration
- **Modern dark UI** built with Next.js 15 and Tailwind CSS

## Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONVERZIA (Single Vercel App)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐        ┌──────────────────────────────────────┐│
│  │  Next.js App    │        │           Supabase                   ││
│  │  (converzia-app)│◀──────▶│  (PostgreSQL + pgvector + Auth + RLS)││
│  │                 │        └──────────────────────────────────────┘│
│  │  Routes:        │                                                │
│  │  /admin/*       │  ← Converzia Admin (role-based)               │
│  │  /portal/*      │  ← Tenant Portal (role-based)                 │
│  │  /api/*         │  ← API Routes (webhooks, AI, billing)         │
│  └─────────────────┘                                                │
│           │                                                          │
│           │ Webhooks                                                 │
│           ▼                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   Meta Lead     │  │    Chatwoot     │  │     Stripe      │     │
│  │     Ads         │  │   (WhatsApp)    │  │    (Billing)    │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Repository Structure

```
Converzia/
├── README.md
├── Converzia_Blueprint_Final_v1.md   # Full specification
│
├── converzia-core/                    # 🗄️ Supabase schema & migrations
│   ├── migrations/                    # SQL migrations (001-010)
│   └── seed/                          # Seed data
│
└── converzia-app/                     # 🚀 Next.js unified app
    ├── src/
    │   ├── app/
    │   │   ├── admin/                 # Admin routes (Converzia team)
    │   │   ├── portal/                # Tenant routes
    │   │   ├── api/
    │   │   │   ├── webhooks/
    │   │   │   │   ├── chatwoot/      # Chatwoot message handler
    │   │   │   │   ├── meta-leads/    # Meta Lead Ads webhook
    │   │   │   │   └── stripe/        # Stripe webhook
    │   │   │   └── billing/           # Checkout API
    │   │   └── login/
    │   ├── components/
    │   ├── lib/
    │   │   ├── supabase/              # Supabase clients
    │   │   └── services/              # OpenAI, Chatwoot services
    │   └── types/
    └── package.json
```

## Key Simplifications

### ✅ Single Vercel App
- One deployment instead of two
- Role-based routing via middleware
- `/admin/*` for Converzia team
- `/portal/*` for tenants

### ✅ No n8n Required
- AI orchestration in Next.js API routes
- OpenAI SDK for qualification & extraction
- Direct webhook handlers for Chatwoot, Meta, Stripe

### ✅ Make Still Recommended
- For Meta Lead Ads → still use Make for initial ingestion
- Simpler than self-hosting Meta webhooks
- Can be replaced with the `/api/webhooks/meta-leads` endpoint

## Quick Start

### 1. Database Setup (Supabase)

```bash
cd converzia-core
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 2. Run the App

```bash
cd converzia-app
npm install
npm run dev
```

### 3. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...

# Chatwoot
CHATWOOT_BASE_URL=https://app.chatwoot.com
CHATWOOT_API_TOKEN=xxx
CHATWOOT_ACCOUNT_ID=1

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Meta (optional, for direct webhook)
META_VERIFY_TOKEN=your-verify-token

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Webhook URLs

Configure these in your external services:

| Service | Webhook URL |
|---------|-------------|
| Chatwoot | `https://your-app.vercel.app/api/webhooks/chatwoot` |
| Meta Lead Ads | `https://your-app.vercel.app/api/webhooks/meta-leads` |
| Stripe | `https://your-app.vercel.app/api/webhooks/stripe` |

## User Roles

| Role | Access |
|------|--------|
| Converzia Admin | `/admin/*` - Full platform management |
| Tenant OWNER/ADMIN | `/portal/*` - Tenant dashboard, leads, billing |
| Tenant BILLING | `/portal/*` - Billing only |
| Tenant VIEWER | `/portal/*` - Read-only |

## Lead Flow

1. **Lead comes in** via Meta Lead Ads → Make → Supabase
2. **Ad mapped?** → Creates `lead_offer` with status `TO_BE_CONTACTED`
3. **Bot sends initial message** via Chatwoot
4. **User replies** → Chatwoot webhook → `/api/webhooks/chatwoot`
5. **AI extracts fields** + generates response
6. **Score calculated** → If >= threshold → `LEAD_READY`
7. **Delivery created** → Credit consumed → Lead delivered to Sheets/CRM

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: OpenAI GPT-4o (qualification), text-embedding-ada-002 (RAG)
- **Payments**: Stripe Checkout
- **Messaging**: Chatwoot + WhatsApp Cloud API
- **Deployment**: Vercel

## Development

```bash
# Install dependencies
cd converzia-app
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

## Project Structure

```
Converzia/
├── converzia-app/           # 🚀 Main Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/       # Admin dashboard (Converzia team)
│   │   │   ├── portal/      # Tenant portal
│   │   │   ├── api/
│   │   │   │   ├── webhooks/  # Chatwoot, Meta, Stripe
│   │   │   │   ├── billing/   # Stripe checkout
│   │   │   │   ├── cron/      # Background jobs
│   │   │   │   ├── rag/       # Knowledge ingestion
│   │   │   │   └── integrations/
│   │   │   └── login/
│   │   ├── components/      # Reusable UI components
│   │   ├── lib/
│   │   │   ├── services/    # Core services (no n8n dependency)
│   │   │   │   ├── chatwoot.ts
│   │   │   │   ├── conversation.ts
│   │   │   │   ├── delivery.ts
│   │   │   │   ├── google-sheets.ts
│   │   │   │   ├── openai.ts
│   │   │   │   ├── rag.ts
│   │   │   │   ├── scoring.ts
│   │   │   │   └── tokko.ts
│   │   │   ├── security/    # Webhook validation, rate limiting
│   │   │   └── supabase/    # Database clients
│   │   └── types/
│   └── vercel.json          # Cron job configuration
│
├── converzia-core/          # 🗄️ Database schema
│   ├── migrations/          # SQL migrations (001-012)
│   └── seed/
│
└── converzia-n8n/           # 📝 Workflow documentation (not used at runtime)
```

## Key Services

| Service | Purpose |
|---------|---------|
| `conversation.ts` | Main conversation orchestrator |
| `scoring.ts` | Lead scoring with configurable templates |
| `rag.ts` | Knowledge ingestion and retrieval |
| `tokko.ts` | Tokko CRM integration |
| `google-sheets.ts` | Google Sheets delivery |
| `delivery.ts` | Lead delivery pipeline |

## Cron Jobs (Vercel)

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Every 5 min | `/api/cron/process-deliveries` | Process pending lead deliveries |
| Every 2 hours | `/api/cron/retry-contacts` | Retry contacts & reactivations |
| Daily 12pm | `/api/cron/credit-alerts` | Notify low credit tenants |

## Security Features

- ✅ HMAC signature validation for all webhooks
- ✅ Rate limiting on API endpoints
- ✅ Row Level Security (RLS) on all tables
- ✅ Service role key used only server-side
- ✅ PII masking in logs

## License

Proprietary - Converzia
