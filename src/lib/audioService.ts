import type { Telemetry } from '../types'

export type AudioTelemetryCallback = (telemetry: Partial<Telemetry> & { rawData?: any }) => void
export type WaveformCallback = (data: Float32Array, rmsDb: number) => void

class AudioIngestionService {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyserNode: AnalyserNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private socket: WebSocket | null = null
  private isStreaming: boolean = false
  private onTelemetryCallback: AudioTelemetryCallback | null = null
  private onWaveformCallback: WaveformCallback | null = null
  private animFrameId: number | null = null
  private recordingBuffer: number[] = []
  private isRecordingForEnroll: boolean = false

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN
  }

  public getIsStreaming(): boolean {
    return this.isStreaming
  }

  public async startStream(
    onTelemetry: AudioTelemetryCallback,
    onWaveform?: WaveformCallback
  ): Promise<boolean> {
    if (this.isStreaming) return true

    this.onTelemetryCallback = onTelemetry
    this.onWaveformCallback = onWaveform || null

    try {
      // 1. Request microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      })

      // 2. Setup Web Audio API pipeline
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new AudioCtx({ sampleRate: 16000 })
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
      
      // Analyser for real-time waveform visualization
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0.6
      this.sourceNode.connect(this.analyserNode)

      // ScriptProcessor to capture PCM frames
      // Buffer size 2048 at 16kHz is ~128ms per packet
      const bufferSize = 2048
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

      // Connect to WebSocket backend
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/audio`
      
      this.connectWebSocket(wsUrl)

      // Audio processing hook
      this.processorNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        
        // If recording for enrollment, accumulate
        if (this.isRecordingForEnroll) {
          for (let i = 0; i < inputData.length; i++) {
            this.recordingBuffer.push(inputData[i])
          }
        }

        // Convert Float32 to 16-bit PCM
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          const pcm16 = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          this.socket.send(pcm16.buffer)
        }
      }

      this.sourceNode.connect(this.processorNode)
      this.processorNode.connect(this.audioContext.destination)

      this.isStreaming = true
      this.startWaveformLoop()

      return true
    } catch (err) {
      console.error('Failed to start microphone audio ingestion:', err)
      this.stopStream()
      return false
    }
  }

  private connectWebSocket(wsUrl: string) {
    try {
      this.socket = new WebSocket(wsUrl)
      this.socket.binaryType = 'arraybuffer'

      this.socket.onopen = () => {
        console.log('Connected to VAANI Audio Ingestion WebSocket at', wsUrl)
      }

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'telemetry' && this.onTelemetryCallback) {
            this.onTelemetryCallback({
              risk: data.risk,
              acousticFake: data.acousticFake,
              bioMatch: data.bioMatch,
              intentScore: data.intentScore,
              latencyMs: data.latencyMs,
              rawData: data,
            })
          }
        } catch (e) {
          console.warn('Error parsing telemetry frame:', e)
        }
      }

      this.socket.onerror = (err) => {
        console.warn('VAANI WebSocket error (falling back to direct local analysis):', err)
      }

      this.socket.onclose = () => {
        console.log('VAANI Audio WebSocket closed')
      }
    } catch (e) {
      console.warn('WebSocket connection failed:', e)
    }
  }

  public setMode(mode: 'legitimate' | 'attack') {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ command: 'set_mode', mode }))
    }
  }

  public setSource(source: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ command: 'set_source', source }))
    }
  }

  public startEnrollmentRecording() {
    this.recordingBuffer = []
    this.isRecordingForEnroll = true
  }

  public stopEnrollmentRecording(): number[] {
    this.isRecordingForEnroll = false
    const copy = [...this.recordingBuffer]
    this.recordingBuffer = []
    return copy
  }

  private startWaveformLoop() {
    const dataArray = new Float32Array(this.analyserNode?.frequencyBinCount || 128)

    const tick = () => {
      if (!this.isStreaming || !this.analyserNode) return

      this.analyserNode.getFloatTimeDomainData(dataArray)

      // Calculate instantaneous RMS dB
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / dataArray.length)
      const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100

      if (this.onWaveformCallback) {
        this.onWaveformCallback(dataArray, rmsDb)
      }

      this.animFrameId = requestAnimationFrame(tick)
    }

    this.animFrameId = requestAnimationFrame(tick)
  }

  public stopStream() {
    this.isStreaming = false

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect()
      this.analyserNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close()
      }
      this.socket = null
    }
  }
}

export const audioService = new AudioIngestionService()
