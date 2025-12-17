# Converzia — Blueprint Final v1.0 (Real Estate First, Multi‑Vertical Ready)

**Fecha:** 2025-12-16  
**Time zone:** America/Argentina/Buenos_Aires  
**Stack decisions locked:**
- Vector store: **Supabase pgvector** (embeddings **1536**)
- Retrieval: **Hybrid search** (vector + full‑text)
- Knowledge sources: **PDFs + public URLs + manual website scraping with allowlist**
- Inventory: **DB as source of truth** (real-time if connected; manual with warnings otherwise)
- Ads mapping: **manual ad_id → offer** (by Converzia); unmapped leads go to **PENDING_MAPPING**
- Delivery: **Google Sheets + CRM (Tokko first)**, only at **Lead Ready**
- Billing: **Stripe** + credit ledger, default **PER_LEAD**
- Lead visibility: tenant sees **counts only** pre‑Lead Ready; **PII only after delivery**
- Handoff: **no Converzia operator** by default; **containment message + bot retry**
- Reactivation: **3 touches in 7 days**
- Initial retry: **2 attempts in 48 hours**, then cooling
- Default Lead Ready score threshold: **80/100** (configurable)

---


### Deploy & CI/CD (locked)
- **GitHub** as the source of truth for code (mono-repo or multi-repo; recommended: multi-repo as listed below).
- **Vercel** for deployment of:
  - `converzia-admin` (Admin UI)
  - `converzia-tenant` (Tenant Portal)
- Preview deployments on every PR; Production deployments on merge to `main`.
- Environment variables managed in Vercel (per environment: dev/staging/prod).
- Supabase migrations stored in GitHub and applied via the Supabase CLI in CI (or via a controlled manual promotion in early v1).


## 1) Product Definition

### 1.1 What Converzia does
Converzia is a multi‑tenant lead qualification platform that:
1. Ingests leads (Meta Lead Ads v1).
2. Starts WhatsApp conversation via Chatwoot.
3. Qualifies leads using:
   - Structured extraction (budget, zone, timing, intent, preferences)
   - Inventory tools (price/stock/delivery/financing from DB)
   - Hybrid RAG (tenant + offer knowledge)
4. Scores each lead per offer (LeadOffer).
5. Recommends the best offer (not necessarily the ad’s offer).
6. Delivers a **Lead Ready** package to the tenant (Sheets + CRM) **if credits are available**.
7. Manages billing with Stripe and an auditable credit ledger.

### 1.2 Voice and conversation constraints
- Bot identity: **assistant of the developer/tenant**
- Tone: **formal, close**, moderate Argentine voseo (avoid heavy slang)
- Goal: **qualify and pass** (no “close”)
- Lead Ready minimum fields:
  - **name**, **budget**, **zone**, **timing**, **intent**
- Never promises:
  - fixed rates, installments, discounts, availability
- If user requests a human:
  - containment message + continue qualification with the bot
  - status: `HUMAN_HANDOFF` (still bot-driven in v1)

---

## 2) Architecture Overview

### 2.1 Components
- **Supabase (Postgres + Auth + RLS + pgvector)**: system of record (multi‑tenant).
- **Make**: Meta Lead Ads ingestion only (no AI logic).
- **Chatwoot + WhatsApp Cloud API**: channel, inbox, webhooks.
- **n8n**: orchestration brain (conversation, RAG, scoring, delivery, scraping jobs, Stripe webhooks).
- **Admin UI (Converzia)**: approvals, pricing, knowledge sources, allowlists, QA.
- **Tenant Portal (Developer/Constructor)**: analytics counts, priorities, routing, billing, user invites.

### 2.2 Data principles
- **Inventory DB is the truth** for: price, availability, delivery date, financing details.
- **RAG is supporting knowledge** for: FAQs, brochure text, amenities explanation, process, legal copy.
- **Lead lifecycle lives in LeadOffer**, not in Lead (because one lead can map to multiple offers and tenants).
- **Billing is ledger-based** (no mutable balance field).
- **Tenant sees PII only after Lead Ready delivery**.

---

