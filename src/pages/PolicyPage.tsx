import { useState } from 'react'
import { Check, Cpu, Sparkles, Zap } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { GlassCard } from '../components/ui/GlassCard'
import { StatusPill } from '../components/ui/StatusPill'
import { threatFromRisk } from '../lib/engine'

const PRESETS = [
  {
    id: 'balanced',
    name: 'Balanced (50/30/20)',
    tag: 'Default Phase 7',
    desc: 'Standard multi-signal defense combining acoustic vocoders, speaker verification, and Llama 3.2 intent.',
    weights: { wAcoustic: 0.50, wBiometric: 0.30, wIntent: 0.20 },
  },
  {
    id: 'anti_spoof',
    name: 'Anti-Spoof Heavy (70/20/10)',
    tag: 'Synthetic Vocoder Focus',
    desc: 'Maximum sensitivity to neural vocoders, phase discontinuity, and TTS/VC generation artifacts.',
    weights: { wAcoustic: 0.70, wBiometric: 0.20, wIntent: 0.10 },
  },
  {
    id: 'biometric_strict',
    name: 'Biometric First (20/60/20)',
    tag: 'Executive Identity Guard',
    desc: 'Strict caller identity verification against enrolled executive ECAPA-TDNN voiceprints.',
    weights: { wAcoustic: 0.20, wBiometric: 0.60, wIntent: 0.20 },
  },
  {
    id: 'social_eng',
    name: 'Social-Engineering (20/20/60)',
    tag: 'Llama 3.2 Coercion Focus',
    desc: 'Heavy weighting on urgency, dual-authorization bypass, credential harvesting, and payment coercion.',
    weights: { wAcoustic: 0.20, wBiometric: 0.20, wIntent: 0.60 },
  },
]

