import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  FileAudio,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Upload,
  UserCheck,
  UserX,
  Volume2,
} from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { useSession } from '../context/SessionContext'

type ForensicsResult = {
  filename: string
  duration_sec: number
  sample_rate: number
  acoustic_fake_probability: number
  is_fake: boolean
  verdict: string
  speaker_match: number
  is_cfo_match: boolean
  cfo_identity_match: string
  enrolled_speaker: string
  composite_risk?: number
  threat_level?: string
  fusion?: {
    risk: number
    level: string
    formula: string
    contributions: {
      acoustic: number
      biometric: number
      intent: number
    }
  }
  transcript?: string
  intent_risk?: number
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH'
  threats?: string[]
  slm_reasoning?: string
  slm_status?: string
  confidence?: number
  features: {
    f0: number
    jitter: number
    shimmer: number
    phase_discontinuity: number
    spectral_centroid: number
    rms_db: number
    is_speech: boolean
  }
  ml_models: {
    deepfake_detector: string
    speaker_verifier: string
    asr_engine?: string
    intent_agent?: string
    inference_ms: number
  }
}

export function AudioAnalysisPage() {
  const { voiceprint, policy } = useSession()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<ForensicsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (file: File) => {
    setSelectedFile(file)
    setResult(null)
    setError(null)
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setIsPlaying(false)
  }

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0])
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  // Preset demo audio generator: generates synthetic or genuine-like wav in browser
  const loadPreset = (type: 'genuine' | 'clone') => {
    setError(null)
    setResult(null)

    const sr = 16000
    const duration = 2.5
    const numSamples = Math.floor(sr * duration)
    const buffer = new ArrayBuffer(44 + numSamples * 2)
    const view = new DataView(buffer)

    // Helper to write string to DataView
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    // WAV Header
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + numSamples * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, sr, true)
    view.setUint32(28, sr * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, numSamples * 2, true)

    // Generate samples
    let offset = 44
    for (let i = 0; i < numSamples; i++) {
      const t = i / sr
      let s = 0
      if (type === 'genuine') {
        // Natural human glottal pulse with slight jitter
        const f0 = 180 + Math.sin(2 * Math.PI * 5 * t) * 6
        s = 0.5 * Math.sin(2 * Math.PI * f0 * t) +
            0.25 * Math.sin(2 * Math.PI * 2 * f0 * t) +
            0.1 * (Math.random() * 2 - 1)
      } else {
        // Synthetic deepfake: unnaturally flat pitch, high harmonic dispersion
        const f0 = 240
        s = 0.6 * Math.sin(2 * Math.PI * f0 * t) +
            0.4 * Math.sin(2 * Math.PI * 2 * f0 * t) +
            0.3 * Math.sin(2 * Math.PI * 3 * f0 * t) +
            0.2 * Math.sin(2 * Math.PI * 4 * f0 * t)
      }
      s = Math.max(-1, Math.min(1, s))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }

    const blob = new Blob([buffer], { type: 'audio/wav' })
    const filename = type === 'genuine' ? 'genuine_cfo_call.wav' : 'synthesized_deepfake_clone.wav'
    const file = new File([blob], filename, { type: 'audio/wav' })
    handleFileChange(file)
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const runAnalysis = async () => {
    if (!selectedFile) return
    setAnalyzing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/analyze-audio', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Analysis server returned ${res.status}: ${res.statusText}`)
      }

      const data: ForensicsResult = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to analyze audio file. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          <FileAudio size={14} />
          Phase 4 · Prerecorded Audio Forensics
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Detect AI-Generated Audio</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-600">
          Upload any prerecorded audio file (<code className="rounded bg-black/5 px-1 py-0.5 text-xs">.wav</code>, <code className="rounded bg-black/5 px-1 py-0.5 text-xs">.mp3</code>, <code className="rounded bg-black/5 px-1 py-0.5 text-xs">.m4a</code>) to run full forensic inspection through the **AASIST deepfake detector** and **ECAPA-TDNN speaker verification engine**.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Upload & Controls Card */}
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Audio File Input</h2>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
              isDragOver
                ? 'border-[#004ee8] bg-blue-50/50'
                : 'border-black/10 bg-white/40 hover:border-black/20 hover:bg-white/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
              className="hidden"
              onChange={onFileInputChange}
            />
            <div className="rounded-full bg-gradient-to-r from-[#004ee8]/10 to-[#00bfa5]/10 p-4 text-[#004ee8]">
              <Upload size={24} />
            </div>
            <p className="mt-3 text-sm font-medium text-neutral-800">
              {selectedFile ? selectedFile.name : 'Click to select or drag & drop audio here'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Supports WAV, MP3, M4A, FLAC, OGG (up to 25 MB)
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Or test with pre-built samples
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loadPreset('genuine')}
                className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-white"
              >
                <Sparkles size={13} className="text-emerald-600" />
                Sample Genuine Call
              </button>
              <button
                type="button"
                onClick={() => loadPreset('clone')}
                className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-white"
              >
                <Sparkles size={13} className="text-rose-600" />
                Sample Cloned Deepfake
              </button>
            </div>
          </div>

          {/* Audio Player Preview */}
          {audioUrl && (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-4">
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#004ee8] to-[#00bfa5] text-white shadow-md transition hover:scale-105"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                  <div>
                    <div className="text-sm font-medium text-neutral-900 truncate max-w-[200px] md:max-w-xs">
                      {selectedFile?.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Ready'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-400">
                  <Volume2 size={16} />
                  <span>16 kHz</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="mt-6">
            <Button
              disabled={!selectedFile || analyzing}
              onClick={runAnalysis}
              className="w-full py-3"
            >
              {analyzing ? (
                <span className="inline-flex items-center gap-2">
                  <RotateCcw size={16} className="animate-spin" />
                  Running AASIST + ECAPA-TDNN Models...
                </span>
              ) : (
                'Run AI Deepfake & Speaker Forensics'
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
        </GlassCard>

        {/* Results Card */}
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Forensic Assessment</h2>

          {analyzing && (
            <div className="mt-8 flex flex-col items-center justify-center space-y-3 py-12 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#004ee8] border-t-transparent" />
              <p className="text-sm font-medium text-neutral-700">Analyzing speech acoustics...</p>
              <p className="text-xs text-neutral-400">
                Extracting SincNet graph features & 192-D ECAPA embeddings
              </p>
            </div>
          )}

          {!analyzing && !result && (
            <div className="mt-8 flex flex-col items-center justify-center space-y-2 py-16 text-center text-neutral-400">
              <FileAudio size={40} className="text-neutral-300 stroke-[1.2]" />
              <p className="text-sm font-medium text-neutral-600">No Audio Analyzed Yet</p>
              <p className="max-w-xs text-xs text-neutral-400">
                Select an audio file or click a pre-built sample to run the deepfake and speaker verification inspection.
              </p>
            </div>
          )}

          {!analyzing && result && (
            <div className="mt-4 space-y-5">
              {/* Dual Independent Signals */}
              <div className="space-y-4">
                {/* Signal 1: Synthetic Voice Detection (AASIST) */}
                <div className="rounded-2xl border border-black/5 bg-white/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      Signal 1 · AI Voice Detection
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        result.is_fake
                          ? 'bg-red-100 text-red-700 animate-pulse'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {result.verdict}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight">
                      {Math.round(result.acoustic_fake_probability * 100)}%
                    </span>
                    <span className="text-xs text-neutral-400">
                      AASIST Graph Attention Model
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        result.is_fake
                          ? 'bg-gradient-to-r from-red-600 to-rose-500'
                          : 'bg-gradient-to-r from-[#004ee8] to-[#00bfa5]'
                      }`}
                      style={{ width: `${Math.round(result.acoustic_fake_probability * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Signal 2: Speaker Identity Match (ECAPA-TDNN) */}
                <div className="rounded-2xl border border-black/5 bg-white/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      Signal 2 · Speaker Verification
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        result.is_cfo_match
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {result.is_cfo_match ? <UserCheck size={12} /> : <UserX size={12} />}
                      {result.cfo_identity_match}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight">
                      {Math.round(result.speaker_match * 100)}%
                    </span>
                    <span className="text-xs text-neutral-400">
                      Target: {voiceprint?.name || result.enrolled_speaker}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        result.is_cfo_match
                          ? 'bg-emerald-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.round(result.speaker_match * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Signal 3: AI Intent & Social-Engineering Forensics (Meta Llama 3.2 1B) */}
                <div className="rounded-2xl border border-purple-200/80 bg-purple-50/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                      <Bot size={13} className="text-purple-600" />
                      Signal 3 · AI Intent & Social Engineering
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        (result.risk_level || 'LOW') === 'HIGH'
                          ? 'bg-red-100 text-red-700 animate-pulse'
                          : (result.risk_level || 'LOW') === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {result.risk_level || 'LOW'} INTENT RISK
                    </span>
                  </div>

                  {/* Transcribed Speech Dialogue */}
                  <div className="mt-2.5 rounded-xl border border-purple-200/60 bg-white/90 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mb-1">
                      Faster-Whisper Transcribed Speech:
                    </div>
                    <p className="text-xs italic text-neutral-800 leading-relaxed font-mono">
                      "{result.transcript || 'No vocal speech dialogue detected.'}"
                    </p>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight text-purple-950">
                      {Math.round((result.intent_risk ?? 0) * 100)}%
                    </span>
                    <span className="text-xs text-purple-600">
                      Local SLM: {result.slm_status || 'Meta Llama 3.2 1B'}
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        (result.intent_risk ?? 0) >= 0.65
                          ? 'bg-gradient-to-r from-red-600 to-rose-500'
                          : (result.intent_risk ?? 0) >= 0.30
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.round((result.intent_risk ?? 0) * 100)}%` }}
                    />
                  </div>

                  {/* Detected Tactics */}
                  {result.threats && result.threats.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-purple-200/40">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-purple-600">
                        Tactics:
                      </span>
                      {result.threats.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"
                        >
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Llama 3.2 Reasoning */}
                  {result.slm_reasoning && (
                    <div className="mt-2.5 rounded-lg border border-purple-200/80 bg-purple-50/60 p-2 text-[11px] text-purple-900 leading-relaxed">
                      <span className="font-semibold text-purple-800">🦙 Llama 3.2 Security Rationale:</span>{' '}
                      {result.slm_reasoning}
                    </div>
                  )}
                </div>
              </div>

              {/* Phase 7: Multi-Signal Risk Fusion Outcome */}
              {(() => {
                const norm = (policy.wAcoustic + policy.wBiometric + policy.wIntent) || 1.0
                const acousticContrib = result.fusion?.contributions?.acoustic ?? Math.round(((policy.wAcoustic * result.acoustic_fake_probability) / norm) * 1000) / 10
                const bioGap = Math.max(0, 1.0 - result.speaker_match)
                const bioContrib = result.fusion?.contributions?.biometric ?? Math.round(((policy.wBiometric * bioGap) / norm) * 1000) / 10
                const intentScore = result.intent_risk ?? 0
                const intentContrib = result.fusion?.contributions?.intent ?? Math.round(((policy.wIntent * intentScore) / norm) * 1000) / 10
                const calculatedRisk = result.fusion?.risk ?? Math.min(100.0, Math.max(0.0, Math.round((acousticContrib + bioContrib + intentContrib) * 10) / 10))
                const formula = result.fusion?.formula ?? `${policy.wAcoustic.toFixed(2)}*A + ${policy.wBiometric.toFixed(2)}*(1-B) + ${policy.wIntent.toFixed(2)}*I`
                const level = result.fusion?.level ?? (calculatedRisk >= policy.criticalMin ? 'critical' : calculatedRisk > policy.lowMax ? 'medium' : 'low')

                return (
                  <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 text-white shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <Cpu size={13} className="text-blue-400" />
                        Phase 7 · Multi-Signal Risk Fusion
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          level === 'critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                            : level === 'medium'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {level.toUpperCase()} THREAT
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <div className="text-xs text-neutral-400">Fused Composite Risk</div>
                        <div className="text-3xl font-extrabold font-mono text-white">
                          Risk {Math.round(calculatedRisk)}
                          <span className="text-sm font-normal text-neutral-400 ml-1.5">
                            ({calculatedRisk.toFixed(1)} / 100)
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-neutral-400 font-mono">
                        {formula}
                      </div>
                    </div>

                    {/* Multi-segment contribution bar */}
                    <div className="mt-3">
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-800 p-0.5 gap-0.5">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${Math.max(2, acousticContrib)}%` }}
                          title={`Acoustic: +${acousticContrib.toFixed(1)} pts`}
                        />
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.max(2, bioContrib)}%` }}
                          title={`Biometric Gap: +${bioContrib.toFixed(1)} pts`}
                        />
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${Math.max(2, intentContrib)}%` }}
                          title={`Intent: +${intentContrib.toFixed(1)} pts`}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                          Acoustic: +{acousticContrib.toFixed(1)} pts
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Bio Gap: +{bioContrib.toFixed(1)} pts
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                          Intent: +{intentContrib.toFixed(1)} pts
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Combined Verdict Alert */}
              <div
                className={`rounded-2xl border p-4 ${
                  result.is_fake || (result.intent_risk ?? 0) >= 0.65 || !result.is_cfo_match
                    ? 'border-red-200 bg-red-50/80 text-red-900'
                    : !result.is_fake && result.is_cfo_match && (result.intent_risk ?? 0) < 0.30
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                    : 'border-amber-200 bg-amber-50/80 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.is_fake || (result.intent_risk ?? 0) >= 0.65 ? (
                    <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={18} />
                  ) : (
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      {result.is_fake && (result.intent_risk ?? 0) >= 0.65
                        ? 'CRITICAL SECURITY THREAT: Synthetic Deepfake + Wire Fraud Attack'
                        : result.is_fake
                        ? 'CRITICAL SECURITY ALERT: Synthetic Voice Clone Detected'
                        : (result.intent_risk ?? 0) >= 0.65
                        ? 'HIGH INTENT RISK: Social-Engineering Manipulation Detected'
                        : result.is_cfo_match
                        ? 'GENUINE EXECUTIVE CONFIRMED'
                        : 'ANOMALY DETECTED'}
                    </div>
                    <p className="mt-1 text-xs leading-5 opacity-90">
                      {result.is_fake && (result.intent_risk ?? 0) >= 0.65
                        ? 'AASIST detected neural vocoder phase artifacts and Llama 3.2 flagged coercive wire transfer pressure. Payment workflows locked.'
                        : result.is_fake
                        ? 'AASIST detected neural vocoder phase artifacts and ECAPA-TDNN confirmed biometric mismatch with the enrolled executive.'
                        : (result.intent_risk ?? 0) >= 0.65
                        ? 'Llama 3.2 flagged coercive social-engineering pressure and verification bypass attempts in the conversation dialogue.'
                        : result.is_cfo_match
                        ? 'Natural physiological micro-tremors verified, biometric similarity confirmed, and conversation intent is benign.'
                        : 'Mixed forensic signals detected. Manual verification recommended.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Forensic Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-neutral-400">Pitch (F0)</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-800">
                    {result.features.f0 > 0 ? `${result.features.f0.toFixed(1)} Hz` : 'Unvoiced'}
                  </div>
                </div>
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-neutral-400">Phase Discontinuity</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-800">
                    {(result.features.phase_discontinuity * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-neutral-400">Jitter (Micro-tremor)</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-800">
                    {(result.features.jitter * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-neutral-400">Spectral Centroid</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-800">
                    {Math.round(result.features.spectral_centroid)} Hz
                  </div>
                </div>
              </div>

              {/* Model Provenance */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span className="flex items-center gap-1">
                  <Cpu size={12} />
                  AASIST + ECAPA-TDNN
                </span>
                <span>Inference: {result.ml_models.inference_ms.toFixed(1)} ms</span>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