## 3) Domain Model (Conceptual ERD)

### 3.1 Core entities
- `tenants`
- `users` (`auth.users`)
- `tenant_members` (role + approval status)
- `offers` (generic; offer_type: PROPERTY, AUTO, LOAN, INSURANCE)
- `properties` (subtype for real estate)
- `offer_variants` (typologies: 1br/2br, etc.)
- `units` (optional real-time stock from CRM)
- `ad_offer_map` (manual mapping ad_id → offer_id)
- `leads` (global; primary key = phone E.164)
- `lead_sources` (Meta lead metadata)
- `lead_offers` (state + scoring + extracted fields)
- `conversations`, `messages` (Chatwoot IDs + transcript)
- `lead_events` (audit log)
- `deliveries` (Lead Ready payload and status)
- Billing: `tenant_pricing`, `stripe_customers`, `billing_orders`, `credit_ledger`
- RAG: `rag_sources`, `rag_documents`, `rag_chunks` (vector + full-text)

### 3.2 Key cardinalities
- Tenant 1—N Offers  
- Offer 1—N Variants; Variant 1—N Units (optional)  
- Lead N—N Offers via LeadOffer  
- Lead 1—N LeadSources  
- LeadOffer 1—0..1 Delivery (default 1)  
- Tenant 1—N Knowledge Sources and Documents  

---

## 4) Lead Lifecycle & State Machine

### 4.1 LeadOffer states (v1)
- `PENDING_MAPPING` (ad_id unmapped)
- `TO_BE_CONTACTED`
- `CONTACTED`
- `ENGAGED`
- `QUALIFYING`
- `SCORED`
- `LEAD_READY`
- `SENT_TO_DEVELOPER`
- `COOLING`
- `REACTIVATION`
- `DISQUALIFIED`
- `STOPPED`
- `HUMAN_HANDOFF`

### 4.2 Retry / cooling / reactivation policy
- **2 attempts in 48h** after initial message; if no progress → `COOLING`
- **Reactivation:** 3 touches over 7 days; if reply → back to `ENGAGED/QUALIFYING`
- Opt-out: `STOP` / `BAJA` / `NO` / `CANCELAR` sets `STOPPED` and blocks automation.

### 4.3 “Incomplete” definition (billing and quality)
A lead is **INCOMPLETE** (not chargeable) if within **48 hours** from first contact:
- minimum fields not completed (name, budget, zone, timing, intent), or
- messages do not allow qualification (e.g., “hola” only).

Outcome:
- LeadOffer → `COOLING`
- Billing eligibility → `NOT_CHARGEABLE: INCOMPLETE`
- No credit consumption (since delivery did not happen)

---

## 5) Inventory Model (Real Estate v1)

### 5.1 Offer vs Variant vs Unit
- **Offer (PROPERTY)** = project or development
- **OfferVariant** = typology / configuration (e.g., 2 ambientes, 60m²)
- **Unit (optional)** = concrete unit (Floor, orientation, unit number), when CRM provides it

### 5.2 Qualification beyond typology
The bot should capture:
- typology (variant)
- preferences: **floor high/low**, **front/back**, and optionally balcony/garage/amenities
- or present **2–4 options** (variants or units) so the lead chooses

**Risk control:** options must be presented with “subject to confirmation” language.

### 5.3 Real-time vs manual inventory updates
- Real-time if connected to CRM/API (recommended)
- Manual updates allowed; system sets a **warning flag** (inventory_stale) if not updated within configured threshold.

---

## 6) RAG (Supabase Hybrid Retrieval)

### 6.1 Knowledge sources (input)
- PDFs (uploaded to Supabase Storage or provided as URL)
- Public landing pages (URLs)
- Website root (public) for scraping with allowlist (paths)

### 6.2 Scraping constraints (v1)
- Manual run only (triggered from Admin UI)
- Allowlist per tenant/project/offer (paths)
- Public content only (no login)
- Dedup by content hash; keep versions

### 6.3 Storage & indexing
- `rag_documents`: source metadata, validity window, version hash
- `rag_chunks`:
  - `embedding vector(1536)` with HNSW index
  - `tsvector` column with GIN index for full-text search
  - metadata for doc_type, section, page, language, offer_id

