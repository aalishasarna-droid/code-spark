import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Code2, Lightbulb, AlertCircle, ChevronDown, Save, Check, Play, X, Terminal as TerminalIcon, Zap, Wand2, BookOpen, GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Editor, { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { cn } from '@/lib/utils'
import { API_ENDPOINTS } from '@/lib/api-config'
import type { ChatMessage, EditorState, CodeEdit } from '@/types/editor'
import FileExplorer from '@/components/FileExplorer'
import Terminal from '@/components/Terminal'
import { useJarvis } from '@/hooks/useJarvis'
import JarvisButton from '@/components/JarvisButton'

const INITIAL_CODE = `// Welcome to Coding Canvas!
// This is a context-aware AI coding tutor

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
`

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: 'assistant',
    content: "Welcome to the Shadow Tutor! I can see you're working on a recursive function. What would you like help with?",
  },
]

interface Model {
  id: string
  name: string
  type: string
  description: string
}

const IDEPage = () => {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES)
  const [input, setInput] = useState('')
  const [code, setCode] = useState(INITIAL_CODE)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('ollama')
  const [availableModels, setAvailableModels] = useState<Model[]>([])
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [isSaved, setIsSaved] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [executionError, setExecutionError] = useState('')
  const [showOutput, setShowOutput] = useState(false)
  const [showFileDropdown, setShowFileDropdown] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [currentFileId, setCurrentFileId] = useState<string>('')
  const [currentProjectId] = useState<string>('00000000-0000-0000-0000-000000000001') // Default project
  const [showTerminal, setShowTerminal] = useState(false)
  const [lastExecutionResult, setLastExecutionResult] = useState<{
    output: string
    error: string
    timestamp: Date
  } | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(true) // Default to dark mode
  // Smart Assistant state
  const [smartAssistantEnabled, setSmartAssistantEnabled] = useState(() => {
    return localStorage.getItem('mcp-ide-smart-assistant') === 'true'
  })
  const [proposedEdit, setProposedEdit] = useState<CodeEdit | null>(null)
  const [isAgentWorking, setIsAgentWorking] = useState(false)
  const [agentInput, setAgentInput] = useState('')
  const [editorState, setEditorState] = useState<EditorState>({
    file_path: 'main.js',
    language: 'javascript',
    full_code: INITIAL_CODE,
    cursor_line: 1,
    cursor_column: 1,
    selected_text: '',
    errors: [],
  })
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  // Voice agent code edit callback — reuses the Smart Assistant diff view
  const handleVoiceCodeEdit = useCallback((edit: CodeEdit) => {
    console.log('🎙️ E D I T H voice edit received:', edit.file_path)
    setProposedEdit(edit)
    
    // Add a chat message so the user knows
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      role: 'assistant' as const,
      content: `🎙️ E D I T H proposed a ${edit.edit_type} for ${edit.file_path}: ${edit.explanation}`,
      timestamp: new Date()
    }])
  }, [])

  const { jarvisState, transcript, startJarvis, stopJarvis, updateContext } = useJarvis({
    onCodeEdit: handleVoiceCodeEdit
  })

  // Update Jarvis context when IDE state changes
  useEffect(() => {
    updateContext({
      code,
      filePath: editorState.file_path,
      output,
      error: executionError,
      projectId: currentProjectId
    });
  }, [code, editorState.file_path, output, executionError, currentProjectId, updateContext]);

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Helper to get language from file extension
  const getLanguageFromFile = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': return 'javascript'
      case 'py': return 'python'
      case 'cpp': case 'cc': case 'cxx': return 'cpp'
      default: return 'javascript'
    }
  }

  const handleFileChange = (newFile: string) => {
    const language = getLanguageFromFile(newFile)
    setEditorState(prev => ({
      ...prev,
      file_path: newFile,
      language: language
    }))
    setShowFileDropdown(false)

    // Update session context in database
    if (sessionId) {
      fetch(API_ENDPOINTS.tutorSessionUpdateContext(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          language: language,
          file_path: newFile
        })
      }).catch(err => console.error('Failed to update session context:', err))
    }

    // Update Monaco editor language
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        const monaco = (window as any).monaco
        if (monaco) {
          monaco.editor.setModelLanguage(model, language)
        }
      }
    }
  }

  const fileOptions = [
    { name: 'main.js', icon: '📄', lang: 'JavaScript' },
    { name: 'main.py', icon: '🐍', lang: 'Python' },
    { name: 'main.cpp', icon: '⚙️', lang: 'C++' },
  ]

  // Fetch available models on mount
  useEffect(() => {
    console.log('🚀 Starting session creation...')

    // Get initial language from current file
    const initialLanguage = getLanguageFromFile(editorState.file_path)

    // Start a new session with correct language
    fetch(API_ENDPOINTS.tutorSessionStart(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language: initialLanguage,
        file_path: editorState.file_path
      })
    })
      .then(res => {
        console.log('Session response status:', res.status)
        return res.json()
      })
      .then(data => {
        console.log('Session response data:', data)
        if (data.session_id) {
          setSessionId(data.session_id)
          console.log('✅ Session started:', data.session_id)
        } else {
          console.log('❌ No session_id in response:', data)
        }
      })
      .catch(err => {
        console.error('❌ Failed to start session:', err)
      })

    // Fetch available models
    fetch(API_ENDPOINTS.tutorModels())
      .then(res => res.json())
      .then(data => {
        setAvailableModels(data.models)
        if (data.models.length > 0) {
          setSelectedModel(data.models[0].id)
        }
      })
      .catch(err => {
        console.error('Failed to fetch models:', err)
        // Fallback to default
        setAvailableModels([{
          id: 'ollama',
          name: 'Gemma 4 (Local)',
          type: 'local',
          description: 'Fast, private, runs on your machine'
        }])
      })
  }, [])

  // Auto-save functionality
  useEffect(() => {
    if (!isSaved && currentFileId) {
      const timer = setTimeout(() => {
        console.log('🔄 Auto-saving file...', currentFileId)
        handleSave()
      }, 2000) // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timer)
    }
  }, [code, isSaved, currentFileId])

  // Keyboard shortcut for save (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [code])

  const handleSave = async () => {
    console.log('💾 handleSave called')
    console.log('   Current file ID:', currentFileId)
    console.log('   Code length:', code.length)

    // Save to localStorage
    localStorage.setItem('mcp-ide-code', code)
    localStorage.setItem('mcp-ide-file', editorState.file_path)
    setIsSaved(true)
    setLastSaved(new Date())

    // Save to database if we have a file ID
    if (currentFileId) {
      try {
        console.log('📤 Sending PATCH request to database...')
        const response = await fetch(API_ENDPOINTS.filesUpdate(currentFileId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: code })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ Failed to save to database:', errorText)
        } else {
          console.log('✅ File saved to database successfully')
        }
      } catch (err) {
        console.error('❌ Failed to save to database:', err)
      }
    } else {
      console.warn('⚠️ No currentFileId, skipping database save')
    }
  }

  const handleFileSelect = async (file: any) => {
    console.log('Selecting file:', file.name, 'Current file ID:', currentFileId)

    // Don't reload if clicking the same file
    if (currentFileId === file.id) {
      return
    }

    // Save current file in background (don't await)
    if (currentFileId && code) {
      fetch(API_ENDPOINTS.filesUpdate(currentFileId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: code })
      }).catch(err => console.error('Failed to save:', err))
    }

    // Optimistically load from file object first (instant)
    setCurrentFileId(file.id)
    setCode(file.content || '')
    setEditorState(prev => ({
      ...prev,
      file_path: file.path,
      language: file.language,
      full_code: file.content || ''
    }))
    setIsSaved(true)
    setLastSaved(new Date())

    // Clear output when switching files
    setOutput('')
    setExecutionError('')
    setShowOutput(false)

    // Update Monaco editor language immediately
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        const monaco = (window as any).monaco
        if (monaco) {
          monaco.editor.setModelLanguage(model, file.language)
        }
      }
    }

    // Fetch latest content in background and update if different
    fetch(API_ENDPOINTS.filesGet(file.id))
      .then(res => res.json())
      .then(latestFile => {
        if (latestFile.content !== file.content) {
          console.log('Updated with latest content from database')
          setCode(latestFile.content || '')
          setEditorState(prev => ({
            ...prev,
            full_code: latestFile.content || ''
          }))
        }
      })
      .catch(err => console.error('Failed to fetch latest file content:', err))

    // Update session context in background
    if (sessionId) {
      fetch('http://localhost:8000/api/v1/tutor/session/update-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          language: file.language,
          file_path: file.path
        })
      }).catch(err => console.error('Failed to update session:', err))
    }

    // Mark as active in database
    fetch(API_ENDPOINTS.filesActivate(file.id, file.project_id), {
      method: 'POST'
    }).catch(err => console.error('Failed to activate file:', err))
  }

  const handleFileDelete = (deletedFileId: string) => {
    console.log('File deleted:', deletedFileId)

    // If the currently open file was deleted, clear the editor
    if (currentFileId === deletedFileId) {
      console.log('Currently open file was deleted, clearing editor')
      setCurrentFileId('')
      setCode('// File was deleted')
      setEditorState(prev => ({
        ...prev,
        file_path: '',
        full_code: '// File was deleted'
      }))
    }
  }

  const handleRunCode = async () => {
    console.log('▶️ Run Code clicked')

    // CRITICAL: Save to database BEFORE executing
    if (currentFileId && !isSaved) {
      console.log('💾 Saving file before execution...')
      try {
        const saveResponse = await fetch(API_ENDPOINTS.filesUpdate(currentFileId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: code })
        })

        if (saveResponse.ok) {
          console.log('✅ File saved before execution')
          setIsSaved(true)
          setLastSaved(new Date())
        } else {
          console.error('❌ Failed to save before execution')
        }
      } catch (err) {
        console.error('❌ Error saving before execution:', err)
      }

      // Wait a bit for database to update
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    setIsRunning(true)
    setShowOutput(true)
    setOutput('')
    setExecutionError('')

    // Detect language from file extension
    const language = getLanguageFromFile(editorState.file_path)

    try {
      console.log('🚀 Executing code...')
      const response = await fetch(API_ENDPOINTS.executorRun(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          language: language,
          input: '',
          session_id: sessionId,
          file_path: editorState.file_path,
          project_id: currentProjectId  // Enable multi-file execution
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to execute code')
      }

      const data = await response.json()

      // Store execution result for AI context
      setLastExecutionResult({
        output: data.output || '',
        error: data.error || '',  // Complete stderr with all errors preserved
        timestamp: new Date()
      })

      if (data.error) {
        setExecutionError(data.error)
        
        // Smart Assistant: auto-fix errors if enabled
        if (smartAssistantEnabled && data.error) {
          console.log('🤖 Smart Assistant: Auto-analyzing error...')
          handleAgentFixError(data.error)
        }
      }
      if (data.output) {
        setOutput(data.output)
      }
      if (!data.output && !data.error) {
        setOutput('(No output)')
      }
    } catch (error: any) {
      console.error('Execution error:', error)
      setExecutionError(error.message || 'Failed to execute code. Make sure the backend is running.')
    } finally {
      setIsRunning(false)
    }
  }

  // ==================== SMART ASSISTANT HANDLERS ====================

  const toggleSmartAssistant = useCallback(() => {
    const newVal = !smartAssistantEnabled
    setSmartAssistantEnabled(newVal)
    localStorage.setItem('mcp-ide-smart-assistant', String(newVal))
  }, [smartAssistantEnabled])

  const handleAgentFixError = async (errorOutput: string) => {
    if (isAgentWorking) return
    setIsAgentWorking(true)
    try {
      const response = await fetch(API_ENDPOINTS.agentFixError(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId || '',
          file_id: currentFileId || '',
          file_path: editorState.file_path,
          error_output: errorOutput,
          code_content: code,
          language: editorState.language,
          model_type: selectedModel
        })
      })
      if (response.ok) {
        const edit: CodeEdit = await response.json()
        setProposedEdit(edit)
        console.log('🤖 Smart Assistant: Fix proposed')
      }
    } catch (err) {
      console.error('Smart Assistant fix error failed:', err)
    } finally {
      setIsAgentWorking(false)
    }
  }

  const handleAgentEdit = async () => {
    if (!agentInput.trim() || isAgentWorking) return
    setIsAgentWorking(true)
    try {
      const response = await fetch(API_ENDPOINTS.agentEdit(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProjectId || '',
          file_id: currentFileId || '',
          file_path: editorState.file_path,
          instruction: agentInput,
          code_content: code,
          language: editorState.language,
          model_type: selectedModel
        })
      })
      if (response.ok) {
        const edit: CodeEdit = await response.json()
        setProposedEdit(edit)
        setAgentInput('')
        console.log('🤖 Smart Assistant: Edit proposed')
      }
    } catch (err) {
      console.error('Smart Assistant edit failed:', err)
    } finally {
      setIsAgentWorking(false)
    }
  }

  const handleApplyEdit = async () => {
    if (!proposedEdit) return
    setIsAgentWorking(true)
    try {
      if (!proposedEdit.file_id) {
        // Apply to local editor only if no file_id (unsaved file)
        setCode(proposedEdit.proposed_content)
        setEditorState(prev => ({ ...prev, full_code: proposedEdit.proposed_content }))
        localStorage.setItem('mcp-ide-code', proposedEdit.proposed_content)
        localStorage.setItem('mcp-ide-file', proposedEdit.file_path)
        setIsSaved(false)
        setProposedEdit(null)
        console.log('✅ Smart Assistant: Edit applied locally')
        
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          role: 'assistant' as const,
          content: `🤖 Smart Assistant applied: ${proposedEdit.explanation}`,
          timestamp: new Date()
        }])
        setIsAgentWorking(false)
        return
      }

      const response = await fetch(API_ENDPOINTS.agentApply(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: proposedEdit.file_id,
          new_content: proposedEdit.proposed_content
        })
      })
      if (response.ok) {
        const isCurrentFile = proposedEdit.file_id === currentFileId

        if (isCurrentFile) {
          // Fix is for the currently open file — update editor
          setCode(proposedEdit.proposed_content)
          setEditorState(prev => ({ ...prev, full_code: proposedEdit.proposed_content }))
          localStorage.setItem('mcp-ide-code', proposedEdit.proposed_content)
          localStorage.setItem('mcp-ide-file', proposedEdit.file_path)
        }
        // Either way, it's saved to DB
        setIsSaved(true)
        setLastSaved(new Date())
        setProposedEdit(null)
        console.log(`✅ Smart Assistant: Edit applied to ${proposedEdit.file_path}${isCurrentFile ? '' : ' (different file, saved to DB)'}`)
        
        // Add success message to chat
        const fileNote = isCurrentFile ? '' : ` (in ${proposedEdit.file_path})`
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          role: 'assistant' as const,
          content: `🤖 Smart Assistant applied fix${fileNote}: ${proposedEdit.explanation}`,
          timestamp: new Date()
        }])
      }
    } catch (err) {
      console.error('Smart Assistant apply failed:', err)
    } finally {
      setIsAgentWorking(false)
    }
  }

  const handleDismissEdit = () => {
    setProposedEdit(null)
  }

  // Load saved code on mount
  useEffect(() => {
    const savedCode = localStorage.getItem('mcp-ide-code')
    const savedFile = localStorage.getItem('mcp-ide-file')

    if (savedCode) {
      setCode(savedCode)
      setEditorState(prev => ({
        ...prev,
        full_code: savedCode,
        file_path: savedFile || 'main.js'
      }))
    }
  }, [])

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setEditorState((prev) => ({
        ...prev,
        cursor_line: e.position.lineNumber,
        cursor_column: e.position.column,
      }))
    })

    // Track selection
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel()
      if (model) {
        const selectedText = model.getValueInRange(e.selection)
        setEditorState((prev) => ({
          ...prev,
          selected_text: selectedText,
        }))
      }
    })
  }

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || ''
    console.log('✏️ Code changed, length:', newCode.length)
    setCode(newCode)
    setIsSaved(false) // Mark as unsaved when code changes
    setEditorState((prev) => ({
      ...prev,
      full_code: newCode,
    }))
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: messages.length + 1,
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Build enhanced editor state with execution results
      const enhancedEditorState = {
        ...editorState,
        // Add execution context if available - includes complete error output
        last_execution: lastExecutionResult ? {
          output: lastExecutionResult.output,
          error: lastExecutionResult.error,  // Complete stderr with all errors
          timestamp: lastExecutionResult.timestamp.toISOString()
        } : undefined
      }

      const response = await fetch(API_ENDPOINTS.tutorAsk(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editor_state: enhancedEditorState,
          user_question: input,
          model_type: selectedModel,
          session_id: sessionId,
          project_id: currentProjectId  // Enable RAG
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const aiMessage: ChatMessage = {
        id: messages.length + 2,
        role: 'assistant',
        content: data.response || "I examined your code! What specific part would you like help understanding?",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: ChatMessage = {
        id: messages.length + 2,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please make sure the backend is running and try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const currentModel = availableModels.find(m => m.id === selectedModel)

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg gradient-primary">
            <Code2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Coding Canvas</h1>
            <p className="text-xs text-muted-foreground">Context-Aware AI Coding Tutor</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* PS 1 Adaptive Learning Platform Button */}
          <button
            onClick={() => navigate('/adaptive-learning')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs transition-all"
            title="Switch to PS 1: Adaptive Learning & Remediation Platform"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Adaptive Learning (PS 1)</span>
          </button>

          {/* Knowledge Hub Button */}
          <button
            onClick={() => navigate('/knowledge')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all border border-transparent hover:border-border/50"
            title="Knowledge Hub & Study Notes"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge Hub</span>
          </button>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          {/* Smart Assistant Toggle */}
          <button
            onClick={toggleSmartAssistant}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              smartAssistantEnabled
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            )}
            title={smartAssistantEnabled ? 'Disable Smart Assistant' : 'Enable Smart Assistant'}
          >
            <Zap className={cn("w-3.5 h-3.5", smartAssistantEnabled && "animate-pulse")} />
            <span>{smartAssistantEnabled ? 'Agent ON' : 'Agent'}</span>
          </button>
          <JarvisButton
            jarvisState={jarvisState}
            transcript={transcript}
            onToggle={() => {
              if (jarvisState === 'disconnected' || jarvisState === 'error') {
                startJarvis({
                  code,
                  filePath: editorState.file_path,
                  output,
                  error: executionError,
                  projectId: currentProjectId
                });
              } else {
                stopJarvis();
              }
            }}
          />
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Connected</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <FileExplorer
          onFileSelect={handleFileSelect}
          currentFileId={currentFileId}
          onFileDelete={handleFileDelete}
        />

        {/* Editor and Chat */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Editor Panel - NOW ON LEFT */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
              <div className="relative">
                <button
                  onClick={() => setShowFileDropdown(!showFileDropdown)}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-secondary rounded transition-colors"
                >
                  <Code2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{editorState.file_path}</span>
                  <ChevronDown className={cn(
                    "w-3 h-3 text-muted-foreground transition-transform",
                    showFileDropdown && "rotate-180"
                  )} />
                </button>

                <AnimatePresence>
                  {showFileDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden min-w-[200px]"
                    >
                      {fileOptions.map((file) => (
                        <button
                          key={file.name}
                          onClick={() => handleFileChange(file.name)}
                          className={cn(
                            "w-full px-3 py-2 text-left hover:bg-secondary transition-colors flex items-center gap-2",
                            editorState.file_path === file.name && "bg-primary/10"
                          )}
                        >
                          <span>{file.icon}</span>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-foreground">{file.name}</div>
                            <div className="text-xs text-muted-foreground">{file.lang}</div>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isSaved && <span className="text-xs text-orange-500">• Unsaved</span>}
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-all disabled:opacity-50"
                >
                  <Play className="w-3 h-3" />
                  <span>{isRunning ? 'Running...' : 'Run Code'}</span>
                </button>
                <button
                  onClick={() => setShowTerminal(!showTerminal)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all",
                    showTerminal
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                >
                  <TerminalIcon className="w-3 h-3" />
                  <span>Terminal</span>
                </button>
                {lastSaved && (
                  <span className="text-xs text-muted-foreground">
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={handleSave}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                    isSaved
                      ? "bg-green-500/10 text-green-500"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      <span>Save (Ctrl+S)</span>
                    </>
                  )}
                </button>
                <span className="text-xs text-muted-foreground">
                  Line {editorState.cursor_line}, Col {editorState.cursor_column}
                </span>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className={cn("transition-all", showOutput ? "h-[60%]" : "flex-1")}>
              <Editor
                height="100%"
                language={editorState.language}
                value={code}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                theme={isDarkMode ? "vs-dark" : "light"}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>

            {/* Output Panel */}
            <AnimatePresence>
              {showOutput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '40%', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border bg-secondary/30 flex flex-col"
                >
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isRunning ? "bg-yellow-500 animate-pulse" : executionError ? "bg-red-500" : "bg-green-500"
                      )} />
                      <span className="text-xs font-medium text-foreground">Output</span>
                    </div>
                    <button
                      onClick={() => setShowOutput(false)}
                      className="p-1 hover:bg-secondary rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 font-mono text-xs">
                    {executionError && (
                      <div className="text-red-400 whitespace-pre-wrap mb-2">
                        {/* Display complete error output - all errors preserved with line breaks */}
                        {executionError}
                      </div>
                    )}
                    {output && (
                      <div className="text-green-400 whitespace-pre-wrap">
                        {output}
                      </div>
                    )}
                    {isRunning && (
                      <div className="text-muted-foreground">
                        Running code...
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>



            {/* Status Bar */}
            {editorState.errors.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-red-500/10 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-500">{editorState.errors[0]}</span>
              </div>
            )}
          </motion.div>

          {/* Tutor Chat Panel - NOW ON RIGHT */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-[380px] shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="p-4 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg gradient-primary">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Shadow Tutor</h3>
                  <p className="text-xs text-muted-foreground">Socratic guidance • Won't give answers</p>
                </div>
              </div>

              {/* Model Selector */}
              <div className="mt-3 relative">
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-secondary rounded-lg text-xs hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-3 h-3 text-yellow-500" />
                    <span className="text-foreground font-medium">
                      {currentModel?.name || 'Select Model'}
                    </span>
                  </div>
                  <ChevronDown className={cn(
                    "w-3 h-3 text-muted-foreground transition-transform",
                    showModelDropdown && "rotate-180"
                  )} />
                </button>

                <AnimatePresence>
                  {showModelDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden"
                    >
                      {availableModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id)
                            setShowModelDropdown(false)
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left hover:bg-secondary transition-colors",
                            selectedModel === model.id && "bg-primary/10"
                          )}
                        >
                          <div className="text-xs font-medium text-foreground">{model.name}</div>
                          <div className="text-xs text-muted-foreground">{model.description}</div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}
                >
                  <div
                    className={cn(
                      'p-1.5 rounded-lg shrink-0 h-fit',
                      msg.role === 'assistant' ? 'gradient-primary' : 'bg-secondary'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-secondary-foreground" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'rounded-xl px-3.5 py-2.5 text-sm max-w-[85%]',
                      msg.role === 'assistant'
                        ? 'bg-secondary text-secondary-foreground'
                        : 'gradient-primary text-primary-foreground'
                    )}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <div className="p-1.5 rounded-lg gradient-primary shrink-0 h-fit">
                    <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <div className="rounded-xl px-3.5 py-2.5 text-sm bg-secondary text-secondary-foreground">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Smart Assistant: Proposed Edit Diff View */}
            <AnimatePresence>
              {proposedEdit && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t-2 border-amber-500/50 bg-amber-500/5 flex flex-col max-h-[50%]"
                >
                  <div className="flex items-center justify-between px-4 py-2 border-b border-amber-500/20 bg-amber-500/10">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-300">
                        🤖 {proposedEdit.edit_type === 'fix' ? 'Proposed Fix' : 'Proposed Edit'} — <span className="text-amber-200">{proposedEdit.file_path}</span>
                        {proposedEdit.file_id !== currentFileId && proposedEdit.file_id && (
                          <span className="ml-1 text-amber-400/60">(different file)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApplyEdit}
                        disabled={isAgentWorking}
                        className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                        Apply
                      </button>
                      <button
                        onClick={handleDismissEdit}
                        className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-2 text-xs text-amber-200/80 bg-amber-500/5 border-b border-amber-500/10">
                    {proposedEdit.explanation}
                  </div>
                  <div className="flex-1 overflow-auto p-3 font-mono text-xs">
                    {/* Simple diff view: show proposed code */}
                    <div className="space-y-0">
                      {proposedEdit.proposed_content.split('\n').map((line, i) => {
                        const origLines = proposedEdit.original_content.split('\n')
                        const isNew = i >= origLines.length || origLines[i] !== line
                        return (
                          <div
                            key={i}
                            className={cn(
                              "px-2 py-0.5 leading-5 whitespace-pre",
                              isNew ? "bg-green-500/10 text-green-400 border-l-2 border-green-500" : "text-muted-foreground"
                            )}
                          >
                            <span className="inline-block w-6 text-right mr-3 opacity-40 select-none">{i + 1}</span>
                            {isNew && <span className="text-green-500 mr-1">+</span>}
                            {line || ' '}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Agent Working Indicator */}
            <AnimatePresence>
              {isAgentWorking && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-amber-500/30 bg-amber-500/5 px-4 py-2 flex items-center gap-2"
                >
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-amber-300">🤖 Smart Assistant is thinking...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-3 border-t border-border space-y-2">
              {/* Smart Assistant Agent Edit Input */}
              {smartAssistantEnabled && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Wand2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-amber-400" />
                    <input
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAgentEdit()}
                      placeholder="Agent: edit code... (e.g. 'add error handling')"
                      disabled={isAgentWorking}
                      className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-amber-400/50 outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={handleAgentEdit}
                    disabled={isAgentWorking || !agentInput.trim()}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Regular Tutor Chat Input */}
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask the tutor..."
                  disabled={isLoading}
                  className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="p-2 rounded-lg gradient-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Terminal */}
      <Terminal
        projectId={currentProjectId}
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
      />
    </div>
  )
}

export default IDEPage
