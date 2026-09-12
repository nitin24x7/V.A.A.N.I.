import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { sampleTelemetry, threatFromRisk, DEFAULT_POLICY } from '../lib/engine'
import { audioService } from '../lib/audioService'
import type {
  AudioIngestMode,
  CallMode,
  DemoStep,
  Incident,
  IngestSource,
  InterventionEvent,
  Policy,
  SessionSummary,
  Telemetry,
  Voiceprint,
} from '../types'

type SessionState = {
  policy: Policy
  setPolicy: (p: Policy) => void
  voiceprint: Voiceprint | null
  enroll: (name: string, role: string, durationSec: number, samples?: number[]) => Promise<void>
  clearEnrollment: () => void
  mode: CallMode
  setMode: (m: CallMode) => void
  live: boolean
  startCall: (source?: IngestSource, ingestMode?: AudioIngestMode) => Promise<void>
  stopCall: () => void
  source: IngestSource
  telemetry: Telemetry
  history: Telemetry[]
  incidents: Incident[]
  demoStep: DemoStep
  setDemoStep: (s: DemoStep) => void
  oobPrompt: boolean
  dismissOob: () => void
  isMicActive: boolean
  micRmsDb: number
  micWaveformData: Float32Array | null
  backendConnected: boolean
  audioIngestMode: AudioIngestMode
  setAudioIngestMode: (m: AudioIngestMode) => void
  sessionSummary: SessionSummary | null
  clearSessionSummary: () => void
  loadPreset: (presetName: string) => Promise<void>
  activeIntervention: InterventionEvent | null
  dismissIntervention: () => void
  triggerTestIntervention: () => void
}

const SessionContext = createContext<SessionState | null>(null)

