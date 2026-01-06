# Converzia — AGENTS.md (Repository Contract)

## 0) Mission
Ship Converzia as a production-grade multi-tenant lead qualification SaaS:
- Stable: no regressions in lead pipeline
- Secure: webhook validation + RLS isolation + no secret/PII leakage
- Tier-1 UI: consistent design system, no ad-hoc styling
- Observable: errors/latency are measurable and actionable

## 1) Merge Gates (Non-Negotiable)
No PR may merge unless:
- `npm run lint` passes
- `npm run typecheck` passes (must exist)
- `npm run test:run` passes
- UI changes include before/after screenshots
- Critical lead pipeline smoke test completed (manual or E2E)
- No secrets committed; no raw PII in logs

## 2) Standard Commands (must work locally)
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start (prod-like): `npm run start`
- Lint: `npm run lint`
- Unit tests (watch): `npm run test`
- Unit tests (CI): `npm run test:run`
- Coverage (CI optional): `npm run test:coverage`
- Create test users (dev only): `npm run create-users`

### 2.1 Required addition (typecheck)
DATA GAP: `typecheck` script is missing today. Add:
- Typecheck: `npm run typecheck` -> `tsc --noEmit`

## 3) Architecture & Boundaries
Goal: avoid “god files” and tangled dependencies.

### 3.1 Layering Rules
- UI pages/routes: `src/app/**`
- Shared UI components: `src/components/**`
- Business logic: `src/lib/services/**`
- Security primitives: `src/lib/security/**`
- Monitoring: `src/lib/monitoring/**`
- DB / data access: prefer a single data-access layer (avoid scattered Supabase calls)

Rules:
- React components must not contain business logic beyond view-state.
- Route handlers (`src/app/api/**`) must orchestrate only; core logic must live in services.
- External integrations must be isolated into service modules with clear interfaces.

### 3.2 Forbidden Patterns
- Copy/paste logic across routes/services (refactor to shared module).
- Direct external API calls from React components.
- Ad-hoc DB queries sprinkled across UI; centralize data access.

## 4) Multi-tenancy / Supabase RLS Contract
Converzia is multi-tenant. Isolation is enforced by RLS.

Hard rules:
- NEVER weaken RLS policies.
- All tenant-scoped reads/writes must include tenant constraints even if RLS exists.
- Supabase service role key is server-side only; never exposed to client bundles.
- Any new tenant-scoped table must include:
  - `tenant_id`
  - RLS enabled + explicit policies
  - test coverage for access boundaries (at minimum, unit/integration)

If uncertain: stop and request Security + DB review.

## 5) Security Contract
### 5.1 Secrets
- Never commit secrets.
- Use `.env.local` for local dev only.
- Keep `.env.example` with placeholders (no real tokens).
- Never print env values to logs.

### 5.2 Webhooks
All webhooks must:
- Validate signature (Meta/Stripe/Chatwoot)
- Apply rate limiting
- Be idempotent (safe replays)
- Avoid logging raw request bodies if they contain PII

### 5.3 PII
- Use existing AES-256-GCM helpers for PII fields.
- Never log raw PII; redact by default.
- Any new PII field must state:
  - where stored (encrypted?)
  - where decrypted (who can access?)
  - how masked in UI

## 6) Critical Flows (Do Not Break)
Any change touching these requires QA review and (ideally) E2E coverage.

### 6.1 Lead Pipeline (Happy Path)
Meta lead webhook
→ ad mapping (tenant + offer)
→ lead upsert + lead_offer creation
→ initial WhatsApp message (Chatwoot template)
→ inbound message webhook
→ LLM field extraction
→ RAG retrieval (optional)
→ response generation
→ scoring
→ delivery creation
→ delivery processing
→ credit consumption

### 6.2 Billing/Credits
- Stripe checkout session creation
- Stripe webhook processing
- credit_ledger updates
- credit consumption only under the defined “delivery success” rule

Rule must be explicit:
- Success = DELIVERED or PARTIAL? (define and document; tests must enforce)

### 6.3 State Machine
LeadOffer state transitions must remain valid and auditable.
- Do not bypass transition validation via raw status updates.

## 7) Integrations Contract (External APIs)
All integrations must implement:
- Timeouts (no hanging calls)
- Retries with exponential backoff (bounded)
- Idempotency where possible
- Dead-letter handling after N failures
- Structured error logs (no secrets/PII)

Integrations include:
- Meta Lead Ads / Graph API
- Chatwoot (WhatsApp)
- OpenAI (chat + embeddings)
- Stripe (checkout + webhooks)
- Tokko CRM
- Google Sheets OAuth + append

## 8) UX/UI Tier-1 Contract
### 8.1 Design System
- UI must use a single component system and token scale.
- No one-off styles without UI agent approval.

### 8.2 Standards
- Consistent spacing + typography scale
- Loading/Empty/Error/Success states on all data screens
- Accessibility basics: focus states, aria labels, keyboard navigation for dialogs/menus

### 8.3 Evidence
All UI PRs must include screenshots:
- Before + After
- Desktop + one responsive breakpoint (if user-facing)

## 9) Testing Strategy
Minimum:
- Unit tests for pure logic (scoring, mapping, parsing)
- Integration tests for delivery processing and webhook validation where feasible
Recommended:
- E2E smoke tests for lead pipeline

Definition of Done:
- Tests updated/added for behavior changes
- Bugfixes require a regression test

## 10) PR Discipline
### 10.1 Size
Target PR size: < 500 net lines.
If larger: split (refactor PR first, feature PR second).

### 10.2 PR Checklist (must include)
- What changed / Why
- How to test (commands + manual steps)
- Screenshots (UI)
- Risks + rollback notes

## 11) Agent Team (Roles & Scope)
Agents must stay in their lane. Coordinator/EM routes work.

- Coordinator/EM: decomposes tasks, enforces gates, approves merge readiness
- Product Spec: PRD-lite (stories, edge cases, acceptance criteria)
- UX Flow: navigation and state consistency
- UI Design System: tokens/components; blocks ad-hoc UI
- Frontend Feature: implements screens using the design system
- Backend/API: route handlers + service boundaries + validation
- DB/Migrations: schema + RLS + constraints + indexes
- Integrations: robustness for Meta/Chatwoot/Stripe/Tokko/Sheets
- QA: regression plan + tests (unit/integration/E2E)
- Security: authZ/RLS/secrets/webhooks/PII
- Performance/Observability: measure latency/errors; ensure metrics are actionable
- DevOps/CI: CI gates + preview + release checklist

## 12) When Uncertain
Do not guess.
Write: `DATA GAP: Need X` and propose options with trade-offs.
