# Real Estate Automation System

A scalable, multi-tenant automation system for Real Estate Agencies using **n8n**, **Supabase**, and **Next.js**.

## Features
- **Multi-Tenancy**: Support multiple construction companies and projects.
- **Lead Ingestion**: Auto-capture leads from Facebook Ads.
- **Intelligent Chat**: AI Agent (RAG) answers questions and qualifies leads via WhatsApp.
- **Billing System**: Stripe integration for managing credits and CPA.
- **Admin Dashboard**: Next.js app for analytics and project management.

## Setup Instructions

### 1. Supabase (Database)
1.  Create a new project in [Supabase](https://supabase.com).
2.  Go to **SQL Editor**.
3.  Copy and run the content of `schema.sql`.
4.  Go to **Authentication** > **Providers** and enable **Google**.
5.  Get your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 2. Admin Dashboard (Next.js)
The dashboard is located in the `admin-dashboard` folder.

1.  Install dependencies:
    ```bash
    cd admin-dashboard
    npm install
    ```
2.  Configure Environment:
    -   Rename `.env.example` to `.env.local`.
    -   Add your Supabase credentials.
3.  Run locally:
    ```bash
    npm run dev
    ```
4.  **Deploy to Vercel**:
    -   Push this repo to GitHub.
    -   Import into Vercel.
    -   Add Environment Variables in Vercel Settings.

### 3. n8n (Automation)
1.  Open your n8n instance (Hostinger VPS).
2.  **Import Workflows**:
    -   Import `workflow_ingestion.json`.
    -   Import `workflow_chat.json`.
3.  **Configure Credentials**:
    -   **Supabase**: Use your Postgres connection string.
    -   **WhatsApp**: Use your Meta Business API Token.
    -   **OpenAI**: Use your API Key.
4.  **Activate Workflows**.

### 4. Facebook & WhatsApp
1.  Follow the [Facebook Setup Guide](facebook_setup_guide.md).
2.  Set the **Webhook URL** in Facebook Developer App to your n8n Webhook URL.

## Security (RLS)
**CRITICAL**: This system uses Row Level Security (RLS) to ensure multi-tenancy safety.
-   Users can only see data belonging to their assigned Company.
-   You must insert a row in `company_users` to link a Supabase User ID to a Company ID.

## API Routes
-   `POST /api/stripe/checkout`: Creates a Stripe Checkout Session for buying credits.
    -   Body: `{ "quantity": 50 }`
-   `POST /api/tokko/sync`: Syncs project data from Tokko Broker.
    -   Body: `{ "project_id": "..." }`

## Project Structure
-   `/admin-dashboard`: Next.js Web App.
-   `schema.sql`: Database Schema.
-   `workflow_ingestion.json`: n8n Lead Capture Flow.
-   `workflow_chat.json`: n8n AI Chat Flow.
