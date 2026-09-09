import { useSession } from '../context/SessionContext'
import { GlassCard } from '../components/ui/GlassCard'

export function PolicyPage() {
  const { policy, setPolicy } = useSession()
  const sum = policy.wAcoustic + policy.wBiometric + policy.wIntent

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold tracking-tight">Risk fusion weights</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Risk = w1 · Acoustic_Fake + w2 · (1 − Bio_Match) + w3 · Intent_Score. Weights are
          normalized in the engine display; the live ticker uses the values below directly.
        </p>
        <Slider
          label="Acoustic (w1)"
          value={policy.wAcoustic}
          onChange={(wAcoustic) => setPolicy({ ...policy, wAcoustic })}
        />
        <Slider
          label="Biometric gap (w2)"
          value={policy.wBiometric}
          onChange={(wBiometric) => setPolicy({ ...policy, wBiometric })}
        />
        <Slider
          label="Intent (w3)"
          value={policy.wIntent}
          onChange={(wIntent) => setPolicy({ ...policy, wIntent })}
        />
        <p className="mt-4 text-[12px] text-neutral-500">Sum {sum.toFixed(2)} (does not need to be 1.0)</p>
      </GlassCard>
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold tracking-tight">Action thresholds</h2>
        <Slider
          label="LOW ceiling"
          value={policy.lowMax / 100}
          display={`${policy.lowMax}`}
          onChange={(v) => setPolicy({ ...policy, lowMax: Math.round(v * 100) })}
        />
        <Slider
          label="CRITICAL floor"
          value={policy.criticalMin / 100}
          display={`${policy.criticalMin}`}
          onChange={(v) => setPolicy({ ...policy, criticalMin: Math.round(v * 100) })}
        />
        <div className="mt-6 space-y-3 text-sm text-neutral-600">
          <p>
            <strong className="text-neutral-900">LOW</strong> — passive telemetry, green banking CTAs.
          </p>
          <p>
            <strong className="text-neutral-900">MEDIUM</strong> — agent banner, secondary visual alert.
          </p>
          <p>
            <strong className="text-neutral-900">CRITICAL</strong> — freeze Approve Transfer, OOB push.
          </p>
        </div>
      </GlassCard>
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
  display,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  display?: string
}) {
  return (
    <label className="mt-6 block">
      <div className="mb-2 flex justify-between text-[12px]">
        <span className="font-medium">{label}</span>
        <span className="text-neutral-500">{display ?? value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-black"
      />
    </label>
  )
}
