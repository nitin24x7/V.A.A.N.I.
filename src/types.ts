export type ThreatLevel = 'low' | 'medium' | 'critical'
export type CallMode = 'idle' | 'legitimate' | 'attack'
export type IngestSource = 'webrtc' | 'sip' | 'sdk'
export type AudioIngestMode = 'mic' | 'tab' | 'dual'

export type Policy = {
  wAcoustic: number
  wBiometric: number
  wIntent: number
  lowMax: number
  criticalMin: number
}

export type Voiceprint = {
  name: string
  role: string
  enrolledAt: string
  durationSec: number
  embeddingPreview: number[]
}

export type ThreatCategory =
  | 'authority_impersonation'
  | 'urgency_manipulation'
  | 'verification_bypass'
  | 'financial_manipulation'
  | 'sensitive_info_request'
  | 'inconsistency_detection'

export type IntentAnalysis = {
  intent_risk: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  threats: string[]
  confidence: number
  evidence?: Record<string, string[]>
  analysis_time_ms?: number
}

export type SessionSummary = {
  durationSec: number
  transcript: string
  intentRisk: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  threats: string[]
  slmReasoning?: string
  compositeRisk: number
  acousticFake: number
  bioMatch: number
}

export type Telemetry = {
  ts: number
  acousticFake: number
  bioMatch: number
  intentScore: number
  risk: number
  latencyMs: number
  phaseDiscontinuity: number
  jitterHz: number
  shimmer: number
  transcript: string
  fullTranscript?: string
  sessionDurationSec?: number
  vocoderHint: string
  threats?: string[]
  intentRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  intentAnalysis?: IntentAnalysis
  slmStatus?: string
  slmReasoning?: string
  speechEngine?: string
}

export type Incident = {
  id: string
  ts: string
  level: ThreatLevel
  title: string
  detail: string
  source: IngestSource
  risk: number
}

export type DemoStep = 0 | 1 | 2 | 3 | 4
