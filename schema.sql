-- Enable pgvector extension for RAG
create extension if not exists vector;

-- ==========================================
-- 1. COMPANIES & PROJECTS (Multi-Tenancy)
-- ==========================================

-- COMPANIES: Agencies or Construction Companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stripe_customer_id text, -- Stripe Customer ID
  credit_balance int default 0, -- Number of leads available
  cpa_price numeric default 10.00, -- Cost per Lead (USD)
  billing_status text default 'ACTIVE', -- ACTIVE, PAUSED, TRIAL
  created_at timestamp with time zone default now()
);

-- PROJECTS: Specific Buildings or Developments
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  description text,
  
  -- Integrations
  tokko_id int, -- Tokko Project ID
  tokko_api_key text, 
  spreadsheet_id text, 
  facebook_form_id text, -- To map FB Lead Form to Project
  
  -- Rich Data (Synced from Tokko or Manual)
  tokko_data jsonb default '{}'::jsonb, -- Full sync data (prices, units)
  amenities text[], -- Array of strings
  images text[], -- Array of Image URLs
  status text default 'ACTIVE', -- ACTIVE, INACTIVE
  
  created_at timestamp with time zone default now()
);

-- ==========================================
-- 2. LEADS & INTERACTIONS
-- ==========================================

-- LEADS: Potential Buyers
create table leads (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone_number text not null,
  email text,
  
  -- Verification
  dni text, -- For Nosis/Veraz check
  credit_check_status text default 'PENDING', -- PENDING, APPROVED, REJECTED
  
  -- Qualification
  score int default 0, -- Lead Score (0-100)
  status text default 'NEW', -- NEW, CONTACTED, QUALIFIED, DISQUALIFIED, SOLD
  qualification_data jsonb default '{}'::jsonb, -- Structured answers (Budget, Timeline, etc.)
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- LEAD_INTERESTS: Many-to-Many relationship
-- Tracks which projects a lead is interested in
create table lead_interests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  status text default 'INTERESTED', -- INTERESTED, VIEWING, OFFER, REJECTED
  created_at timestamp with time zone default now(),
  unique(lead_id, project_id)
);

-- CONVERSATIONS: Chat History
create table conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  active_project_id uuid references projects(id), -- Context for the current chat
  platform text default 'whatsapp',
  messages jsonb default '[]'::jsonb, -- Array of message objects
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ==========================================
-- 3. BILLING & TRANSACTIONS
-- ==========================================

create table transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  amount numeric, -- Money amount (e.g., $50.00)
  credits int, -- Number of leads (e.g., 5)
  type text not null, -- CHARGE (Lead sent), DEPOSIT (Credits bought)
  stripe_payment_id text,
  description text,
  created_at timestamp with time zone default now()
);

-- ==========================================
-- 4. RAG & AI
-- ==========================================

-- PROJECT_DOCUMENTS: Knowledge Base
create table project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  content text, -- The text chunk
  metadata jsonb, -- Source filename, page number, etc.
  embedding vector(1536), -- OpenAI Embedding
  created_at timestamp with time zone default now()
);

-- ==========================================
-- 5. ANALYTICS VIEWS
-- ==========================================

-- View: Leads per Project
create or replace view view_leads_by_project as
select 
  p.name as project_name,
  p.company_id,
  count(li.id) as total_leads
from projects p
left join lead_interests li on p.id = li.project_id
group by p.id;

-- View: Leads by Status (Funnel)
create or replace view view_leads_by_status as
select 
  status,
  count(*) as count
from leads
group by status;

-- ==========================================
-- 6. SECURITY & USERS
-- ==========================================

-- COMPANY_USERS: Link Supabase Auth Users to Companies
create table company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid not null, -- Supabase Auth User ID
  role text default 'ADMIN', -- ADMIN, MEMBER
  created_at timestamp with time zone default now(),
  unique(company_id, user_id)
);

-- Enable RLS
alter table companies enable row level security;
alter table projects enable row level security;
alter table leads enable row level security;
alter table conversations enable row level security;
alter table company_users enable row level security;

-- RLS Policies
-- 1. Company Users can see their own mapping
create policy "Users can view own company mapping"
on company_users for select
using (auth.uid() = user_id);

-- 2. Companies: Users can view their assigned company
create policy "Users can view own company"
on companies for select
using (
  id in (select company_id from company_users where user_id = auth.uid())
);

-- 3. Projects: Users can view projects of their company
create policy "Users can view own company projects"
on projects for select
using (
  company_id in (select company_id from company_users where user_id = auth.uid())
);

-- 4. Leads: Users can view leads of their company's projects
create policy "Users can view own company leads"
on leads for select
using (
  exists (
    select 1 from lead_interests li
    join projects p on li.project_id = p.id
    join company_users cu on p.company_id = cu.company_id
    where li.lead_id = leads.id and cu.user_id = auth.uid()
  )
);

-- ==========================================
-- 7. INDEXES
-- ==========================================
create index idx_leads_phone on leads(phone_number);
create index idx_projects_fb_form on projects(facebook_form_id);
create index idx_lead_interests_lead on lead_interests(lead_id);
create index idx_lead_interests_project on lead_interests(project_id);
create index idx_project_documents_project on project_documents(project_id);
create index idx_company_users_user on company_users(user_id);
