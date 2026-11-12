import { useState, useEffect } from 'react'
import { Folder, Plus, Trash2, Edit2, ChevronRight, ChevronDown, FolderPlus, Code2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { API_ENDPOINTS } from '@/lib/api-config'

interface FileItem {
  id: string
  name: string
  path: string
  language: string
  content: string
  is_active: boolean
  parent_folder: string
  is_folder: boolean
}

interface Project {
  id: string
  name: string
  description: string
}

interface FileExplorerProps {
  onFileSelect: (file: FileItem) => void
  currentFileId?: string
  onFileDelete?: (fileId: string) => void
}

interface FolderNode {
  path: string
  name: string
  files: FileItem[]
  subfolders: Map<string, FolderNode>
  isExpanded: boolean
}

const FileExplorer = ({ onFileSelect, currentFileId, onFileDelete }: FileExplorerProps) => {
  const [_projects, setProjects] = useState<Project[]>([])  // Prefix with _ to indicate intentionally unused
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']))
  const [showNewFileModal, setShowNewFileModal] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [renameFileName, setRenameFileName] = useState('')
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null)
  const [currentFolder, setCurrentFolder] = useState('/')

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Load files when project changes
  useEffect(() => {
    if (currentProject) {
      loadFiles(currentProject.id)
    }
  }, [currentProject])

  // Build folder tree when files change
  useEffect(() => {
    if (files.length > 0) {
      buildFolderTree()
    }
  }, [files, expandedFolders])

  const buildFolderTree = () => {
    console.log('Building folder tree with files:', files.length)
    const root: FolderNode = {
      path: '/',
      name: 'root',
      files: [],
      subfolders: new Map(),
      isExpanded: true
    }

    // First pass: create all folder nodes
    files.forEach(file => {
      console.log('Processing file:', file.name, 'is_folder:', file.is_folder)
      if (file.is_folder) {
        // Create folder node
        const folderPath = file.path
        const parts = folderPath.split('/').filter(Boolean)
        let current = root
        let currentPath = ''

        parts.forEach(part => {
          currentPath += '/' + part
          if (!current.subfolders.has(currentPath)) {
            current.subfolders.set(currentPath, {
              path: currentPath,
              name: part,
              files: [],
              subfolders: new Map(),
              isExpanded: expandedFolders.has(currentPath)
            })
          }
          current = current.subfolders.get(currentPath)!
        })
      }
    })

    // Second pass: add files to their folders
    files.forEach(file => {
      if (file.is_folder) return

      const folder = file.parent_folder || '/'
      if (folder === '/') {
        root.files.push(file)
      } else {
        // Navigate to the folder and add file
        const parts = folder.split('/').filter(Boolean)
        let current = root
        let currentPath = ''

        parts.forEach(part => {
          currentPath += '/' + part
          if (!current.subfolders.has(currentPath)) {
            current.subfolders.set(currentPath, {
              path: currentPath,
              name: part,
              files: [],
              subfolders: new Map(),
              isExpanded: expandedFolders.has(currentPath)
            })
          }
          current = current.subfolders.get(currentPath)!
        })

        current.files.push(file)
      }
    })

    console.log('Folder tree built:', root)
    setFolderTree(root)
  }

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const loadProjects = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.filesProjects())
      const data = await response.json()
      setProjects(data.projects)
      
      // Select first project by default
      if (data.projects.length > 0) {
        setCurrentProject(data.projects[0])
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const loadFiles = async (projectId: string) => {
    try {
      console.log('Loading files for project:', projectId)
      const response = await fetch(API_ENDPOINTS.filesProjectFiles(projectId))
      const data = await response.json()
      console.log('Files loaded:', data.files)
      setFiles(data.files)
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }

  const handleCreateFile = async () => {
    if (!newFileName || !currentProject) return

    console.log('Creating file:', newFileName, 'in folder:', currentFolder)

    // Determine language from extension
    const ext = newFileName.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'cpp': 'cpp',
      'c': 'c',
      'java': 'java',
      'html': 'html',
      'css': 'css',
      'json': 'json'
    }
    const language = languageMap[ext || ''] || 'plaintext'

    // Build full path
    const fullPath = currentFolder === '/' ? newFileName : `${currentFolder}/${newFileName}`

    console.log('Full path:', fullPath, 'Language:', language)

    try {
      const response = await fetch(API_ENDPOINTS.filesCreate(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProject.id,
          name: newFileName,
          path: fullPath,
          language: language,
          content: '',
          parent_folder: currentFolder,
          is_folder: false
        })
      })

      console.log('Create file response:', response.status)

      if (response.ok) {
        const newFile = await response.json()
        console.log('New file created:', newFile)
        // Add to local state immediately
        setFiles([...files, newFile])
        setNewFileName('')
        setShowNewFileModal(false)
        // Select the new file
        onFileSelect(newFile)
      } else {
        const error = await response.text()
        console.error('Failed to create file:', response.status, error)
      }
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName || !currentProject) return

    console.log('Creating folder:', newFolderName, 'in:', currentFolder)

    const fullPath = currentFolder === '/' ? newFolderName : `${currentFolder}/${newFolderName}`

    console.log('Full folder path:', fullPath)

    try {
      const response = await fetch(API_ENDPOINTS.filesCreate(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProject.id,
          name: newFolderName,
          path: fullPath,
          language: 'folder',
          content: '',
          parent_folder: currentFolder,
          is_folder: true
        })
      })

      console.log('Create folder response:', response.status)

      if (response.ok) {
        const newFolder = await response.json()
        console.log('New folder created:', newFolder)
        // Add to local state immediately
        setFiles([...files, newFolder])
        setNewFolderName('')
        setShowNewFolderModal(false)
        setExpandedFolders(new Set([...expandedFolders, fullPath]))
      } else {
        const error = await response.text()
        console.error('Failed to create folder:', response.status, error)
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const response = await fetch(API_ENDPOINTS.filesDelete(fileId), {
        method: 'DELETE'
      })

      if (response.ok) {
        console.log('✅ File deleted from database')
        // Notify parent component
        if (onFileDelete) {
          onFileDelete(fileId)
        }
        // Reload files from server to ensure sync
        if (currentProject) {
          await loadFiles(currentProject.id)
        }
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const handleDeleteFolder = async (folderPath: string) => {
    if (!confirm(`Are you sure you want to delete folder "${folderPath}" and all its contents?`)) return

    console.log('🗑️ Deleting folder:', folderPath)
    console.log('📋 All files:', files.map(f => ({ path: f.path, is_folder: f.is_folder, parent: f.parent_folder })))

    try {
      // Normalize folder path (remove leading slash if present)
      const normalizedPath = folderPath.startsWith('/') ? folderPath.substring(1) : folderPath
      const withSlash = '/' + normalizedPath
      
      console.log('🔍 Searching for paths:', { original: folderPath, normalized: normalizedPath, withSlash })
      
      // Find all files related to this folder (try multiple path formats)
      const filesToDelete = files.filter(f => {
        const matches = 
          f.path === folderPath ||  // Exact match
          f.path === normalizedPath ||  // Without leading slash
          f.path === withSlash ||  // With leading slash
          f.path.startsWith(folderPath + '/') ||  // Files inside (with slash)
          f.path.startsWith(normalizedPath + '/') ||  // Files inside (normalized)
          f.parent_folder === folderPath ||  // Direct children
          f.parent_folder === normalizedPath ||  // Direct children (normalized)
          f.parent_folder === withSlash  // Direct children (with slash)
        
        if (matches) {
          console.log(`  ✓ Will delete: ${f.path} (is_folder: ${f.is_folder}, parent: ${f.parent_folder})`)
        }
        return matches
      })

      console.log(`📊 Found ${filesToDelete.length} items to delete`)

      if (filesToDelete.length === 0) {
        console.error('❌ No files found to delete!')
        console.log('💡 This might be a display-only folder. Refreshing...')
        // Just reload to sync with database
        if (currentProject) {
          await loadFiles(currentProject.id)
        }
        return
      }

      // Delete all files and the folder
      for (const file of filesToDelete) {
        console.log(`🗑️ Deleting: ${file.path}`)
        const response = await fetch(API_ENDPOINTS.filesDelete(file.id), {
          method: 'DELETE'
        })
        
        if (response.ok) {
          console.log(`  ✅ Deleted: ${file.path}`)
        } else {
          console.error(`  ❌ Failed to delete ${file.path}:`, response.status)
        }
        
        // Notify parent for each deleted file
        if (onFileDelete) {
          onFileDelete(file.id)
        }
      }

      console.log('✅ Folder deletion complete, reloading files...')
      
      // Reload files from server to ensure sync
      if (currentProject) {
        await loadFiles(currentProject.id)
      }
    } catch (error) {
      console.error('❌ Failed to delete folder:', error)
    }
  }

  const handleRenameFile = async () => {
    if (!renameFileName || !renamingFile || !currentProject) return

    // const oldPath = renamingFile.path  // Not currently used
    const parentFolder = renamingFile.parent_folder || '/'
    const newPath = parentFolder === '/' ? renameFileName : `${parentFolder}/${renameFileName}`

    try {
      const response = await fetch(API_ENDPOINTS.filesUpdate(renamingFile.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: renameFileName,
          path: newPath
        })
      })

      if (response.ok) {
        // Update local state
        setFiles(files.map(f => 
          f.id === renamingFile.id 
            ? { ...f, name: renameFileName, path: newPath }
            : f
        ))
        setShowRenameModal(false)
        setRenamingFile(null)
        setRenameFileName('')
      }
    } catch (error) {
      console.error('Failed to rename file:', error)
    }
  }

  const createProjectTemplate = async (template: 'react' | 'node' | 'vanilla') => {
    if (!currentProject) return

    const templates = {
      react: [
        { name: 'package.json', content: JSON.stringify({
          name: 'react-app',
          version: '1.0.0',
          type: 'module',
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          }
        }, null, 2), language: 'json' },
        { name: 'index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/main.js"></script>
</body>
</html>`, language: 'html' },
        { name: 'main.js', content: `import { add } from './utils.js';

console.log('Sum:', add(5, 3));
console.log('React app ready!');`, language: 'javascript' },
        { name: 'utils.js', content: `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}`, language: 'javascript' }
      ],
      node: [
        { name: 'package.json', content: JSON.stringify({
          name: 'node-app',
          version: '1.0.0',
          type: 'module',
          main: 'main.js'
        }, null, 2), language: 'json' },
        { name: 'main.js', content: `import { add } from './mathUtils.js';
import { fibonacci } from './fibonacci.js';

const sum = add(5, 7);
const fibSeq = fibonacci(7);

console.log('Sum:', sum);
console.log('Fibonacci:', fibSeq);`, language: 'javascript' },
        { name: 'mathUtils.js', content: `export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}`, language: 'javascript' },
        { name: 'fibonacci.js', content: `export function fibonacci(n) {
  let a = 0, b = 1;
  let result = [];
  
  for (let i = 0; i < n; i++) {
    result.push(a);
    [a, b] = [b, a + b];
  }
  
  return result;
}`, language: 'javascript' }
      ],
      vanilla: [
        { name: 'package.json', content: JSON.stringify({
          name: 'vanilla-js',
          version: '1.0.0',
          type: 'module'
        }, null, 2), language: 'json' },
        { name: 'main.js', content: `console.log('Hello, World!');`, language: 'javascript' }
      ]
    }

    const templateFiles = templates[template]

    try {
      for (const file of templateFiles) {
        await fetch(API_ENDPOINTS.filesCreate(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: currentProject.id,
            name: file.name,
            path: file.name,
            language: file.language,
            content: file.content,
            parent_folder: '/',
            is_folder: false
          })
        })
      }

      // Reload files
      await loadFiles(currentProject.id)
      setShowTemplateModal(false)
    } catch (error) {
      console.error('Failed to create template:', error)
    }
  }

  const getFileIcon = (language: string) => {
    const icons: Record<string, string> = {
      'javascript': '📄',
      'typescript': '📘',
      'python': '🐍',
      'cpp': '⚙️',
      'java': '☕',
      'html': '🌐',
      'css': '🎨',
      'json': '📋',
      'folder': '📁'
    }
    return icons[language] || '📄'
  }

  const renderFolderNode = (node: FolderNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path)

    return (
      <div key={node.path}>
        {/* Folder Header */}
        {node.path !== '/' && (
          <div
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-secondary transition-colors group"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <div
              onClick={() => {
                toggleFolder(node.path)
              }}
              className="flex items-center gap-2 flex-1 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <Folder className="w-4 h-4 text-yellow-500" />
              <span className="flex-1 text-left">{node.name}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentFolder(node.path)
                  setShowNewFileModal(true)
                }}
                className="p-0.5 hover:bg-primary/10 rounded transition-colors"
                title="New File"
              >
                <Plus className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentFolder(node.path)
                  setShowNewFolderModal(true)
                }}
                className="p-0.5 hover:bg-primary/10 rounded transition-colors"
                title="New Folder"
              >
                <FolderPlus className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteFolder(node.path)
                }}
                className="p-0.5 hover:bg-red-500/10 rounded transition-colors"
                title="Delete Folder"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          </div>
        )}

        {/* Files in this folder */}
        {isExpanded && node.files.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors group cursor-pointer",
              currentFileId === file.id
                ? "bg-primary/10 text-primary"
                : "hover:bg-secondary text-foreground"
            )}
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            <div 
              onClick={() => onFileSelect(file)}
              className="flex items-center gap-2 flex-1"
            >
              <span className="text-base">{getFileIcon(file.language)}</span>
              <span className="flex-1 text-left truncate">{file.name}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setRenamingFile(file)
                  setRenameFileName(file.name)
                  setShowRenameModal(true)
                }}
                className="p-0.5 hover:bg-blue-500/10 rounded transition-opacity"
                title="Rename"
              >
                <Edit2 className="w-3 h-3 text-blue-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteFile(file.id)
                }}
                className="p-0.5 hover:bg-red-500/10 rounded transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          </motion.div>
        ))}

        {/* Subfolders */}
        {isExpanded && Array.from(node.subfolders.values()).map(subfolder =>
          renderFolderNode(subfolder, depth + 1)
        )}
      </div>
    )
  }

  return (
    <div className="w-64 h-full bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Files</h3>
          <div className="flex gap-1">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="p-1 hover:bg-secondary rounded transition-colors"
              title="Project Templates"
            >
              <Code2 className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="p-1 hover:bg-secondary rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowNewFileModal(true)}
              className="p-1 hover:bg-secondary rounded transition-colors"
              title="New File"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Project Selector */}
        {currentProject && (
          <div className="text-xs text-muted-foreground">
            {currentProject.name}
          </div>
        )}
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto p-2">
        {folderTree && folderTree.files.length > 0 ? (
          renderFolderNode(folderTree)
        ) : files.length > 0 ? (
          <div className="space-y-1">
            {files.filter(f => !f.is_folder).map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors group cursor-pointer",
                  currentFileId === file.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary text-foreground"
                )}
              >
                <div 
                  onClick={() => onFileSelect(file)}
                  className="flex items-center gap-2 flex-1"
                >
                  <span className="text-base">{getFileIcon(file.language)}</span>
                  <span className="flex-1 text-left truncate">{file.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteFile(file.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/10 rounded transition-opacity"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No files yet
            <br />
            <button
              onClick={() => setShowNewFileModal(true)}
              className="text-primary hover:underline mt-2"
            >
              Create your first file
            </button>
          </div>
        )}
      </div>

      {/* New File Modal */}
      <AnimatePresence>
        {showNewFileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowNewFileModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg p-4 w-80"
            >
              <h3 className="text-lg font-semibold mb-3">New File</h3>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                placeholder="filename.js"
                className="w-full px-3 py-2 bg-secondary rounded border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <div className="text-xs text-muted-foreground mt-2">
                Creating in: {currentFolder}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCreateFile}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewFileModal(false)
                    setNewFileName('')
                  }}
                  className="flex-1 px-3 py-2 bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowNewFolderModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg p-4 w-80"
            >
              <h3 className="text-lg font-semibold mb-3">New Folder</h3>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="folder-name"
                className="w-full px-3 py-2 bg-secondary rounded border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <div className="text-xs text-muted-foreground mt-2">
                Creating in: {currentFolder}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCreateFolder}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewFolderModal(false)
                    setNewFolderName('')
                  }}
                  className="flex-1 px-3 py-2 bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename File Modal */}
      <AnimatePresence>
        {showRenameModal && renamingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowRenameModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg p-4 w-80"
            >
              <h3 className="text-lg font-semibold mb-3">Rename File</h3>
              <input
                type="text"
                value={renameFileName}
                onChange={(e) => setRenameFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameFile()}
                placeholder="new-name.js"
                className="w-full px-3 py-2 bg-secondary rounded border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <div className="text-xs text-muted-foreground mt-2">
                Current: {renamingFile.name}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleRenameFile}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    setShowRenameModal(false)
                    setRenamingFile(null)
                    setRenameFileName('')
                  }}
                  className="flex-1 px-3 py-2 bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Template Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowTemplateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg p-4 w-96"
            >
              <h3 className="text-lg font-semibold mb-3">Project Templates</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Quick start with pre-configured project structures
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={() => createProjectTemplate('node')}
                  className="w-full p-3 bg-secondary hover:bg-secondary/80 rounded-lg text-left transition-colors"
                >
                  <div className="font-medium text-foreground">Node.js ES Modules</div>
                  <div className="text-xs text-muted-foreground">
                    Multi-file with imports (mathUtils, fibonacci, main)
                  </div>
                </button>
                
                <button
                  onClick={() => createProjectTemplate('react')}
                  className="w-full p-3 bg-secondary hover:bg-secondary/80 rounded-lg text-left transition-colors"
                >
                  <div className="font-medium text-foreground">React App</div>
                  <div className="text-xs text-muted-foreground">
                    HTML + React modules with package.json
                  </div>
                </button>
                
                <button
                  onClick={() => createProjectTemplate('vanilla')}
                  className="w-full p-3 bg-secondary hover:bg-secondary/80 rounded-lg text-left transition-colors"
                >
                  <div className="font-medium text-foreground">Vanilla JavaScript</div>
                  <div className="text-xs text-muted-foreground">
                    Simple single-file setup
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowTemplateModal(false)}
                className="w-full mt-4 px-3 py-2 bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FileExplorer
