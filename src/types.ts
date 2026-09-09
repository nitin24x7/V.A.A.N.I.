export type ThreatLevel = 'low' | 'medium' | 'critical'
export type CallMode = 'idle' | 'legitimate' | 'attack'
export type IngestSource = 'webrtc' | 'sip' | 'sdk'

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
  vocoderHint: string
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
