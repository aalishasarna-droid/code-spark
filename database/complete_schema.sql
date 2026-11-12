-- ============================================================================
-- MCP-IDE Complete Database Schema
-- Run this ONCE in your Supabase SQL Editor to set up everything
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  last_opened_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at DESC);

-- ============================================================================
-- 2. FILES TABLE (with folder support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN DEFAULT false,
  parent_folder TEXT DEFAULT '/',
  is_folder BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(project_id, path)
);

CREATE INDEX IF NOT EXISTS files_project_id_idx ON files(project_id);
CREATE INDEX IF NOT EXISTS files_user_id_idx ON files(user_id);
CREATE INDEX IF NOT EXISTS files_language_idx ON files(language);
CREATE INDEX IF NOT EXISTS files_parent_folder_idx ON files(parent_folder);
CREATE INDEX IF NOT EXISTS files_updated_at_idx ON files(updated_at DESC);

-- ============================================================================
-- 3. FILE VERSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS file_versions_file_id_idx ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS file_versions_created_at_idx ON file_versions(created_at DESC);

-- ============================================================================
-- 4. TUTOR SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tutor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  model_type TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  ended_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS tutor_sessions_user_id_idx ON tutor_sessions(user_id);
CREATE INDEX IF NOT EXISTS tutor_sessions_started_at_idx ON tutor_sessions(started_at DESC);

