-- Add Folder Support to Files
-- Run this in your Supabase SQL Editor

-- Add parent_folder column to files table
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS parent_folder TEXT DEFAULT '/';

-- Add is_folder column to support folder entries
ALTER TABLE files
ADD COLUMN IF NOT EXISTS is_folder BOOLEAN DEFAULT false;

-- Update existing files to be in root folder
UPDATE files 
SET parent_folder = '/' 
WHERE parent_folder IS NULL;

-- Create index for folder queries
CREATE INDEX IF NOT EXISTS files_parent_folder_idx ON files(parent_folder);

-- Function to get folder tree
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

-- Function to create folder
CREATE OR REPLACE FUNCTION create_folder(
  p_project_id UUID,
  p_name TEXT,
  p_path TEXT,
  p_parent_folder TEXT DEFAULT '/'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_folder_id UUID;
BEGIN
  INSERT INTO files (
    project_id,
    name,
    path,
    parent_folder,
    is_folder,
    language,
    content
  ) VALUES (
    p_project_id,
    p_name,
    p_path,
    p_parent_folder,
    true,
    'folder',
    ''
  )
  RETURNING id INTO v_folder_id;
  
  RETURN v_folder_id;
END;
$$;

-- Verify changes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'files' 
AND column_name IN ('parent_folder', 'is_folder');

SELECT 'Folder support added successfully!' as status;
