import { useState } from 'react'
import {
  ArrowDown,
  Bot,
  Clock,
  Cpu,
  FileText,
  Headphones,
  Mic,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Waves,
  X,
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSession } from '../context/SessionContext'
import { threatFromRisk } from '../lib/engine'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { RiskGauge } from '../components/ui/RiskGauge'
import { StatusPill } from '../components/ui/StatusPill'
import { Waveform } from '../components/ui/Waveform'

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const pillars = [
  {
    title: 'Acoustic Phase Forensics',
    copy: 'Sub-band phase continuity and micro-jitter inspection to detect vocoder artifacts (HiFi-GAN, WaveGlow, Diffusion).',
    lat: '< 120 ms',
  },
  {
    title: 'Voice Biometrics (ECAPA-TDNN)',
    copy: '192-dimensional deep speaker embedding space with cosine similarity scoring against the enrolled target.',
    lat: '< 150 ms',
  },
  {
    title: 'AI Intent & Contextual Defense',
    copy: 'Autonomous local SLM (Llama 3.2 1B) monitoring social-engineering patterns, coercion, and dual-control bypass attempts.',
    lat: '< 300 ms',
  },
]

export function HomePage() {
  const {
    live,
    startCall,
    stopCall,
    telemetry,
    history,
    policy,
    setPolicy,
    loadPreset,
    mode,
    setMode,
    voiceprint,
    isMicActive,
    micRmsDb,
    micWaveformData,
    backendConnected,
    audioIngestMode,
    setAudioIngestMode,
    sessionSummary,
    clearSessionSummary,
    triggerTestIntervention,
  } = useSession()

  const [showWeights, setShowWeights] = useState(false)
  const [activePreset, setActivePreset] = useState<string>('balanced')

  const level = threatFromRisk(telemetry.risk, policy)
  const chart = history.map((h, i) => ({
    i,
    risk: Number(h.risk.toFixed(1)),
    fake: Number((h.acousticFake * 100).toFixed(1)),
    bio: Number((h.bioMatch * 100).toFixed(1)),
  }))

  return (
    <div className="space-y-6">
      {/* Hero Header Section without the navigation buttons */}
      <GlassCard className="overflow-hidden p-8 md:p-10">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            <ShieldCheck size={14} className="text-blue-600" />
            Enterprise Defense System
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            Stop cloned voices and synthetic speech attacks in real-time.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-neutral-600">
            VAANI is a live interception layer for WebRTC, SIP, and in-app calls. It fuses vocoder
            forensics, speaker verification, and social-engineering intent to warn users and security
            teams in under 400 ms.
          </p>
        </div>
      </GlassCard>

      {/* Real-time Threat & Ingestion Control Center */}
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">
        <GlassCard className="p-5" flash={live && level === 'critical'}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              Combined threat
            </div>
            <StatusPill level={live ? level : 'low'} />
          </div>
          <RiskGauge value={live ? telemetry.risk : 0.0} />
          <p className="mt-1 text-center text-[12px] text-neutral-500">
            Fusion · 250 ms sliding window
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Live PCM · {live ? '16-bit / 16 kHz' : 'buffer idle'}
                </div>
                {live && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                    <Clock size={11} className="animate-spin" />
                    {formatDuration(telemetry.sessionDurationSec || 0)}
                  </span>
                )}
                {live && isMicActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Mic Active ({Math.round(micRmsDb)} dB)
                  </span>
                )}
                {backendConnected && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    FastAPI
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-medium">
                {voiceprint ? `${voiceprint.name} · ${voiceprint.role}` : 'No enrolled identity'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!live && (
                <div className="flex items-center rounded-lg border border-neutral-200/80 bg-neutral-50/80 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setAudioIngestMode('mic')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                      audioIngestMode === 'mic'
                        ? 'bg-white shadow-xs text-neutral-900 font-semibold'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                    title="Capture local hardware microphone"
                  >
                    <Mic size={12} />
                    Microphone
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioIngestMode('tab')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                      audioIngestMode === 'tab'
                        ? 'bg-white shadow-xs text-neutral-900 font-semibold'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                    title="Capture remote caller audio from active browser tab (Google Meet, Slack, Zoom, Teams)"
                  >
                    <Monitor size={12} />
                    Connect Tab (eg. Gmeet / Slack/zoom)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioIngestMode('dual')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                      audioIngestMode === 'dual'
                        ? 'bg-white shadow-xs text-neutral-900 font-semibold'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                    title="Capture both local microphone and active tab audio"
                  >
                    <Headphones size={12} />
                    Dual Stream
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={triggerTestIntervention}
                  className="border border-red-500/30 text-red-700 hover:bg-red-50 hover:text-red-800 text-[12px] font-semibold flex items-center gap-1.5 shadow-xs"
                  title="Trigger Phase 8 Critical Impersonation Intervention test from backend (Risk 82)"
                >
                  <span>🚨</span>
                  <span>Test Intervention (Risk 82)</span>
                </Button>

                {live ? (
                  <Button variant="ghost" onClick={stopCall}>
                    Stop stream
                  </Button>
                ) : (
                  <Button onClick={() => startCall('webrtc', audioIngestMode)}>
                    {audioIngestMode === 'mic'
                      ? 'Start microphone stream'
                      : audioIngestMode === 'tab'
                      ? 'Connect Tab (eg. Gmeet / Slack/zoom)'
                      : 'Start dual stream'}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="h-36">
            <Waveform
              active={live}
              intensity={live ? 0.25 : 0.05}
              alert={level === 'critical'}
              data={micWaveformData}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[12px]">
            <div className="rounded-xl bg-white/60 py-3">
              <div className="text-neutral-500">Latency</div>
              <div className="mt-1 text-lg font-semibold">
                {live ? `${Math.round(telemetry.latencyMs)} ms` : '—'}
              </div>
            </div>
            <div className="rounded-xl bg-white/60 py-3">
              <div className="text-neutral-500">Jitter F0</div>
              <div className="mt-1 text-lg font-semibold">{telemetry.jitterHz.toFixed(1)} Hz</div>
            </div>
            <div className="rounded-xl bg-white/60 py-3">
              <div className="text-neutral-500">Mode</div>
              <div className="mt-1 text-lg font-semibold capitalize">{mode}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Detection layers (AASIST + ECAPA + Intent AI)
          </div>
          <LayerRow
            label="AI Voice Detection"
            value={telemetry.acousticFake}
            sub={telemetry.vocoderHint}
          />
          <LayerRow label="Biometric match" value={telemetry.bioMatch} invert />
          <LayerRow label="Intent pressure" value={telemetry.intentScore} />
          {telemetry.threats && telemetry.threats.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-neutral-200/50 pt-2">
              {telemetry.threats.map((threat) => (
                <span
                  key={threat}
                  className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-700 uppercase tracking-wide"
                >
                  {threat.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              variant={mode === 'legitimate' ? 'glossy' : 'ghost'}
              className="flex-1"
              onClick={() => {
                setMode('legitimate')
                startCall()
              }}
            >
              Genuine
            </Button>
            <Button
              variant={mode === 'attack' ? 'glossy' : 'ghost'}
              className="flex-1"
              onClick={() => {
                setMode('attack')
                startCall()
              }}
            >
              Inject clone
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* Phase 7 — Multi-Signal Risk Fusion Engine */}
      <GlassCard className="p-6 border-blue-200/40 bg-gradient-to-br from-white via-neutral-50/50 to-white shadow-xs">
        {/* Header with Title & Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600">
              <Cpu size={22} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-neutral-900 flex items-center gap-2">
                Multi-Signal Risk Fusion Engine
                <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {telemetry.fusion?.formula || `${policy.wAcoustic.toFixed(2)}*Acoustic + ${policy.wBiometric.toFixed(2)}*(1-Bio) + ${policy.wIntent.toFixed(2)}*Intent`}
                </span>
              </div>
              <div className="text-xs text-neutral-500">
                Mathematical fusion across AASIST Neural Vocoders, ECAPA Speaker Identity, and Meta Llama 3.2 1B
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Presets */}
            <div className="flex items-center rounded-lg border border-neutral-200/80 bg-neutral-50/80 p-0.5 text-[11px]">
              {[
                { id: 'balanced', label: 'Balanced 50/30/20' },
                { id: 'anti_spoof', label: 'Anti-Spoof 70/20/10' },
                { id: 'biometric_strict', label: 'Biometric 20/60/20' },
                { id: 'social_eng', label: 'Intent 20/20/60' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePreset(p.id)
                    loadPreset(p.id)
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    activePreset === p.id
                      ? 'bg-white shadow-xs text-neutral-900 font-semibold'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowWeights(!showWeights)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                showWeights
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <SlidersHorizontal size={13} />
              {showWeights ? 'Hide Sliders' : 'Tune Weights'}
            </button>
          </div>
        </div>

        {/* Dynamic Weight Sliders (Collapsible) */}
        {showWeights && (
          <div className="mt-4 rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-800">
                Custom Signal Weights (Auto-Normalized to 100%)
              </span>
              <span className="text-[11px] text-neutral-500">
                Sum: {(policy.wAcoustic + policy.wBiometric + policy.wIntent).toFixed(2)}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-neutral-700">w1 · Acoustic Deepfake</span>
                  <span className="font-semibold text-blue-600">{(policy.wAcoustic * 100).toFixed(0)}% ({policy.wAcoustic.toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={policy.wAcoustic}
                  onChange={(e) => {
                    setActivePreset('custom')
                    setPolicy({ ...policy, wAcoustic: Number(e.target.value) })
                  }}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-neutral-700">w2 · Biometric Mismatch (1 - Match)</span>
                  <span className="font-semibold text-emerald-600">{(policy.wBiometric * 100).toFixed(0)}% ({policy.wBiometric.toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={policy.wBiometric}
                  onChange={(e) => {
                    setActivePreset('custom')
                    setPolicy({ ...policy, wBiometric: Number(e.target.value) })
                  }}
                  className="w-full accent-emerald-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-neutral-700">w3 · Intent & Coercion</span>
                  <span className="font-semibold text-purple-600">{(policy.wIntent * 100).toFixed(0)}% ({policy.wIntent.toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={policy.wIntent}
                  onChange={(e) => {
                    setActivePreset('custom')
                    setPolicy({ ...policy, wIntent: Number(e.target.value) })
                  }}
                  className="w-full accent-purple-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3-Signal Flow Pipeline (Visual Architecture) */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          {/* Left Column: 3 Input Signals */}
          <div className="space-y-3">
            {/* Signal 1: Acoustic Fake */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Signal 1 · Acoustic (AASIST)
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  w1 = {policy.wAcoustic.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono">
                  {telemetry.acousticFake.toFixed(2)}
                  <span className="text-xs text-neutral-400 font-normal ml-1">
                    ({Math.round(telemetry.acousticFake * 100)}% fake)
                  </span>
                </span>
                <span className="text-xs font-semibold text-blue-600">
                  +{((telemetry.fusion?.contributions.acoustic ?? (telemetry.acousticFake * policy.wAcoustic * 100))).toFixed(1)} pts
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round(telemetry.acousticFake * 100))}%` }}
                />
              </div>
            </div>

            {/* Signal 2: Biometric Gap */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Signal 2 · Biometric (ECAPA-TDNN)
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  w2 = {policy.wBiometric.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono">
                  {telemetry.bioMatch.toFixed(2)}
                  <span className="text-xs text-neutral-400 font-normal ml-1">
                    (Mismatch: {(Math.max(0, 1 - telemetry.bioMatch)).toFixed(2)})
                  </span>
                </span>
                <span className="text-xs font-semibold text-emerald-600">
                  +{((telemetry.fusion?.contributions.biometric ?? (Math.max(0, 1 - telemetry.bioMatch) * policy.wBiometric * 100))).toFixed(1)} pts
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round(Math.max(0, 1 - telemetry.bioMatch) * 100))}%` }}
                />
              </div>
            </div>

            {/* Signal 3: Intent Score */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-600" />
                  Signal 3 · Intent AI (Llama 3.2)
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  w3 = {policy.wIntent.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono">
                  {(telemetry.intentScore || 0).toFixed(2)}
                  <span className="text-xs text-neutral-400 font-normal ml-1">
                    ({Math.round((telemetry.intentScore || 0) * 100)}% risk)
                  </span>
                </span>
                <span className="text-xs font-semibold text-purple-600">
                  +{((telemetry.fusion?.contributions.intent ?? ((telemetry.intentScore || 0) * policy.wIntent * 100))).toFixed(1)} pts
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full bg-purple-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((telemetry.intentScore || 0) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Middle Divider / Directional Connectors */}
          <div className="hidden lg:flex flex-col items-center justify-center px-2 text-neutral-300">
            <div className="h-full w-px bg-gradient-to-b from-transparent via-neutral-300 to-transparent" />
            <div className="my-2 rounded-full border border-neutral-300 bg-white p-1 text-neutral-500 shadow-xs">
              <ArrowDown size={14} />
            </div>
            <div className="h-full w-px bg-gradient-to-b from-transparent via-neutral-300 to-transparent" />
          </div>

          {/* Right Column: Risk Engine Convergence Box */}
          <div className="flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-white shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Fused Multi-Modal Outcome
                </span>
                <StatusPill level={live ? level : 'low'} />
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <div className="text-xs text-neutral-400 uppercase tracking-wider">Composite Threat</div>
                  <div className="text-4xl font-extrabold tracking-tight font-mono text-white">
                    Risk {Math.round(live ? telemetry.risk : 0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-400">Normalized Scale</div>
                  <div className="text-sm font-semibold text-neutral-200">0 – 100 / 100</div>
                </div>
              </div>

              {/* Fused Contribution Breakdown Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-neutral-400 mb-1.5">
                  <span>Signal Composition</span>
                  <span className="font-mono">{telemetry.fusion?.formula || '0.50*A + 0.30*(1-B) + 0.20*I'}</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-800 p-0.5 gap-0.5">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.max(2, (telemetry.fusion?.contributions.acoustic ?? 0))}%` }}
                    title={`Acoustic: +${(telemetry.fusion?.contributions.acoustic ?? 0).toFixed(1)} pts`}
                  />
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.max(2, (telemetry.fusion?.contributions.biometric ?? 0))}%` }}
                    title={`Biometric Mismatch: +${(telemetry.fusion?.contributions.biometric ?? 0).toFixed(1)} pts`}
                  />
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${Math.max(2, (telemetry.fusion?.contributions.intent ?? 0))}%` }}
                    title={`Intent: +${(telemetry.fusion?.contributions.intent ?? 0).toFixed(1)} pts`}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    Acoustic: +{(telemetry.fusion?.contributions.acoustic ?? 0).toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Bio Gap: +{(telemetry.fusion?.contributions.biometric ?? 0).toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                    Intent: +{(telemetry.fusion?.contributions.intent ?? 0).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/90 p-3 text-xs text-neutral-300">
              <span className="font-semibold text-white">Decision Action:</span>{' '}
              {level === 'critical'
                ? 'CRITICAL RISK: High-threat impersonation detected. Do not trust caller instructions.'
                : level === 'medium'
                ? 'MEDIUM RISK: In-band visual advisory active. Verification recommended.'
                : 'LOW RISK: Routine business dialogue. Natural voice characteristics verified.'}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Historical Telemetry Chart & Streaming Transcript */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <GlassCard className="p-5">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Risk & authenticity history
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <XAxis dataKey="i" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(10,10,10,0.08)',
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="risk" stroke="#0a0a0a" fill="rgba(10,10,10,0.08)" />
                <Area type="monotone" dataKey="fake" stroke="#d61f3a" fill="rgba(214,31,58,0.08)" />
                <Area type="monotone" dataKey="bio" stroke="#0f8a4b" fill="rgba(15,138,75,0.08)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              Streaming transcript
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {live && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                  <Clock size={11} className="animate-spin" />
                  {formatDuration(telemetry.sessionDurationSec || 0)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                {telemetry.speechEngine === 'browser_instant' ? '⚡ Instant Streaming ASR (< 40 ms)' : 'Faster-Whisper (INT8)'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                telemetry.intentRiskLevel === 'HIGH'
                  ? 'bg-red-500/15 text-red-700'
                  : telemetry.intentRiskLevel === 'MEDIUM'
                  ? 'bg-amber-500/15 text-amber-700'
                  : 'bg-emerald-500/15 text-emerald-700'
              }`}>
                AI Intent: {telemetry.intentRiskLevel || 'LOW'} ({Math.round((telemetry.intentScore || 0) * 100)}%)
              </span>
              {telemetry.slmStatus?.includes('active') && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                  🦙 Llama 3.2
                </span>
              )}
            </div>
          </div>
          {/* Captured voice transcript box */}
          <div className="mt-4 min-h-[4.8rem] rounded-xl border border-neutral-200/70 bg-neutral-50/80 p-3.5 flex flex-col justify-center">
            {live ? (
              telemetry.transcript && telemetry.transcript.trim() ? (
                <div className="flex items-start gap-2.5 text-[14px] leading-relaxed font-mono text-neutral-900">
                  <span className="text-blue-600 font-bold shrink-0 mt-0.5">▶</span>
                  <div className="flex-1">
                    <span className="font-semibold text-neutral-950">{telemetry.transcript}</span>
                    <span className="inline-block w-1.5 h-4 ml-1.5 bg-blue-500 animate-pulse align-middle" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-neutral-400 italic">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>Awaiting captured speech... Speak into your mic or connect tab audio.</span>
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-neutral-400 animate-pulse" />
                </div>
              )
            ) : (
              <p className="text-xs text-neutral-400 italic">
                Audio stream idle. Click <span className="font-semibold text-neutral-600">"Start microphone stream"</span> or <span className="font-semibold text-neutral-600">"Connect Tab"</span> above to capture voice messages.
              </p>
            )}
          </div>
          {telemetry.threats && telemetry.threats.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Tactics:</span>
              {telemetry.threats.map((t) => (
                <span
                  key={t}
                  className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"
                >
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          {telemetry.slmReasoning && (
            <div className="mt-2.5 rounded-lg border border-purple-200/60 bg-purple-50/50 p-2.5 text-[11px] text-purple-900 leading-relaxed">
              <span className="font-semibold text-purple-800">🦙 Llama 3.2 Live Security Reasoning:</span> {telemetry.slmReasoning}
            </div>
          )}
          <p className="mt-4 text-[12px] leading-5 text-neutral-500">
            Phase discontinuity {Math.round(telemetry.phaseDiscontinuity * 100)}% · shimmer{' '}
            {telemetry.shimmer.toFixed(2)} · policy {policy.wAcoustic.toFixed(2)} /{' '}
            {policy.wBiometric.toFixed(2)} / {policy.wIntent.toFixed(2)}
          </p>
        </GlassCard>
      </div>

      {/* Autonomous AI Middleman Agent (Meta Llama 3.2 1B) & Live Speech Interception */}
      <GlassCard className="p-6 border-purple-200/50 bg-gradient-to-br from-white via-purple-50/15 to-white shadow-sm">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-700">
              <Bot size={22} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-neutral-900 flex items-center gap-2">
                Autonomous AI Voice Firewall & Intent Agent
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${live ? 'animate-ping' : ''}`} />
                  {live ? 'Live Active Monitor' : 'Agent Ready'}
                </span>
              </div>
              <div className="text-xs text-neutral-500">
                Meta Llama 3.2 1B (via Ollama local CPU) · Real-Time Moving Speech Transcription
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-medium text-purple-700">
              <Sparkles size={13} className="text-purple-600 animate-pulse" />
              {telemetry.slmStatus || 'Ollama: llama3.2:1b'}
            </span>
          </div>
        </div>

        {/* Dual Panel Grid: 1. Live Spoken Conversation (Moving Letters) | 2. Autonomous Llama 3.2 Analysis */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {/* Panel 1: Live Spoken Conversation (Real-Time Moving Letters) */}
          <div className="flex flex-col rounded-xl border border-neutral-800/60 bg-neutral-950 p-4 text-white shadow-inner">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 ${live ? 'animate-ping' : ''}`} />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
                  Live Spoken Audio Transcript
                </span>
              </div>
              <span className="rounded bg-neutral-800/80 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                {live ? (telemetry.speechEngine === 'browser_instant' ? '⚡ Instant Streaming (< 40 ms)' : 'Faster-Whisper (INT8)') : 'Standby'}
              </span>
            </div>

            {/* Transcript Text with moving letters & typing cursor */}
            <div className="mt-3 flex-1 min-h-[5.5rem] flex flex-col justify-center">
              {live ? (
                <div className="text-[14px] leading-relaxed font-mono text-neutral-100">
                  {telemetry.transcript && telemetry.transcript !== 'Listening on microphone stream... Speak into your mic' ? (
                    <span>
                      <span className="text-emerald-400 mr-2">▶</span>
                      {telemetry.transcript}
                      <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />
                    </span>
                  ) : (
                    <span className="italic text-neutral-500 flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Listening to speech... Speak into your microphone to transcribe live.
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-neutral-600 animate-pulse" />
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs italic text-neutral-500">
                  Microphone idle. Click <span className="font-semibold text-neutral-300">"Start microphone stream"</span> above to transcribe voice in real-time.
                </p>
              )}
            </div>

            {/* Footer metrics inside transcript */}
            <div className="mt-3 flex items-center justify-between border-t border-neutral-800/80 pt-2 text-[10px] text-neutral-400">
              <span>Duration: {formatDuration(telemetry.sessionDurationSec || 0)}</span>
              <span>16 kHz PCM · {telemetry.speechEngine === 'browser_instant' ? 'Zero-Latency Stream' : 'INT8 Neural STT'}</span>
            </div>
          </div>

          {/* Panel 2: Autonomous Llama 3.2 Intent Security Verdict */}
          <div className="flex flex-col rounded-xl border border-purple-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
                    (telemetry.intentRiskLevel || 'LOW') === 'HIGH'
                      ? 'bg-red-600 animate-pulse'
                      : (telemetry.intentRiskLevel || 'LOW') === 'MEDIUM'
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                >
                  {telemetry.intentRiskLevel || 'LOW'} INTENT RISK ({Math.round((telemetry.intentScore || 0.02) * 100)}%)
                </span>
                <span className="text-[11px] text-neutral-500">
                  Confidence: {Math.round((telemetry.intentAnalysis?.confidence || 0.92) * 100)}%
                </span>
              </div>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                Llama 3.2 1B
              </span>
            </div>

            {/* Security Verdict Text */}
            <div className="mt-3 flex-1 min-h-[5.5rem] flex flex-col justify-center">
              <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3 text-xs leading-relaxed text-purple-950">
                <span className="font-semibold text-purple-900 block mb-1">
                  🛡️ Llama 3.2 Forensic Security Assessment:
                </span>
                {telemetry.slmReasoning || (
                  live
                    ? (telemetry.transcript && telemetry.transcript.length > 10
                        ? "Analyzing spoken intent for social-engineering, urgency pressure, and unauthorized financial bypass..."
                        : "Ready and listening. Spoken conversation will be evaluated automatically without any buttons.")
                    : "System standby. Autonomous agent will evaluate the transcript when audio starts."
                )}
              </div>
            </div>

            {/* Threat tags */}
            <div className="mt-2 min-h-[1.5rem] flex items-center">
              {telemetry.threats && telemetry.threats.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Threats Detected:
                  </span>
                  {telemetry.threats.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"
                    >
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                  <ShieldCheck size={12} />
                  No social engineering tactics detected
                </span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Call Session Security Report Card (Emitted when stream is evaluated or stopped) */}
      {sessionSummary && (
        <GlassCard className="border-2 border-blue-500/30 bg-gradient-to-br from-white via-blue-50/15 to-white p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between border-b border-neutral-200/60 pb-3 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-700">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-neutral-900 flex items-center gap-2">
                  Call Session Security Report
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                    Duration: {formatDuration(sessionSummary.durationSec)}
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Comprehensive intent & biometric forensics report for the active microphone stream
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-white ${
                  sessionSummary.riskLevel === 'HIGH'
                    ? 'bg-red-600'
                    : sessionSummary.riskLevel === 'MEDIUM'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              >
                {sessionSummary.riskLevel} RISK ({Math.round(sessionSummary.intentRisk * 100)}%)
              </span>
              <button
                type="button"
                onClick={clearSessionSummary}
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
                title="Dismiss Report"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Recorded Spoken Dialogue:
              </div>
              <p className="rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-3 text-xs italic leading-relaxed text-neutral-800 min-h-[4rem]">
                "{sessionSummary.transcript}"
              </p>
              {sessionSummary.threats.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Detected Social Engineering Tactics:
                  </span>
                  {sessionSummary.threats.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"
                    >
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                🦙 Llama 3.2 1B Security Verdict:
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-xs leading-relaxed text-purple-950 min-h-[4rem]">
                {sessionSummary.slmReasoning || (
                  sessionSummary.threats.length > 0
                    ? "Social engineering patterns identified during conversation. Urgency and verification bypass tactics detected."
                    : "Benign call pattern verified. No executive impersonation, urgent financial manipulation, or credential harvesting detected."
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-100">
                <span>Acoustic Fake: {Math.round(sessionSummary.acousticFake * 100)}%</span>
                <span>Speaker Match: {Math.round(sessionSummary.bioMatch * 100)}%</span>
                <span>Composite Risk: {sessionSummary.compositeRisk}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* 3 Pillars of Detection */}
      <div className="grid gap-4 md:grid-cols-3">
        {pillars.map((p) => (
          <GlassCard key={p.title} className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">{p.title}</h2>
              <span className="rounded-full bg-gradient-to-r from-[#004ee8] to-[#00bfa5] px-2.5 py-1 text-[10px] text-white">
                {p.lat}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{p.copy}</p>
          </GlassCard>
        ))}
      </div>

      {/* Security SLA & Privacy Guarantees */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Timer size={16} />
            Security SLA & Guarantees
          </div>
          <ul className="mt-4 space-y-3 text-sm text-neutral-600">
            <li>Streaming PCM ingestion at 8 kHz / 16 kHz with Silero VAD gating.</li>
            <li>Telephony-resilient models trained through G.711 and 3.4 kHz band-limit.</li>
            <li>Risk fusion with LOW / MEDIUM / CRITICAL policy actions.</li>
            <li>Banking CTA lock + out-of-band push when risk exceeds 70.</li>
          </ul>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Waves size={16} />
            Privacy
          </div>
          <p className="mt-4 text-sm leading-6 text-neutral-600">
            Raw audio lives only in a 1.0 s RAM ring buffer. After embeddings are computed the buffer
            is overwritten. Inference is designed for on-prem / edge INT8 (ONNX Runtime / TensorRT)
            to stay aligned with DPDP and GDPR.
          </p>
        </GlassCard>
      </div>
    </div>
  )
}

function LayerRow({
  label,
  value,
  sub,
  invert,
}: {
  label: string
  value: number
  sub?: string
  invert?: boolean
}) {
  const pct = Math.round(value * 100)
  const isHighRisk = !invert && value >= 0.5

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-neutral-800">{label}</span>
        <div className="flex items-center gap-2">
          {isHighRisk && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-700 uppercase animate-pulse">
              SYNTHETIC VOICE DETECTED
            </span>
          )}
          <span className={`font-semibold ${isHighRisk ? 'text-red-600' : 'text-neutral-600'}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/5">
        <div
          className={`h-full transition-all duration-300 ${
            invert
              ? 'bg-emerald-600'
              : isHighRisk
                ? 'bg-gradient-to-r from-red-600 to-rose-500'
                : 'bg-gradient-to-r from-[#004ee8] to-[#00bfa5]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub && <div className="mt-1 text-[11px] text-neutral-400">{sub}</div>}
    </div>
  )
}
