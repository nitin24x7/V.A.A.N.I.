import { useEffect, useRef } from 'react'

export function Waveform({
  active,
  intensity = 0.35,
  alert = false,
  data,
}: {
  active: boolean
  intensity?: number
  alert?: boolean
  data?: Float32Array | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const t = useRef(0)
  const size = useRef({ w: 300, h: 88 })
  const latestData = useRef<Float32Array | null>(null)

  useEffect(() => {
    latestData.current = data || null
  }, [data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const { w: width, h: height } = size.current
      ctx.clearRect(0, 0, width, height)
      const bars = 56
      const gap = 3
      const barW = Math.max(2, (width - gap * (bars - 1)) / bars)
      t.current += active ? 0.085 : 0.012

      const micData = latestData.current

      for (let i = 0; i < bars; i++) {
        let h = 4

        if (active && micData && micData.length > 0) {
          // Sample actual microphone audio waveform
          const sampleIndex = Math.floor((i / bars) * micData.length)
          const sampleVal = Math.abs(micData[sampleIndex] || 0)
          h = Math.max(4, Math.min(height, sampleVal * height * 2.8 + 6))
        } else {
          // Synthetic ambient animation
          const n =
            Math.sin(t.current + i * 0.22) * 0.45 +
            Math.sin(t.current * 1.7 + i * 0.09) * 0.35 +
            Math.sin(i * 0.8) * 0.12
          const amp = active ? Math.max(0.08, intensity) : 0.08
          h = Math.max(4, Math.abs(n) * height * amp * 1.6 + (active ? 6 : 3))
        }

        const x = i * (barW + gap)
        const y = (height - h) / 2

        if (alert) {
          ctx.fillStyle = 'rgba(214,31,58,0.85)'
        } else if (active && micData) {
          // Matching brand gradient colors for active live mic
          const grad = ctx.createLinearGradient(0, y, 0, y + h)
          grad.addColorStop(0, '#004ee8')
          grad.addColorStop(1, '#00bfa5')
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = active ? 'rgba(0, 78, 232, 0.75)' : 'rgba(10,10,10,0.6)'
        }

        ctx.beginPath()
        ctx.roundRect(x, y, barW, h, 3)
        ctx.fill()
      }
      raf.current = requestAnimationFrame(draw)
    }

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      size.current = { w, h }
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener('resize', resize)
    }
  }, [active, intensity, alert])

  return <canvas ref={canvasRef} className="h-full w-full" />
}
