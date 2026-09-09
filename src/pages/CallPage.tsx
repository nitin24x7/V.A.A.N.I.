import { Mic, PhoneOff, ShieldAlert } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { threatFromRisk } from '../lib/engine'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { StatusPill } from '../components/ui/StatusPill'
import { Waveform } from '../components/ui/Waveform'

export function CallPage() {
  const {
    live,
    startCall,
    stopCall,
    mode,
    setMode,
    telemetry,
    policy,
    voiceprint,
    source,
    isMicActive,
    micRmsDb,
    micWaveformData,
    backendConnected,
  } = useSession()
  const level = threatFromRisk(telemetry.risk, policy)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <GlassCard className={`p-8 text-center ${level === 'critical' && live ? 'flash-crit' : ''}`}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <StatusPill level={live ? level : 'low'} />
          {live && isMicActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Mic Ingestion ({Math.round(micRmsDb)} dB)
            </span>
          )}
          {backendConnected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              FastAPI Engine Online
            </span>
          )}
        </div>
        <div className="mx-auto mt-6 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#004ee8] to-[#00bfa5] text-3xl font-semibold text-white shadow-lg shadow-blue-500/20">
          {voiceprint?.name.slice(0, 1) ?? '?'}
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          {voiceprint?.name ?? 'Unenrolled caller'}
        </h2>
        <p className="text-sm text-neutral-500">{voiceprint?.role ?? 'Enroll a voiceprint first'}</p>
        <p className="mt-2 text-[12px] uppercase tracking-[0.16em] text-neutral-400">
          Source · {source.toUpperCase()} · 16kHz PCM Stream
        </p>
        <div className="mx-auto mt-6 h-24 max-w-lg">
          <Waveform
            active={live}
            intensity={0.6}
            alert={level === 'critical'}
            data={micWaveformData}
          />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {!live ? (
            <Button onClick={() => startCall('webrtc')}>
              <Mic size={16} /> Start Microphone Ingestion
            </Button>
          ) : (
            <Button variant="ghost" onClick={stopCall}>
              <PhoneOff size={16} /> Stop Microphone
            </Button>
          )}
          <Button
            variant={mode === 'attack' ? 'glossy' : 'ghost'}
            onClick={() => {
              setMode(mode === 'attack' ? 'legitimate' : 'attack')
              if (!live) startCall('webrtc')
            }}
          >
            <ShieldAlert size={16} />
            {mode === 'attack' ? 'Clone attack active' : 'Simulate voice clone attack'}
          </Button>
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Human speech"
          value={`${((1 - telemetry.acousticFake) * 100).toFixed(1)}%`}
          hint="Layer 1"
        />
        <Metric
          label="Identity match"
          value={`${(telemetry.bioMatch * 100).toFixed(1)}%`}
          hint="Layer 2"
        />
        <Metric
          label="Threat score"
          value={`${telemetry.risk.toFixed(1)} / 100`}
          hint="Fused policy"
        />
      </div>
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <GlassCard className="p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{hint}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-neutral-600">{label}</div>
    </GlassCard>
  )
}
