export type SupportedLanguage = 'en' | 'hi' | 'kn' | 'ta' | 'te'

export interface LanguageOption {
  code: SupportedLanguage
  label: string
  nativeName: string
  flag: string
}

export type MasteryStatus = 'mastered' | 'developing' | 'critical_gap' | 'locked'

export interface ConceptNode {
  id: string
  title: string
  nativeTitle: Record<SupportedLanguage, string>
  subject: string
  grade: number
  masteryScore: number // 0 to 100
  status: MasteryStatus
  prerequisites: string[]
  description: string
  nativeDescription: Record<SupportedLanguage, string>
  learningObjective: string
  ncertReference: string
  misconceptions: string[]
}

export interface QuizOption {
  id: string
  text: string
  nativeText: Record<SupportedLanguage, string>
  isCorrect: boolean
  explanation: string
  nativeExplanation: Record<SupportedLanguage, string>
  diagnosticTrap?: string
}

export interface QuizQuestion {
  id: string
  conceptId: string
  conceptTitle: string
  difficulty: 1 | 2 | 3 | 4 // 1: Foundation, 2: Core, 3: Advanced, 4: Mastery
  difficultyLabel: 'Foundation' | 'Core' | 'Application' | 'Mastery'
  questionText: string
  nativeQuestionText: Record<SupportedLanguage, string>
  contextAnalogy?: string // Rural/local real-world context
  nativeContextAnalogy?: Record<SupportedLanguage, string>
  options: QuizOption[]
  hint: string
  nativeHint: Record<SupportedLanguage, string>
  audioDurationSeconds: number
}

export interface RemediationStep {
  stepNumber: number
  heading: string
  nativeHeading: Record<SupportedLanguage, string>
  explanation: string
  nativeExplanation: Record<SupportedLanguage, string>
  mathFormula?: string
  visualNote?: string
}

export interface RemediationModule {
  conceptId: string
  conceptTitle: string
  nativeConceptTitle: Record<SupportedLanguage, string>
  detectedGaps: string[]
  ncertReference: {
    book: string
    chapter: string
    page: number
  }
  ruralAnalogy: {
    title: string
    content: string
    nativeContent: Record<SupportedLanguage, string>
  }
  breakdownSteps: RemediationStep[]
  audioExplanationUrl: string
  audioDurationSec: number
  remedialPracticeQuestions: QuizQuestion[]
}

export interface StudentProfile {
  id: string
  name: string
  rollNo: string
  avatar: string
  grade: number
  section: string
  preferredLanguage: SupportedLanguage
  overallMastery: number
  status: 'normal' | 'needs_attention' | 'critical_risk'
  rootCauseGap?: string
  lastActive: string
  voiceUsagePercent: number
  completedConcepts: number
  totalConcepts: number
  topicScores: Record<string, number>
}

export interface ClassAnalyticsSummary {
  totalStudents: number
  classAverageMastery: number
  atRiskCount: number
  ruralLanguageVoiceUsage: number
  averageResponseTimeSec: number
  curriculumBoard: string
  schoolName: string
}

export interface LatencyMetric {
  pipelineStage: string
  p50Ms: number
  p90Ms: number
  p99Ms: number
  targetSlaMs: number
  status: 'optimal' | 'warning' | 'breach'
}
