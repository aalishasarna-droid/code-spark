import React, { useState } from 'react'
import { CheckCircle2, XCircle, HelpCircle, Sparkles, Volume2, Mic, ArrowRight, RefreshCw, Award } from 'lucide-react'
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
  const [masteryLevel, setMasteryLevel] = useState(45) // Starting baseline

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
      setMasteryLevel(prev => Math.min(100, prev + 18)) // Dynamic BKT boost
    } else {
      setMasteryLevel(prev => Math.max(15, prev - 12)) // Downward calibration
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

  // Voice narration of question in regional language
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
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-6">
      {/* Top Banner: Progress and Adaptive Difficulty Meter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/70 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            • Concept: <strong className="text-foreground">{currentQ.conceptTitle}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Dynamic Difficulty Gauge */}
          <div className="flex items-center gap-1.5 bg-secondary px-3 py-1 rounded-lg text-xs">
            <span className="text-muted-foreground">Adaptive Difficulty:</span>
            <span className="font-bold text-amber-500 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              {currentQ.difficultyLabel} (L{currentQ.difficulty})
            </span>
          </div>

          {/* Real-time Mastery Meter */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Mastery:</span>
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
                animate={{ width: `${masteryLevel}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="font-bold text-foreground text-xs">{masteryLevel}%</span>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
            {currentQ.nativeQuestionText[currentLanguage] || currentQ.questionText}
          </h3>

          {/* Read Out Question in Regional Audio */}
          <button
            onClick={handleReadQuestion}
            className={`p-2 rounded-xl border transition-all ${
              isReadingQuestion
                ? 'bg-amber-500/20 border-amber-500 text-amber-600 animate-pulse'
                : 'bg-secondary/70 hover:bg-secondary border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Listen to question in regional language"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {/* Real-World Village / Agricultural Context Analogy */}
        {currentQ.contextAnalogy && (
          <div className="mt-2 text-xs text-muted-foreground bg-secondary/40 border border-border/50 rounded-xl p-3 flex items-start gap-2">
            <span className="font-bold text-amber-600 dark:text-amber-400">🌾 Context:</span>
            <span>{currentQ.nativeContextAnalogy?.[currentLanguage] || currentQ.contextAnalogy}</span>
          </div>
        )}
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {currentQ.options.map(option => {
          const isSelected = selectedOptionId === option.id
          let optionStyle = 'bg-secondary/40 hover:bg-secondary/80 border-border/70 text-foreground'

          if (isSelected && !isSubmitted) {
            optionStyle = 'bg-primary/10 border-primary text-primary font-semibold ring-1 ring-primary'
          }

          if (isSubmitted) {
            if (option.isCorrect) {
              optionStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold'
            } else if (isSelected && !option.isCorrect) {
              optionStyle = 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 font-semibold'
            } else {
              optionStyle = 'opacity-40 border-border/40'
            }
          }

          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelectOption(option.id)}
              disabled={isSubmitted}
              whileTap={!isSubmitted ? { scale: 0.98 } : {}}
              className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${optionStyle}`}
            >
              <div>
                <span className="text-sm">
                  {option.nativeText[currentLanguage] || option.text}
                </span>
                {isSubmitted && option.diagnosticTrap && isSelected && (
                  <span className="block text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-normal">
                    ⚠️ Diagnosed Trap: {option.diagnosticTrap}
                  </span>
                )}
              </div>

              {isSubmitted && option.isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}
              {isSubmitted && isSelected && !option.isCorrect && (
                <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
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
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold mb-1">
              {selectedOption.isCorrect ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Correct Answer! Concept Mastery Confirmed.</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Learning Gap Detected!</span>
                </>
              )}
            </div>
            <p className="text-xs text-foreground/80">
              {selectedOption.nativeExplanation[currentLanguage] || selectedOption.explanation}
            </p>

            {!selectedOption.isCorrect && (
              <div className="mt-3 pt-3 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-rose-700 dark:text-rose-300">
                  Recommended Action: Review the Step-by-Step Remedial Module
                </span>
                <button
                  onClick={() => onRequestRemediation?.(currentQ.conceptId)}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
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
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-amber-500" />
          <span>{showHint ? 'Hide Hint' : 'Need a Hint? (संकेत)'}</span>
        </button>

        <div className="flex items-center gap-2">
          {!isSubmitted ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={!selectedOptionId}
              className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all ${
                selectedOptionId
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-secondary text-muted-foreground cursor-not-allowed'
              }`}
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
            >
              <span>{isLastQuestion ? 'Complete Assessment' : 'Next Adaptive Question'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleReset}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
            className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200"
          >
            💡 <strong>Hint:</strong> {currentQ.nativeHint[currentLanguage] || currentQ.hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
