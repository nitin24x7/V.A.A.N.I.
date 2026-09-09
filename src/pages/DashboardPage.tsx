import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSession } from '../context/SessionContext'
import { threatFromRisk } from '../lib/engine'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { RiskGauge } from '../components/ui/RiskGauge'
import { StatusPill } from '../components/ui/StatusPill'
import { Waveform } from '../components/ui/Waveform'

export function DashboardPage() {
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
    <div className="space-y-4">
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
              <div className="mt-1 text-lg font-semibold">{live ? `${Math.round(telemetry.latencyMs)} ms` : '—'}</div>
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
          <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Layer scores</div>
          <LayerRow
            label="Acoustic fake"
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
          <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Streaming transcript
          </div>
          <p className="mt-4 text-[15px] leading-7 text-neutral-800">{telemetry.transcript}</p>
          <p className="mt-6 text-[12px] leading-5 text-neutral-500">
            Phase discontinuity {Math.round(telemetry.phaseDiscontinuity * 100)}% · shimmer{' '}
            {telemetry.shimmer.toFixed(2)} · policy {policy.wAcoustic.toFixed(2)} /{' '}
            {policy.wBiometric.toFixed(2)} / {policy.wIntent.toFixed(2)}
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
  const pct = Math.round(value * 1000) / 10
  return (
    <div className="mt-4">
      <div className="flex justify-between text-[12px]">
        <span>{label}</span>
        <span className="font-medium">{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div
          className={`h-full ${invert ? 'bg-emerald-700' : 'bg-black'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub && <div className="mt-1 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  )
}
