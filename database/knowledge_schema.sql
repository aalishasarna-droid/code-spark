-- ============================================================================
-- Knowledge Hub Schema
-- Upload study notes (PDF, TXT, MD), store as chunked vector embeddings,
-- and enable RAG-powered Q&A with citations.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- Ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. KNOWLEDGE DOCUMENTS — metadata per uploaded file
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,            -- 'pdf', 'txt', 'md'
  file_size_bytes BIGINT DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing'    -- 'processing', 'ready', 'error'
    CHECK (status IN ('processing', 'ready', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_documents_project_id_idx
  ON knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_status_idx
  ON knowledge_documents(status);
CREATE INDEX IF NOT EXISTS knowledge_documents_created_at_idx
  ON knowledge_documents(created_at DESC);

-- ============================================================================
-- 2. KNOWLEDGE CHUNKS — chunked text with embeddings (384d for MiniLM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,                -- source page in PDF (NULL for txt/md)
  section_title TEXT,                 -- heading if extractable
  embedding VECTOR(384),              -- all-MiniLM-L6-v2 dimension
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_document_id_idx
  ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_chunk_index_idx
  ON knowledge_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS knowledge_chunks_content_hash_idx
  ON knowledge_chunks(content_hash);

-- Vector similarity search index (ivfflat)
-- NOTE: ivfflat requires at least 100 rows to build.
-- If you have fewer rows initially, the index will still be created
-- but won't be used until there are enough rows.
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- 3. RLS POLICIES — allow anonymous access (matching existing setup)
-- ============================================================================
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (matching your existing pattern)
CREATE POLICY "Allow all operations on knowledge_documents"
  ON knowledge_documents FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on knowledge_chunks"
  ON knowledge_chunks FOR ALL
  USING (true)
  WITH CHECK (true);
