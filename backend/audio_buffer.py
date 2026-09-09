"""
Phase 2 — Streaming Audio Pipeline: Ring Buffer with Normalization & Resampling.

Handles:
  - 16-bit PCM ingestion at 16 kHz
  - DC offset removal (high-pass filter)
  - Peak normalization to [-1.0, +1.0]
  - Resampling from arbitrary sample rates to 16 kHz
  - 1.0 s rolling window with 0.25 s stride
  - Zero raw audio persistence (transient RAM only)
"""

import time
import numpy as np
from scipy.signal import resample_poly
from math import gcd


class AudioNormalizer:
    """
    Real-time audio normalization:
      1. DC offset removal via exponential moving average (high-pass)
      2. Peak normalization (scales to [-1, +1])
    """

    def __init__(self, dc_alpha: float = 0.999):
        # DC offset tracking via leaky integrator
        self.dc_alpha = dc_alpha
        self.dc_estimate = 0.0

    def normalize(self, samples: np.ndarray) -> np.ndarray:
        """Remove DC offset and soft-limit to [-1, +1] without amplifying quiet signals."""
        if len(samples) == 0:
            return samples

        out = samples.astype(np.float32, copy=True)

        # 1. DC offset removal (exponential moving average high-pass)
        for i in range(len(out)):
            self.dc_estimate = self.dc_alpha * self.dc_estimate + (1.0 - self.dc_alpha) * out[i]
            out[i] -= self.dc_estimate

        # 2. Soft-limit: only attenuate if peak exceeds 1.0 (prevent clipping)
        #    Do NOT amplify quiet signals — preserves relative amplitude for VAD
        peak = np.max(np.abs(out))
        if peak > 1.0:
            out /= peak

        return out


class AudioResampler:
    """
    Integer-ratio polyphase resampler.
    Converts arbitrary input sample rate → target 16 kHz.
    Uses scipy.signal.resample_poly for efficient anti-aliased resampling.
    """

    def __init__(self, target_sr: int = 16000):
        self.target_sr = target_sr

    def resample(self, samples: np.ndarray, source_sr: int) -> np.ndarray:
        """Resample audio from source_sr to target_sr."""
        if source_sr == self.target_sr:
            return samples
        if len(samples) == 0:
            return samples

        # Compute simplest integer ratio
        g = gcd(self.target_sr, source_sr)
        up = self.target_sr // g
        down = source_sr // g

        resampled = resample_poly(samples, up, down).astype(np.float32)
        return resampled


class AudioRingBuffer:
    """
    Circular audio ring buffer for streaming PCM ingestion.
    
    Phase 2 config:
      - Sample rate: 16 kHz
      - Window:      1.0 s (16,000 samples)
      - Stride:      0.25 s (4,000 samples)
    
    Includes built-in normalization and resampling.
    Every stride trigger emits a processing window for downstream analysis.
    """

    def __init__(
        self,
        sample_rate: int = 16000,
        window_sec: float = 1.0,
        stride_sec: float = 0.25,
        enable_normalization: bool = True,
    ):
        self.sample_rate = sample_rate
        self.window_sec = window_sec
        self.stride_sec = stride_sec
        self.window_size = int(sample_rate * window_sec)
        self.stride_size = int(sample_rate * stride_sec)
        self.buffer = np.zeros(self.window_size, dtype=np.float32)
        self.write_pos = 0
        self.total_samples_received = 0
        self.samples_since_last_stride = 0
        self.stride_count = 0

        # Phase 2 components
        self.normalizer = AudioNormalizer() if enable_normalization else None
        self.resampler = AudioResampler(target_sr=sample_rate)

        # Timing statistics
        self._last_stride_time: float | None = None
        self._stride_interval_ms: float = 0.0

    def ingest(self, raw_samples: np.ndarray, source_sr: int = 16000) -> bool:
        """
        Phase 2 entry point: ingest raw PCM, resample if needed, normalize, 
        and append to the ring buffer.
        
        Returns True when a new 250 ms stride is ready for processing.
        """
        if raw_samples.ndim != 1:
            raw_samples = raw_samples.flatten()
        if len(raw_samples) == 0:
            return False

        # Step 1: Resample to target sample rate if source differs
        samples = self.resampler.resample(raw_samples, source_sr)

        # Step 2: Normalize (DC removal + peak normalization)
        if self.normalizer is not None:
            samples = self.normalizer.normalize(samples)

        # Step 3: Write into circular buffer
        return self._write(samples)

    def append(self, samples: np.ndarray) -> bool:
        """
        Legacy Phase 1 API: append pre-processed float32 samples directly.
        Kept for backward compatibility.
        """
        return self.ingest(samples, source_sr=self.sample_rate)

    def _write(self, samples: np.ndarray) -> bool:
        """Write samples into the ring buffer with wrap-around."""
        n = len(samples)
        self.total_samples_received += n
        self.samples_since_last_stride += n

        if n >= self.window_size:
            # Chunk bigger than buffer: keep latest window_size samples
            self.buffer[:] = samples[-self.window_size:]
            self.write_pos = 0
        else:
            end_pos = self.write_pos + n
            if end_pos <= self.window_size:
                self.buffer[self.write_pos:end_pos] = samples
            else:
                first_part = self.window_size - self.write_pos
                self.buffer[self.write_pos:] = samples[:first_part]
                self.buffer[:end_pos - self.window_size] = samples[first_part:]
            self.write_pos = end_pos % self.window_size

        # Stride trigger: fire every 0.25 s once we have at least one full window
        if (
            self.samples_since_last_stride >= self.stride_size
            and self.total_samples_received >= self.window_size
        ):
            self.samples_since_last_stride %= self.stride_size
            self.stride_count += 1

            # Track stride interval for monitoring
            now = time.perf_counter()
            if self._last_stride_time is not None:
                self._stride_interval_ms = round((now - self._last_stride_time) * 1000, 1)
            self._last_stride_time = now

            return True
        return False

    def get_latest_window(self) -> np.ndarray:
        """
        Extract the most recent 1.0 s contiguous window in chronological order.
        Zero-copy when write_pos is 0.
        """
        if self.write_pos == 0:
            return self.buffer.copy()
        return np.roll(self.buffer, -self.write_pos)

    def get_stats(self) -> dict:
        """Return buffer statistics for telemetry."""
        return {
            "total_samples": self.total_samples_received,
            "total_duration_sec": round(self.total_samples_received / self.sample_rate, 2),
            "stride_count": self.stride_count,
            "stride_interval_ms": self._stride_interval_ms,
            "buffer_fill_pct": round(
                min(100.0, self.total_samples_received / self.window_size * 100), 1
            ),
        }

    def reset(self):
        """Clear all buffer state."""
        self.buffer.fill(0)
        self.write_pos = 0
        self.total_samples_received = 0
        self.samples_since_last_stride = 0
        self.stride_count = 0
        self._last_stride_time = None
        self._stride_interval_ms = 0.0
        if self.normalizer:
            self.normalizer.dc_estimate = 0.0
