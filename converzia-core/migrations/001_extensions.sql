-- ============================================
-- Converzia: Extensions Setup
-- Migration: 001_extensions
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for embeddings

-- Enable full-text search (usually enabled by default)
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy matching if needed











