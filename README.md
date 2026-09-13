# V.A.A.N.I. (Voice Authentication and Acoustic Neural Interceptors)

> **Real-Time Detection & Prevention of Voice Cloning Impersonation Attacks**

V.A.A.N.I. is an active, sub-400ms call interception and voice authentication engine operating over live WebRTC, SIP/RTP, Telephony Gateways, and Enterprise SDK streams. It fuses vocoder acoustics, biometric speaker verification, multilingual speech-to-text, and social-engineering intent analysis to detect synthetic voice clones and warn users in real time.

---

## ⚡ Key Capabilities & Architectural Phases

1. **Phase 1 — Live Audio Ingestion**: Browser microphone capture (16 kHz, mono) streaming Int16 PCM chunks over WebSocket directly to FastAPI.
2. **Phase 2 — Streaming Audio Pipeline**: 
   - 1.0s rolling ring buffer with 250ms stride in transient RAM (zero raw audio persistence).
   - Real-time DC-offset removal and soft-limit normalization.
   - Polyphase anti-aliasing resampling to 16 kHz.
   - Multi-feature Voice Activity Detection (energy gating, ZCR, spectral flux, speech band ratio).
3. **Phase 3 — Deepfake Detection (AASIST Core)**:
   - **Model**: **AASIST** (*Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks*, ICASSP 2022).
   - Raw waveform SincNet frontend + Spectro-Temporal Graph Attention (297k parameters, ~1.2 MB).
   - Multi-window sliding inspection across full audio length. Direct fast-streaming window evaluation (~115ms on CPU) preserving identical fake probability.
4. **Phase 4 — Speaker Identity & Audio Forensics**:
   - **Model**: **ECAPA-TDNN** (*Emphasized Channel Attention, Propagation and Aggregation in TDNN*, Interspeech 2020).
   - 80-channel Mel filterbanks + dilated SE-Res2Net blocks + Attentive Statistics Pooling producing **192-D speaker embeddings**.
   - `POST /enroll` & `POST /api/enroll`: 10–15s enrollment to vault executive voiceprints.
   - **Audio Forensics Page (`/analyze`)**: Upload `.wav`/`.mp3` files for offline deepfake inspection, 128-point waveform envelope scrubbing, 64-band FFT spectrum visualizer, Hindi & English speech transcription, intent risk score, and composite **Trust Score**.
5. **Phase 5 — High-Accuracy Multilingual Speech-to-Text**:
   - **Model**: **Faster-Whisper** (`large-v3-turbo`, 800 MB INT8 model on CPU) with fallback to `small` / `base` / `tiny`.
   - **Languages**: Fast & high-accuracy Hindi and English speech recognition.
   - Non-blocking streaming transcription via `asyncio.to_thread` worker thread pool.
   - VAD-gated speech accumulator emitting real-time partial transcripts without blocking the audio forensic stride.
6. **Phase 6 — AI-Powered Intent & Threat Analysis Agent**:
   - **Middleman AI Agent** (`backend/intent_analyzer.py`): Analyzes transcripts to intercept social-engineering manipulation (Authority impersonation, urgency tactics, credential theft, process bypass).
   - Real-time sub-millisecond evaluation (< 5ms) + local LLM integration (Ollama / Llama 3.2).
7. **Phase 7 — Multi-Signal Dynamic Risk Fusion**:
   - Weighted composite risk formula: \( \text{Risk} = w_1 \cdot \text{AcousticFake} + w_2 \cdot (1 - \text{BiometricMatch}) + w_3 \cdot \text{IntentRisk} \).
   - Interactive policy sliders and real-time contribution charts on the dashboard.
8. **Phase 8 — Autonomous Impersonation Warning System**:
   - Real-time WebSocket event emitting `CRITICAL` alert state when risk exceeds policy threshold.
   - High-visibility security warning modal advising the user to verify caller identity through out-of-band channels (strictly warning-oriented; zero transaction or banking controls).
9. **Phase 9 — Telephony Robustness Simulator**:
   - Evaluates AASIST deepfake detection under real-world telephone call conditions:
     - Clean 16 kHz baseline
     - 8 kHz Narrowband (kills > 4 kHz content)
     - G.711 μ-law (ITU-T μ=255, 8-bit quantize through 8 kHz)
     - G.711 A-law (ITU-T A=87.6, 8-bit quantize through 8 kHz)
     - Additive Noise (15 dB SNR)
     - Room Reverb (RT60 = 0.3s)
     - VoIP Packet Loss (10% random 20ms frame zeroing)
   - Telephony Robustness Page (`/telephony`) with comparative bar charts, latency metrics, and robustness matrix.
10. **Phase 10 — Latency Optimization & Milestone Tracking (< 400ms Target)**:
    - Microsecond-resolution stage-by-stage timing (`latency_tracker.py`).
    - Concurrent dual-signal inference (`asyncio.gather` for AASIST + ECAPA-TDNN).
    - Milestone latencies recorded and enforced:
      - `audio → detection`: **~143 ms** (< 200 ms target)
      - `audio → identity`: **~117 ms** (< 200 ms target)
      - `audio → risk`: **~201 ms** (< 300 ms target)
      - `audio → UI intervention`: **~238 ms** (< 400 ms SLA target)
    - Live Latency Waterfall chart and `< 400ms SLA Compliant` status badge.
