import { Radio } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import type { IngestSource } from '../types'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'

const sources: { id: IngestSource; title: string; copy: string }[] = [
  {
    id: 'webrtc',
    title: 'System Microphone / WebRTC',
    copy: 'Live microphone input via browser MediaStream. Captures 16-bit 16 kHz PCM and streams directly to FastAPI backend over WebSockets.',
  },
  {
    id: 'sip',
    title: 'SIP Trunk / PBX (RTP)',
    copy: 'FreeSWITCH or Asterisk RTP telephony audio stream. Equalized for G.711 and 8 kHz narrowband.',
  },
  {
    id: 'sdk',
    title: 'Mobile / Banking App In-Call SDK',
    copy: 'In-call capture from enterprise mobile applications. Edge INT8 inference, zero raw audio persistence.',
  },
]

export function SourcesPage() {
  const { source, startCall, live, stopCall, isMicActive, micRmsDb, backendConnected } = useSession()

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Audio ingestion fabric</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              All audio sources terminate on the streaming proxy: 1.0 s zero-copy ring buffer, 0.25 s
              stride, telephony bandpass equalizer, and Silero VAD before acoustic forensics and
              biometric verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                backendConnected
                  ? 'bg-emerald-500/15 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {backendConnected ? 'Backend Online (Port 8000)' : 'Backend Standby'}
            </span>
          </div>
        </div>
      </GlassCard>
      <div className="grid gap-4 md:grid-cols-3">
        {sources.map((s) => (
          <GlassCard key={s.id} className="p-6" strong={source === s.id && live}>
            <div className="flex items-center justify-between">
              <Radio size={18} />
              {live && source === s.id && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {s.id === 'webrtc' && isMicActive ? `Mic Active (${Math.round(micRmsDb)} dB)` : 'Streaming'}
                </span>
              )}
            </div>
            <h3 className="mt-3 text-[15px] font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{s.copy}</p>
            <div className="mt-5">
              {live && source === s.id ? (
                <Button variant="ghost" onClick={stopCall}>
                  Disconnect source
                </Button>
              ) : (
                <Button onClick={() => startCall(s.id)}>
                  {s.id === 'webrtc' ? 'Connect Microphone' : 'Attach source'}
                </Button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