function makeEmbedding() {
  return Array.from({ length: 24 }, () => Number((Math.random() * 2 - 1).toFixed(3)))
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY)
  const [voiceprint, setVoiceprint] = useState<Voiceprint | null>(null)
  const [mode, setMode] = useState<CallMode>('idle')
  const [live, setLive] = useState(false)
  const [source, setSource] = useState<IngestSource>('webrtc')
  const [telemetry, setTelemetry] = useState<Telemetry>(() => sampleTelemetry('idle', DEFAULT_POLICY))
  const [history, setHistory] = useState<Telemetry[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [demoStep, setDemoStep] = useState<DemoStep>(0)
  const [oobPrompt, setOobPrompt] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)
  const [micRmsDb, setMicRmsDb] = useState(-100)
  const [micWaveformData, setMicWaveformData] = useState<Float32Array | null>(null)
  const [backendConnected, setBackendConnected] = useState(false)
  const [audioIngestMode, setAudioIngestMode] = useState<AudioIngestMode>('mic')
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const clearSessionSummary = useCallback(() => setSessionSummary(null), [])
  const lastCritAt = useRef(0)

  // Phase 8: Autonomous Intervention State
  const [activeIntervention, setActiveIntervention] = useState<InterventionEvent | null>(null)

  const dismissIntervention = useCallback(() => {
    setActiveIntervention(null)
    setOobPrompt(false)
    audioService.dismissIntervention()
    fetch('/api/intervention/dismiss', { method: 'POST' }).catch(() => {})
  }, [])

  const triggerTestIntervention = useCallback(async () => {
    if (audioService.isConnected()) {
      audioService.triggerIntervention()
    } else {
      try {
        const res = await fetch('/api/intervention/trigger', { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          setActiveIntervention({
            type: 'intervention',
            status: data.status || 'TRIGGERED',
            level: data.level || 'CRITICAL',
            title: data.title || '🚨 CRITICAL IMPERSONATION DETECTED',
            threatScore: data.threat_score ?? 82,
            signals: {
              aiVoice: data.signals?.ai_voice ?? 91,
              identityMatch: data.signals?.identity_match ?? 34,
              intentRisk: data.signals?.intent_risk ?? 87,
            },
            warning: data.warning || 'CRITICAL_IMPERSONATION_RISK',
            warningDirective: data.warning_directive || 'Do NOT trust caller claims or follow verbal instructions given on this line.',
            guidance: data.guidance || 'Verify caller through another channel.',
            verificationProtocols: data.verification_protocols,
            incidentId: data.incident_id,
            sessionId: data.session_id,
            timestamp: data.timestamp || Date.now(),
          })
          setOobPrompt(true)
        }
      } catch {
        setActiveIntervention({
          type: 'intervention',
          status: 'TRIGGERED',
          level: 'CRITICAL',
          title: '🚨 CRITICAL IMPERSONATION DETECTED',
          threatScore: 82,
          signals: { aiVoice: 91, identityMatch: 34, intentRisk: 87 },
          warning: 'CRITICAL_IMPERSONATION_RISK',
          warningDirective: 'Do NOT trust caller claims or follow verbal instructions given on this line.',
          guidance: 'Verify caller through another channel.',
          timestamp: Date.now(),
        })
        setOobPrompt(true)
      }
    }
  }, [])

  // Wire up audioService intervention listener
  useEffect(() => {
    audioService.setInterventionCallback((evt) => {
      setActiveIntervention(evt)
      if (evt) {
        setOobPrompt(true)
        const now = Date.now()
        setIncidents((list) => [
          {
            id: evt.incidentId || `INC-${now.toString().slice(-6)}`,
            ts: new Date(evt.timestamp || now).toISOString(),
            level: 'critical' as const,
            title: '🚨 Autonomous Intervention: Critical Impersonation Warning',
            detail: `Threat Score: ${evt.threatScore}/100 · AI Voice: ${evt.signals.aiVoice}%, Identity Match: ${evt.signals.identityMatch}%, Intent: ${evt.signals.intentRisk}% · Critical Warning Issued`,
            source: 'webrtc' as const,
            risk: evt.threatScore,
          },
          ...list,
        ].slice(0, 40))
      }
    })
  }, [])

  // Synchronize policy configuration from backend on mount
  useEffect(() => {
    fetch('/api/policy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.weights && data?.thresholds) {
          setPolicy({
            wAcoustic: data.weights.w_acoustic,
            wBiometric: data.weights.w_biometric,
            wIntent: data.weights.w_intent,
            lowMax: data.thresholds.low_max,
            criticalMin: data.thresholds.critical_min,
          })
        }
      })
      .catch(() => {})
  }, [])

  const handleSetPolicy = useCallback((newPolicy: Policy) => {
    setPolicy(newPolicy)
    fetch('/api/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wAcoustic: newPolicy.wAcoustic,
        wBiometric: newPolicy.wBiometric,
        wIntent: newPolicy.wIntent,
        lowMax: newPolicy.lowMax,
        criticalMin: newPolicy.criticalMin,
      }),
    }).catch(() => {})
    audioService.updatePolicy(newPolicy)
  }, [])

  const loadPreset = useCallback(async (presetName: string) => {
    try {
      const res = await fetch(`/api/policy/preset/${presetName}`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data?.weights && data?.thresholds) {
          const updated: Policy = {
            wAcoustic: data.weights.w_acoustic,
            wBiometric: data.weights.w_biometric,
            wIntent: data.weights.w_intent,
            lowMax: data.thresholds.low_max,
            criticalMin: data.thresholds.critical_min,
          }
          setPolicy(updated)
          audioService.loadPreset(presetName)
        }
      }
    } catch (e) {
      console.warn('Failed to activate policy preset on backend:', e)
    }
  }, [])

  const enroll = useCallback(async (name: string, role: string, durationSec: number, samples?: number[]) => {
    let embedding = makeEmbedding()

    // If audio samples provided, try sending to backend
    if (samples && samples.length > 0) {
      try {
        const res = await fetch('/api/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            role,
            samples,
            sample_rate: 16000,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.profile?.embedding_preview) {
            embedding = data.profile.embedding_preview
          }
        }
      } catch (e) {
        console.warn('Backend enrollment offline, using derived embedding:', e)
      }
    }

    setVoiceprint({
      name,
      role,
      durationSec,
      enrolledAt: new Date().toISOString(),
      embeddingPreview: embedding,
    })
    setDemoStep(1)
  }, [])

  const clearEnrollment = useCallback(() => {
    setVoiceprint(null)
    setDemoStep(0)
  }, [])

  const startCall = useCallback(async (nextSource: IngestSource = 'webrtc', ingestModeOverride?: AudioIngestMode) => {
    setSource(nextSource)
    setLive(true)
    setSessionSummary(null)
    setMode((current) => (current === 'idle' ? 'legitimate' : current))

    const activeIngest = ingestModeOverride || audioIngestMode

    // Ingest audio from microphone/tab when using WebRTC source
    if (nextSource === 'webrtc') {
      const ok = await audioService.startStream(
        (telemetryUpdate) => {
          setBackendConnected(true)
          setTelemetry((prev) => {
            const raw = telemetryUpdate.rawData || {}
            const mlModel = raw.mlModel
            const fakePct = (telemetryUpdate.acousticFake ?? 0) * 100

            // Phase 3: ML-powered vocoder hint
            let vocoderHint = prev.vocoderHint
            if (mlModel?.type === 'aasist') {
              vocoderHint = fakePct > 50
                 ? `SYNTHETIC VOICE DETECTED (${fakePct.toFixed(0)}%)`
                : `Natural speech verified (${(100 - fakePct).toFixed(0)}% genuine)`
            } else if ((raw.phaseDiscontinuity || 0) > 0.35) {
              vocoderHint = 'HiFi-GAN / Diffusion artifact'
            } else {
              vocoderHint = 'Natural glottal pulse'
            }

            const threats = raw.threats || (mode === 'attack' ? ['authority_impersonation', 'urgency_manipulation', 'verification_bypass'] : [])
            const intentRiskLevel = raw.intentRiskLevel || (telemetryUpdate.intentScore && telemetryUpdate.intentScore >= 0.65 ? 'HIGH' : telemetryUpdate.intentScore && telemetryUpdate.intentScore >= 0.3 ? 'MEDIUM' : 'LOW')

            return {
              ...prev,
              risk: telemetryUpdate.risk ?? prev.risk,
              fusion: raw.fusion || prev.fusion,
              acousticFake: telemetryUpdate.acousticFake ?? prev.acousticFake,
              bioMatch: telemetryUpdate.bioMatch ?? prev.bioMatch,
              intentScore: telemetryUpdate.intentScore ?? prev.intentScore,
              latencyMs: telemetryUpdate.latencyMs ?? prev.latencyMs,
              phaseDiscontinuity: raw.phaseDiscontinuity ?? prev.phaseDiscontinuity,
              shimmer: raw.shimmer ?? prev.shimmer,
              jitterHz: raw.f0 ?? prev.jitterHz,
              vocoderHint,
              transcript: telemetryUpdate.transcript || raw.text || raw.transcript || prev.transcript,
              fullTranscript: telemetryUpdate.fullTranscript || raw.fullTranscript || prev.fullTranscript,
              sessionDurationSec: raw.sessionDurationSec || prev.sessionDurationSec,
              threats,
              intentRiskLevel,
              intentAnalysis: raw.intentAnalysis || prev.intentAnalysis,
              slmStatus: raw.slm_status || prev.slmStatus,
              slmReasoning: raw.slm_reasoning || prev.slmReasoning,
              speechEngine: telemetryUpdate.speechEngine || raw.speechEngine || prev.speechEngine,
            }
          })
        },
        (waveData, rmsDb) => {
          setMicWaveformData(new Float32Array(waveData))
          setMicRmsDb(rmsDb)
        },
        activeIngest,
        (summary) => {
          setSessionSummary(summary)
        }
      )
      setIsMicActive(ok)
    } else {
      audioService.stopStream()
      setIsMicActive(false)
      setMicWaveformData(null)
    }
  }, [audioIngestMode, mode])

  const stopCall = useCallback(() => {
    setTelemetry((currentTelem) => {
      const dur = currentTelem.sessionDurationSec || audioService.getSessionDuration() || 0
      const fullText = currentTelem.fullTranscript || currentTelem.transcript || 'No speech recorded during session.'
      setSessionSummary({
        durationSec: dur,
        transcript: fullText,
        intentRisk: currentTelem.intentScore,
        riskLevel: currentTelem.intentRiskLevel || (currentTelem.intentScore >= 0.65 ? 'HIGH' : currentTelem.intentScore >= 0.3 ? 'MEDIUM' : 'LOW'),
        threats: currentTelem.threats || [],
        slmReasoning: currentTelem.slmReasoning,
        compositeRisk: currentTelem.risk,
        acousticFake: currentTelem.acousticFake,
        bioMatch: currentTelem.bioMatch,
      })
      return currentTelem
    })
    audioService.stopStream()
    setIsMicActive(false)
    setMicWaveformData(null)
    setMicRmsDb(-100)
    setLive(false)
    setMode('idle')
  }, [])

  const handleSetMode = useCallback((m: CallMode) => {
    setMode(m)
    if (m === 'legitimate' || m === 'attack') {
      audioService.setMode(m)
      fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: m }),
      }).catch(() => {})
    }
  }, [])

  const dismissOob = useCallback(() => setOobPrompt(false), [])

  // Check backend health periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/status')
        if (res.ok) {
          setBackendConnected(true)
        }
      } catch {
        setBackendConnected(false)
      }
    }
    checkHealth()
    const id = window.setInterval(checkHealth, 5000)
    return () => window.clearInterval(id)
  }, [])

  // Simulated telemetry fallback if backend is not streaming packets
  useEffect(() => {
    if (!live || isMicActive) return
    const id = window.setInterval(() => {
      setTelemetry((prev) => {
        const next = sampleTelemetry(mode, policy)
        const blended: Telemetry = {
          ...next,
          acousticFake: prev.acousticFake * 0.35 + next.acousticFake * 0.65,
          bioMatch: prev.bioMatch * 0.35 + next.bioMatch * 0.65,
          intentScore: prev.intentScore * 0.4 + next.intentScore * 0.6,
          risk: prev.risk * 0.3 + next.risk * 0.7,
          threats: mode === 'attack' ? ['authority_impersonation', 'urgency_manipulation', 'verification_bypass'] : [],
          intentRiskLevel: mode === 'attack' ? 'HIGH' : 'LOW',
        }
        blended.risk = Math.round(blended.risk * 10) / 10
        return blended
      })
    }, 250)
    return () => window.clearInterval(id)
  }, [live, isMicActive, mode, policy])

  useEffect(() => {
    if (!live) return
    setHistory((h) => [...h.slice(-79), telemetry])
  }, [telemetry, live])

  useEffect(() => {
    if (!live) return
    const level = threatFromRisk(telemetry.risk, policy)
    if (level !== 'critical') return
    const now = Date.now()
    if (now - lastCritAt.current < 4500) return
    lastCritAt.current = now
    setOobPrompt(true)
    setIncidents((list) =>
      [
        {
          id: `INC-${now.toString().slice(-6)}`,
          ts: new Date(now).toISOString(),
          level,
          title: 'Critical impersonation intercepted',
          detail: telemetry.transcript,
          source,
          risk: telemetry.risk,
        },
        ...list,
      ].slice(0, 40),
    )
  }, [telemetry, live, policy, source])

  const value = useMemo<SessionState>(
    () => ({
      policy,
      setPolicy: handleSetPolicy,
      loadPreset,
      voiceprint,
      enroll,
      clearEnrollment,
      mode,
      setMode: handleSetMode,
      live,
      startCall,
      stopCall,
      source,
      telemetry,
      history,
      incidents,
      demoStep,
      setDemoStep,
      oobPrompt,
      dismissOob,
      isMicActive,
      micRmsDb,
      micWaveformData,
      backendConnected,
      audioIngestMode,
      setAudioIngestMode,
      sessionSummary,
      clearSessionSummary,
      activeIntervention,
      dismissIntervention,
      triggerTestIntervention,
    }),
    [
      policy,
      handleSetPolicy,
      loadPreset,
      voiceprint,
      enroll,
      clearEnrollment,
      mode,
      handleSetMode,
      live,
      startCall,
      stopCall,
      source,
      telemetry,
      history,
      incidents,
      demoStep,
      oobPrompt,
      dismissOob,
      isMicActive,
      micRmsDb,
      micWaveformData,
      backendConnected,
      audioIngestMode,
      sessionSummary,
      clearSessionSummary,
      activeIntervention,
      dismissIntervention,
      triggerTestIntervention,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