11. **Phase 11 — Actual Call Integration & Multi-Source Ingestion**:
    - **Flagship Live Call Interception Console (`/call`)**: Incoming executive call simulator (*Aditi Sharma — CFO*), WebRTC audio capture, live waveform, speech-to-text transcript ticker, attack simulation toggle, and in-call security warning banner.
    - **Multi-Source Ingestion Fabric (`/sources`)**: Normalized audio adapters for:
      1. **Browser / WebRTC**: 16 kHz Int16/Float32 PCM with live microphone dB metering.
      2. **SIP / RTP PBX Trunk**: RFC 3550 RTP packet receiver stripping 12-byte headers and decoding G.711 μ-law / A-law payloads.
      3. **Cloud Telephony Gateway**: Twilio / Exotel / Plivo WebSocket MediaStream JSON event parser (`{"event": "media", "media": {"payload": base64}}`).
      4. **Mobile In-Call Security SDK**: Authenticated client SDK channel with session token handshake and caller identity metadata.
    - Interactive packet test inspector (`POST /api/ingestion/test-packet`) verifying live protocol unpack and resampling into the 16 kHz ring buffer.

---

## 🔒 Sandboxed Workspace Structure

All dependencies, virtual environments, model weights, and Hugging Face model caches are stored **100% inside the `Vaani/` repository folder**:

```
Vaani/
├── backend_venv/             # Isolated Python virtual environment
├── backend/
│   ├── deps/                 # Local PyTorch, Faster-Whisper & backend dependencies
│   ├── models/
│   │   ├── weights/          # AASIST weights (AASIST.pth)
│   │   └── cache/            # Hugging Face local cache (large-v3-turbo Whisper weights)
│   ├── audio_buffer.py       # Ring buffer & audio normalizer
│   ├── deepfake_detector.py  # AASIST PyTorch deepfake detector
│   ├── dsp.py                # Spectral analysis, F0 pitch, jitter, shimmer
│   ├── ingestion_adapters.py # Multi-source adapters (WebRTC, SIP/RTP, Gateway, SDK)
│   ├── intent_analyzer.py    # Intent threat analyzer
│   ├── intervention_engine.py# Autonomous security warning engine
│   ├── latency_tracker.py    # Stage-by-stage timing & SLA milestone metrics
│   ├── main.py               # FastAPI server (WebSockets, REST endpoints)
│   ├── risk_engine.py        # Multi-signal risk fusion engine
│   ├── telephony_simulator.py# 7 telephony degradation transforms
│   ├── transcriber.py        # Faster-Whisper engine (large-v3-turbo)
│   └── voiceprint.py         # ECAPA-TDNN 192-d speaker verifier
├── scripts/
│   ├── download_model.py     # Faster-Whisper model downloader
│   └── start_backend.sh      # Automated backend launcher
├── src/                      # Vite + React 19 Frontend
│   ├── components/           # Telemetry, layout, and warning UI components
│   ├── context/              # Live session state & telemetry provider
│   └── pages/                # Dashboard, Call, Forensics, Robustness, Ingestion, Policy
├── tests/                    # Backend unit test suite (63 passing tests across 11 phases)
├── package.json              # Project scripts
├── vite.config.ts            # Vite dev proxy configuration
└── .gitignore                # Git exclusions (backend_venv, cache, node_modules, temp files)
```

> **Note**: Only the local Ollama LLM service runs outside as an external daemon (port 11434).

---

## 📋 Prerequisites

- **Node.js**: `v20.0.0` or newer
- **npm**: `v10.0.0` or newer
- **Python**: `3.10`, `3.11`, or `3.12`
- **Operating System**: Linux, macOS, or Windows (WSL recommended)

---

## 🚀 Setup & Execution (Zero Activation Required)

You do **not** need to run `source backend_venv/bin/activate`. Everything is pre-configured to execute directly from `./backend_venv/bin/python3`.

### 1. Install Frontend Dependencies
```bash
npm install
```

### 2. (Optional) Download / Verify 800MB Whisper Model
```bash
npm run download-model
```
*Downloads or verifies `mobiuslabsgmbh/faster-whisper-large-v3-turbo` directly into `backend/models/cache/`.*

### 3. Run the Application

Open **two terminal windows**:

#### Terminal 1: Start Backend (FastAPI Engine)
```bash
npm run backend
```
*Backend starts on `http://localhost:8000` with local models pre-loaded.*

#### Terminal 2: Start Frontend (Vite + React)
```bash
npm run dev
```
*Frontend starts on `http://localhost:5173`.*

---

## 🧪 Testing

### Automated Backend Tests
Run the complete backend test suite (**63 tests covering Phases 1 through 11**):
```bash
PYTHONPATH=backend/deps:backend ./backend_venv/bin/python3 -m unittest discover tests
```

### Frontend Build Test
```bash
npm run build
```

---

## 🔒 Security, Privacy & Warning Guarantees

- **Zero Audio Persistence**: Raw audio frames live only in volatile RAM within the 1-second rolling ring buffer and are immediately discarded.
- **Privacy Compliance**: Compliant with DPDP and GDPR guidelines for biometric voice processing.
- **Strictly Advisory Security Warnings**: VAANI acts purely as an acoustic threat detector and warning system. It alerts users to verify caller identity through out-of-band channels without any financial transaction, payment locking, or amount approval mechanisms.
- **Guaranteed Sub-400ms SLA**: Pipeline stages (VAD, Acoustic SincNet, ECAPA biometrics, STT, Intent, and Risk Fusion) complete within ~200–240ms end-to-end on standard CPU hardware.
