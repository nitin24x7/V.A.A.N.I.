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

export type FusionDetails = {
  risk: number
  level: ThreatLevel
  formula: string
  contributions: {
    acoustic: number
    biometric: number
    intent: number
  }
  normalized_signals?: {
    acoustic_fake: number
    speaker_match: number
    bio_penalty: number
    intent_score: number
  }
  weights: {
    w_acoustic: number
    w_biometric: number
    w_intent: number
  }
  thresholds?: {
    low_max: number
    critical_min: number
  }
}

export type LatencyBreakdown = {
  vad_ms: number
  acoustic_ms: number
  speaker_ms: number
  stt_ms: number
  intent_ms: number
  fusion_ms: number
  total_e2e_ms: number
}

export type LatencyMilestones = {
  audio_to_detection_ms: number
  audio_to_identity_ms: number
  audio_to_risk_ms: number
  audio_to_intervention_ms: number
}

export type LatencySla = {
  target_ms: number
  compliant: boolean
  margin_ms: number
}

export type Telemetry = {
  ts: number
  acousticFake: number
  bioMatch: number
  intentScore: number
  risk: number
  fusion?: FusionDetails
  latencyMs: number
  latencies?: LatencyBreakdown
  milestones?: LatencyMilestones
  sla?: LatencySla
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

// ── Phase 8: Autonomous Intervention Types ──
export type InterventionSignal = {
  aiVoice: number       // e.g. 91
  identityMatch: number // e.g. 34
  intentRisk: number    // e.g. 87
}

export type InterventionAction = {
  id: string
  label: string
  status: 'DISABLED' | 'ENABLED' | 'LOCKED'
  reason?: string
}

export type InterventionEvent = {
  type: 'intervention'
  status: 'TRIGGERED' | 'ACTIVE' | 'RESOLVED'
  level: 'CRITICAL' | string
  title: string
  threatScore: number   // e.g. 82
  signals: InterventionSignal
  warning?: string
  warningDirective?: string
  actions?: InterventionAction[]
  guidance: string
  verificationProtocols?: string[]
  incidentId?: string
  sessionId?: string
  timestamp: number
}
