import { useState, useCallback } from 'react'
import { Upload, Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

/* ── Types ──────────────────────────────────────────────────────────── */

interface ConditionResult {
  name: string
  fake_probability: number
  trust_score: number
  rating: string
  inference_ms: number
}

interface RobustnessResult {
  duration_sec: number
  conditions: ConditionResult[]
  summary: {
    all_detected: boolean
    min_fake_prob: number
    max_fake_prob: number
    mean_fake_prob: number
    robust: boolean
  }
}

/* ── Rating Helpers ─────────────────────────────────────────────────── */

function ratingColor(rating: string) {
  switch (rating) {
    case 'CRITICAL': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', bar: '#ef4444' }
    case 'SUSPICIOUS': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', bar: '#f59e0b' }
    case 'TRUSTED': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: '#10b981' }
    default: return { bg: 'bg-neutral-50', border: 'border-neutral-200', text: 'text-neutral-700', bar: '#6b7280' }
  }
}

function RatingBadge({ rating }: { rating: string }) {
  const c = ratingColor(rating)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text} ${c.border} border`}>
      {rating === 'CRITICAL' && <ShieldAlert size={12} />}
      {rating === 'SUSPICIOUS' && <AlertTriangle size={12} />}
      {rating === 'TRUSTED' && <ShieldCheck size={12} />}
      {rating}
    </span>
  )
}

/* ── Main Page ──────────────────────────────────────────────────────── */

export function TelephonyRobustnessPage() {
  const [result, setResult] = useState<RobustnessResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const analyze = useCallback(async (file: File) => {
    setLoading(true)
    setError('')
    setFileName(file.name)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/telephony-robustness', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Analysis failed')
      }
      const data: RobustnessResult = await res.json()
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) analyze(file)
  }, [analyze])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) analyze(file)
  }, [analyze])

  /* Chart data */
  const chartData = result?.conditions.map(c => ({
    name: c.name.length > 16 ? c.name.slice(0, 14) + '…' : c.name,
    fullName: c.name,
    fake: Math.round(c.fake_probability * 100),
    rating: c.rating,
  })) ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 shadow-lg">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Telephony Robustness</h1>
          <p className="text-[13px] text-neutral-500">
            Evaluate deepfake detection under real-world telephony degradation conditions
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all
          ${dragOver
            ? 'border-blue-400 bg-blue-50/50'
            : 'border-neutral-200 bg-white/60 hover:border-neutral-300 hover:bg-white/80'
          }`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm text-neutral-600">
              Running 7 degradation transforms on <span className="font-medium">{fileName}</span>…
            </p>
            <p className="text-xs text-neutral-400">This may take 10–30 seconds depending on audio length</p>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-3">
            <Upload size={28} className="text-neutral-400" />
            <p className="text-sm text-neutral-600">
              Drop an audio file here or <span className="font-medium text-blue-600">browse</span>
            </p>
            <p className="text-xs text-neutral-400">WAV, MP3, M4A, FLAC — any format</p>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={onFileSelect}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <div className={`rounded-2xl border p-5 ${
            result.summary.robust
              ? 'border-emerald-200 bg-emerald-50/60'
              : 'border-amber-200 bg-amber-50/60'
          }`}>
            <div className="flex items-start gap-3">
              {result.summary.robust ? (
                <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle size={24} className="mt-0.5 shrink-0 text-amber-600" />
              )}
              <div>
                <h2 className="font-semibold">
                  {result.summary.robust
                    ? '✅ ROBUST — Detected across all telephony conditions'
                    : '⚠ DEGRADED — Detection weakened under some conditions'
                  }
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Audio duration: <span className="font-medium">{result.duration_sec}s</span> ·
                  Fake probability range: <span className="font-medium">
                    {Math.round(result.summary.min_fake_prob * 100)}%
                  </span> – <span className="font-medium">
                    {Math.round(result.summary.max_fake_prob * 100)}%
                  </span> ·
                  Mean: <span className="font-medium">
                    {Math.round(result.summary.mean_fake_prob * 100)}%
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-700">
              Fake Probability by Condition
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Fake Probability']}
                  labelFormatter={(_label, payload) => {
                    const entry = payload?.[0]?.payload as Record<string, unknown> | undefined
                    return (entry?.fullName as string) ?? ''
                  }}
                />
                <Bar dataKey="fake" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={ratingColor(entry.rating).bar} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Results Table */}
          <div className="rounded-2xl border border-neutral-200 bg-white/80 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Condition
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Fake Prob
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Trust Score
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Rating
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Latency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {result.conditions.map((c, i) => {
                  const colors = ratingColor(c.rating)
                  return (
                    <tr key={i} className={`transition-colors hover:bg-neutral-50/60 ${colors.bg}`}>
                      <td className="px-5 py-3 font-medium text-neutral-800">{c.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-neutral-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.round(c.fake_probability * 100)}%`,
                                backgroundColor: ratingColor(c.rating).bar,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-neutral-600">
                            {Math.round(c.fake_probability * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium">{c.trust_score}</td>
                      <td className="px-5 py-3"><RatingBadge rating={c.rating} /></td>
                      <td className="px-5 py-3 text-right text-xs text-neutral-500">{c.inference_ms} ms</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> CRITICAL (Trust &lt; 40)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> SUSPICIOUS (Trust 40–70)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> TRUSTED (Trust &gt; 70)
            </span>
          </div>
        </>
      )}
    </div>
  )
}
