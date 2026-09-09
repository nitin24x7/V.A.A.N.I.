import { Lock, ShieldCheck } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { threatFromRisk } from '../lib/engine'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { StatusPill } from '../components/ui/StatusPill'

export function BankingPage() {
  const { telemetry, policy, live, voiceprint } = useSession()
  const level = threatFromRisk(telemetry.risk, policy)
  const locked = live && level === 'critical'

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <GlassCard className={`p-6 ${locked ? 'flash-crit' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Core banking · RTGS desk
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">High-value transfer approval</h2>
          </div>
          <StatusPill level={live ? level : 'low'} />
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          VAANI hooks the approve CTA. Critical impersonation risk disables the control instantly so
          an agent cannot complete a coerced wire from a cloned executive voice.
        </p>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Instructing party" value={voiceprint?.name ?? 'Not verified'} />
            <Field label="Instrument" value="RTGS · INR" />
            <Field label="Amount" value="₹ 50,00,000" />
            <Field label="Beneficiary" value="Vendor Escrow ****4921" />
            <Field label="Purpose" value="Emergency vendor settlement" />
            <Field label="Initiated via" value="In-call verbal instruction" />
          </dl>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button disabled={locked} className="min-w-44">
              {locked ? (
                <>
                  <Lock size={16} /> Approve transfer locked
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> Approve transfer
                </>
              )}
            </Button>
            <Button variant="ghost">Hold for compliance</Button>
          </div>
          {locked && (
            <p className="mt-4 text-sm font-medium text-rose-700">
              CRITICAL impersonation detected. Payment rail frozen. Out-of-band verification required.
            </p>
          )}
        </GlassCard>
        <GlassCard className="p-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            Interceptor overlay
          </div>
          <ul className="mt-4 space-y-3 text-sm text-neutral-600">
            <li>Acoustic synthetic probability {(telemetry.acousticFake * 100).toFixed(1)}%</li>
            <li>Biometric mismatch {((1 - telemetry.bioMatch) * 100).toFixed(1)}%</li>
            <li>Social-engineering intent {(telemetry.intentScore * 100).toFixed(1)}%</li>
            <li>Fused risk {telemetry.risk.toFixed(1)} / 100 (lock at {policy.criticalMin})</li>
          </ul>
          <div className="mt-6 rounded-2xl bg-white/70 p-4 text-[12px] leading-5 text-neutral-500">
            SIEM compatible event emitted: `vaani.intercept.payment_lock` with Splunk / Elasticsearch
            mapping for SOC dashboards.
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  )
}
