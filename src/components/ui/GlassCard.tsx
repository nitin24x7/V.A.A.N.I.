import type { ReactNode } from 'react'

export function GlassCard({
  children,
  className = '',
  strong = false,
  flash = false,
}: {
  children: ReactNode
  className?: string
  strong?: boolean
  flash?: boolean
}) {
  return (
    <div
      className={`${strong ? 'glass-strong' : 'glass'} relative overflow-hidden rounded-2xl ${flash ? 'flash-crit' : ''} ${className}`}
    >
      <div className="noise" />
      <div className="relative">{children}</div>
    </div>
  )
}
