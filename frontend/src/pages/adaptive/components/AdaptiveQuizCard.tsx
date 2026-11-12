import React, { useState } from 'react'
import { CheckCircle2, XCircle, HelpCircle, Sparkles, Volume2, ArrowRight, RefreshCw, Award } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { QuizQuestion, SupportedLanguage } from '../types'

interface AdaptiveQuizCardProps {
  questions: QuizQuestion[]
  currentLanguage: SupportedLanguage
  onQuizCompleted?: (score: number) => void
  onRequestRemediation?: (conceptId: string) => void
}

export const AdaptiveQuizCard: React.FC<AdaptiveQuizCardProps> = ({
  questions,
  currentLanguage,
  onQuizCompleted,
  onRequestRemediation,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [isReadingQuestion, setIsReadingQuestion] = useState(false)
  const [masteryLevel, setMasteryLevel] = useState(45)

  const currentQ = questions[currentIndex] || questions[0]
  const isLastQuestion = currentIndex >= questions.length - 1

  const handleSelectOption = (optionId: string) => {
    if (isSubmitted) return
    setSelectedOptionId(optionId)
  }

  const handleSubmitAnswer = () => {
    if (!selectedOptionId || isSubmitted) return
    setIsSubmitted(true)

    const chosenOption = currentQ.options.find(o => o.id === selectedOptionId)
    if (chosenOption?.isCorrect) {
      setScore(prev => prev + 1)
      setMasteryLevel(prev => Math.min(100, prev + 18))
    } else {
      setMasteryLevel(prev => Math.max(15, prev - 12))
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      onQuizCompleted?.(score + (currentQ.options.find(o => o.id === selectedOptionId)?.isCorrect ? 1 : 0))
    } else {
      setCurrentIndex(prev => prev + 1)
      setSelectedOptionId(null)
      setIsSubmitted(false)
      setShowHint(false)
    }
  }

  const handleReset = () => {
    setCurrentIndex(0)
    setSelectedOptionId(null)
    setIsSubmitted(false)
    setScore(0)
    setShowHint(false)
    setMasteryLevel(45)
  }

  const handleReadQuestion = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const textToRead = currentQ.nativeQuestionText[currentLanguage] || currentQ.questionText
      const utterance = new SpeechSynthesisUtterance(textToRead)
      const langCodes: Record<SupportedLanguage, string> = {
        en: 'en-IN',
        hi: 'hi-IN',
        kn: 'kn-IN',
        ta: 'ta-IN',
        te: 'te-IN',
      }
      utterance.lang = langCodes[currentLanguage] || 'hi-IN'
      utterance.onstart = () => setIsReadingQuestion(true)
      utterance.onend = () => setIsReadingQuestion(false)
      utterance.onerror = () => setIsReadingQuestion(false)
      window.speechSynthesis.speak(utterance)
    } else {
      setIsReadingQuestion(true)
      setTimeout(() => setIsReadingQuestion(false), 3000)
    }
  }

  const selectedOption = currentQ.options.find(o => o.id === selectedOptionId)

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm mb-6">
      {/* Top Banner: Progress and Adaptive Difficulty Meter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            • Concept: <strong className="text-slate-900">{currentQ.conceptTitle}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Dynamic Difficulty Gauge */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg text-xs">
            <span className="text-slate-500">Adaptive Difficulty:</span>
            <span className="font-bold text-amber-700 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              {currentQ.difficultyLabel} (L{currentQ.difficulty})
            </span>
          </div>

          {/* Real-time Mastery Meter */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-slate-500">Mastery:</span>
            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
                animate={{ width: `${masteryLevel}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="font-bold text-slate-900 text-xs">{masteryLevel}%</span>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
            {currentQ.nativeQuestionText[currentLanguage] || currentQ.questionText}
          </h3>

          <button
            onClick={handleReadQuestion}
            className={`p-2.5 rounded-xl border transition-all ${
              isReadingQuestion
                ? 'bg-amber-100 border-amber-300 text-amber-700 animate-pulse'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
            title="Listen to question in regional language"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {/* Real-World Context Analogy */}
        {currentQ.contextAnalogy && (
          <div className="mt-2.5 text-xs text-slate-700 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2 shadow-2xs">
            <span className="font-bold text-amber-700">🌾 Local Context:</span>
            <span>{currentQ.nativeContextAnalogy?.[currentLanguage] || currentQ.contextAnalogy}</span>
          </div>
        )}
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {currentQ.options.map(option => {
          const isSelected = selectedOptionId === option.id
          let optionStyle = 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'

          if (isSelected && !isSubmitted) {
            optionStyle = 'bg-indigo-50/70 border-indigo-600 text-indigo-900 font-semibold ring-2 ring-indigo-500/20'
          }

          if (isSubmitted) {
            if (option.isCorrect) {
              optionStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
            } else if (isSelected && !option.isCorrect) {
              optionStyle = 'bg-rose-50 border-rose-500 text-rose-900 font-bold'
            } else {
              optionStyle = 'opacity-40 border-slate-200 bg-slate-50'
            }
          }

          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelectOption(option.id)}
              disabled={isSubmitted}
              whileTap={!isSubmitted ? { scale: 0.98 } : {}}
              className={`p-4 rounded-xl border-2 text-left transition-all flex items-start justify-between gap-3 ${optionStyle}`}
            >
              <div>
                <span className="text-sm">
                  {option.nativeText[currentLanguage] || option.text}
                </span>
                {isSubmitted && option.diagnosticTrap && isSelected && (
                  <span className="block text-[11px] text-rose-600 mt-1 font-semibold">
                    ⚠️ Diagnosed Trap: {option.diagnosticTrap}
                  </span>
                )}
              </div>

              {isSubmitted && option.isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              )}
              {isSubmitted && isSelected && !option.isCorrect && (
                <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Socratic Feedback & Diagnostic Explanation */}
      <AnimatePresence>
        {isSubmitted && selectedOption && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-xl border mb-5 ${
              selectedOption.isCorrect
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold mb-1">
              {selectedOption.isCorrect ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-800">Correct Answer! Concept Mastery Confirmed.</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-rose-800">Learning Gap Detected!</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {selectedOption.nativeExplanation[currentLanguage] || selectedOption.explanation}
            </p>

            {!selectedOption.isCorrect && (
              <div className="mt-3 pt-3 border-t border-rose-200/80 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-rose-800 font-medium">
                  Recommended Action: Review the Step-by-Step Remedial Module
                </span>
                <button
                  onClick={() => onRequestRemediation?.(currentQ.conceptId)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Open Automated Remediation</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hints & Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          onClick={() => setShowHint(prev => !prev)}
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-semibold transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-amber-500" />
          <span>{showHint ? 'Hide Hint' : 'Need a Hint? (संकेत)'}</span>
        </button>

        <div className="flex items-center gap-2">
          {!isSubmitted ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={!selectedOptionId}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all ${
                selectedOptionId
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <span>{isLastQuestion ? 'Complete Assessment' : 'Next Adaptive Question'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleReset}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Reset Quiz"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hint Drawer */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed"
          >
            💡 <strong>Hint:</strong> {currentQ.nativeHint[currentLanguage] || currentQ.hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
