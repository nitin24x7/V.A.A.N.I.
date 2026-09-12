"""
Phase 9 — Telephony Robustness: Degradation Simulator.

Applies real-world telephony degradation transforms to audio and evaluates
whether the AASIST deepfake detector remains robust under each condition.

Supported transforms:
  1. Clean 16 kHz         — Passthrough baseline
  2. 8 kHz Narrowband     — Downsample to 8 kHz and back (loses >4 kHz)
  3. G.711 μ-law          — ITU-T μ-law compress → 8-bit quantize → expand (μ=255)
  4. G.711 A-law          — ITU-T A-law compress → 8-bit quantize → expand (A=87.6)
  5. Additive Noise       — White noise at configurable SNR (default 15 dB)
  6. Room Reverb          — Exponential-decay impulse response convolution (RT60≈0.3s)
  7. Packet Loss          — Random 20ms frame zeroing at configurable loss rate (10%)

All functions accept float32 audio at 16 kHz and return float32 audio at 16 kHz.
"""

import time
import numpy as np
from scipy.signal import resample_poly, fftconvolve
from math import gcd


# ── G.711 μ-law Codec (ITU-T G.711) ──────────────────────────────────

MU = 255  # μ-law companding parameter


def _mu_law_encode(audio: np.ndarray, mu: int = MU) -> np.ndarray:
    """Compress float32 [-1, 1] → μ-law encoded uint8 [0, 255]."""
    audio = np.clip(audio, -1.0, 1.0)
    sign = np.sign(audio)
    magnitude = np.log1p(mu * np.abs(audio)) / np.log1p(mu)
    # Quantize to 8 bits: map [-1, 1] → [0, 255]
    quantized = ((sign * magnitude + 1.0) / 2.0 * 255.0).astype(np.uint8)
    return quantized


def _mu_law_decode(encoded: np.ndarray, mu: int = MU) -> np.ndarray:
    """Expand μ-law encoded uint8 [0, 255] → float32 [-1, 1]."""
    # Map [0, 255] back to [-1, 1]
    normalized = encoded.astype(np.float32) / 255.0 * 2.0 - 1.0
    sign = np.sign(normalized)
    magnitude = (1.0 / mu) * ((1.0 + mu) ** np.abs(normalized) - 1.0)
    return sign * magnitude


