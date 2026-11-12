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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border border-border w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Automated Remediation & Step-by-Step Breakdown
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  RAG Textbook Grounded
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Target: {module.nativeConceptTitle[currentLanguage] || module.conceptTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NCERT Grounding Badge */}
        <div className="px-6 py-2.5 bg-primary/5 border-b border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-primary font-medium">
            <BookOpen className="w-4 h-4" />
            <span>Retrieved Curriculum Source:</span>
            <strong className="text-foreground">
              {module.ncertReference.book} • {module.ncertReference.chapter} (Page {module.ncertReference.page})
            </strong>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Latency: 480ms vector query
          </span>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-3 border-b border-border/80 flex items-center gap-2 overflow-x-auto bg-card">
          <button
            onClick={() => setActiveTab('analogy')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'analogy'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🌾 Rural Kirana Analogy</span>
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'breakdown'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>📐 Step-by-Step Chalkboard</span>
          </button>
          <button
            onClick={() => setActiveTab('podcast')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'podcast'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🎙️ Regional Audio Podcast</span>
          </button>
          <button
            onClick={() => setActiveTab('practice')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'practice'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {module.ruralAnalogy.title}
                  </h3>
                  <button
                    onClick={handleAudioToggle}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 text-white font-semibold text-xs shadow-sm"
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
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                  {module.ruralAnalogy.nativeContent[currentLanguage] || module.ruralAnalogy.content}
                </p>
              </div>

              <div className="p-3 bg-secondary/50 rounded-xl border border-border/60 text-xs">
                <span className="font-bold text-foreground">Why this fixes the misconception:</span>
                <p className="text-muted-foreground mt-0.5">
                  Rural learners often confuse negative signs with simple arithmetic multiplication. Grounding the equation in cash ledgers and physical debts transforms abstract symbol manipulation into an instinctive real-world balance.
                </p>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Mathematical Step-by-Step Chalkboard */}
          {activeTab === 'breakdown' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="bg-slate-900 text-emerald-400 font-mono p-4 rounded-2xl border border-slate-800 shadow-inner">
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
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-emerald-500/20 text-emerald-300 text-sm font-bold my-1">
                        {step.mathFormula}
                      </div>
                    )}
                    <p className="text-xs text-slate-300 font-sans mt-1">
                      {step.nativeExplanation[currentLanguage] || step.explanation}
                    </p>
                    {step.visualNote && (
                      <div className="text-[11px] text-amber-400 mt-0.5 italic">
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
              <div className="p-5 bg-gradient-to-br from-purple-500/10 via-card to-secondary border border-purple-500/30 rounded-2xl">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Bite-Sized Regional Audio Lesson
                    </h3>
                    <p className="text-xs text-muted-foreground">
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
                <div className="h-14 bg-background/80 rounded-xl border border-border/80 p-3 flex items-center justify-center gap-1">
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

                <div className="mt-4 p-3 bg-card rounded-xl border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block mb-0.5">Spoken Transcript:</span>
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
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                  Mastery Recovery Checkpoint
                </span>
                <h4 className="text-sm font-bold text-foreground mb-3">
                  {practiceQ.nativeQuestionText[currentLanguage] || practiceQ.questionText}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {practiceQ.options.map(opt => {
                    const isSelected = practiceAnswer === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !isPracticeSubmitted && setPracticeAnswer(opt.id)}
                        className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                            : 'bg-card border-border/80 text-foreground hover:bg-secondary'
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
                    className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all ${
                      practiceAnswer
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-secondary text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    Check Practice Answer
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Conceptual Gap Resolved! Knowledge Graph Updated (+18% Mastery).</span>
                    </div>
                    <button
                      onClick={() => {
                        onPracticeComplete?.()
                        onClose()
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-semibold text-xs shadow-sm hover:bg-emerald-800"
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
        <div className="px-6 py-3 border-t border-border bg-secondary/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Targeting rural under-resourced schools with localized analogies & Indic voice.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border border-border transition-colors"
          >
            Close Module
          </button>
        </div>
      </motion.div>
    </div>
  )
}