-- ============================================================================
-- 5. TUTOR MESSAGES TABLE (with context columns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  code_context TEXT,
  execution_context JSONB,
  cursor_line INTEGER,
  cursor_column INTEGER,
  selected_text TEXT,
  errors TEXT[],
  model_type TEXT,
  response_time_ms INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS tutor_messages_session_id_idx ON tutor_messages(session_id);
CREATE INDEX IF NOT EXISTS tutor_messages_created_at_idx ON tutor_messages(created_at DESC);

-- ============================================================================
-- 6. CODE HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  code_content TEXT NOT NULL,
  cursor_line INTEGER,
  cursor_column INTEGER,
  errors TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS code_history_user_id_idx ON code_history(user_id);
CREATE INDEX IF NOT EXISTS code_history_file_path_idx ON code_history(file_path);
CREATE INDEX IF NOT EXISTS code_history_created_at_idx ON code_history(created_at DESC);

-- ============================================================================
-- 7. CODE EMBEDDINGS TABLE (for RAG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS code_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  code_content TEXT,  -- The actual code content
  embedding VECTOR(384),  -- 384 dimensions for all-MiniLM-L6-v2
  content_hash TEXT,  -- SHA256 hash to detect changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS code_embeddings_file_id_idx ON code_embeddings(file_id);
CREATE INDEX IF NOT EXISTS code_embeddings_content_hash_idx ON code_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS code_embeddings_embedding_idx 
  ON code_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS code_embeddings_file_path_idx ON code_embeddings(file_path);
CREATE INDEX IF NOT EXISTS code_embeddings_language_idx ON code_embeddings(language);

-- ============================================================================
-- 8. DOC EMBEDDINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS doc_embeddings (
  id BIGSERIAL PRIMARY KEY,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT,
  chunk_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(doc_type, title, chunk_id)
);

CREATE INDEX IF NOT EXISTS doc_embeddings_embedding_idx 
  ON doc_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS doc_embeddings_doc_type_idx ON doc_embeddings(doc_type);
CREATE INDEX IF NOT EXISTS doc_embeddings_language_idx ON doc_embeddings(language);

-- ============================================================================
-- 9. LEARNING CONCEPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_concepts (
  id BIGSERIAL PRIMARY KEY,
  concept_name TEXT NOT NULL UNIQUE,
  language TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  description TEXT NOT NULL,
  examples TEXT[],
  related_concepts TEXT[],
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS learning_concepts_embedding_idx 
  ON learning_concepts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS learning_concepts_name_idx ON learning_concepts(concept_name);
CREATE INDEX IF NOT EXISTS learning_concepts_language_idx ON learning_concepts(language);

-- ============================================================================
-- 10. COMMON ERRORS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS common_errors (
  id BIGSERIAL PRIMARY KEY,
  error_type TEXT NOT NULL,
  language TEXT NOT NULL,
  error_message TEXT NOT NULL,
  explanation TEXT NOT NULL,
  hint TEXT NOT NULL,
  example_code TEXT,
  embedding VECTOR(768),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS common_errors_embedding_idx 
  ON common_errors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS common_errors_language_idx ON common_errors(language);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_code_embeddings_updated_at ON code_embeddings;
CREATE TRIGGER update_code_embeddings_updated_at
  BEFORE UPDATE ON code_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doc_embeddings_updated_at ON doc_embeddings;
CREATE TRIGGER update_doc_embeddings_updated_at
  BEFORE UPDATE ON doc_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_learning_concepts_updated_at ON learning_concepts;
CREATE TRIGGER update_learning_concepts_updated_at
  BEFORE UPDATE ON learning_concepts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_common_errors_updated_at ON common_errors;
CREATE TRIGGER update_common_errors_updated_at
  BEFORE UPDATE ON common_errors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create file version on update
CREATE OR REPLACE FUNCTION create_file_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO file_versions (file_id, content, change_description)
    VALUES (NEW.id, OLD.content, 'Auto-saved version');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_version_files ON files;
CREATE TRIGGER auto_version_files
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION create_file_version();

-- Get folder tree function
CREATE OR REPLACE FUNCTION get_folder_tree(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  path TEXT,
  parent_folder TEXT,
  is_folder BOOLEAN,
  language TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.path,
    f.parent_folder,
    f.is_folder,
    f.language,
    f.is_active
  FROM files f
  WHERE f.project_id = p_project_id
  ORDER BY f.is_folder DESC, f.path ASC;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Allow anonymous for now
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (will add proper auth later)
DROP POLICY IF EXISTS "Anyone can manage projects" ON projects;
CREATE POLICY "Anyone can manage projects" ON projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can manage files" ON files;
CREATE POLICY "Anyone can manage files" ON files FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view file versions" ON file_versions;
CREATE POLICY "Anyone can view file versions" ON file_versions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert tutor sessions" ON tutor_sessions;
CREATE POLICY "Anyone can insert tutor sessions" ON tutor_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view tutor sessions" ON tutor_sessions;
CREATE POLICY "Anyone can view tutor sessions" ON tutor_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update tutor sessions" ON tutor_sessions;
CREATE POLICY "Anyone can update tutor sessions" ON tutor_sessions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can insert tutor messages" ON tutor_messages;
CREATE POLICY "Anyone can insert tutor messages" ON tutor_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view tutor messages" ON tutor_messages;
CREATE POLICY "Anyone can view tutor messages" ON tutor_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert code history" ON code_history;
CREATE POLICY "Anyone can insert code history" ON code_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view code history" ON code_history;
CREATE POLICY "Anyone can view code history" ON code_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can manage code embeddings" ON code_embeddings;
CREATE POLICY "Anyone can manage code embeddings" ON code_embeddings FOR ALL USING (true) WITH CHECK (true);

-- Public read for documentation
DROP POLICY IF EXISTS "Anyone can view documentation embeddings" ON doc_embeddings;
CREATE POLICY "Anyone can view documentation embeddings" ON doc_embeddings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view learning concepts" ON learning_concepts;
CREATE POLICY "Anyone can view learning concepts" ON learning_concepts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view common errors" ON common_errors;
CREATE POLICY "Anyone can view common errors" ON common_errors FOR SELECT USING (true);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Create default project
INSERT INTO projects (id, name, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'My First Project',
  'A sample project to get started'
) ON CONFLICT (id) DO NOTHING;

-- Create sample files
INSERT INTO files (id, project_id, name, path, language, content, is_active, parent_folder, is_folder)
VALUES 
  (
    '59b8f49a-4129-4c22-a4e0-9758a1c58639',
    '00000000-0000-0000-0000-000000000001',
    'main.js',
    'main.js',
    'javascript',
    '// Welcome to MCP-IDE!\nconsole.log("Hello, World!");',
    true,
    '/',
    false
  ),
  (
    '23f93982-09ad-4a28-81b5-a4f89f359806',
    '00000000-0000-0000-0000-000000000001',
    'utils.js',
    'utils.js',
    'javascript',
    '// Utility functions\nfunction add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };',
    false,
    '/',
    false
  )
ON CONFLICT (project_id, path) DO NOTHING;

-- Insert sample learning concepts
INSERT INTO learning_concepts (concept_name, language, difficulty_level, description, examples, related_concepts)
VALUES 
  ('Recursion', 'javascript', 'intermediate', 
   'A function that calls itself to solve a problem by breaking it down into smaller subproblems.',
   ARRAY['factorial', 'fibonacci', 'tree traversal'],
   ARRAY['base case', 'call stack', 'iteration']),
  
  ('Array Methods', 'javascript', 'beginner',
   'Built-in functions for manipulating arrays like map, filter, and reduce.',
   ARRAY['map', 'filter', 'reduce', 'forEach'],
   ARRAY['higher-order functions', 'callbacks', 'functional programming'])
ON CONFLICT (concept_name) DO NOTHING;

-- Insert sample common errors
INSERT INTO common_errors (error_type, language, error_message, explanation, hint, example_code)
VALUES 
  ('ReferenceError', 'javascript', 'variable is not defined',
   'You are trying to use a variable that has not been declared.',
   'Check if you declared the variable with let, const, or var before using it.',
   'let myVar = 10; // Declare before use'),
  
  ('TypeError', 'javascript', 'Cannot read property of undefined',
   'You are trying to access a property of an undefined or null value.',
   'Check if the object exists before accessing its properties. Use optional chaining (?.) or conditional checks.',
   'if (obj && obj.property) { ... }')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Complete schema created successfully!' as status;

-- Show tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Show sample project
SELECT * FROM projects WHERE id = '00000000-0000-0000-0000-000000000001';

-- Show sample files
SELECT id, name, path, language, is_folder, parent_folder 
FROM files 
WHERE project_id = '00000000-0000-0000-0000-000000000001';

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

