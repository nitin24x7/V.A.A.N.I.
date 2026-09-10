import {
  Activity,
  Cpu,
  FileAudio,
  LayoutDashboard,
  PhoneCall,
  Radio,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { threatFromRisk } from '../../lib/engine'
import { Button } from '../ui/Button'
import { StatusPill } from '../ui/StatusPill'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/analyze', label: 'Audio Forensics', icon: FileAudio },
  { to: '/enroll', label: 'Voice Enrollment', icon: UserRound },
  { to: '/call', label: 'Live Call', icon: PhoneCall },
  { to: '/incidents', label: 'SIEM Incidents', icon: Activity },
  { to: '/sources', label: 'Ingestion', icon: Radio },
  { to: '/policy', label: 'Policy Engine', icon: SlidersHorizontal },
  { to: '/architecture', label: 'Architecture', icon: Cpu },
]

export function AppShell() {
  const { live, telemetry, policy, oobPrompt, dismissOob, mode } = useSession()
  const level = threatFromRisk(telemetry.risk, policy)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-neutral-900/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="glass-strong sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-white/70 lg:flex lg:flex-col">
          <div className="flex justify-center px-4 pb-5 pt-6">
            <NavLink to="/" className="flex items-center justify-center w-full">
              <img
                src="/logo.png"
                alt="VAANI Logo"
                className="h-16 w-auto max-w-[210px] object-contain transition-transform duration-200 hover:scale-105"
              />
            </NavLink>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6 scrollbar-thin">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-gradient-to-r from-[#004ee8] via-[#0066f6] to-[#00bfa5] !text-white text-white shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_4px_14px_rgba(0,78,232,0.35)]'
                      : 'text-neutral-600 hover:bg-white/70 hover:text-neutral-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={16}
                      className={`shrink-0 ${isActive ? '!text-white text-white' : 'text-neutral-600'}`}
                    />
                    <span className={isActive ? '!text-white text-white font-medium' : ''}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="m-3 rounded-2xl border border-white/70 bg-white/50 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Live posture</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[12px] text-neutral-600">{live ? 'Streaming PCM' : 'Standby'}</span>
              <StatusPill level={live ? level : 'low'} />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass sticky top-0 z-20 mx-3 mt-3 rounded-2xl px-4 py-3 lg:mx-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <NavLink to="/" className="inline-flex lg:hidden">
                  <img
                    src="/logo.png"
                    alt="VAANI Logo"
                    className="h-10 w-auto object-contain"
                  />
                </NavLink>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                    Frontline interceptor
                  </div>
                  <div className="text-[15px] font-medium tracking-tight">
                    {links.find((l) =>
                      l.end ? location.pathname === '/' : location.pathname.startsWith(l.to),
                    )?.label ?? 'VAANI'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-neutral-500">
                <span className="hidden sm:inline">Zero raw audio persistence · Edge INT8 path</span>
                <span
                  className={`rounded-full px-2.5 py-1 ${live ? 'bg-emerald-500/15 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}
                >
                  {live ? `E2E ${Math.round(telemetry.latencyMs)} ms` : 'Idle'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {links.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                      isActive
                        ? 'bg-gradient-to-r from-[#004ee8] to-[#00bfa5] !text-white text-white shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_2px_10px_rgba(0,78,232,0.3)]'
                        : 'bg-white/70 text-neutral-600 hover:text-neutral-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <span className={isActive ? '!text-white text-white' : ''}>
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </header>

          <main className="relative flex-1 px-3 py-4 lg:px-6 lg:py-6">
            <Outlet />
          </main>
        </div>
      </div>

      {oobPrompt && mode === 'attack' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/40 p-4 backdrop-blur-xl">
          <div className="glass-strong w-full max-w-md rounded-3xl p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700">
              Out-of-band challenge
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Verify with the genuine user</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Payment rails are frozen. An authenticator prompt and SMS have been pushed to the enrolled
              Managing Director. Do not honor in-call instructions until this challenge succeeds.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={dismissOob}>
                Acknowledge
              </Button>
              <Button onClick={dismissOob}>Open authenticator</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