export function PolicyPage() {
  const { policy, setPolicy, loadPreset } = useSession()
  const [activePresetId, setActivePresetId] = useState<string>('balanced')

  // Interactive Live Simulation Sandbox state
  const [simAcoustic, setSimAcoustic] = useState(0.91)
  const [simBiometric, setSimBiometric] = useState(0.34)
  const [simIntent, setSimIntent] = useState(0.87)

  const sum = policy.wAcoustic + policy.wBiometric + policy.wIntent
  const norm = sum > 0 ? sum : 1.0

  // Calculate simulated fusion
  const simBioGap = Math.max(0, 1.0 - simBiometric)
  const cAcoustic = ((policy.wAcoustic * simAcoustic) / norm) * 100.0
  const cBiometric = ((policy.wBiometric * simBioGap) / norm) * 100.0
  const cIntent = ((policy.wIntent * simIntent) / norm) * 100.0
  const simRisk = Math.min(100.0, Math.max(0.0, Math.round((cAcoustic + cBiometric + cIntent) * 10) / 10))
  const simLevel = threatFromRisk(simRisk, policy)

  const applyPreset = (p: typeof PRESETS[0]) => {
    setActivePresetId(p.id)
    loadPreset(p.id)
  }

  const loadPromptExample = () => {
    setSimAcoustic(0.91)
    setSimBiometric(0.34)
    setSimIntent(0.87)
    applyPreset(PRESETS[0])
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <GlassCard className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              <Cpu size={14} className="text-blue-600" />
              Multi-Signal Risk Engine
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl text-neutral-900">
              Risk Fusion Policy & Thresholds
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
              Define the mathematical balance between Acoustic Synthetic Voice, Biometric Verification Gap,
              and Conversational Intent AI. Changes apply in real-time to active WebSocket telemetry and forensics.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPromptExample}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition"
          >
            <Sparkles size={14} className="text-amber-400" />
            Load Prompt Test Scenario (Risk 82)
          </button>
        </div>

        {/* 1-Click Policy Presets */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const isSelected = activePresetId === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`flex flex-col text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500'
                    : 'border-neutral-200/80 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    {p.tag}
                  </span>
                  {isSelected && <Check size={14} className="text-blue-600" />}
                </div>
                <span className="mt-1 text-sm font-semibold text-neutral-900">{p.name}</span>
                <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{p.desc}</p>
                <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-neutral-400 border-t border-neutral-100 pt-2">
                  <span>A: {(p.weights.wAcoustic * 100).toFixed(0)}%</span>
                  <span>·</span>
                  <span>B: {(p.weights.wBiometric * 100).toFixed(0)}%</span>
                  <span>·</span>
                  <span>I: {(p.weights.wIntent * 100).toFixed(0)}%</span>
                </div>
              </button>
            )
          })}
        </div>
      </GlassCard>

      {/* Main Grid: Config Sliders & Live Simulation Sandbox */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Sliders */}
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
                Signal Weights (w1, w2, w3)
              </h2>
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-mono text-neutral-600">
                Sum: {sum.toFixed(2)} {sum !== 1.0 && '(Auto-Normalized)'}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              Adjust how much each intelligence channel contributes to the fused threat score.
            </p>

            <div className="mt-6 space-y-5">
              <Slider
                label="w1 · Acoustic Deepfake (AASIST)"
                sub="Detects neural vocoder phase artifacts & HiFi-GAN signatures"
                value={policy.wAcoustic}
                color="blue"
                display={`${(policy.wAcoustic * 100).toFixed(0)}% (${policy.wAcoustic.toFixed(2)})`}
                onChange={(wAcoustic) => {
                  setActivePresetId('custom')
                  setPolicy({ ...policy, wAcoustic })
                }}
              />
              <Slider
                label="w2 · Biometric Mismatch Gap (1 − ECAPA Match)"
                sub="Penalizes deviation from enrolled executive voiceprint"
                value={policy.wBiometric}
                color="emerald"
                display={`${(policy.wBiometric * 100).toFixed(0)}% (${policy.wBiometric.toFixed(2)})`}
                onChange={(wBiometric) => {
                  setActivePresetId('custom')
                  setPolicy({ ...policy, wBiometric })
                }}
              />
              <Slider
                label="w3 · AI Intent & Coercion (Meta Llama 3.2 1B)"
                sub="Flags urgency, dual-authorization bypass, and wire fraud intent"
                value={policy.wIntent}
                color="purple"
                display={`${(policy.wIntent * 100).toFixed(0)}% (${policy.wIntent.toFixed(2)})`}
                onChange={(wIntent) => {
                  setActivePresetId('custom')
                  setPolicy({ ...policy, wIntent })
                }}
              />
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
              Policy Action Thresholds
            </h2>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              Set the fused risk boundaries that trigger automated security interventions.
            </p>

            <div className="mt-6 space-y-5">
              <Slider
                label="LOW Ceiling (Advisory Barrier)"
                sub="Scores below this are greenlit with passive telemetry"
                value={policy.lowMax / 100}
                color="emerald"
                display={`${policy.lowMax} / 100`}
                onChange={(v) => setPolicy({ ...policy, lowMax: Math.round(v * 100) })}
              />
              <Slider
                label="CRITICAL Floor (Automated Lockdown)"
                sub="Scores at or above this instantly freeze transactions and prompt OOB push"
                value={policy.criticalMin / 100}
                color="red"
                display={`${policy.criticalMin} / 100`}
                onChange={(v) => setPolicy({ ...policy, criticalMin: Math.round(v * 100) })}
              />
            </div>

            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-2.5 text-xs text-neutral-600">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <strong className="text-neutral-900">LOW (0 – {policy.lowMax}):</strong> Passive telemetry, normal payment workflows cleared.
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <strong className="text-neutral-900">MEDIUM ({policy.lowMax + 1} – {policy.criticalMin - 1}):</strong> Visual warning banner, secondary verification prompt.
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <strong className="text-neutral-900">CRITICAL ({policy.criticalMin} – 100):</strong> Instant payment freeze, out-of-band push to authorized executive.
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Live Simulation Sandbox */}
        <div className="space-y-6">
          <GlassCard className="p-6 border-blue-200/50 bg-gradient-to-br from-white via-blue-50/10 to-white">
            <div className="flex items-center justify-between border-b border-neutral-200/60 pb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-neutral-900 flex items-center gap-2">
                  <Zap size={18} className="text-blue-600" />
                  Live Simulation Sandbox
                </h2>
                <p className="text-xs text-neutral-500">
                  Drag sample inputs to simulate real-time risk fusion under your current policy.
                </p>
              </div>
              <StatusPill level={simLevel} />
            </div>

            {/* Simulated Signal Sliders */}
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5">
                <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-1">
                  <span>Input 1 · Simulated Acoustic Fake</span>
                  <span className="text-blue-600 font-mono">{simAcoustic.toFixed(2)} ({Math.round(simAcoustic * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={simAcoustic}
                  onChange={(e) => setSimAcoustic(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5">
                <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-1">
                  <span>Input 2 · Simulated Speaker Match</span>
                  <span className="text-emerald-600 font-mono">
                    {simBiometric.toFixed(2)} (Gap: {simBioGap.toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={simBiometric}
                  onChange={(e) => setSimBiometric(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5">
                <div className="flex justify-between text-xs font-semibold text-neutral-800 mb-1">
                  <span>Input 3 · Simulated Intent Risk</span>
                  <span className="text-purple-600 font-mono">{simIntent.toFixed(2)} ({Math.round(simIntent * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={simIntent}
                  onChange={(e) => setSimIntent(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>
            </div>

            {/* Simulated Outcome Display */}
            <div className="mt-5 rounded-2xl border border-neutral-900 bg-neutral-950 p-5 text-white">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>SIMULATED RISK FUSION</span>
                <span className="font-mono">
                  {policy.wAcoustic.toFixed(2)}*A + {policy.wBiometric.toFixed(2)}*(1-B) + {policy.wIntent.toFixed(2)}*I
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-4xl font-extrabold font-mono tracking-tight text-white">
                    Risk {Math.round(simRisk)}
                    <span className="text-lg font-normal text-neutral-400 ml-1.5">({simRisk.toFixed(1)})</span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                      simLevel === 'critical'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : simLevel === 'medium'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {simLevel} THREAT
                  </span>
                </div>
              </div>

              {/* Contribution Breakdown */}
              <div className="mt-4 space-y-2 border-t border-neutral-800 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Acoustic Contribution:</span>
                  <span className="text-blue-400 font-mono">
                    {policy.wAcoustic.toFixed(2)} × {simAcoustic.toFixed(2)} = +{cAcoustic.toFixed(1)} pts
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Biometric Gap Contribution:</span>
                  <span className="text-emerald-400 font-mono">
                    {policy.wBiometric.toFixed(2)} × (1 − {simBiometric.toFixed(2)}) = +{cBiometric.toFixed(1)} pts
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Intent AI Contribution:</span>
                  <span className="text-purple-400 font-mono">
                    {policy.wIntent.toFixed(2)} × {simIntent.toFixed(2)} = +{cIntent.toFixed(1)} pts
                  </span>
                </div>
              </div>

              {/* Multi-segment bar */}
              <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-neutral-800 p-0.5 gap-0.5">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${cAcoustic}%` }} />
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${cBiometric}%` }} />
                <div className="h-full rounded-full bg-purple-500" style={{ width: `${cIntent}%` }} />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

function Slider({
  label,
  sub,
  value,
  onChange,
  display,
  color = 'blue',
}: {
  label: string
  sub?: string
  value: number
  onChange: (v: number) => void
  display?: string
  color?: 'blue' | 'emerald' | 'purple' | 'red'
}) {
  const accentClass =
    color === 'emerald'
      ? 'accent-emerald-600'
      : color === 'purple'
      ? 'accent-purple-600'
      : color === 'red'
      ? 'accent-red-600'
      : 'accent-blue-600'

  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-semibold text-neutral-800">{label}</span>
        <span className="font-mono text-neutral-600 font-medium">{display ?? value.toFixed(2)}</span>
      </div>
      {sub && <p className="mb-2 text-[11px] text-neutral-500">{sub}</p>}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${accentClass} cursor-pointer`}
      />
    </label>
  )
}
