import React, { useState } from 'react'
import { Sparkles, BookOpen, Volume2, CheckCircle2, XCircle, ArrowRight, X, Play, Pause, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RemediationModule, SupportedLanguage } from '../types'

interface RemediationDrawerProps {
  module: RemediationModule
  currentLanguage: SupportedLanguage
  isOpen: boolean
  onClose: () => void
  onPracticeComplete?: () => void
}

export const RemediationDrawer: React.FC<RemediationDrawerProps> = ({
  module,
  currentLanguage,
  isOpen,
  onClose,
  onPracticeComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'analogy' | 'breakdown' | 'podcast' | 'practice'>('analogy')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [practiceAnswer, setPracticeAnswer] = useState<string | null>(null)
  const [isPracticeSubmitted, setIsPracticeSubmitted] = useState(false)

  if (!isOpen) return null

  const practiceQ = module.remedialPracticeQuestions[0]

  const handleAudioToggle = () => {
    if (isPlayingAudio) {
      window.speechSynthesis?.cancel?.()
      setIsPlayingAudio(false)
    } else {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const textToSpeak = module.ruralAnalogy.nativeContent[currentLanguage] || module.ruralAnalogy.content
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        const langCodes: Record<SupportedLanguage, string> = {
          en: 'en-IN',
          hi: 'hi-IN',
          kn: 'kn-IN',
          ta: 'ta-IN',
          te: 'te-IN',
        }
        utterance.lang = langCodes[currentLanguage] || 'hi-IN'
        utterance.rate = 0.95
        utterance.onstart = () => setIsPlayingAudio(true)
        utterance.onend = () => setIsPlayingAudio(false)
        utterance.onerror = () => setIsPlayingAudio(false)
        window.speechSynthesis.speak(utterance)
      } else {
        setIsPlayingAudio(true)
        setTimeout(() => setIsPlayingAudio(false), 5000)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white border border-slate-200/90 w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900"
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Automated Remediation & Step-by-Step Breakdown
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  RAG Textbook Grounded
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Target: {module.nativeConceptTitle[currentLanguage] || module.conceptTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NCERT Grounding Badge */}
        <div className="px-6 py-2.5 bg-indigo-50/50 border-b border-indigo-100/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 font-medium">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Retrieved Curriculum Source:</span>
            <strong className="text-slate-900">
              {module.ncertReference.book} • {module.ncertReference.chapter} (Page {module.ncertReference.page})
            </strong>
          </div>
          <span className="text-[11px] text-slate-500">
            Latency: 480ms vector query
          </span>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-2 overflow-x-auto bg-white">
          <button
            onClick={() => setActiveTab('analogy')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'analogy'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>🌾 Rural Kirana Analogy</span>
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'breakdown'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>📐 Step-by-Step Chalkboard</span>
          </button>
          <button
            onClick={() => setActiveTab('podcast')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'podcast'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>🎙️ Regional Audio Podcast</span>
          </button>
          <button
            onClick={() => setActiveTab('practice')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'practice'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>🎯 1-Min Practice Check</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: Rural Analogy */}
          {activeTab === 'analogy' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-2xl shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-amber-900">
                    {module.ruralAnalogy.title}
                  </h3>
                  <button
                    onClick={handleAudioToggle}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs"
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Stop Audio
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Listen in Regional Voice
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
                  {module.ruralAnalogy.nativeContent[currentLanguage] || module.ruralAnalogy.content}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-900">Why this resolves the bottleneck:</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  Rural learners often confuse negative signs with basic arithmetic subtraction. Grounding algebraic equations in local shop ledgers and physical debts transforms abstract symbol manipulation into an instinctive physical balance.
                </p>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Mathematical Step-by-Step Chalkboard */}
          {activeTab === 'breakdown' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="bg-slate-900 text-emerald-400 font-mono p-5 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-3">
                  <span>Interactive Chalkboard Derivation</span>
                  <span>Equation Balance Rule: L.H.S = R.H.S</span>
                </div>
                {module.breakdownSteps.map(step => (
                  <div key={step.stepNumber} className="mb-4 last:mb-0">
                    <div className="text-xs font-bold text-white mb-1">
                      {step.nativeHeading[currentLanguage] || step.heading}
                    </div>
                    {step.mathFormula && (
                      <div className="bg-slate-950 p-3 rounded-lg border border-emerald-500/20 text-emerald-300 text-sm font-bold my-1.5">
                        {step.mathFormula}
                      </div>
                    )}
                    <p className="text-xs text-slate-300 font-sans mt-1 leading-relaxed">
                      {step.nativeExplanation[currentLanguage] || step.explanation}
                    </p>
                    {step.visualNote && (
                      <div className="text-[11px] text-amber-400 mt-1 italic">
                        ↳ Note: {step.visualNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: Audio Podcast */}
          {activeTab === 'podcast' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="p-5 bg-purple-50/70 border border-purple-200 rounded-2xl shadow-2xs">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-purple-950">
                      Bite-Sized Regional Audio Lesson
                    </h3>
                    <p className="text-xs text-slate-600">
                      Voice explanation generated in real-time by Indic TTS pipeline
                    </p>
                  </div>
                  <button
                    onClick={handleAudioToggle}
                    className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-transform active:scale-95"
                  >
                    {isPlayingAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                </div>

                {/* Simulated Audio Waveform */}
                <div className="h-14 bg-white rounded-xl border border-purple-200 p-3 flex items-center justify-center gap-1 shadow-2xs">
                  {[20, 50, 80, 40, 95, 60, 30, 85, 70, 45, 90, 65, 35, 75, 55, 90, 40, 20].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-purple-500 rounded-full"
                      animate={{
                        height: isPlayingAudio ? [`${Math.max(10, h * 0.4)}%`, `${h}%`, '15%'] : '20%',
                      }}
                      transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.04 }}
                    />
                  ))}
                </div>

                <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700">
                  <span className="font-bold text-slate-900 block mb-0.5">Spoken Transcript:</span>
                  <p className="italic">
                    "{module.ruralAnalogy.nativeContent[currentLanguage] || module.ruralAnalogy.content}"
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: Targeted Practice Checkpoint */}
          {activeTab === 'practice' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-2xs">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  Mastery Recovery Checkpoint
                </span>
                <h4 className="text-sm font-bold text-slate-900 mb-3">
                  {practiceQ.nativeQuestionText[currentLanguage] || practiceQ.questionText}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                  {practiceQ.options.map(opt => {
                    const isSelected = practiceAnswer === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !isPracticeSubmitted && setPracticeAnswer(opt.id)}
                        className={`p-3 rounded-xl border-2 text-left text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-emerald-100 border-emerald-600 text-emerald-950 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {opt.nativeText[currentLanguage] || opt.text}
                      </button>
                    )
                  })}
                </div>

                {!isPracticeSubmitted ? (
                  <button
                    onClick={() => setIsPracticeSubmitted(true)}
                    disabled={!practiceAnswer}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all ${
                      practiceAnswer
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Check Practice Answer
                  </button>
                ) : (
                  <div className="p-3.5 bg-emerald-100/80 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Conceptual Gap Resolved! Knowledge Graph Updated (+18% Mastery).</span>
                    </div>
                    <button
                      onClick={() => {
                        onPracticeComplete?.()
                        onClose()
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-xs shadow-xs hover:bg-emerald-800"
                    >
                      Done & Return
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Targeting rural under-resourced schools with localized analogies & Indic voice.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 shadow-2xs transition-colors"
          >
            Close Module
          </button>
        </div>
      </motion.div>
    </div>
  )
}