### 6.4 Retrieval algorithm (runtime)
For each user message:
1. Create query embedding (1536).
2. Run **offer-specific** hybrid search (tenant_id + offer_id).
3. Run **tenant-general** hybrid search (tenant_id + offer_id is null).
4. Merge and dedupe.
5. Feed context to LLM.
6. Any variable/sensitive numeric info must be fetched from inventory DB tools, not from RAG.

---

## 7) Scoring (Explainable, Template-Based by Vertical)

### 7.1 Templates
- `scoring_templates` per `offer_type` (PROPERTY/AUTO/LOAN/INSURANCE)
- Weights and rules configurable per tenant

### 7.2 Default PROPERTY breakdown (example)
- Budget fit (0–25)
- Zone fit (0–20)
- Typology/variant fit (0–15)
- Timing fit (0–15)
- Intent strength (0–15)
- Conversation quality / friction (−0–10)

Persist per LeadOffer:
- `score_total`
- `score_breakdown_json`
- `qualification_fields_json` (name, budget, zone, timing, intent, preferences)
- `billing_eligibility` (chargeable / not chargeable with reason)

---

## 8) Billing & Monetization (Stripe + Credits)

### 8.1 Default model
- Charge model: **PER_LEAD**
- 1 Lead Ready delivered = **1 credit consumed**
- Packages are **custom per tenant** (USD)
- Strict blocking when credits are 0
- Low-credit notifications at thresholds

### 8.2 Not chargeable & refunds
Not chargeable:
- duplicate (E.164, default window 90 days)
- spam
- incomplete (48h rule)
- out of zone

Refund policy:
- automatic: duplicate, spam
- “grey cases”: require Converzia approval (Admin UI action creates refund ledger entry)

### 8.3 PER_SALE (future)
- Sale confirmed via CRM event
- Generates invoice or success fee entry; no credit consumed at delivery

---

## 9) Delivery (Sheets + CRM)

### 9.1 Delivery trigger
Only when LeadOffer is `LEAD_READY` and billing gate passes.

### 9.2 Payload (minimum)
- Lead PII: name, phone E.164, email (if present)
- Qualification summary: budget, zone, timing, intent, preferences
- Recommended offer + alternatives
- Score and breakdown
- Conversation summary + link/reference
- Source metadata: ad_id, campaign_id, form_id, leadgen_id

### 9.3 Targets
- Google Sheets append row (tracking and audit)
- CRM (Tokko first) create/update lead (dedupe by phone)

---

## 10) Access Control (RBAC + Converzia Approval)

### 10.1 Tenant user flow
- Tenant invites a user → membership status `PENDING_APPROVAL`
- Converzia Admin approves → `ACTIVE`

### 10.2 Visibility rules
- Pre‑Lead Ready: tenant sees counts and pipeline metrics only (no PII)
- Post‑Lead Ready: lead delivered; tenant sees details for delivered leads only

### 10.3 Roles (suggested)
- OWNER / ADMIN: manage routing, priorities, users, view analytics
- BILLING: payments and invoices
- VIEWER: read-only metrics

---

## 11) UX/UI Blueprint

### 11.1 Converzia Admin UI (must-have screens)
1. **Tenants**
   - create tenant
   - activate/deactivate
   - set default score threshold
2. **Pricing**
   - charge model
   - CPA and package settings
   - refund rules toggles
3. **Users & Approvals**
   - pending approvals list
   - role assignment
4. **Offers & Inventory**
   - offers list (type, status)
   - variants and units (if applicable)
   - inventory freshness indicators
5. **Ads Mapping**
   - map Meta `ad_id` → offer
   - queue: “unmapped leads”
   - reprocess after mapping
6. **Knowledge (RAG)**
   - add PDF / URL / website root source
   - configure allowlist
   - run scraping (manual)
   - view ingestion status and version history
7. **Operations & QA**
   - conversation health (reply rate, completion)
   - lead ready rate
   - refund queue (grey cases)
   - credit ledger audit

