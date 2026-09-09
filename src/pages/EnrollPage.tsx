import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { audioService } from '../lib/audioService'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'
import { Waveform } from '../components/ui/Waveform'

export function EnrollPage() {
  const { voiceprint, enroll, clearEnrollment } = useSession()
  const [name, setName] = useState('Aditi Sharma')
  const [role, setRole] = useState('Managing Director / CFO')
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [enrollWaveData, setEnrollWaveData] = useState<Float32Array | null>(null)
  const [enrollDb, setEnrollDb] = useState(-100)
  const navigate = useNavigate()

  const start = async () => {
    if (recording) return
    setRecording(true)
    setProgress(0)

    // Start audio stream & buffer accumulation
    audioService.startEnrollmentRecording()
    await audioService.startStream(
      () => {},
      (waveData: Float32Array, rmsDb: number) => {
        setEnrollWaveData(new Float32Array(waveData))
        setEnrollDb(rmsDb)
      }
    )

    const started = Date.now()
    const id = window.setInterval(async () => {
      const p = Math.min(100, ((Date.now() - started) / 15000) * 100)
      setProgress(p)
      if (p >= 100) {
        window.clearInterval(id)
        setRecording(false)
        const recordedSamples = audioService.stopEnrollmentRecording()
        audioService.stopStream()
        setEnrollWaveData(null)
        setEnrollDb(-100)
        await enroll(name, role, 15, recordedSamples)
      }
    }, 80)
  }

  const handleStopEarly = async () => {
    if (!recording) return
    setRecording(false)
    const recordedSamples = audioService.stopEnrollmentRecording()
    audioService.stopStream()
    setEnrollWaveData(null)
    setEnrollDb(-100)
    await enroll(name, role, Math.round(progress * 0.15), recordedSamples)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Enroll genuine voiceprint</h2>
          {recording && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Recording Mic ({Math.round(enrollDb)} dB)
            </span>
          )}
        </div>
        <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-600">
          Capture a 15-second sample. VAANI derives a 192-d ECAPA-TDNN embedding and stores only the
          vector — never the waveform — for continuous speaker verification.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-[12px] font-medium text-neutral-500">
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-black/40"
            />
          </label>
          <label className="text-[12px] font-medium text-neutral-500">
            Role
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-black/40"
            />
          </label>
        </div>
        <div className="mt-6 h-28 overflow-hidden rounded-2xl bg-white/50">
          <Waveform active={recording} intensity={recording ? 0.7 : 0.12} data={enrollWaveData} />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full bg-gradient-to-r from-[#004ee8] to-[#00bfa5] transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {!recording ? (
            <Button onClick={start}>
              Record with microphone (15s)
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleStopEarly}>
              Finish & save voiceprint early
            </Button>
          )}
          {voiceprint && !recording && (
            <Button variant="ghost" onClick={clearEnrollment}>
              Clear voiceprint
            </Button>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-6 md:p-8">
        <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Vault status</div>
        {voiceprint ? (
          <div className="mt-4 space-y-4">
            <div className="text-xl font-semibold">{voiceprint.name}</div>
            <div className="text-sm text-neutral-600">{voiceprint.role}</div>
            <div className="text-[12px] text-neutral-500">
              Enrolled {new Date(voiceprint.enrolledAt).toLocaleString()} · {voiceprint.durationSec}s
            </div>
            <div className="grid grid-cols-8 gap-1 pt-2">
              {voiceprint.embeddingPreview.map((v, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-black/80"
                  style={{ opacity: 0.25 + Math.abs(v) * 0.75 }}
                  title={String(v)}
                />
              ))}
            </div>
            <p className="text-[12px] text-neutral-500">Embedding preview (24 of 192 dimensions)</p>
            <Button onClick={() => navigate('/call')}>Continue to live call</Button>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-neutral-600">
            No executive voiceprint enrolled yet. Capture a genuine voice sample to enable real-time
            speaker verification and deepfake interception.
          </p>
        )}
      </GlassCard>
    </div>
  )
}
