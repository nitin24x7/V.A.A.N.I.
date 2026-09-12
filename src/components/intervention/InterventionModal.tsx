import { useSession } from '../../context/SessionContext'
import {
  AlertTriangle,
  PhoneCall,
  ShieldAlert,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export function InterventionModal() {
  const { activeIntervention, dismissIntervention } = useSession()

  if (!activeIntervention) return null

  const { signals, threatScore, guidance, verificationProtocols, incidentId } = activeIntervention

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-red-500/40 bg-neutral-950 p-6 md:p-8 text-neutral-100 shadow-2xl shadow-red-950/60 ring-1 ring-red-500/30">
        {/* Pulsing Alert Top Bar */}
        <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-600"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-400">
              Autonomous Threat Interception
            </span>
          </div>
          {incidentId && (
            <span className="font-mono text-xs text-neutral-400 bg-neutral-900 px-2.5 py-0.5 rounded-full border border-neutral-800">
              {incidentId}
            </span>
          )}
        </div>

        {/* Header matching exact user spec */}
        <div className="mt-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>🚨</span>
            <span>CRITICAL IMPERSONATION DETECTED</span>
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            Backend Risk Engine identified a coordinated synthetic voice attack.
          </p>
        </div>

        {/* 3 Intelligence Signals Breakdown */}
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 space-y-3 font-mono">
          {/* Signal 1: AI Voice */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-300 font-medium font-sans">AI Voice:</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${signals.aiVoice}%` }}
                />
              </div>
              <span className="font-bold text-red-400 text-base">{signals.aiVoice}%</span>
            </div>
          </div>

          {/* Signal 2: Identity Match */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-300 font-medium font-sans">Identity Match:</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${signals.identityMatch}%` }}
                />
              </div>
              <span className="font-bold text-amber-400 text-base">{signals.identityMatch}%</span>
            </div>
          </div>

          {/* Signal 3: Intent Risk */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-300 font-medium font-sans">Intent Risk:</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${signals.intentRisk}%` }}
                />
              </div>
              <span className="font-bold text-red-400 text-base">{signals.intentRisk}%</span>
            </div>
          </div>
        </div>

        {/* Threat Score Highlight */}
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-gradient-to-r from-red-950/80 to-neutral-900 border border-red-500/40 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-red-400">
              Autonomous Fused Severity
            </div>
            <div className="text-xs text-neutral-400 mt-0.5">Threshold: 70/100 (CRITICAL)</div>
          </div>
          <div className="text-right">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mr-2">
              Threat Score:
            </span>
            <span className="text-3xl font-black text-red-400">{threatScore}/100</span>
          </div>
        </div>

        {/* High-Threat Caller Warning Notice */}
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/40 p-4">
          <div className="flex items-center gap-2.5 text-red-400 font-bold text-sm tracking-wide uppercase">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <span>High-Risk Caller Warning</span>
          </div>
          <p className="mt-2 text-xs text-neutral-300 leading-relaxed">
            Autonomous threat detection identified abnormal voice synthesis and spoofing indicators.
            Do <strong className="text-red-300 font-bold underline decoration-red-500/60">NOT</strong> trust caller claims, share confidential data, or follow verbal instructions given on this call.
          </p>
        </div>

        {/* Out-of-band Verification Guidance */}
        <div className="mt-4 rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
          <div className="flex items-start gap-3">
            <PhoneCall className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-white">
                {guidance || 'Verify caller through another channel.'}
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-neutral-400">
                {verificationProtocols && verificationProtocols.length > 0 ? (
                  verificationProtocols.map((protocol, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{protocol}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Call back the executive or caller on their verified registered enterprise phone number.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Confirm identity through direct official communication channels before proceeding.</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Operator Controls */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-800">
          <Link
            to="/analyze"
            onClick={dismissIntervention}
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>View Forensics Lab</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          <button
            type="button"
            onClick={dismissIntervention}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 px-5 py-2.5 text-xs font-semibold text-white transition-colors border border-neutral-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-neutral-400" />
            <span>Acknowledge & Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  )
}
