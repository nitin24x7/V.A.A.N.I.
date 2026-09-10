import sys
import os
import time
import json
import uuid
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Ensure local backend dependencies are accessible
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'deps'))

from audio_buffer import AudioRingBuffer
from dsp import analyze_audio_window
from voiceprint import voiceprint_manager
from deepfake_detector import deepfake_detector

app = FastAPI(
    title="VAANI Backend",
    description="Voice authentication and Acoustic Neural Interceptor real-time streaming engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global session state
class ServerState:
    def __init__(self):
        self.mode = "legitimate"  # "legitimate" | "attack"
        self.source = "webrtc"
        self.incidents: list[dict] = []
        self.active_sessions: int = 0
        self.total_audio_seconds: float = 0.0
        self.total_packets_processed: int = 0

state = ServerState()

class ModeRequest(BaseModel):
    mode: str  # "legitimate" | "attack"

class EnrollRequest(BaseModel):
    name: str
    role: str
    samples: list[float]
    sample_rate: Optional[int] = 16000

@app.get("/health")
@app.get("/api/status")
def get_status():
    return {
        "status": "healthy",
        "service": "VAANI Acoustic Forensics Engine",
        "mode": state.mode,
        "source": state.source,
        "enrolled_count": len(voiceprint_manager.enrolled),
        "active_sessions": state.active_sessions,
        "total_audio_seconds": round(state.total_audio_seconds, 1),
        "total_packets_processed": state.total_packets_processed,
    }

@app.post("/api/mode")
def set_mode(req: ModeRequest):
    if req.mode not in ["legitimate", "attack"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'legitimate' or 'attack'.")
    state.mode = req.mode
    return {"status": "ok", "mode": state.mode}

@app.get("/api/voiceprints")
def get_voiceprints():
    profiles = []
    for k, v in voiceprint_manager.enrolled.items():
        profiles.append({
            "id": v["id"],
            "name": v["name"],
            "role": v["role"],
            "preview": v["preview"],
            "sample_rate": v["sample_rate"],
        })
    return {"voiceprints": profiles}

@app.post("/api/enroll")
def enroll_speaker(req: EnrollRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")
    if len(req.samples) < 1000:
        raise HTTPException(status_code=400, detail="Audio sample is too short for enrollment.")

    audio_array = np.array(req.samples, dtype=np.float32)
    speaker_id = str(uuid.uuid4())[:8]
    result = voiceprint_manager.enroll_speaker(
        speaker_id=speaker_id,
        name=req.name,
        role=req.role,
        audio=audio_array,
        sample_rate=req.sample_rate or 16000,
    )
    return {"status": "enrolled", "profile": result}

@app.get("/api/incidents")
def get_incidents():
    return {"incidents": state.incidents}

@app.websocket("/ws/audio")
async def audio_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.active_sessions += 1

    # Phase 2: Ring buffer with built-in normalization & resampling
    ring_buffer = AudioRingBuffer(
        sample_rate=16000,
        window_sec=1.0,
        stride_sec=0.25,
        enable_normalization=True,
    )
    packet_count = 0
    session_id = str(uuid.uuid4())[:8]

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                start_time = time.perf_counter()

                # Browser sends Int16Array binary buffer (2 bytes per sample at 16kHz)
                if len(raw_bytes) % 2 == 0:
                    samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                elif len(raw_bytes) % 4 == 0:
                    samples = np.frombuffer(raw_bytes, dtype=np.float32)
                else:
                    continue

                packet_count += 1
                state.total_packets_processed += 1
                state.total_audio_seconds += len(samples) / 16000.0

                # Phase 2: ingest() handles resampling + normalization + ring write
                stride_ready = ring_buffer.ingest(samples, source_sr=16000)

                # Process every 250 ms stride (or every 3rd packet as fallback)
                if stride_ready or packet_count % 3 == 0:
                    window = ring_buffer.get_latest_window()

                    # Phase 2 DSP: returns timestamp, speech_detected, audio_duration_ms
                    dsp_results = analyze_audio_window(window, sample_rate=16000, mode=state.mode)

                    # ── Phase 3: AASIST Deepfake Detection ──
                    # Run the real ML model on speech windows
                    ml_result = None
                    if dsp_results["is_speech"]:
                        ml_result = deepfake_detector.predict(window, sample_rate=16000)
                        acoustic_fake = ml_result["acoustic_fake_probability"]
                    else:
                        acoustic_fake = 0.02  # No speech → negligible fake probability

                    # Biometric verification against enrolled profile
                    bio_match = voiceprint_manager.verify(window, sample_rate=16000)

                    # Dynamic Intent Analysis
                    if state.mode == "attack":
                        intent_score = 0.88 + np.random.uniform(-0.04, 0.08)
                    else:
                        intent_score = 0.05 if dsp_results["is_speech"] else 0.01

                    # 3-Tier Risk Fusion:
                    # Risk = w1*(Acoustic_Fake_Prob) + w2*(1 - Bio_Match) + w3*(Intent_Score)
                    w1, w2, w3 = 0.45, 0.30, 0.25
                    bio_penalty = max(0.0, 1.0 - bio_match)

                    if not dsp_results["is_speech"]:
                        raw_risk = 4.0
                    else:
                        raw_risk = (w1 * acoustic_fake + w2 * bio_penalty + w3 * intent_score) * 100.0

                    raw_risk = max(1.0, min(99.0, raw_risk))

                    if raw_risk >= 70.0:
                        level = "critical"
                    elif raw_risk >= 30.0:
                        level = "medium"
                    else:
                        level = "low"

                    inference_latency_ms = round((time.perf_counter() - start_time) * 1000, 1)
                    buf_stats = ring_buffer.get_stats()

                    # Phase 3 telemetry payload — includes ML model results
                    telemetry_payload = {
                        "type": "telemetry",
                        "sessionId": session_id,
                        # Phase 2 output fields
                        "timestamp": dsp_results["timestamp"],
                        "speech_detected": dsp_results["speech_detected"],
                        "audio_duration_ms": dsp_results["audio_duration_ms"],
                        # Core telemetry
                        "packetIndex": packet_count,
                        "isSpeech": dsp_results["is_speech"],
                        "rmsDb": dsp_results["rms_db"],
                        "f0": dsp_results["f0"],
                        "jitter": dsp_results["jitter"],
                        "shimmer": dsp_results["shimmer"],
                        "spectralCentroid": dsp_results.get("spectral_centroid", 0.0),
                        "rolloff": dsp_results.get("rolloff", 0.0),
                        "phaseDiscontinuity": dsp_results["phase_discontinuity"],
                        # Phase 3: ML-powered acoustic fake score
                        "acousticFake": acoustic_fake,
                        "bioMatch": bio_match,
                        "intentScore": round(intent_score, 3),
                        "risk": round(raw_risk, 1),
                        "level": level,
                        "latencyMs": inference_latency_ms,
                        "mode": state.mode,
                        "source": state.source,
                        # Phase 2 stride stats
                        "strideCount": buf_stats["stride_count"],
                        "strideIntervalMs": buf_stats["stride_interval_ms"],
                        "bufferFillPct": buf_stats["buffer_fill_pct"],
                        # VAD feature details
                        "vad": dsp_results.get("vad"),
                        # Phase 3: ML model metadata
                        "mlModel": {
                            "type": ml_result["model_type"] if ml_result else None,
                            "inferenceMs": ml_result["inference_ms"] if ml_result else None,
                            "pretrained": ml_result["pretrained"] if ml_result else None,
                            "confidence": ml_result["confidence"] if ml_result else None,
                        } if ml_result else None,
                    }

                    # If critical risk, record incident
                    if level == "critical" and (not state.incidents or (time.time() - state.incidents[-1]["ts"]) > 5.0):
                        inc = {
                            "id": f"INC-{int(time.time()) % 10000:04d}",
                            "ts": time.time() * 1000,
                            "level": "critical",
                            "source": state.source,
                            "risk": round(raw_risk, 1),
                            "detail": f"Synthetic voice clone detected (Acoustic Fake: {round(acoustic_fake*100, 1)}%, Phase Discontinuity: {dsp_results['phase_discontinuity']})",
                        }
                        state.incidents.append(inc)

                    await websocket.send_json(telemetry_payload)

            elif "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                    cmd = data.get("command")
                    if cmd == "set_mode":
                        state.mode = data.get("mode", state.mode)
                        await websocket.send_json({"type": "mode_changed", "mode": state.mode})
                    elif cmd == "set_source":
                        state.source = data.get("source", state.source)
                        await websocket.send_json({"type": "source_changed", "source": state.source})
                    elif cmd == "ping":
                        await websocket.send_json({"type": "pong", "time": time.time()})
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": str(e)})

    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as e:
        print(f"WebSocket session error: {e}")
    finally:
        state.active_sessions = max(0, state.active_sessions - 1)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