### 11.2 Tenant Portal (must-have screens)
1. **Dashboard**
   - lead pipeline counts by state
   - credits remaining + low-credit warning
   - “leads delivered today/7d”
2. **Offers**
   - offer priorities (ranking)
   - routing rules (zone/team)
3. **Billing**
   - buy package (Stripe checkout)
   - invoices/receipts
4. **Users**
   - invite users (pending Converzia approval)
5. **Delivered Leads**
   - list of delivered leads (with details after delivery)
   - export / links to CRM records

### 11.3 WhatsApp Conversation UX (must-have behaviors)
- Very short messages, one question at a time when possible
- When asking for multiple fields, use structured prompts:
  - “¿Presupuesto aproximado?” then “¿En qué zonas?” etc.
- Offer options as enumerated list
- Always include opt-out hint occasionally: “Si querés dejar de recibir mensajes, respondé STOP.”

---

## 12) Build Plan (Step-by-Step Implementation)

### Phase 0 — Repo & environments (Day 0–1)

**Deploy (Vercel + GitHub)**
- Create Vercel projects connected to GitHub repos:
  - `converzia-admin` → Vercel project `converzia-admin`
  - `converzia-tenant` → Vercel project `converzia-tenant`
- Set up three Vercel environments (via projects + env vars):
  - **Development**: preview deployments per PR (Supabase dev)
  - **Staging**: branch `staging` (Supabase staging)
  - **Production**: branch `main` (Supabase prod)
- Configure Vercel environment variables (per environment):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only; only if you use server routes)
  - `CHATWOOT_BASE_URL` / `CHATWOOT_API_TOKEN` (server-only)
  - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
  - `GOOGLE_SHEETS_*`
  - `TOKKO_*`
- Enable Vercel Preview URLs for easy QA with Converzia Admin.

**Repos:**
- `converzia-core` (Supabase schema + migrations)
- `converzia-n8n` (workflows export + env docs)
- `converzia-admin` (Admin UI)
- `converzia-tenant` (Tenant Portal)

**Environments:**
- `dev`, `staging`, `prod`

**Secrets management:**
- Supabase service role key (server-only)
- Chatwoot API tokens
- WhatsApp Cloud API creds
- Stripe webhook secret
- Google Sheets API creds
- CRM credentials (Tokko)

### Phase 1 — Data layer (Supabase) (Day 1–3)
1. Implement final SQL schema:
   - tenants, offers (+ property subtype), variants, units
   - leads, lead_sources, lead_offers, events
   - conversations, messages
   - deliveries
   - billing ledger and pricing
   - rag tables (documents/chunks + tsvector + vector indexes)
   - RBAC + approvals + RLS policies
2. Seed:
   - base roles
   - scoring templates (PROPERTY v1)
3. Create a “service role” access pattern for n8n/Make.

### Phase 2 — Ingestion (Make) (Day 3–4)
1. FB Lead Ads watch leads
2. Normalize phone to E.164
3. Upsert lead + insert lead_source
4. If `ad_id` mapped:
   - create lead_offer TO_BE_CONTACTED
   - call n8n webhook `/send_initial_message`
5. If unmapped:
   - lead_offer PENDING_MAPPING
   - add to “unmapped queue” for Converzia mapping

### Phase 3 — Chatwoot + n8n conversation (Day 4–8)
**n8n workflows:**
- `incoming_message_webhook`
- `send_initial_message`
- `lead_qualify_and_reply` (main)
- `reactivation_cron`
- `stripe_webhooks`
- `rag_ingestion_job` (PDF/URL)
- `scrape_website_job` (manual trigger)

**Main workflow behavior:**
1. Receive message from Chatwoot
2. Load lead + active lead_offers
3. Decide context offer (current + alternatives)
4. Extraction:
   - update missing fields
5. Inventory tool:
   - fetch offers/variants/units based on preferences
6. RAG hybrid retrieve:
   - offer-specific + tenant-general
7. Generate response:
   - comply with “never promise” rules
8. Update state + scoring
9. If Lead Ready:
   - billing gate (consume credit)
   - delivery to Sheets + CRM
   - mark SENT_TO_DEVELOPER

