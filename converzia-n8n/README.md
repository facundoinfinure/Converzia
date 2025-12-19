# Converzia n8n Workflows

Orchestration workflows for the Converzia lead qualification platform.

## Workflows

### Core Workflows

1. **incoming_message_webhook**
   - Triggered by Chatwoot webhook
   - Routes messages to appropriate handlers

2. **send_initial_message**
   - Sends first contact message to new leads
   - Called by Make after lead ingestion

3. **lead_qualify_and_reply** (Main workflow)
   - Receives message from Chatwoot
   - Loads lead context and active lead_offers
   - Runs extraction for qualification fields
   - Queries inventory (offers/variants/units)
   - Performs hybrid RAG retrieval
   - Generates AI response
   - Updates state and scoring
   - Triggers delivery if Lead Ready

4. **reactivation_cron**
   - Runs on schedule (e.g., every 4 hours)
   - Finds leads in COOLING status
   - Sends reactivation messages (3 touches over 7 days)

5. **stripe_webhooks**
   - Handles Stripe events
   - checkout.session.completed → add credits
   - payment_intent.succeeded → update order status

### Knowledge Workflows

6. **rag_ingestion_job**
   - Processes PDFs and URLs
   - Chunks content
   - Generates embeddings
   - Stores in rag_chunks

7. **scrape_website_job**
   - Manual trigger from Admin UI
   - Scrapes allowed paths
   - Deduplicates by content hash
   - Creates rag_documents

## Environment Variables

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Chatwoot
CHATWOOT_BASE_URL=https://app.chatwoot.com
CHATWOOT_API_TOKEN=xxx
CHATWOOT_ACCOUNT_ID=1

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Sheets
GOOGLE_SHEETS_CREDENTIALS={}
GOOGLE_SHEETS_SPREADSHEET_ID=xxx

# Tokko CRM
TOKKO_API_URL=https://api.tokkobroker.com
TOKKO_API_KEY=xxx
```

## Workflow Structure

Each workflow JSON file follows this structure:
- `workflow_name.json` - The n8n workflow export
- Environment variables are referenced via `{{$env.VAR_NAME}}`

## Deployment

1. Import workflows to n8n instance
2. Configure credentials (use n8n credential system)
3. Set environment variables
4. Activate workflows

## Main Conversation Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Chatwoot   │────▶│  n8n Webhook    │────▶│ Load Lead Context│
│   Webhook    │     │                 │     │                  │
└──────────────┘     └─────────────────┘     └────────┬─────────┘
                                                      │
                                                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Main Qualification Loop                    │
├──────────────────────────────────────────────────────────────┤
│  1. Extract fields (budget, zone, timing, intent)            │
│  2. Query inventory DB (offers, variants, units)             │
│  3. Hybrid RAG search (offer-specific + tenant-general)      │
│  4. Generate response (with guardrails)                      │
│  5. Update lead_offer state                                  │
│  6. Calculate score                                          │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Score >= Threshold?  │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Yes                   │ No
                    ▼                       ▼
        ┌───────────────────┐    ┌───────────────────┐
        │  Billing Gate     │    │ Continue          │
        │  (check credits)  │    │ Conversation      │
        └─────────┬─────────┘    └───────────────────┘
                  │
                  ▼
        ┌───────────────────┐
        │  Deliver Lead     │
        │  (Sheets + CRM)   │
        └───────────────────┘
```




