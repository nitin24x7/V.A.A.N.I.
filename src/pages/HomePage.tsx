import { ShieldCheck, Timer, Waves } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSession } from '../context/SessionContext'
import { threatFromRisk } from '../lib/engine'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { RiskGauge } from '../components/ui/RiskGauge'
import { StatusPill } from '../components/ui/StatusPill'
import { Waveform } from '../components/ui/Waveform'

const pillars = [
  {
    title: 'Acoustic forensics',
    copy: 'AASIST / RawNet3 vocoder artifacts, phase discontinuity, and 8–12 Hz micro-tremor.',
    lat: '< 120 ms',
  },
  {
    title: 'Biometric consistency',
    copy: 'ECAPA-TDNN voiceprint match against the enrolled executive, mid-call embedding drift.',
    lat: '< 150 ms',
  },
  {
    title: 'Intent interception',
    copy: 'Whisper-streaming + SLM flags urgency, RTGS coercion, 2FA bypass, and CFO override.',
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
    mode,
    setMode,
    voiceprint,
    isMicActive,
    micRmsDb,
    micWaveformData,
    backendConnected,
  } = useSession()

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
            Stop cloned voices before the transfer goes through.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-neutral-600">
            VAANI is a live interception layer for WebRTC, SIP, and in-app calls. It fuses vocoder
            forensics, speaker verification, and social-engineering intent — then locks payment
            workflows in under 400 ms.
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
          <RiskGauge value={live ? telemetry.risk : 4.2} />
          <p className="mt-1 text-center text-[12px] text-neutral-500">
            Fusion · 250 ms sliding window
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Live PCM · {live ? '16-bit / 16 kHz' : 'buffer idle'}
                </div>
                {live && isMicActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Mic {Math.round(micRmsDb)} dB
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
            <div className="flex gap-2">
              {live ? (
                <Button variant="ghost" onClick={stopCall}>
                  Stop stream
                </Button>
              ) : (
                <Button onClick={() => startCall()}>Start microphone stream</Button>
              )}
            </div>
          </div>
          <div className="h-36">
            <Waveform
              active={live}
              intensity={live ? 0.55 + telemetry.acousticFake * 0.35 : 0.1}
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
          <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Detection layers (AASIST)</div>
          <LayerRow
            label="AI Voice Detection"
            value={telemetry.acousticFake}
            sub={telemetry.vocoderHint}
          />
          <LayerRow label="Biometric match" value={telemetry.bioMatch} invert />
          <LayerRow label="Intent pressure" value={telemetry.intentScore} />
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
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              Streaming transcript
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Faster-Whisper (INT8)
            </span>
          </div>
          <p className="mt-4 min-h-[4.5rem] text-[15px] font-medium italic leading-7 text-neutral-800">
            "{telemetry.transcript}"
          </p>
          <p className="mt-4 text-[12px] leading-5 text-neutral-500">
            Phase discontinuity {Math.round(telemetry.phaseDiscontinuity * 100)}% · shimmer{' '}
            {telemetry.shimmer.toFixed(2)} · policy {policy.wAcoustic.toFixed(2)} /{' '}
            {policy.wBiometric.toFixed(2)} / {policy.wIntent.toFixed(2)}
          </p>
        </GlassCard>
      </div>

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