### Phase 4 — Knowledge ingestion (RAG) (Day 6–10)
1. Admin UI: add sources (PDF/URL/root)
2. n8n ingestion:
   - fetch → clean → chunk → embed → upsert
3. Validate:
   - hybrid retrieval returns the right chunks
4. Add versioning:
   - hash comparison
   - keep history

### Phase 5 — Tenant Portal + Admin UI (Day 8–15)
- Tenant Portal:
  - counts dashboard
  - credits + purchase
  - offer priority + routing
  - delivered leads list
  - user invites (pending approval)
- Admin UI:
  - approvals (tenant + user)
  - ad mapping
  - knowledge allowlists and manual scrape triggers
  - refunds queue for grey cases
  - pricing controls and thresholds

### Phase 6 — Observability & QA (Day 10–20)
- Metrics:
  - contact rate, qualification completion rate, lead ready rate
  - avg time to Lead Ready
  - refund rate by reason
  - credit burn rate
- Quality loops:
  - sample transcripts
  - prompt adjustments
  - scoring template tuning

---

## 13) Operational Runbooks (v1)

### 13.1 Onboarding a new tenant
1. Create tenant in Admin UI
2. Define pricing agreement (CPA, PER_LEAD, packages)
3. Add offers, variants, units (or connect CRM)
4. Set allowlist and add knowledge sources
5. Run scraping and ingest PDFs/URLs
6. Map Meta ads to offers
7. Activate tenant
8. Run test leads (internal) to validate end-to-end

### 13.2 Handling unmapped ads
1. Admin sees unmapped queue
2. Map ad_id → offer
3. “Reprocess” pending leads: send initial message and move to TO_BE_CONTACTED

### 13.3 Refund handling
- Auto: duplicate/spam
- Grey: Admin UI approval triggers `CREDIT_REFUND` ledger entry + marks delivery as refunded

---

## 14) Security & Compliance Checklist

- RLS on tenant-scoped tables
- Service role key used only server-side (n8n/Make)
- Tenant portal never exposes PII pre-delivery
- Opt-out enforced globally (STOP)
- PII masking in logs
- 365-day retention job (scheduled) to purge old messages if needed
- Backups and audit trails (events + ledger)

---

## 15) Future-proofing (v1 → v2)
- Add channels: Instagram DM, web chat
- PER_SALE success fees (CRM event-driven)
- Bank partnership for mortgage offers (tool integration)
- Multi-vertical scoring templates (AUTO/LOAN/INSURANCE) and offer subtypes
- Better normalization of zone with geo data and maps

---

## Appendix A — “Never promise” guardrail copy (Spanish)
Use as a standard policy snippet in prompts:
- “No confirmes disponibilidad; decí que se confirma al avanzar.”
- “No prometas tasa fija, cuotas o descuentos; solo mencioná que hay opciones y se revisan caso a caso.”
- “Si el usuario pide confirmación exacta, pedí datos mínimos y ofrecé que el equipo lo valide al recibir el lead.”

---

## Appendix B — Minimal bot qualification script (example)
1. “Hola {Nombre si existe}, soy el asistente de {Constructora}. Para ayudarte mejor: ¿me decís tu **presupuesto aproximado**?”
2. “Gracias. ¿En qué **zonas** estás buscando?”
3. “¿Para cuándo te gustaría mudarte / concretar?”
4. “¿Tu nombre completo?”
5. “Perfecto. ¿Querés coordinar una **visita** o preferís una **llamada**?”
6. (If inventory allows) “Según lo que me decís, hoy hay estas opciones (a confirmar): A) … B) … C) … ¿Cuál te interesa más?”
7. “Genial. Con esto ya puedo pasarte con el equipo para que lo valide y avance.”

---

## Appendix C — Tooling recommendations
- **Supabase migrations**: use a migration tool (e.g., `supabase db diff` / `supabase migration up`) and keep schema under version control.
- **n8n**: keep workflows exported as JSON in repo; parameterize all credentials via env vars.
- **Prompting**: keep prompts in versioned templates, not inside workflow nodes only.

