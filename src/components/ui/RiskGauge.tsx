import { useId } from 'react'

export function RiskGauge({ value }: { value: number }) {
  const id = useId()
  const r = 54
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value)) / 100
  const offset = c * (1 - pct)
  const color = value >= 70 ? '#d61f3a' : value > 30 ? '#c47a08' : '#0f8a4b'

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(10,10,10,0.08)" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 280ms ease' }}
        />
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[28px] font-semibold leading-none tracking-tight" style={{ color }}>
          {value.toFixed(1)}
        </div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          / 100 risk
        </div>
      </div>
    </div>
  )
}
