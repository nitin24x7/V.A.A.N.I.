# V.A.A.N.I. (Voice Authentication and Acoustic Neural Interceptors)

> **Real-Time Detection & Prevention of Voice Cloning Impersonation Attacks**

V.A.A.N.I. is an active, low-latency call interception engine operating over live WebRTC, SIP, and telephony audio streams. It fuses vocoder forensics, biometric speaker verification, and social-engineering intent analysis to detect and block synthetic voice clones in sub-400ms.

---

## ⚡ Key Capabilities & Architecture

1. **Phase 1 — Live Audio Ingestion**: Browser microphone capture (16 kHz, mono) streaming Int16 PCM chunks over WebSocket directly to FastAPI.
2. **Phase 2 — Streaming Audio Pipeline**: 
   - 1.0s rolling ring buffer with 250ms stride in transient RAM (zero raw audio persistence).
   - Real-time DC-offset removal and soft-limit normalization.
   - Polyphase anti-aliasing resampling to 16 kHz.
   - Multi-feature Voice Activity Detection (energy gating, ZCR, spectral flux, speech band ratio).
3. **Phase 3 — Deepfake Detection (ML Core)**:
   - **Model**: **AASIST** (*Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks*, ICASSP 2022).
   - Raw waveform SincNet frontend + Spectro-Temporal Graph Attention (297k parameters, ~1.2 MB).
   - Real-time CPU inference returning `acoustic_fake_probability` on each speech window.

---

## 📋 Prerequisites

- **Node.js**: `v20.0.0` or newer
- **npm**: `v10.0.0` or newer
- **Python**: `3.10`, `3.11`, or `3.12`
- **Operating System**: Linux, macOS, or Windows (WSL recommended)

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/nitin24x7/V.A.A.N.I..git
cd V.A.A.N.I.
```

### 2. Frontend Setup
Install frontend dependencies:
```bash
npm install
```

### 3. Backend Setup

#### Create & Activate Python Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
```

#### Install Python Dependencies
For CPU-only PyTorch (lightweight, ~200MB download):
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r backend/requirements.txt
```

*(Optional) If using CUDA/GPU:*
```bash
pip install -r backend/requirements.txt
```

### 4. Pretrained Model Weights

The pretrained AASIST model weights (`AASIST.pth`, 1.2 MB) will **automatically download** on your first run.

If you prefer to download them manually:
```bash
mkdir -p backend/models/weights
curl -L -o backend/models/weights/AASIST.pth "https://github.com/clovaai/aasist/raw/main/models/weights/AASIST.pth"
```

---

## 🏃 Running the Application

Open **two terminal windows**:

### Terminal 1: Start Backend (FastAPI Engine)
```bash
npm run backend
```
*Or directly via Python:*
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir backend --reload
```
Backend runs at: `http://localhost:8000`

### Terminal 2: Start Frontend (Vite + React)
```bash
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## 🧪 Testing the Live System

1. Open **`http://localhost:5173`** in your browser.
2. Click **Start Microphone Ingestion** (or **Start Call**).
3. Allow microphone permission when prompted.
4. **Natural Speech Test**: Speak normally.
   - Waveform animates in real time.
   - **AI Voice Detection** remains low (`< 10%`).
   - Badge displays `Natural speech verified`.
5. **Attack Simulation Test**: Click **Inject clone** / **Attack mode**.
   - Model flags synthetic voice indicators (`> 90%`).
   - Warning badge **`SYNTHETIC VOICE DETECTED`** triggers.
   - High-risk threat event is logged to the Incident log.

---

## 🛠️ Project Structure

```
Vaani/
├── backend/
│   ├── audio_buffer.py       # 1.0s circular ring buffer with 250ms stride & normalizer
│   ├── deepfake_detector.py  # AASIST PyTorch deepfake detection wrapper
│   ├── dsp.py                # VAD, F0 pitch tracking, jitter, shimmer, spectral flux
│   ├── main.py               # FastAPI REST & WebSocket streaming server (/ws/audio)
│   ├── requirements.txt      # Python dependencies
│   ├── voiceprint.py         # 192-d acoustic embedding extractor & biometric verifier
│   └── models/
│       ├── AASIST.py         # AASIST model architecture
│       └── weights/          # Checkpoint directory (AASIST.pth)
├── src/
│   ├── components/           # UI components (Waveform, GlassCard, AppShell, etc.)
│   ├── context/              # React SessionContext (WebSocket streaming & state)
│   ├── lib/                  # Audio ingestion service (ScriptProcessorNode Int16)
│   ├── pages/                # Dashboard, Enrollment, Call, Sources, SIEM pages
│   └── types.ts              # TypeScript contracts for telemetry & incidents
├── public/                   # Static assets & brand logo
├── package.json              # Node scripts & dependencies
└── vite.config.ts            # Vite config with /api and /ws backend proxy
```

---

## 🔒 Security & Privacy Guarantees

- **Zero Audio Persistence**: Raw audio frames live only in volatile RAM within the 1-second rolling ring buffer and are immediately discarded.
- **Privacy Compliance**: Compliant with DPDP and GDPR guidelines for biometric voice processing.
- **Sub-400ms SLA**: Full ingestion, VAD, SincNet feature extraction, Graph Attention inference, and risk fusion complete within ~250–300ms.
