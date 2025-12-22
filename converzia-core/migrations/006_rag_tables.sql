-- ============================================
-- Converzia: RAG Knowledge Tables
-- Migration: 006_rag_tables
-- ============================================

-- ============================================
-- RAG SOURCES (knowledge source definitions)
-- ============================================
CREATE TABLE rag_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE, -- NULL = tenant-general
  
  -- Source type
  source_type rag_source_type NOT NULL,
  
  -- Source details
  name TEXT NOT NULL,
  description TEXT,
  
  -- URL/Path
  source_url TEXT, -- For URL/WEBSITE types
  storage_path TEXT, -- For uploaded files (Supabase Storage)
  
  -- Website scraping config
  scrape_config JSONB DEFAULT '{}',
  -- Example:
  -- {
  --   "root_url": "https://example.com",
  --   "allowlist": ["/proyectos/*", "/amenities"],
  --   "blocklist": ["/admin/*"],
  --   "max_pages": 50,
  --   "follow_links": true
  -- }
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_processed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX idx_rag_sources_tenant ON rag_sources(tenant_id);
CREATE INDEX idx_rag_sources_offer ON rag_sources(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_rag_sources_type ON rag_sources(source_type);
CREATE INDEX idx_rag_sources_active ON rag_sources(is_active) WHERE is_active = TRUE;

-- ============================================
-- RAG DOCUMENTS (processed documents)
-- ============================================
CREATE TABLE rag_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES rag_sources(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
  
  -- Document info
  title TEXT,
  url TEXT, -- Original URL if applicable
  
  -- Content
  raw_content TEXT,
  cleaned_content TEXT,
  
  -- Versioning
  content_hash TEXT NOT NULL, -- SHA256 of content for dedup
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  
  -- Status
  status rag_document_status NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  
  -- Metadata
  doc_type TEXT, -- 'FAQ', 'BROCHURE', 'LANDING', 'LEGAL', etc.
  language TEXT DEFAULT 'es',
  page_count INTEGER,
  word_count INTEGER,
  
  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  chunk_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rag_documents_source ON rag_documents(source_id);
CREATE INDEX idx_rag_documents_tenant ON rag_documents(tenant_id);
CREATE INDEX idx_rag_documents_offer ON rag_documents(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_rag_documents_hash ON rag_documents(content_hash);
CREATE INDEX idx_rag_documents_current ON rag_documents(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_rag_documents_status ON rag_documents(status);

-- ============================================
-- RAG CHUNKS (embedded chunks with hybrid search)
-- ============================================
CREATE TABLE rag_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES rag_sources(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT NOT NULL,
  
  -- Vector embedding (1536 dimensions for OpenAI ada-002)
  embedding vector(1536),
  
  -- Full-text search
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED,
  
  -- Position
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  section TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  -- Example:
  -- {
  --   "doc_type": "FAQ",
  --   "heading": "¿Cuáles son las formas de pago?",
  --   "language": "es"
  -- }
  
  -- Token count
  token_count INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector similarity search index (HNSW)
CREATE INDEX idx_rag_chunks_embedding ON rag_chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search index (GIN)
CREATE INDEX idx_rag_chunks_tsv ON rag_chunks USING gin(content_tsv);

-- Filtering indexes
CREATE INDEX idx_rag_chunks_document ON rag_chunks(document_id);
CREATE INDEX idx_rag_chunks_source ON rag_chunks(source_id);
CREATE INDEX idx_rag_chunks_tenant ON rag_chunks(tenant_id);
CREATE INDEX idx_rag_chunks_offer ON rag_chunks(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_rag_chunks_tenant_offer ON rag_chunks(tenant_id, offer_id);

-- ============================================
-- FUNCTION: Hybrid Search
-- ============================================
CREATE OR REPLACE FUNCTION search_rag_chunks(
  p_tenant_id UUID,
  p_offer_id UUID,
  p_query_embedding vector(1536),
  p_query_text TEXT,
  p_limit INTEGER DEFAULT 10,
  p_vector_weight FLOAT DEFAULT 0.7,
  p_text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  vector_score FLOAT,
  text_score FLOAT,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT 
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      1 - (c.embedding <=> p_query_embedding) AS v_score
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE c.tenant_id = p_tenant_id
      AND (p_offer_id IS NULL OR c.offer_id IS NULL OR c.offer_id = p_offer_id)
      AND d.is_current = TRUE
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_limit * 2
  ),
  text_results AS (
    SELECT 
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      ts_rank_cd(c.content_tsv, plainto_tsquery('spanish', p_query_text)) AS t_score
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE c.tenant_id = p_tenant_id
      AND (p_offer_id IS NULL OR c.offer_id IS NULL OR c.offer_id = p_offer_id)
      AND d.is_current = TRUE
      AND c.content_tsv @@ plainto_tsquery('spanish', p_query_text)
    ORDER BY t_score DESC
    LIMIT p_limit * 2
  ),
  combined AS (
    SELECT 
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.document_id, t.document_id) AS doc_id,
      COALESCE(v.content, t.content) AS cnt,
      COALESCE(v.metadata, t.metadata) AS meta,
      COALESCE(v.v_score, 0) AS vs,
      COALESCE(t.t_score, 0) AS ts
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
  )
  SELECT 
    id AS chunk_id,
    doc_id AS document_id,
    cnt AS content,
    meta AS metadata,
    vs AS vector_score,
    ts AS text_score,
    (vs * p_vector_weight + ts * p_text_weight) AS combined_score
  FROM combined
  ORDER BY (vs * p_vector_weight + ts * p_text_weight) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Vector-only Search (simpler)
-- ============================================
CREATE OR REPLACE FUNCTION search_rag_chunks_vector(
  p_tenant_id UUID,
  p_offer_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS chunk_id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM rag_chunks c
  JOIN rag_documents d ON d.id = c.document_id
  WHERE c.tenant_id = p_tenant_id
    AND (p_offer_id IS NULL OR c.offer_id IS NULL OR c.offer_id = p_offer_id)
    AND d.is_current = TRUE
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;









