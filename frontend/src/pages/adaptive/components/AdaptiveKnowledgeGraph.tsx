import React from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, Lock, BookOpen, ArrowRight, Sparkles, BrainCircuit } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConceptNode, SupportedLanguage } from '../types'

interface AdaptiveKnowledgeGraphProps {
  concepts: ConceptNode[]
  selectedConceptId: string
  onSelectConcept: (conceptId: string) => void
  currentLanguage: SupportedLanguage
  onLaunchRemediation: (conceptId: string) => void
  onLaunchQuiz: (conceptId: string) => void
}

export const AdaptiveKnowledgeGraph: React.FC<AdaptiveKnowledgeGraphProps> = ({
  concepts,
  selectedConceptId,
  onSelectConcept,
  currentLanguage,
  onLaunchRemediation,
  onLaunchQuiz,
}) => {
  const selectedConcept = concepts.find(c => c.id === selectedConceptId) || concepts[0]

  const averageMastery = Math.round(
    concepts.reduce((acc, curr) => acc + curr.masteryScore, 0) / concepts.length
  )

  const getStatusColor = (status: ConceptNode['status']) => {
    switch (status) {
      case 'mastered':
        return {
          cardBg: 'bg-white hover:bg-emerald-50/30 border-emerald-300 text-slate-900',
          badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
          dot: 'bg-emerald-500',
          label: 'Mastered (80%+)',
        }
      case 'developing':
        return {
          cardBg: 'bg-white hover:bg-amber-50/30 border-amber-300 text-slate-900',
          badge: 'bg-amber-100 text-amber-800 border border-amber-300 font-bold',
          dot: 'bg-amber-500',
          label: 'Developing (50-79%)',
        }
      case 'critical_gap':
        return {
          cardBg: 'bg-white hover:bg-rose-50/40 border-rose-400 text-slate-900 ring-1 ring-rose-200',
          badge: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
          dot: 'bg-rose-500',
          label: 'Critical Gap (<50%)',
        }
      case 'locked':
      default:
        return {
          cardBg: 'bg-slate-50/80 border-slate-200 text-slate-500 opacity-80',
          badge: 'bg-slate-200 text-slate-700 border border-slate-300 font-medium',
          dot: 'bg-slate-400',
          label: 'Locked / Prerequisite',
        }
    }
  }

  const nodePositions: Record<string, { x: number; y: number }> = {
    c1: { x: 80, y: 70 },
    c2: { x: 80, y: 220 },
    c3: { x: 300, y: 145 },
    c4: { x: 520, y: 80 },
    c5: { x: 300, y: 280 },
    c6: { x: 520, y: 220 },
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm mb-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Adaptive Knowledge Graph & Concept Map
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                CBSE & State Board Aligned
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Dynamic concept tracing • Pinpointing exact prerequisite learning gaps
            </p>
          </div>
        </div>

        {/* Live Mastery Meter Gauge */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 font-medium">Curriculum Mastery:</span>
              <span className="font-extrabold text-slate-900">{averageMastery}%</span>
            </div>
            <div className="w-36 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-teal-500 to-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${averageMastery}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
          <div className="text-right pl-3 border-l border-slate-200">
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
              Status
            </span>
            <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> 2 Bottlenecks
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Graph on Left, Node Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Graph Canvas */}
        <div className="lg:col-span-8 bg-slate-50/70 border border-slate-200 rounded-xl p-3 relative overflow-hidden min-h-[360px] flex flex-col justify-between">
          {/* Top Status Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] mb-2 px-2">
            <span className="text-slate-500 font-semibold">Legend:</span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Mastered (80%+)
            </span>
            <span className="flex items-center gap-1 text-amber-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> In Progress (50-79%)
            </span>
            <span className="flex items-center gap-1 text-rose-700 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" /> Remediation Needed (&lt;50%)
            </span>
            <span className="flex items-center gap-1 text-slate-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Locked
            </span>
          </div>

          {/* SVG Canvas with Prerequisite Curves and Interactive Nodes */}
          <div className="relative w-full h-[320px] bg-white/80 rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 620 350">
              <defs>
                <marker
                  id="arrow-green"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-red"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                </marker>
                <marker
                  id="arrow-gray"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
              </defs>

              {/* Edge: c1 -> c3 (Fractions to Linear Equations) */}
              <path
                d="M 170 85 C 230 85, 240 145, 300 145"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="4 2"
                markerEnd="url(#arrow-green)"
              />
              {/* Edge: c2 -> c3 (Negative Integers to Linear Equations - BOTTLENECK) */}
              <path
                d="M 170 235 C 230 235, 240 165, 300 155"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3"
                markerEnd="url(#arrow-red)"
              />
              {/* Edge: c1 -> c5 (Fractions to Ratio) */}
              <path
                d="M 170 95 C 230 140, 240 280, 300 280"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd="url(#arrow-green)"
              />
              {/* Edge: c3 -> c4 (Linear Equations to Word Problems) */}
              <path
                d="M 390 145 C 440 145, 460 95, 520 95"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                markerEnd="url(#arrow-red)"
              />
              {/* Edge: c3 -> c6 (Linear Equations to Quadratic) */}
              <path
                d="M 390 155 C 440 170, 460 220, 520 220"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                markerEnd="url(#arrow-gray)"
              />
            </svg>

            {/* Clickable Concept Node Cards */}
            {concepts.map(concept => {
              const pos = nodePositions[concept.id] || { x: 50, y: 50 }
              const isSelected = concept.id === selectedConceptId
              const styles = getStatusColor(concept.status)

              return (
                <motion.button
                  key={concept.id}
                  onClick={() => onSelectConcept(concept.id)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ left: `${pos.x - 45}px`, top: `${pos.y - 25}px` }}
                  className={`absolute z-10 w-44 text-left p-2.5 rounded-xl border-2 transition-all shadow-xs ${styles.cardBg} ${
                    isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Concept {concept.id.toUpperCase()}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${styles.badge}`}>
                      {concept.masteryScore}%
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-900 line-clamp-1">
                    {concept.nativeTitle[currentLanguage] || concept.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {concept.status === 'mastered' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {concept.status === 'critical_gap' && (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    {concept.status === 'developing' && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    {concept.status === 'locked' && (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="text-[10px] text-slate-500 truncate">
                      {styles.label.split(' ')[0]}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>

          <p className="text-[11px] text-slate-600 px-2 pt-2">
            💡 <strong>Algorithmic Bottleneck Tracing:</strong> The red pathway highlights that weakness in{' '}
            <strong className="text-rose-600">C2: Negative Integers</strong> prevents success in{' '}
            <strong className="text-rose-600">C4: Word Problems</strong>. Targeted remediation is ready below.
          </p>
        </div>

        {/* Right Drawer: Selected Concept Inspection Card */}
        <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedConcept.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {selectedConcept.subject} • Grade {selectedConcept.grade}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(selectedConcept.status).badge}`}>
                  Mastery: {selectedConcept.masteryScore}%
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedConcept.nativeTitle[currentLanguage] || selectedConcept.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {selectedConcept.nativeDescription[currentLanguage] || selectedConcept.description}
                </p>
              </div>

              {/* NCERT & Syllabus Reference */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Curriculum Reference:</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  {selectedConcept.ncertReference}
                </p>
              </div>

              {/* Misconceptions diagnosed */}
              {selectedConcept.misconceptions.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
                  <span className="font-bold block mb-1 flex items-center gap-1 text-rose-700">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    Diagnosed Bottleneck:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800">
                    {selectedConcept.misconceptions.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-slate-200 space-y-2 mt-4">
            <button
              onClick={() => onLaunchQuiz(selectedConcept.id)}
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <span>Test Concept (Adaptive Quiz)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onLaunchRemediation(selectedConcept.id)}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-300 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Generate Automated Remediation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
