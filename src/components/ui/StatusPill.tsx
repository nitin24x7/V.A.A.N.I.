import type { ThreatLevel } from '../../types'

const copy: Record<ThreatLevel, string> = {
  low: 'SAFE',
  medium: 'ELEVATED',
  critical: 'CRITICAL',
}

const tones: Record<ThreatLevel, string> = {
  low: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-800 border-amber-500/25',
  critical: 'bg-rose-500/15 text-rose-800 border-rose-500/25',
}

const dots: Record<ThreatLevel, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  critical: 'bg-rose-500',
}

export function StatusPill({ level }: { level: ThreatLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ${tones[level]}`}
    >
      <span className={`pulse-dot h-1.5 w-1.5 rounded-full ${dots[level]}`} />
      {copy[level]}
    </span>
  )
}
