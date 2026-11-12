-- Add code_content column to code_embeddings table
-- This stores the actual code for RAG context

ALTER TABLE code_embeddings 
ADD COLUMN IF NOT EXISTS code_content TEXT;

-- Add index for faster searches
CREATE INDEX IF NOT EXISTS idx_code_embeddings_file_id 
ON code_embeddings(file_id);

-- Add index for content hash lookups
CREATE INDEX IF NOT EXISTS idx_code_embeddings_content_hash 
ON code_embeddings(content_hash);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'code_embeddings';
