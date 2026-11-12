import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, FileText, Trash2, Send, BookOpen, ArrowLeft, Loader2, CheckCircle, AlertCircle, X, GraduationCap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_ENDPOINTS } from '@/lib/api-config'
import { useNavigate } from 'react-router-dom'
import { useKnowledgeVoice } from '@/hooks/useKnowledgeVoice'
import JarvisButton from '@/components/JarvisButton'
import type { JarvisState } from '@/hooks/useJarvis'

interface KnowledgeDocument {
  id: string
  file_name: string
  file_type: string
  file_size_bytes: number
  page_count: number
  chunk_count: number
  status: 'processing' | 'ready' | 'error'
  error_message?: string
  created_at: string
}

interface Reference {
  index: number
  file_name: string
  page_number: number | null
  section_title: string | null
  chunk_text: string
  relevance: number
}

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  references?: Reference[]
  timestamp: Date
}

const KnowledgeHubPage = () => {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 0, role: 'assistant',
    content: "Welcome to the Knowledge Hub! Upload your study notes (PDF, TXT, MD) and I'll help you understand them. Ask me anything about your uploaded materials — I'll cite the sources!",
    timestamp: new Date()
  }])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'chat'>('upload')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectId = '00000000-0000-0000-0000-000000000001'

  const { voiceState, transcript, startVoice, stopVoice } = useKnowledgeVoice()

  useEffect(() => { fetchDocuments() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchDocuments = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.knowledgeDocuments(projectId))
      const data = await res.json()
      if (data.documents) setDocuments(data.documents)
    } catch (err) { console.error('Failed to fetch documents:', err) }
  }

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['pdf', 'txt', 'md'].includes(ext || '')) {
        alert(`Unsupported file: ${file.name}. Use PDF, TXT, or MD.`)
        continue
      }
      setIsUploading(true)
      setUploadProgress(`Processing ${file.name}...`)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('project_id', projectId)
        const res = await fetch(API_ENDPOINTS.knowledgeUpload(), { method: 'POST', body: formData })
        if (!res.ok) throw new Error(await res.text())
        setUploadProgress(`✅ ${file.name} uploaded successfully!`)
        await fetchDocuments()
      } catch (err: any) {
        setUploadProgress(`❌ Failed to upload ${file.name}: ${err.message}`)
      }
    }
    setTimeout(() => { setIsUploading(false); setUploadProgress('') }, 2000)
  }, [])

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document and all its embeddings?')) return
    try {
      await fetch(API_ENDPOINTS.knowledgeDocumentDelete(docId), { method: 'DELETE' })
      await fetchDocuments()
    } catch (err) { console.error('Delete failed:', err) }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || isChatLoading) return
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: chatInput.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const history = messages.filter(m => m.id !== 0).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(API_ENDPOINTS.knowledgeChat(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.content, project_id: projectId, chat_history: history, top_k: 5 })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: data.response || 'No response received.',
        references: data.references || [],
        timestamp: new Date()
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: '❌ Failed to get a response. Is the backend running?',
        timestamp: new Date()
      }])
    }
    setIsChatLoading(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📕'
      case 'md': return '📝'
      default: return '📄'
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0d0d2b 100%)',
      color: '#e0e0f0', fontFamily: "'Inter', 'Segoe UI', sans-serif"
    }}>
      {/* Header */}
      <header style={{
        padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(10,10,30,0.6)', backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/ide')} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 12px', color: '#a0a0c0', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, transition: 'all 0.2s'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          >
            <ArrowLeft size={14} /> Back to IDE
          </button>
          <button onClick={() => navigate('/adaptive-learning')} style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(20,184,166,0.2))',
            border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: 8, padding: '8px 12px', color: '#6ee7b7', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, transition: 'all 0.2s'
          }}>
            <GraduationCap size={14} /> Adaptive Learning PS-1
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} color="#7c6ff7" />
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0,
              background: 'linear-gradient(135deg, #7c6ff7, #5eead4)', WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Knowledge Hub</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
          {(['upload', 'chat'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === tab ? 'rgba(124,111,247,0.25)' : 'transparent',
              color: activeTab === tab ? '#a78bfa' : '#808090', transition: 'all 0.2s'
            }}>
              {tab === 'upload' ? '📁 Documents' : '💬 Chat'}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'upload' ? (
            <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Drop Zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#7c6ff7' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 16, padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(124,111,247,0.08)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.3s', marginBottom: 32
                }}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" multiple hidden
                  onChange={e => e.target.files && handleUpload(e.target.files)} />
                {isUploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <Loader2 size={32} color="#7c6ff7" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#a0a0c0', fontSize: 14 }}>{uploadProgress}</p>
                  </div>
                ) : (
                  <>
                    <Upload size={36} color="#7c6ff7" style={{ marginBottom: 12 }} />
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#c0c0e0', margin: '0 0 4px' }}>
                      Drop files here or click to upload
                    </p>
                    <p style={{ fontSize: 13, color: '#808090', margin: 0 }}>PDF, TXT, MD — up to 20MB</p>
                  </>
                )}
              </div>

              {/* Document Library */}
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#c0c0e0', marginBottom: 16 }}>
                Uploaded Documents ({documents.length})
              </h2>
              {documents.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: 48, color: '#606080',
                  background: 'rgba(255,255,255,0.02)', borderRadius: 12
                }}>
                  <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p>No documents uploaded yet. Upload your study notes to get started!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {documents.map(doc => (
                    <motion.div key={doc.id} layout initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }} style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.08)', padding: 20, position: 'relative'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 28 }}>{getTypeIcon(doc.file_type)}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px', color: '#e0e0f0',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>{doc.file_name}</p>
                            <p style={{ fontSize: 12, color: '#808090', margin: 0 }}>
                              {formatFileSize(doc.file_size_bytes)} · {doc.page_count} pages · {doc.chunk_count} chunks
                            </p>
                          </div>
                        </div>
                        <button onClick={() => handleDelete(doc.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#ff6b6b',
                          padding: 4, opacity: 0.6, transition: 'opacity 0.2s'
                        }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.6' }}
                        ><Trash2 size={16} /></button>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {doc.status === 'ready' ? (
                          <><CheckCircle size={14} color="#22c55e" /><span style={{ fontSize: 12, color: '#22c55e' }}>Ready</span></>
                        ) : doc.status === 'processing' ? (
                          <><Loader2 size={14} color="#f59e0b" style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: 12, color: '#f59e0b' }}>Processing...</span></>
                        ) : (
                          <><AlertCircle size={14} color="#ef4444" /><span style={{ fontSize: 12, color: '#ef4444' }}>Error</span></>
                        )}
                        <span style={{ fontSize: 11, color: '#606080', marginLeft: 'auto' }}>
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
              {/* Chat Messages */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16
              }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{
                    display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '75%', padding: '14px 18px', borderRadius: 14,
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, #7c6ff7, #6366f1)'
                        : 'rgba(255,255,255,0.06)',
                      border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content}
                      {/* References */}
                      {msg.references && msg.references.length > 0 && (
                        <div style={{
                          marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', marginBottom: 8 }}>
                            📚 Sources:
                          </p>
                          {msg.references.map((ref, i) => (
                            <div key={i} style={{
                              background: 'rgba(124,111,247,0.1)', borderRadius: 8,
                              padding: '8px 12px', marginBottom: 6, fontSize: 12
                            }}>
                              <div style={{ fontWeight: 600, color: '#c4b5fd', marginBottom: 2 }}>
                                [{ref.index}] {ref.file_name}
                                {ref.page_number && <span style={{ color: '#808090' }}> — Page {ref.page_number}</span>}
                                <span style={{ float: 'right', color: '#22c55e' }}>{(ref.relevance * 100).toFixed(0)}%</span>
                              </div>
                              <p style={{ color: '#a0a0c0', margin: 0, fontSize: 11 }}>
                                {ref.chunk_text}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      padding: '14px 18px', borderRadius: 14,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', gap: 8
                    }}>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} color="#7c6ff7" />
                      <span style={{ fontSize: 13, color: '#808090' }}>Searching notes & generating response...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input & Voice Controls */}
              <div style={{ padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: 14, color: '#a0a0c0', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                    Live Audio Chat
                  </div>
                  <JarvisButton 
                    jarvisState={voiceState as JarvisState}
                    transcript={transcript}
                    onToggle={() => {
                      if (voiceState === 'disconnected' || voiceState === 'error') {
                        startVoice(projectId);
                      } else {
                        stopVoice();
                      }
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                    placeholder="Ask about your uploaded notes..."
                    style={{
                      flex: 1, padding: '14px 18px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e0e0f0', fontSize: 14, outline: 'none'
                    }}
                  />
                  <button onClick={handleChat} disabled={isChatLoading || !chatInput.trim()} style={{
                    padding: '14px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: chatInput.trim() ? 'linear-gradient(135deg, #7c6ff7, #6366f1)' : 'rgba(255,255,255,0.06)',
                    color: chatInput.trim() ? '#fff' : '#606080', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <Send size={16} /> Ask
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #606080; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </div>
  )
}

export default KnowledgeHubPage
