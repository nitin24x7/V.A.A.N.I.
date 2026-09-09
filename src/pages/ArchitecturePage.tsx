import { GlassCard } from '../components/ui/GlassCard'

const stages = [
  {
    title: 'Ingest',
    items: ['WebRTC / SIP / SDK', 'PCM 8 kHz or 16 kHz', 'Zero-copy ring buffer'],
  },
  {
    title: 'Preprocess',
    items: ['G.711 equalizer', '3.4 kHz band-limit', 'Silero VAD'],
  },
  {
    title: 'Workers',
    items: ['AASIST / RawNet3', 'ECAPA-TDNN', 'Whisper + SLM'],
  },
  {
    title: 'Act',
    items: ['Fused risk JSON', 'CRM banner / CTA lock', 'SIEM + OOB push'],
  },
]

export function ArchitecturePage() {
  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold tracking-tight">End-to-end interception path</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          This console is the frontline layer. Backend inference (FastAPI, Redis pub/sub, ONNX INT8)
          can replace the in-browser simulator without changing the UI contracts.
        </p>
      </GlassCard>
      <div className="grid gap-4 md:grid-cols-4">
        {stages.map((s, i) => (
          <GlassCard key={s.title} className="p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
              0{i + 1}
            </div>
            <h3 className="mt-2 text-[15px] font-semibold">{s.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="p-6">
        <h3 className="text-[15px] font-semibold">Edge Cases & Threat Hardening</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <p className="text-sm leading-6 text-neutral-600">
            <strong className="text-neutral-900">8 kHz telephony.</strong> Augment with u-law, packet
            loss, and AMR-NB so vocoder detectors do not collapse on PSTN audio.
          </p>
          <p className="text-sm leading-6 text-neutral-600">
            <strong className="text-neutral-900">Code-switching.</strong> WavLM / XLSR acoustic
            features stay language-agnostic across Hinglish and Indic TTS.
          </p>
          <p className="text-sm leading-6 text-neutral-600">
            <strong className="text-neutral-900">DPDP / GDPR.</strong> Transient RAM only. Quantized
            on-device path keeps embeddings inside the enterprise boundary.
          </p>
        </div>
      </GlassCard>
    </div>
  )
}
