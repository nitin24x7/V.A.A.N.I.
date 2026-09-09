import { useSession } from '../context/SessionContext'
import { GlassCard } from '../components/ui/GlassCard'
import { StatusPill } from '../components/ui/StatusPill'

export function IncidentsPage() {
  const { incidents } = useSession()

  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-black/5 px-6 py-5">
        <h2 className="text-xl font-semibold tracking-tight">SIEM incident log</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Critical intercepts are retained as structured telemetry. Raw PCM is never written to disk.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/50 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
            <tr>
              <th className="px-6 py-3 font-medium">ID</th>
              <th className="px-6 py-3 font-medium">When</th>
              <th className="px-6 py-3 font-medium">Level</th>
              <th className="px-6 py-3 font-medium">Source</th>
              <th className="px-6 py-3 font-medium">Risk</th>
              <th className="px-6 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                  No intercepts recorded yet. Live voice streams and intercepted attack events will appear here in real time.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => (
                <tr key={inc.id} className="border-t border-black/5">
                  <td className="px-6 py-3 font-medium">{inc.id}</td>
                  <td className="px-6 py-3 text-neutral-600">
                    {new Date(inc.ts).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-3">
                    <StatusPill level={inc.level} />
                  </td>
                  <td className="px-6 py-3 uppercase">{inc.source}</td>
                  <td className="px-6 py-3">{inc.risk.toFixed(1)}</td>
                  <td className="px-6 py-3 text-neutral-600">{inc.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}
