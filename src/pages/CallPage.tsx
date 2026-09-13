import { useState, useEffect } from 'react'
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  ShieldAlert,
  ShieldCheck,
  Mic,
  MicOff,
  AlertTriangle,
  Radio,
  UserCheck,
  UserX,
  FileText,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { threatFromRisk } from '../lib/engine'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { StatusPill } from '../components/ui/StatusPill'
import { Waveform } from '../components/ui/Waveform'

interface CallerProfile {
  name: string
  role: string
  phone: string
  avatar: string
  department: string
}

const DEFAULT_CALLERS: CallerProfile[] = [
  {
    name: 'Aditi Sharma',
    role: 'Chief Financial Officer',
    phone: '+91 98201 54321',
    avatar: 'AS',
    department: 'Corporate Finance & Treasury',
  },
  {
    name: 'Vikram Mehta',
    role: 'Executive Director',
    phone: '+91 98112 34567',
    avatar: 'VM',
    department: 'Operations & Strategy',
  },
  {
    name: 'Pooja Verma',
    role: 'Head of IT Infrastructure',
    phone: '+91 99203 11223',
    avatar: 'PV',
    department: 'Security Operations Center',
  },
]

export function CallPage() {
  const {
    live,
    startCall,
    stopCall,
    mode,
    setMode,
    telemetry,
    policy,
    isMicActive,
    micRmsDb,
    micWaveformData,
    backendConnected,
  } = useSession()

  const [selectedCaller, setSelectedCaller] = useState<CallerProfile>(DEFAULT_CALLERS[0])
  const [callState, setCallState] = useState<'incoming' | 'active' | 'ended'>('incoming')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [warningDismissed, setWarningDismissed] = useState(false)

  const level = threatFromRisk(telemetry.risk, policy)
  const isCritical = level === 'critical'

  // Call timer
  useEffect(() => {
    let interval: any = null
    if (callState === 'active' && live) {
      interval = setInterval(() => setCallDuration((d) => d + 1), 1000)
    } else {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [callState, live])

  // Reset warning dismissal if risk drops or mode changes
  useEffect(() => {
    if (!isCritical) {
      setWarningDismissed(false)
    }
  }, [isCritical])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleAcceptCall = async () => {
    setCallState('active')
    setCallDuration(0)
    setWarningDismissed(false)
    await startCall('webrtc')
  }

  const handleEndCall = () => {
    setCallState('ended')
    stopCall()
  }

  const handleResetIncoming = () => {
    stopCall()
    setCallState('incoming')
    setCallDuration(0)
    setWarningDismissed(false)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* SIH Demo Header */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md">
              <Phone size={20} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 font-semibold">
                Phase 11 · SIH Live Call Demonstration
              </div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                Active Call Interception & Verification
              </h1>
            </div>
          </div>

          {/* Caller Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Purported Caller:</span>
            <select
              value={selectedCaller.name}
              onChange={(e) => {
                const found = DEFAULT_CALLERS.find((c) => c.name === e.target.value)
                if (found) setSelectedCaller(found)
              }}
              disabled={callState === 'active'}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 shadow-2xs focus:outline-hidden"
            >
              {DEFAULT_CALLERS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Critical Impersonation Warning Banner (Pure Security Warning — No Transaction Controls) */}
      {isCritical && !warningDismissed && (
        <div className="rounded-2xl border-2 border-red-500/80 bg-red-50 p-4.5 shadow-lg animate-pulse transition-all">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-md">
                <ShieldAlert size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    🚨 High Threat Warning
                  </span>
                  <span className="text-xs font-mono font-semibold text-red-900">
                    Threat Score: {telemetry.risk.toFixed(1)} / 100
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold text-red-950">
                  Critical Impersonation & Synthetic Voice Detected!
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-red-800">
                  Acoustic forensics indicate high probability of an AI-cloned voice ({((telemetry.acousticFake || 0.91) * 100).toFixed(0)}% clone likelihood) with identity mismatch.
                  <strong> Do not act on verbal instructions. Verify caller identity via an out-of-band channel.</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWarningDismissed(true)}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 transition"
              >
                Acknowledge Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Call Interface Container */}
      <GlassCard className={`p-8 text-center transition-all ${isCritical && live ? 'border-red-400 bg-red-50/20' : ''}`}>
        {/* Call Status Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-neutral-200/60 pb-4">
          <div className="flex items-center gap-2">
            <StatusPill level={live ? level : 'low'} />
            <span className="text-xs font-mono font-medium text-neutral-500">
              {callState === 'active' ? `Active Call · ${formatTime(callDuration)}` : callState === 'incoming' ? 'Incoming Ringing...' : 'Call Terminated'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {backendConnected && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700 border border-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                VAANI Neural Engine Connected
              </span>
            )}
            {live && isMicActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-800 border border-emerald-200">
                <Mic size={12} className="text-emerald-600" />
                WebRTC Ingestion ({Math.round(micRmsDb)} dB)
              </span>
            )}
          </div>
        </div>

        {/* Caller Avatar & Purported Identity */}
        <div className="mt-8 flex flex-col items-center">
          <div className="relative">
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white shadow-xl transition-transform ${
                callState === 'incoming'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 animate-bounce'
                  : isCritical
                  ? 'bg-gradient-to-br from-red-600 to-rose-700 ring-4 ring-red-300'
                  : 'bg-gradient-to-br from-blue-600 to-teal-500 ring-4 ring-emerald-100'
              }`}
            >
              {selectedCaller.avatar}
            </div>

            <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1 shadow-md">
              {isCritical ? (
                <UserX size={20} className="text-red-600" />
              ) : telemetry.bioMatch >= 0.7 && mode !== 'attack' ? (
                <UserCheck size={20} className="text-emerald-600" />
              ) : (
                <Radio size={20} className="text-blue-600" />
              )}
            </div>
          </div>

          <h2 className="mt-4 text-2xl font-bold text-neutral-900 tracking-tight">
            {selectedCaller.name}
          </h2>
          <p className="text-sm font-medium text-neutral-600">{selectedCaller.role}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{selectedCaller.department} · {selectedCaller.phone}</p>

          {/* Verification Badge */}
          <div className="mt-3">
            {isCritical ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800 border border-red-300">
                <AlertTriangle size={13} />
                Identity Unverified · Impersonation Risk High
              </span>
            ) : live && telemetry.bioMatch >= 0.7 && mode !== 'attack' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
                <ShieldCheck size={13} />
                Executive Voiceprint Matched (Confidence: {(telemetry.bioMatch * 100).toFixed(0)}%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                Live Acoustic Stream Evaluating...
              </span>
            )}
          </div>
        </div>

        {/* Live Audio Waveform */}
        <div className="mx-auto mt-6 h-24 max-w-xl">
          <Waveform
            active={live && !isMuted}
            intensity={0.6}
            alert={isCritical}
            data={micWaveformData}
          />
        </div>

        {/* Live Transcript Ticker */}
        {live && (telemetry.transcript || telemetry.fullTranscript) && (
          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-neutral-200/80 bg-white/80 p-3 text-left shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <FileText size={12} />
              <span>Real-Time Caller Transcript:</span>
            </div>
            <p className="mt-1 text-sm font-mono text-neutral-800 italic">
              "{telemetry.fullTranscript || telemetry.transcript}"
            </p>
          </div>
        )}

        {/* Call Action Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {callState === 'incoming' && (
            <>
              <Button onClick={handleAcceptCall} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 shadow-md flex items-center gap-2">
                <PhoneIncoming size={18} /> Accept Call & Connect WebRTC
              </Button>
              <Button variant="ghost" onClick={() => setCallState('ended')} className="text-neutral-600">
                Decline
              </Button>
            </>
          )}

          {callState === 'active' && (
            <>
              <Button
                variant={isMuted ? 'glossy' : 'ghost'}
                onClick={() => setIsMuted(!isMuted)}
                className="text-xs"
              >
                {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                {isMuted ? 'Unmute' : 'Mute Mic'}
              </Button>

              <Button
                onClick={handleEndCall}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 shadow-md flex items-center gap-2"
              >
                <PhoneOff size={16} /> Hang Up Call
              </Button>

              {/* Attack Simulation Toggle for SIH Demonstration */}
              <Button
                variant={mode === 'attack' ? 'glossy' : 'ghost'}
                onClick={() => setMode(mode === 'attack' ? 'legitimate' : 'attack')}
                className={`text-xs flex items-center gap-1.5 ${
                  mode === 'attack'
                    ? 'border-red-400 bg-red-600 text-white hover:bg-red-700'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <ShieldAlert size={15} />
                {mode === 'attack' ? 'Attack Mode Active (Clone Injected)' : 'Simulate Voice Clone Attack'}
              </Button>
            </>
          )}

          {callState === 'ended' && (
            <Button onClick={handleResetIncoming} className="flex items-center gap-2">
              <Phone size={16} /> Simulate New Incoming Call
            </Button>
          )}
        </div>
      </GlassCard>

      {/* Real-time Sub-400ms Detection Gauges */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="AI Voice Likelihood"
          value={`${((telemetry.acousticFake || 0) * 100).toFixed(1)}%`}
          hint="Layer 1 · AASIST"
          alert={telemetry.acousticFake > 0.7}
        />
        <MetricCard
          label="Identity Match"
          value={`${((telemetry.bioMatch || 0) * 100).toFixed(1)}%`}
          hint="Layer 2 · ECAPA-TDNN"
          invertAlert={telemetry.bioMatch < 0.4}
        />
        <MetricCard
          label="Intent Pressure"
          value={`${((telemetry.intentScore || 0) * 100).toFixed(1)}%`}
          hint="Layer 3 · Social Eng."
          alert={telemetry.intentScore > 0.6}
        />
        <MetricCard
          label="Composite Threat"
          value={`${(telemetry.risk || 0).toFixed(1)} / 100`}
          hint="Multi-Signal Fusion"
          alert={telemetry.risk >= policy.criticalMin}
        />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
  alert = false,
  invertAlert = false,
}: {
  label: string
  value: string
  hint: string
  alert?: boolean
  invertAlert?: boolean
}) {
  const isAlerting = alert || invertAlert
  return (
    <GlassCard className={`p-4 transition-colors ${isAlerting ? 'border-red-300 bg-red-50/40' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{hint}</div>
      <div className={`mt-1.5 text-2xl font-bold tracking-tight ${isAlerting ? 'text-red-600' : 'text-neutral-900'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-neutral-600">{label}</div>
    </GlassCard>
  )
}