def apply_g711_mulaw(audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """
    Simulate G.711 μ-law codec: downsample to 8 kHz, compress with μ-law,
    quantize to 8-bit, decompress, upsample back to 16 kHz.
    """
    # 1. Downsample 16 kHz → 8 kHz
    g = gcd(8000, sample_rate)
    audio_8k = resample_poly(audio, 8000 // g, sample_rate // g).astype(np.float32)

    # 2. μ-law compress + 8-bit quantize + decompress
    encoded = _mu_law_encode(audio_8k)
    decoded = _mu_law_decode(encoded)

    # 3. Upsample 8 kHz → 16 kHz
    g2 = gcd(sample_rate, 8000)
    audio_out = resample_poly(decoded, sample_rate // g2, 8000 // g2).astype(np.float32)

    # Match original length
    if len(audio_out) > len(audio):
        audio_out = audio_out[: len(audio)]
    elif len(audio_out) < len(audio):
        audio_out = np.pad(audio_out, (0, len(audio) - len(audio_out)))

    # Soft-clip to prevent resampling overshoot
    peak = np.max(np.abs(audio_out))
    if peak > 1.0:
        audio_out /= peak

    return audio_out


# ── G.711 A-law Codec (ITU-T G.711) ──────────────────────────────────

A_PARAM = 87.6  # A-law companding parameter


def _a_law_encode(audio: np.ndarray, A: float = A_PARAM) -> np.ndarray:
    """Compress float32 [-1, 1] → A-law encoded uint8 [0, 255]."""
    audio = np.clip(audio, -1.0, 1.0)
    sign = np.sign(audio)
    x = np.abs(audio)

    # A-law piecewise compression
    threshold = 1.0 / A
    linear_region = x < threshold
    magnitude = np.where(
        linear_region,
        A * x / (1.0 + np.log(A)),
        (1.0 + np.log(A * np.maximum(x, 1e-10))) / (1.0 + np.log(A)),
    )

    # Quantize to 8 bits
    quantized = ((sign * magnitude + 1.0) / 2.0 * 255.0).astype(np.uint8)
    return quantized


def _a_law_decode(encoded: np.ndarray, A: float = A_PARAM) -> np.ndarray:
    """Expand A-law encoded uint8 [0, 255] → float32 [-1, 1]."""
    normalized = encoded.astype(np.float32) / 255.0 * 2.0 - 1.0
    sign = np.sign(normalized)
    y = np.abs(normalized)

    # A-law piecewise expansion (inverse)
    threshold = 1.0 / (1.0 + np.log(A))
    linear_region = y < threshold
    magnitude = np.where(
        linear_region,
        y * (1.0 + np.log(A)) / A,
        np.exp(y * (1.0 + np.log(A)) - 1.0) / A,
    )

    return sign * magnitude


def apply_g711_alaw(audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """
    Simulate G.711 A-law codec: downsample to 8 kHz, compress with A-law,
    quantize to 8-bit, decompress, upsample back to 16 kHz.
    """
    # 1. Downsample 16 kHz → 8 kHz
    g = gcd(8000, sample_rate)
    audio_8k = resample_poly(audio, 8000 // g, sample_rate // g).astype(np.float32)

    # 2. A-law compress + 8-bit quantize + decompress
    encoded = _a_law_encode(audio_8k)
    decoded = _a_law_decode(encoded)

    # 3. Upsample 8 kHz → 16 kHz
    g2 = gcd(sample_rate, 8000)
    audio_out = resample_poly(decoded, sample_rate // g2, 8000 // g2).astype(np.float32)

    # Match original length
    if len(audio_out) > len(audio):
        audio_out = audio_out[: len(audio)]
    elif len(audio_out) < len(audio):
        audio_out = np.pad(audio_out, (0, len(audio) - len(audio_out)))

    return audio_out


# ── 8 kHz Narrowband ─────────────────────────────────────────────────

def apply_narrowband_8khz(audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """
    Simulate narrowband telephony: downsample to 8 kHz and upsample back.
    Destroys all frequency content above 4 kHz (Nyquist of 8 kHz).
    """
    g = gcd(8000, sample_rate)
    audio_8k = resample_poly(audio, 8000 // g, sample_rate // g).astype(np.float32)

    g2 = gcd(sample_rate, 8000)
    audio_out = resample_poly(audio_8k, sample_rate // g2, 8000 // g2).astype(np.float32)

    if len(audio_out) > len(audio):
        audio_out = audio_out[: len(audio)]
    elif len(audio_out) < len(audio):
        audio_out = np.pad(audio_out, (0, len(audio) - len(audio_out)))

    return audio_out


# ── Additive Noise ────────────────────────────────────────────────────

def apply_additive_noise(
    audio: np.ndarray, snr_db: float = 15.0, sample_rate: int = 16000
) -> np.ndarray:
    """
    Add white Gaussian noise at a specified signal-to-noise ratio (dB).
    Default 15 dB simulates a moderately noisy phone call environment.
    """
    signal_power = np.mean(audio ** 2)
    if signal_power < 1e-10:
        return audio.copy()

    noise_power = signal_power / (10.0 ** (snr_db / 10.0))
    noise = np.random.RandomState(42).randn(len(audio)).astype(np.float32)
    noise *= np.sqrt(noise_power)

    noisy = audio + noise
    # Soft-clip to prevent overflow
    peak = np.max(np.abs(noisy))
    if peak > 1.0:
        noisy /= peak
    return noisy


# ── Room Reverb ───────────────────────────────────────────────────────

def apply_reverb(
    audio: np.ndarray, rt60: float = 0.3, sample_rate: int = 16000
) -> np.ndarray:
    """
    Simulate room reverb via exponential-decay impulse response convolution.

    Args:
        rt60: Reverberation time in seconds (time for sound to decay by 60 dB).
              Default 0.3s simulates a small office or conference room.
    """
    # Generate synthetic impulse response
    ir_length = int(rt60 * sample_rate)
    if ir_length < 1:
        return audio.copy()

    t = np.arange(ir_length, dtype=np.float32) / sample_rate
    # Exponential decay envelope
    decay = np.exp(-6.908 * t / rt60)  # -60dB at RT60 → 6.908 = ln(1000) ≈ 3*ln(10)
    # Add sparse early reflections
    ir = decay * np.random.RandomState(123).randn(ir_length).astype(np.float32)
    ir[0] = 1.0  # Direct path
    # Normalize IR to preserve signal energy
    ir /= np.sqrt(np.sum(ir ** 2))

    # Fast convolution
    reverbed = fftconvolve(audio, ir, mode="full")[: len(audio)]

    # Normalize to prevent clipping
    peak = np.max(np.abs(reverbed))
    if peak > 1.0:
        reverbed /= peak
    return reverbed.astype(np.float32)


# ── Packet Loss ───────────────────────────────────────────────────────

def apply_packet_loss(
    audio: np.ndarray, loss_rate: float = 0.10, frame_ms: float = 20.0,
    sample_rate: int = 16000
) -> np.ndarray:
    """
    Simulate VoIP packet loss by zeroing random 20ms frames.

    Args:
        loss_rate: Fraction of frames to drop (0.10 = 10% loss).
        frame_ms: Frame duration in milliseconds (20ms is standard for VoIP/RTP).
    """
    frame_samples = int(sample_rate * frame_ms / 1000.0)
    n_frames = len(audio) // frame_samples
    if n_frames == 0:
        return audio.copy()

    output = audio.copy()
    rng = np.random.RandomState(77)
    drop_mask = rng.random(n_frames) < loss_rate

    for i in range(n_frames):
        if drop_mask[i]:
            start = i * frame_samples
            end = start + frame_samples
            output[start:end] = 0.0

    return output


# ── Robustness Suite Orchestrator ─────────────────────────────────────

# All conditions in order
TELEPHONY_CONDITIONS = [
    ("Clean 16 kHz", None),
    ("8 kHz Narrowband", apply_narrowband_8khz),
    ("G.711 μ-law", apply_g711_mulaw),
    ("G.711 A-law", apply_g711_alaw),
    ("Noise (15 dB SNR)", apply_additive_noise),
    ("Room Reverb (RT60=0.3s)", apply_reverb),
    ("Packet Loss (10%)", apply_packet_loss),
]


def run_robustness_suite(audio: np.ndarray, sample_rate: int = 16000) -> dict:
    """
    Run the full telephony robustness evaluation suite.

    Applies all 7 degradation conditions to the input audio, runs AASIST
    deepfake detection on each variant, and returns a structured comparison.

    Args:
        audio: float32 numpy array at 16 kHz
        sample_rate: always 16000

    Returns:
        {
            "duration_sec": float,
            "conditions": [
                {
                    "name": str,
                    "fake_probability": float,
                    "trust_score": float,
                    "rating": str,
                    "inference_ms": float,
                },
                ...
            ],
            "summary": {
                "all_detected": bool,
                "min_fake_prob": float,
                "max_fake_prob": float,
                "mean_fake_prob": float,
                "robust": bool,
            }
        }
    """
    from deepfake_detector import deepfake_detector

    if audio.ndim > 1:
        audio = audio.flatten()
    audio = audio.astype(np.float32)
    if len(audio) < 1600:
        audio = np.pad(audio, (0, 1600 - len(audio)))

    duration_sec = round(len(audio) / sample_rate, 2)
    results = []

    for name, transform_fn in TELEPHONY_CONDITIONS:
        start_t = time.perf_counter()

        # Apply degradation transform (or passthrough for clean)
        if transform_fn is not None:
            degraded = transform_fn(audio, sample_rate=sample_rate)
        else:
            degraded = audio.copy()

        # Run AASIST deepfake detection
        det_result = deepfake_detector.predict_full_audio(degraded, sample_rate=sample_rate)
        fake_prob = det_result["acoustic_fake_probability"]

        # Compute trust score (inverse of fake probability, same as main pipeline)
        trust_score = round((1.0 - fake_prob) * 100.0, 1)

        # Rating thresholds (aligned with risk_engine)
        if trust_score >= 70:
            rating = "TRUSTED"
        elif trust_score >= 40:
            rating = "SUSPICIOUS"
        else:
            rating = "CRITICAL"

        elapsed_ms = round((time.perf_counter() - start_t) * 1000, 1)

        results.append({
            "name": name,
            "fake_probability": round(fake_prob, 4),
            "trust_score": trust_score,
            "rating": rating,
            "inference_ms": elapsed_ms,
        })

    # Summary statistics
    fake_probs = [r["fake_probability"] for r in results]
    min_fp = min(fake_probs)
    max_fp = max(fake_probs)
    mean_fp = round(sum(fake_probs) / len(fake_probs), 4)

    # "Detected" means fake_prob > 0.5 (majority confidence that audio is synthetic)
    all_detected = all(fp > 0.5 for fp in fake_probs)
    # "Robust" means detection never drops below 0.5 across all conditions
    robust = all_detected

    return {
        "duration_sec": duration_sec,
        "conditions": results,
        "summary": {
            "all_detected": all_detected,
            "min_fake_prob": round(min_fp, 4),
            "max_fake_prob": round(max_fp, 4),
            "mean_fake_prob": mean_fp,
            "robust": robust,
        },
    }
