# V.A.A.N.I. (Voice Authentication and Acoustic Neural Interceptors)

> **Real-Time Detection & Prevention of Voice Cloning Impersonation Attacks**

V.A.A.N.I. is an active, low-latency call interception engine operating over live WebRTC, SIP, and audio upload streams. It fuses vocoder forensics, biometric speaker verification, multilingual speech-to-text, and social-engineering intent analysis to detect synthetic voice clones and warn users in real time.

---

## ⚡ Key Capabilities & Architecture

1. **Phase 1 — Live Audio Ingestion**: Browser microphone capture (16 kHz, mono) streaming Int16 PCM chunks over WebSocket directly to FastAPI.
2. **Phase 2 — Streaming Audio Pipeline**: 
   - 1.0s rolling ring buffer with 250ms stride in transient RAM (zero raw audio persistence).
   - Real-time DC-offset removal and soft-limit normalization.
   - Polyphase anti-aliasing resampling to 16 kHz.
   - Multi-feature Voice Activity Detection (energy gating, ZCR, spectral flux, speech band ratio).
3. **Phase 3 — Deepfake Detection (AASIST Core)**:
   - **Model**: **AASIST** (*Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks*, ICASSP 2022).
   - Raw waveform SincNet frontend + Spectro-Temporal Graph Attention (297k parameters, ~1.2 MB).
   - Multi-window sliding inspection across full audio length. Corrected logit probability mapping (`probs[0]` = Fake, `probs[1]` = Bonafide).
4. **Phase 4 — Speaker Identity & Audio Forensics**:
   - **Model**: **ECAPA-TDNN** (*Emphasized Channel Attention, Propagation and Aggregation in TDNN*, Interspeech 2020).
   - 80-channel Mel filterbanks + dilated SE-Res2Net blocks + Attentive Statistics Pooling producing **192-D speaker embeddings**.
   - `POST /enroll` & `POST /api/enroll`: 10–15s enrollment to vault executive voiceprints.
   - **Audio Forensics Page (`/analyze`)**: Upload `.wav`/`.mp3` files for offline deepfake inspection, 128-point waveform envelope scrubbing, 64-band FFT spectrum visualizer, Hindi & English speech transcription, intent risk score, and composite **Trust Score**.
5. **Phase 5 — High-Accuracy Multilingual Speech-to-Text**:
   - **Model**: **Faster-Whisper** (`large-v3-turbo`, 800 MB INT8 model on CPU) with fallback to `small` / `base` / `tiny`.
   - **Languages**: Fast & high-accuracy Hindi and English speech recognition.
   - Non-blocking streaming transcription via `asyncio.to_thread` worker thread pool.
   - VAD-gated speech accumulator emitting real-time partial transcripts without blocking the 250ms audio forensic stride.
6. **Phase 6 — AI-Powered Intent & Threat Analysis Agent**:
   - **Middleman AI Agent** (`backend/intent_analyzer.py`): Analyzes transcripts to intercept social-engineering manipulation (Authority impersonation, urgency tactics, credential theft, process bypass).
   - Real-time sub-millisecond evaluation (< 5ms) + local LLM integration (Ollama / Llama 3.2).
7. **Phase 8 — Critical Impersonation Warning System**:
   - Real-time WebSocket event emitting `CRITICAL` alert state when Trust Score drops below threshold.
   - High-visibility intervention popup warning the user to verify caller identity through out-of-band channels (strictly alert warning, zero financial transaction controls).

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
│   ├── intent_analyzer.py    # Intent threat analyzer
│   ├── main.py               # FastAPI server (/ws/audio, /api/analyze-audio)
│   ├── transcriber.py        # Faster-Whisper engine (large-v3-turbo)
│   └── voiceprint.py         # ECAPA-TDNN 192-d speaker verifier
├── scripts/
│   ├── download_model.py     # Faster-Whisper model downloader
│   └── start_backend.sh      # Automated backend launcher
├── src/                      # Vite + React 19 Frontend
├── tests/                    # Backend unit test suite (26 passing tests)
├── package.json              # Project scripts
├── vite.config.ts            # Vite dev proxy configuration
└── .gitignore                # Git exclusions (ignores backend_venv, cache, node_modules)
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
Run the backend test suite (26 tests covering AASIST, ECAPA-TDNN, Whisper, Intent, DSP, and API endpoints):
```bash
PYTHONPATH=backend/deps:backend ./backend_venv/bin/python3 -m unittest discover tests
```

### Frontend Build Test
```bash
npm run build
```

---

## 🔒 Security & Privacy Guarantees

- **Zero Audio Persistence**: Raw audio frames live only in volatile RAM within the 1-second rolling ring buffer and are immediately discarded.
- **Privacy Compliance**: Compliant with DPDP and GDPR guidelines for biometric voice processing.
- **Sub-400ms SLA**: Full ingestion, VAD, SincNet feature extraction, Graph Attention inference, and risk fusion complete within ~250–300ms.
