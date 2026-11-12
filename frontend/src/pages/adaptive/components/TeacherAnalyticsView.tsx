import React, { useState } from 'react'
import { Users, AlertTriangle, CheckCircle2, Send, Download, Sparkles, TrendingUp, BarChart2, Radio, BookOpen, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StudentProfile, ClassAnalyticsSummary, ConceptNode } from '../types'
import { CLASS_ROSTER_MOCK, CLASS_ANALYTICS_SUMMARY, CONCEPT_NODES } from '../mockData'

export const TeacherAnalyticsView: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>(CLASS_ROSTER_MOCK)
  const [dispatchedStudents, setDispatchedStudents] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'critical_risk' | 'needs_attention'>('all')
  const [activeTab, setActiveTab] = useState<'heatmap' | 'at_risk' | 'groups'>('at_risk')
  const [showDispatchSuccess, setShowDispatchSuccess] = useState(false)

  const filteredStudents = students.filter(s => {
    if (filter === 'all') return true
    return s.status === filter
  })

  const handleDispatchRemediation = (studentId: string) => {
    if (!dispatchedStudents.includes(studentId)) {
      setDispatchedStudents(prev => [...prev, studentId])
      setShowDispatchSuccess(true)
      setTimeout(() => setShowDispatchSuccess(false), 3000)
    }
  }

  const handleDispatchAllAtRisk = () => {
    const atRiskIds = students.filter(s => s.status === 'critical_risk').map(s => s.id)
    setDispatchedStudents(Array.from(new Set([...dispatchedStudents, ...atRiskIds])))
    setShowDispatchSuccess(true)
    setTimeout(() => setShowDispatchSuccess(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Teacher Context in 40:1 Classroom (Whitish Professional) */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/90 border border-indigo-100 text-slate-900 rounded-3xl p-6 shadow-xs relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-600 text-white shadow-2xs">
                Teacher Command Center • 40:1 Classroom Scalability
              </span>
              <h2 className="text-xl font-black mt-2 text-slate-900">
                {CLASS_ANALYTICS_SUMMARY.schoolName}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                Class 8-B • Curriculum: {CLASS_ANALYTICS_SUMMARY.curriculumBoard}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDispatchAllAtRisk}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Auto-Dispatch All At-Risk Remediation</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards (Crisp White) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">Class Enrollment</span>
              <span className="text-2xl font-black mt-0.5 block text-slate-900">{CLASS_ANALYTICS_SUMMARY.totalStudents}</span>
              <span className="text-[11px] text-emerald-600 font-semibold">100% active past 24h</span>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">Class Average Mastery</span>
              <span className="text-2xl font-black mt-0.5 block text-slate-900">{CLASS_ANALYTICS_SUMMARY.classAverageMastery}%</span>
              <span className="text-[11px] text-amber-600 font-semibold">+6.2% since diagnostic</span>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">Critical Interventions</span>
              <span className="text-2xl font-black mt-0.5 block text-rose-600">
                {CLASS_ANALYTICS_SUMMARY.atRiskCount} Students
              </span>
              <span className="text-[11px] text-rose-600 font-medium">Bottleneck: Negative Signs</span>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">Indic Voice Usage</span>
              <span className="text-2xl font-black mt-0.5 block text-indigo-600">{CLASS_ANALYTICS_SUMMARY.ruralLanguageVoiceUsage}%</span>
              <span className="text-[11px] text-slate-500">Hindi / Kannada / Tamil</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      <AnimatePresence>
        {showDispatchSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-950 flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                <strong>Automated Remediation Dispatched!</strong> Bite-sized localized audio explanations and practice sets sent to student tablets & community sync nodes.
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700">Sync complete in 180ms</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 gap-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('at_risk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'at_risk'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🚨 At-Risk Student Triage ({CLASS_ANALYTICS_SUMMARY.atRiskCount})
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'heatmap'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Topic Bottleneck Heatmap Matrix
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'groups'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 Automated Peer Intervention Groups
          </button>
        </div>

        {/* Filter buttons */}
        {activeTab === 'at_risk' && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Filter:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                filter === 'all' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({students.length})
            </button>
            <button
              onClick={() => setFilter('critical_risk')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                filter === 'critical_risk' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Critical Risk
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: At-Risk Student Triage */}
      {activeTab === 'at_risk' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStudents.map(student => {
            const isDispatched = dispatchedStudents.includes(student.id)
            return (
              <motion.div
                key={student.id}
                layout
                className={`p-4 rounded-2xl border-2 transition-all shadow-xs ${
                  student.status === 'critical_risk'
                    ? 'bg-white border-rose-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-2 bg-slate-50 rounded-xl border border-slate-200">{student.avatar}</span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        {student.name}
                        <span className="text-[11px] font-normal text-slate-500">
                          (Roll: {student.rollNo})
                        </span>
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="uppercase font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          Lang: {student.preferredLanguage.toUpperCase()}
                        </span>
                        <span>• Voice Usage: {student.voiceUsagePercent}%</span>
                        <span>• {student.lastActive}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        student.overallMastery < 50
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {student.overallMastery}% Mastery
                    </span>
                  </div>
                </div>

                {/* Root Cause Diagnosis */}
                {student.rootCauseGap && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 mb-3 leading-relaxed">
                    <span className="font-bold block text-rose-800">Diagnosed Conceptual Bottleneck:</span>
                    <span>{student.rootCauseGap}</span>
                  </div>
                )}

                {/* Individual Action */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Completed {student.completedConcepts}/{student.totalConcepts} Core Modules
                  </span>
                  <button
                    onClick={() => handleDispatchRemediation(student.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs ${
                      isDispatched
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isDispatched ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Remediation Sent</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Audio Remediation</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* TAB 2: Topic Bottleneck Heatmap Matrix */}
      {activeTab === 'heatmap' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Class 8-B Topic-Level Mastery Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Visualizing common points of failure across all 42 students
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> &gt;75%
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" /> 50-74%
              </span>
              <span className="flex items-center gap-1 text-rose-700 font-bold">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> &lt;50% (Remediate)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-3">Student Name</th>
                  {CONCEPT_NODES.map(c => (
                    <th key={c.id} className="py-3 px-3 text-center">
                      {c.title.split(' ')[0]}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                      <span>{s.avatar}</span>
                      <span>{s.name}</span>
                    </td>
                    {CONCEPT_NODES.map(c => {
                      const score = s.topicScores[c.id] || 0
                      let cellColor = 'bg-rose-100 text-rose-800 border border-rose-200 font-bold'
                      if (score >= 75) cellColor = 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold'
                      else if (score >= 50) cellColor = 'bg-amber-100 text-amber-800 border border-amber-200 font-bold'

                      return (
                        <td key={c.id} className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded ${cellColor}`}>
                            {score}%
                          </span>
                        </td>
                      )
                    })}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDispatchRemediation(s.id)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        Remediate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Automated Peer Intervention Groups */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Group 1 */}
          <div className="bg-white border-2 border-rose-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                Tier-1 Urgent Remediation
              </span>
              <span className="text-xs text-slate-500 font-bold">9 Students</span>
            </div>
            <h4 className="font-extrabold text-sm text-slate-900">
              Sign Rules & Transposition Gap
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Identified root cause: Dropping negative signs when transposing across '=' sign.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="font-bold block text-slate-800">Assigned Peer Leads:</span>
              <span className="text-slate-600">Rohan Deshmukh & Kavita Patel (Peer Tutors)</span>
            </div>
            <button
              onClick={() => alert('Generated bilingual worksheet for Negative Integers Tier-1!')}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Offline Worksheet</span>
            </button>
          </div>

          {/* Group 2 */}
          <div className="bg-white border-2 border-amber-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Tier-2 Guided Practice
              </span>
              <span className="text-xs text-slate-500 font-bold">6 Students</span>
            </div>
            <h4 className="font-extrabold text-sm text-slate-900">
              Fraction Denominator LCM
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Directly adding numerators and denominators without finding least common multiple.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="font-bold block text-slate-800">Assigned Audio Metaphor:</span>
              <span className="text-slate-600">Village land division into equal bighas (क्षेत्रफल)</span>
            </div>
            <button
              onClick={() => alert('Generated bilingual worksheet for Fraction LCM!')}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Offline Worksheet</span>
            </button>
          </div>

          {/* Group 3 */}
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Tier-3 Advanced Mastery
              </span>
              <span className="text-xs text-slate-500 font-bold">12 Students</span>
            </div>
            <h4 className="font-extrabold text-sm text-slate-900">
              Algebraic Word Modeling & Speed
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Translating real-world verbal scenarios into complex linear and ratio equations.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="font-bold block text-slate-800">Next Milestone:</span>
              <span className="text-slate-600">Quadratic & Polynomial Foundations preview</span>
            </div>
            <button
              onClick={() => alert('Unlocked Advanced Challenge Problems!')}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assign Challenge Set</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
