import { useState, useEffect } from 'react'
import {
  Radio,
  PhoneCall,
  Server,
  Smartphone,
  Cpu,
  CheckCircle2,
  Play,
  RefreshCw,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'

interface SourceMetadata {
  id: string
  name: string
  protocol: string
  sample_rate: string
  codecs?: string[]
  latency: string
  status: string
  packets_processed: number
  description: string
  dropped_packets?: number
}

interface TestPacketResult {
  source: string
  samples_decoded: number
  duration_ms: number
  target_sample_rate: number
  metadata: any
}

export function SourcesPage() {
  const { source, startCall, live, stopCall, isMicActive, micRmsDb, backendConnected } = useSession()

  const [sourcesStatus, setSourcesStatus] = useState<SourceMetadata[]>([])
  const [testingSource, setTestingSource] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestPacketResult | null>(null)
  const [loadingSources, setLoadingSources] = useState(false)

  const fetchSources = async () => {
    try {
      setLoadingSources(true)
      const res = await fetch('/api/ingestion/sources')
      if (res.ok) {
        const data = await res.json()
        setSourcesStatus(data.sources || [])
      }
    } catch (e) {
      console.warn('Could not fetch ingestion sources:', e)
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    fetchSources()
  }, [])

  const handleTestPacket = async (sourceId: string) => {
    setTestingSource(sourceId)
    setTestResult(null)
    try {
      const res = await fetch('/api/ingestion/test-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceId, sample_count: 160 }),
      })
      if (res.ok) {
        const data = await res.json()
        setTestResult(data)
        fetchSources() // refresh packet counters
      }
    } catch (err) {
      console.error('Packet test failed:', err)
    } finally {
      setTestingSource(null)
    }
  }

  const getSourceIcon = (id: string) => {
    switch (id) {
      case 'webrtc':
        return Radio
      case 'sip':
        return Server
      case 'gateway':
        return PhoneCall
      case 'sdk':
        return Smartphone
      default:
        return Cpu
    }
  }

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 font-semibold">
              Phase 11 · Multi-Source Architecture Ingestion Fabric
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
              Universal Telephony & Audio Ingestion Fabric
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              VAANI accepts live audio from diverse enterprise protocols: Browser WebRTC, SIP / RTP telephony PBXs (FreeSWITCH / Asterisk), Cloud Telephony Gateways (Twilio / Exotel MediaStreams), and In-Call Security SDKs.
              All streams are normalized into a unified <strong>16 kHz float32 ring buffer</strong> for real-time acoustic forensics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSources}
              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
              title="Refresh source adapters"
            >
              <RefreshCw size={13} className={loadingSources ? 'animate-spin' : ''} />
              Refresh
            </button>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                backendConnected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {backendConnected ? 'FastAPI Ingestion Engine Active' : 'Backend Standby'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* 4 Multi-Source Ingestion Adapters */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            id: 'webrtc',
            name: 'Browser / WebRTC',
            protocol: 'WebRTC MediaStream',
            sampleRate: '16 kHz Mono PCM',
            latency: '< 25 ms',
            desc: 'Direct browser microphone and tab capture. Streams raw 16-bit PCM over WebSockets.',
            type: 'Live Ingestion',
          },
          {
            id: 'sip',
            name: 'SIP / RTP PBX Trunk',
            protocol: 'RFC 3550 RTP Stream',
            sampleRate: '8 kHz G.711 → 16 kHz',
            latency: '< 35 ms',
            desc: 'Carrier & enterprise PBX (Asterisk / FreeSWITCH). Decodes G.711 μ-law/A-law payloads.',
            type: 'VoIP Telephony',
          },
          {
            id: 'gateway',
            name: 'Telephony Gateway',
            protocol: 'Twilio / Exotel JSON Stream',
            sampleRate: '8 kHz base64 → 16 kHz',
            latency: '< 45 ms',
            desc: 'Cloud telephony media stream webhooks with base64 audio unpacking.',
            type: 'Cloud PSTN',
          },
          {
            id: 'sdk',
            name: 'In-Call Security SDK',
            protocol: 'Enterprise SDK Channel',
            sampleRate: '16 kHz Linear PCM',
            latency: '< 20 ms',
            desc: 'Embedded client SDK for mobile and enterprise applications with session handshake.',
            type: 'Mobile Client',
          },
        ].map((s) => {
          const Icon = getSourceIcon(s.id)
          const liveSourceActive = live && source === s.id

          return (
            <GlassCard key={s.id} className={`p-5 flex flex-col justify-between transition-all ${liveSourceActive ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}>
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-xs">
                    <Icon size={18} />
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                    {s.type}
                  </span>
                </div>

                <h3 className="mt-3.5 text-base font-bold text-neutral-900">{s.name}</h3>
                <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{s.desc}</p>

                <div className="mt-3.5 space-y-1.5 border-t border-neutral-200/60 pt-3 text-[11px]">
                  <div className="flex justify-between text-neutral-600">
                    <span className="text-neutral-400">Protocol:</span>
                    <span className="font-mono font-medium text-neutral-800">{s.protocol}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span className="text-neutral-400">Sample Rate:</span>
                    <span className="font-medium text-neutral-800">{s.sampleRate}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span className="text-neutral-400">Ingest Latency:</span>
                    <span className="font-mono font-semibold text-emerald-600">{s.latency}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span className="text-neutral-400">Packets Ingested:</span>
                    <span className="font-mono font-semibold text-neutral-900">
                      {sourcesStatus.find((src) => src.id === s.id)?.packets_processed ?? 0}
                    </span>
                  </div>
                  {s.id === 'webrtc' && live && isMicActive && (
                    <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                      <span>Live Mic RMS:</span>
                      <span>{Math.round(micRmsDb)} dB</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {s.id === 'webrtc' ? (
                  live ? (
                    <Button variant="ghost" onClick={stopCall} className="w-full text-xs">
                      Disconnect Mic
                    </Button>
                  ) : (
                    <Button onClick={() => startCall('webrtc')} className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white">
                      Connect Live Mic
                    </Button>
                  )
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => handleTestPacket(s.id)}
                    disabled={testingSource === s.id}
                    className="w-full text-xs flex items-center justify-center gap-1.5 border border-neutral-200"
                  >
                    <Play size={12} className={testingSource === s.id ? 'animate-spin' : ''} />
                    {testingSource === s.id ? 'Simulating...' : `Simulate ${s.id.toUpperCase()} Packet`}
                  </Button>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>

      {/* Interactive Ingestion & Protocol Normalization Inspector */}
      {testResult && (
        <GlassCard className="p-5 border-blue-200 bg-blue-50/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 uppercase tracking-wider">
            <CheckCircle2 size={16} className="text-blue-600" />
            <span>Protocol Normalization Verified: {testResult.source.toUpperCase()}</span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-lg bg-white p-3 border border-blue-100">
              <div className="text-neutral-400">Decoded Samples</div>
              <div className="mt-0.5 text-base font-bold text-neutral-900">{testResult.samples_decoded} samples</div>
            </div>
            <div className="rounded-lg bg-white p-3 border border-blue-100">
              <div className="text-neutral-400">Packet Duration</div>
              <div className="mt-0.5 text-base font-bold text-neutral-900">{testResult.duration_ms} ms</div>
            </div>
            <div className="rounded-lg bg-white p-3 border border-blue-100">
              <div className="text-neutral-400">Normalized Rate</div>
              <div className="mt-0.5 text-base font-bold text-emerald-600">{testResult.target_sample_rate} Hz (Float32)</div>
            </div>
            <div className="rounded-lg bg-white p-3 border border-blue-100">
              <div className="text-neutral-400">Detected Codec</div>
              <div className="mt-0.5 text-xs font-mono font-semibold text-purple-700">
                {testResult.metadata?.codec || testResult.metadata?.format || 'Linear PCM'}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-white p-3 border border-blue-100">
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Protocol Unpack Metadata:</div>
            <pre className="mt-1 text-[11px] font-mono text-neutral-800 overflow-x-auto">
              {JSON.stringify(testResult.metadata, null, 2)}
            </pre>
          </div>
        </GlassCard>
      )}

      {/* Architecture Routing Pipeline Diagram */}
      <GlassCard className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Architecture Routing Flow
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4 text-center text-xs">
          <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
            <div className="font-bold text-neutral-800">1. Protocol Ingestion</div>
            <div className="mt-1 text-neutral-500">WebRTC / SIP / Gateway / SDK</div>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
            <div className="font-bold text-neutral-800">2. Normalization Engine</div>
            <div className="mt-1 text-neutral-500">G.711 Unpack → 16kHz Float32</div>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
            <div className="font-bold text-neutral-800">3. Forensic Ring Buffer</div>
            <div className="mt-1 text-neutral-500">1.0s Window · 0.25s Stride</div>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
            <div className="font-bold text-neutral-800">4. Neural Forensics & Alert</div>
            <div className="mt-1 text-neutral-500">AASIST + ECAPA + Intent Warn</div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
