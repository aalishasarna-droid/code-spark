import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Users,
  Code2,
  Activity,
  Wifi,
  WifiOff,
  Sparkles,
  BookOpen,
  ArrowLeft,
  Layers,
  Award,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SupportedLanguage } from './adaptive/types'
import {
  CONCEPT_NODES,
  ADAPTIVE_QUIZ_POOL,
  REMEDIATION_MODULE_SAMPLE,
  SUPPORTED_LANGUAGES,
} from './adaptive/mockData'
import { VoiceSpeechBar } from './adaptive/components/VoiceSpeechBar'
import { AdaptiveKnowledgeGraph } from './adaptive/components/AdaptiveKnowledgeGraph'
import { AdaptiveQuizCard } from './adaptive/components/AdaptiveQuizCard'
import { RemediationDrawer } from './adaptive/components/RemediationDrawer'
import { TeacherAnalyticsView } from './adaptive/components/TeacherAnalyticsView'
import { SystemLatencyModal } from './adaptive/components/SystemLatencyModal'

const AdaptiveLearningPage: React.FC = () => {
  const navigate = useNavigate()

  // Enforce clean whitish light theme on mount
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    return () => {
      // Clean up if returning to IDE
    }
  }, [])

  // State Management
  const [activePortal, setActivePortal] = useState<'student' | 'teacher'>('student')
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('hi')
  const [selectedConceptId, setSelectedConceptId] = useState<string>('c2')
  const [isRemediationOpen, setIsRemediationOpen] = useState(false)
  const [isLatencyModalOpen, setIsLatencyModalOpen] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [concepts, setConcepts] = useState(CONCEPT_NODES)
  const [studentScore, setStudentScore] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Handle concept selection from knowledge graph
  const handleSelectConcept = (conceptId: string) => {
    setSelectedConceptId(conceptId)
    const concept = concepts.find(c => c.id === conceptId)
    if (concept) {
      showToast(`Selected concept: ${concept.nativeTitle[currentLanguage] || concept.title}`)
    }
  }

  // Trigger automated remediation
  const handleLaunchRemediation = (conceptId: string) => {
    setSelectedConceptId(conceptId)
    setIsRemediationOpen(true)
  }

  // Trigger quiz for concept
  const handleLaunchQuiz = (conceptId: string) => {
    setSelectedConceptId(conceptId)
    showToast(`Loaded adaptive diagnostic quiz for ${conceptId.toUpperCase()}`)
  }

  // When practice in remediation drawer finishes
  const handlePracticeComplete = () => {
    setConcepts(prev =>
      prev.map(c => {
        if (c.id === selectedConceptId) {
          const newScore = Math.min(100, c.masteryScore + 18)
          return {
            ...c,
            masteryScore: newScore,
            status: newScore >= 80 ? 'mastered' : newScore >= 50 ? 'developing' : 'critical_gap',
          }
        }
        return c
      })
    )
    showToast('🎉 Mastery restored! Knowledge graph updated in real-time.')
  }

  const activeLang =
    SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors antialiased">
      {/* Top Navbar (Whitish Professional) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Platform Identity */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                  Sahayak AI
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  PS 1 Platform
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                Multilingual Adaptive Learning & Automated Remediation for Under-Resourced Schools
              </p>
            </div>
          </div>

          {/* Central Portal Switcher: Student vs Teacher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActivePortal('student')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePortal === 'student'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span>Student Portal</span>
            </button>
            <button
              onClick={() => setActivePortal('teacher')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePortal === 'teacher'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Teacher Analytics (40:1)</span>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* System Performance & Latency Telemetry Trigger */}
            <button
              onClick={() => setIsLatencyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-all shadow-2xs"
              title="View latency benchmark telemetry report (<8s SLA)"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span className="hidden md:inline">Latency SLA</span>
              <span className="font-extrabold text-emerald-700">(&lt;8s)</span>
            </button>

            {/* Offline Mode Indicator */}
            <button
              onClick={() => {
                setIsOfflineMode(!isOfflineMode)
                showToast(
                  !isOfflineMode
                    ? '⚡ Offline 2G mode enabled. Cached IndexedDB active.'
                    : '🌐 Online 4G mode restored.'
                )
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isOfflineMode
                  ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Toggle simulated offline / low-bandwidth rural mode"
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">2G Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Online</span>
                </>
              )}
            </button>

            {/* Switch Back to MCP-IDE Coding Canvas Button */}
            <button
              onClick={() => navigate('/ide')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all"
              title="Return to MCP-IDE Coding Canvas"
            >
              <Code2 className="w-4 h-4" />
              <span>Back to MCP-IDE</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activePortal === 'student' ? (
          <div>
            {/* Student Welcome Header (Whitish Professional) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  👦
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Namaste, Aarav! (नमस्ते आरव)
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Class 8-B • Govt. Model Secondary School • Goal: Master Linear Equations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLaunchRemediation(selectedConceptId)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-300 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Open Remedial Assistant (खाता बही)</span>
                </button>
              </div>
            </div>

            {/* Sub-Problem 2: Multilingual & Voice-First Interface */}
            <VoiceSpeechBar
              currentLanguage={currentLanguage}
              onLanguageChange={setCurrentLanguage}
              onVoiceTranscript={text => {
                showToast(`Voice query received: "${text}"`)
              }}
              activeConceptTitle="Negative Integers & Sign Rules"
              ttsText={
                currentLanguage === 'hi'
                  ? 'ऋणात्मक पूर्णांक में पक्षांतरण करते समय घटाव का चिह्न दूसरी ओर जाकर जोड़ में बदल जाता है।'
                  : currentLanguage === 'kn'
                  ? 'ಋಣಾತ್ಮಕ ಪೂರ್ಣಾಂಕಗಳಲ್ಲಿ ಪಕ್ಷಾಂತರ ಮಾಡುವಾಗ ಸಮ ಚಿಹ್ನೆ ದಾಟಿದಂತೆ ಚಿಹ್ನೆ ಬದಲಾಗುತ್ತದೆ.'
                  : currentLanguage === 'ta'
                  ? 'குறை முழுக்களை இடமாற்றம் செய்யும்போது சமக்குறியைத் தாண்டும்போது குறிகள் மாறும்.'
                  : currentLanguage === 'te'
                  ? 'ఋణ పూర్ణాంకాలను పక్షాంతరం చేసినప్పుడు సమాన గుర్తు దాటిన తర్వాత గుర్తు మారుతుంది.'
                  : 'When solving linear equations, transposing a term across the equal sign inverts its operation.'
              }
            />

            {/* Sub-Problem 1: Adaptive Knowledge Graph */}
            <AdaptiveKnowledgeGraph
              concepts={concepts}
              selectedConceptId={selectedConceptId}
              onSelectConcept={handleSelectConcept}
              currentLanguage={currentLanguage}
              onLaunchRemediation={handleLaunchRemediation}
              onLaunchQuiz={handleLaunchQuiz}
            />

            {/* Sub-Problem 1 & 2: Real-time Adaptive Quiz Card */}
            <AdaptiveQuizCard
              questions={ADAPTIVE_QUIZ_POOL}
              currentLanguage={currentLanguage}
              onQuizCompleted={score => {
                setStudentScore(score)
                showToast(`🎉 Adaptive Assessment finished! Score: ${score}/3`)
              }}
              onRequestRemediation={handleLaunchRemediation}
            />
          </div>
        ) : (
          /* Sub-Problem 4: Teacher Analytics Dashboard */
          <TeacherAnalyticsView />
        )}
      </main>

      {/* Sub-Problem 3: Automated Remediation Drawer Modal */}
      <RemediationDrawer
        module={REMEDIATION_MODULE_SAMPLE}
        currentLanguage={currentLanguage}
        isOpen={isRemediationOpen}
        onClose={() => setIsRemediationOpen(false)}
        onPracticeComplete={handlePracticeComplete}
      />

      {/* System Latency Telemetry Modal */}
      <SystemLatencyModal
        isOpen={isLatencyModalOpen}
        onClose={() => setIsLatencyModalOpen(false)}
        isOfflineMode={isOfflineMode}
        onToggleOffline={() => setIsOfflineMode(!isOfflineMode)}
      />

      {/* Footer (Whitish Professional) */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 font-medium">
          <span>
            🎓 <strong>PS 1:</strong> AI-Powered Multilingual Adaptive Learning & Automated
            Remediation Platform
          </span>
          <div className="flex items-center gap-3">
            <span>CBSE & State Board NCERT RAG</span>
            <span>•</span>
            <span>Indic ASR & TTS</span>
            <span>•</span>
            <button
              onClick={() => navigate('/ide')}
              className="text-indigo-600 hover:text-indigo-800 font-bold"
            >
              Return to MCP-IDE
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AdaptiveLearningPage
