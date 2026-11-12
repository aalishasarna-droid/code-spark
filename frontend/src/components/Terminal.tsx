import { useState, useEffect, useRef } from 'react'
import { Terminal as TerminalIcon, X, Send, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_ENDPOINTS } from '@/lib/api-config'

interface TerminalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

interface CommandHistory {
  command: string
  result: {
    output: string
    error: string
    exit_code: number
  }
}

const Terminal = ({ projectId, isOpen, onClose }: TerminalProps) => {
  const [sessionId, setSessionId] = useState<string>('')
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<CommandHistory[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Create terminal session when opened
  useEffect(() => {
    if (isOpen && !sessionId) {
      createSession()
    }
  }, [isOpen])

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const createSession = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.terminalCreate(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      })

      const data = await response.json()
      setSessionId(data.session_id)
      
      // Add welcome message
      setHistory([{
        command: '',
        result: {
          output: 'Terminal ready. Type commands below.\nTry: npm init, npm install, or any shell command.',
          error: '',
          exit_code: 0
        }
      }])
    } catch (error) {
      console.error('Failed to create terminal session:', error)
    }
  }

  const executeCommand = async () => {
    if (!command.trim() || !sessionId || isExecuting) return

    setIsExecuting(true)
    const cmd = command
    setCommand('')

    try {
      const response = await fetch(API_ENDPOINTS.terminalExecute(sessionId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      })

      const result = await response.json()
      
      setHistory(prev => [...prev, {
        command: cmd,
        result: result
      }])
    } catch (error) {
      setHistory(prev => [...prev, {
        command: cmd,
        result: {
          output: '',
          error: 'Failed to execute command',
          exit_code: 1
        }
      }])
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      executeCommand()
    }
  }

  const quickCommands = [
    { label: 'npm init', command: 'npm init -y' },
    { label: 'npm install', command: 'npm install' },
    { label: 'npm run dev', command: 'npm run dev' },
    { label: 'ls', command: 'ls' },
  ]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg"
        style={{ height: '40%', zIndex: 50 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">Terminal</span>
            {sessionId && (
              <span className="text-xs text-muted-foreground">
                Session: {sessionId.substring(0, 8)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Quick Commands */}
        <div className="flex gap-2 px-4 py-2 border-b border-border bg-secondary/30">
          {quickCommands.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => setCommand(cmd.command)}
              className="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded transition-colors"
            >
              {cmd.label}
            </button>
          ))}
        </div>

        {/* Terminal Output */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-auto p-4 font-mono text-sm bg-black/90 text-green-400"
          style={{ height: 'calc(100% - 120px)' }}
        >
          {history.map((item, index) => (
            <div key={index} className="mb-2">
              {item.command && (
                <div className="text-blue-400">
                  <span className="text-green-500">$</span> {item.command}
                </div>
              )}
              {item.result.output && (
                <div className="text-green-400 whitespace-pre-wrap">
                  {item.result.output}
                </div>
              )}
              {item.result.error && (
                <div className="text-red-400 whitespace-pre-wrap">
                  {/* Display complete error output - all errors will be shown */}
                  {item.result.error}
                </div>
              )}
            </div>
          ))}
          {isExecuting && (
            <div className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-black/90">
          <span className="text-green-500 font-mono">$</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type command..."
            disabled={isExecuting || !sessionId}
            className="flex-1 bg-transparent text-green-400 font-mono outline-none placeholder:text-green-700 disabled:opacity-50"
          />
          <button
            onClick={executeCommand}
            disabled={isExecuting || !command.trim() || !sessionId}
            className="p-2 hover:bg-secondary/20 rounded transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4 text-green-500" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default Terminal
