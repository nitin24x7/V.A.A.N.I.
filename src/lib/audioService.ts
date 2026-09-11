import type { AudioIngestMode, Policy, SessionSummary, Telemetry } from '../types'

export type AudioTelemetryCallback = (telemetry: Partial<Telemetry> & { rawData?: any }) => void
export type WaveformCallback = (data: Float32Array, rmsDb: number) => void

class AudioIngestionService {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private displayStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private tabSourceNode: MediaStreamAudioSourceNode | null = null
  private mixerNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private socket: WebSocket | null = null
  private isStreaming: boolean = false
  private onTelemetryCallback: AudioTelemetryCallback | null = null
  private onWaveformCallback: WaveformCallback | null = null
  private onSessionSummaryCallback: ((summary: SessionSummary) => void) | null = null
  private animFrameId: number | null = null
  private recordingBuffer: number[] = []
  private isRecordingForEnroll: boolean = false
  private speechRecognizer: any = null
  private sessionStartTime: number = 0
  private currentIngestMode: AudioIngestMode = 'mic'

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN
  }

  public getIsStreaming(): boolean {
    return this.isStreaming
  }

  public getIngestMode(): AudioIngestMode {
    return this.currentIngestMode
  }

  public getSessionDuration(): number {
    if (!this.sessionStartTime) return 0
    return Math.round((Date.now() - this.sessionStartTime) / 1000)
  }

  public async startStream(
    onTelemetry: AudioTelemetryCallback,
    onWaveform?: WaveformCallback,
    ingestMode: AudioIngestMode = 'mic',
    onSessionSummary?: (summary: SessionSummary) => void
  ): Promise<boolean> {
    if (this.isStreaming) return true

    this.onTelemetryCallback = onTelemetry
    this.onWaveformCallback = onWaveform || null
    this.onSessionSummaryCallback = onSessionSummary || null
    this.currentIngestMode = ingestMode
    this.sessionStartTime = Date.now()

    try {
      // 1. Acquire audio streams depending on ingestMode:
      // - 'mic': local hardware microphone
      // - 'tab': Google Meet / browser tab audio (via getDisplayMedia)
      // - 'dual': local mic + tab audio mixed together
      if (ingestMode === 'mic' || ingestMode === 'dual') {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        })
      }

      if (ingestMode === 'tab' || ingestMode === 'dual') {
        try {
          this.displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          })
        } catch (err) {
          console.warn('Tab audio sharing cancelled or unavailable:', err)
          if (ingestMode === 'tab') {
            throw new Error('Google Meet / Tab audio capture was not granted.')
          }
        }
      }

      // 2. Setup Web Audio API pipeline
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new AudioCtx({ sampleRate: 16000 })

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Master mixer node
      this.mixerNode = this.audioContext.createGain()

      if (this.mediaStream && this.mediaStream.getAudioTracks().length > 0) {
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
        this.sourceNode.connect(this.mixerNode)
      }

      if (this.displayStream && this.displayStream.getAudioTracks().length > 0) {
        this.tabSourceNode = this.audioContext.createMediaStreamSource(this.displayStream)
        this.tabSourceNode.connect(this.mixerNode)
      }

      // Analyser for real-time waveform visualization
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0.6
      this.mixerNode.connect(this.analyserNode)

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input
  const ratio = inputSampleRate / 16000
  const outputLength = Math.round(input.length / ratio)
  const output = new Float32Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const origIndex = i * ratio
    const indexFloor = Math.floor(origIndex)
    const indexCeil = Math.min(input.length - 1, indexFloor + 1)
    const fraction = origIndex - indexFloor
    output[i] = input[indexFloor] * (1 - fraction) + input[indexCeil] * fraction
  }
  return output
}

      // ScriptProcessor to capture PCM frames
      const bufferSize = 2048
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

      // Connect to WebSocket backend
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/audio`

      this.connectWebSocket(wsUrl)

      // Audio processing hook with strict 16kHz resampling
      this.processorNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        const currentSampleRate = e.inputBuffer.sampleRate || (this.audioContext ? this.audioContext.sampleRate : 16000)
        const resampled = downsampleTo16k(inputData, currentSampleRate)

        // If recording for enrollment, accumulate resampled 16kHz audio
        if (this.isRecordingForEnroll) {
          for (let i = 0; i < resampled.length; i++) {
            this.recordingBuffer.push(resampled[i])
          }
        }

        // Convert Float32 to 16-bit PCM at strictly 16,000 Hz
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          const pcm16 = new Int16Array(resampled.length)
          for (let i = 0; i < resampled.length; i++) {
            const s = Math.max(-1, Math.min(1, resampled[i]))
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          this.socket.send(pcm16.buffer)
        }
      }

      this.mixerNode.connect(this.processorNode)
      this.processorNode.connect(this.audioContext.destination)

      // Start zero-latency browser streaming speech recognition
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRec) {
        try {
          this.speechRecognizer = new SpeechRec()
          this.speechRecognizer.continuous = true
          this.speechRecognizer.interimResults = true
          this.speechRecognizer.maxAlternatives = 1
          this.speechRecognizer.lang = 'en-US'

          this.speechRecognizer.onresult = (event: any) => {
            let fullText = ''
            for (let i = 0; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript + ' '
            }
            const trimmed = fullText.trim()
            if (trimmed) {
              // 1. Instant Fast Path: Update UI with zero latency (< 30ms)
              if (this.onTelemetryCallback) {
                this.onTelemetryCallback({
                  transcript: trimmed,
                  fullTranscript: trimmed,
                  speechEngine: 'browser_instant',
                })
              }

              // 2. Transmit to backend for Llama 3.2 AI intent analysis
              if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                  command: 'speech_transcript',
                  text: trimmed,
                }))
              }
            }
          }

          this.speechRecognizer.onerror = (event: any) => {
            console.warn('Browser SpeechRecognition event:', event?.error)
          }

          // Persistent keep-alive: restart when recognition session ends after speech pauses
          this.speechRecognizer.onend = () => {
            if (this.isStreaming) {
              setTimeout(() => {
                if (this.isStreaming && this.speechRecognizer) {
                  try {
                    this.speechRecognizer.start()
                  } catch {}
                }
              }, 50)
            }
          }

          this.speechRecognizer.start()
        } catch (e) {
          console.warn('Browser SpeechRecognition note:', e)
        }
      }

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
          } else if (data.type === 'session_summary' && this.onSessionSummaryCallback) {
            this.onSessionSummaryCallback({
              durationSec: data.durationSec || 0,
              transcript: data.transcript || '',
              intentRisk: data.intentRisk || 0,
              riskLevel: data.riskLevel || 'LOW',
              threats: data.threats || [],
              slmReasoning: data.slmReasoning,
              compositeRisk: data.compositeRisk || 0,
              acousticFake: 0,
              bioMatch: 1,
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

  public updatePolicy(policy: Policy) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        command: 'update_policy',
        policy: {
          wAcoustic: policy.wAcoustic,
          wBiometric: policy.wBiometric,
          wIntent: policy.wIntent,
          lowMax: policy.lowMax,
          criticalMin: policy.criticalMin,
        },
      }))
    }
  }

  public loadPreset(presetName: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        command: 'load_preset',
        preset: presetName,
      }))
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

    if (this.speechRecognizer) {
      try {
        this.speechRecognizer.stop()
      } catch {}
      this.speechRecognizer = null
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }

    if (this.tabSourceNode) {
      this.tabSourceNode.disconnect()
      this.tabSourceNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.mixerNode) {
      this.mixerNode.disconnect()
      this.mixerNode = null
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect()
      this.analyserNode = null
    }

    if (this.displayStream) {
      this.displayStream.getTracks().forEach((track) => track.stop())
      this.displayStream = null
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

    this.sessionStartTime = 0
  }

  public requestSessionSummary() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ command: 'get_session_summary' }))
    }
  }
}

export const audioService = new AudioIngestionService()
