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

      // Calculate instantaneous root-mean-square to detect true speech vs room silence
      let localRms = 0
      if (active && micData && micData.length > 0) {
        let sum = 0
        for (let j = 0; j < micData.length; j++) {
          sum += micData[j] * micData[j]
        }
        localRms = Math.sqrt(sum / micData.length)
      }

      // Voice activity threshold: ambient room noise typically sits below 0.009 (~ -41 dB)
      const hasSpeechEnergy = active && localRms >= 0.009
      const voiceEnergy = hasSpeechEnergy ? Math.min(1.0, (localRms - 0.009) * 5.5) : 0.0

      for (let i = 0; i < bars; i++) {
        let h = 3.5

        if (active && micData && micData.length > 0) {
          if (!hasSpeechEnergy) {
            // Ambient quiet / silence: clean resting flatline with tiny breathing micro-movement
            const micro = Math.sin(t.current * 0.5 + i * 0.2) * 0.4
            h = Math.max(3, 3.5 + micro)
          } else {
            // Real speech detected: average a frequency/temporal window to avoid single-sample spikes
            const chunkStart = Math.floor((i / bars) * micData.length)
            const chunkSize = Math.max(1, Math.floor(micData.length / bars))
            let chunkSum = 0
            for (let c = 0; c < chunkSize; c++) {
              chunkSum += Math.abs(micData[Math.min(micData.length - 1, chunkStart + c)] || 0)
            }
            const barVal = chunkSum / chunkSize
            const dynamicScale = barVal * (height * 0.85) * voiceEnergy
            h = Math.max(3.5, Math.min(height - 4, 3.5 + dynamicScale + (voiceEnergy * 8)))
          }
        } else if (active) {
          // Streaming active but waiting for packets: clean flatline
          h = 3.5
        } else {
          // Idle standby mode: subtle gentle ambient breathe (3px - 7px)
          const n = Math.sin(t.current + i * 0.2) * 0.5 + 0.5
          h = 3 + n * 4
        }

        const x = i * (barW + gap)
        const y = (height - h) / 2

        if (alert) {
          ctx.fillStyle = 'rgba(214,31,58,0.85)'
        } else if (hasSpeechEnergy) {
          // Dynamic brand gradient when user is actively speaking
          const grad = ctx.createLinearGradient(0, y, 0, y + h)
          grad.addColorStop(0, '#004ee8')
          grad.addColorStop(1, '#00bfa5')
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = active ? 'rgba(0, 78, 232, 0.45)' : 'rgba(10,10,10,0.3)'
        }

        ctx.beginPath()
        ctx.roundRect(x, y, barW, h, 2)
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
