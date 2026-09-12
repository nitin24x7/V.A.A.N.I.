"""
Phase 9 — Telephony Robustness: Unit Tests.

Tests each degradation transform for correctness and validates
the full robustness suite orchestrator.
"""
import sys
import os
import unittest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'deps'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


class TestNarrowband8kHz(unittest.TestCase):
    """Test 8 kHz narrowband resampling."""

    def test_output_length_preserved(self):
        from telephony_simulator import apply_narrowband_8khz
        audio = np.random.randn(32000).astype(np.float32) * 0.5  # 2 seconds
        result = apply_narrowband_8khz(audio, sample_rate=16000)
        self.assertEqual(len(result), len(audio))

    def test_high_frequencies_removed(self):
        """After 8 kHz narrowband, energy above 4 kHz should be heavily attenuated."""
        from telephony_simulator import apply_narrowband_8khz
        sr = 16000
        # Generate a 6 kHz tone (above Nyquist of 8 kHz)
        t = np.linspace(0, 1.0, sr, endpoint=False, dtype=np.float32)
        tone_6k = np.sin(2 * np.pi * 6000 * t).astype(np.float32)
        result = apply_narrowband_8khz(tone_6k, sample_rate=sr)

        # The 6 kHz tone should be almost completely destroyed
        original_energy = np.sum(tone_6k ** 2)
        result_energy = np.sum(result ** 2)
        attenuation_db = 10 * np.log10(result_energy / (original_energy + 1e-10))
        self.assertLess(attenuation_db, -20)  # At least 20 dB attenuation

    def test_low_frequencies_preserved(self):
        """After 8 kHz narrowband, energy below 3 kHz should be mostly preserved."""
        from telephony_simulator import apply_narrowband_8khz
        sr = 16000
        t = np.linspace(0, 1.0, sr, endpoint=False, dtype=np.float32)
        tone_1k = np.sin(2 * np.pi * 1000 * t).astype(np.float32)
        result = apply_narrowband_8khz(tone_1k, sample_rate=sr)

        correlation = float(np.corrcoef(tone_1k, result)[0, 1])
        self.assertGreater(correlation, 0.90)


class TestG711MuLaw(unittest.TestCase):
    """Test G.711 μ-law codec simulation."""

    def test_output_length_preserved(self):
        from telephony_simulator import apply_g711_mulaw
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = apply_g711_mulaw(audio, sample_rate=16000)
        self.assertEqual(len(result), len(audio))

    def test_roundtrip_correlation(self):
        """μ-law roundtrip should preserve signal structure (correlation > 0.80)."""
        from telephony_simulator import apply_g711_mulaw
        sr = 16000
        t = np.linspace(0, 1.0, sr, endpoint=False, dtype=np.float32)
        speech_like = (np.sin(2 * np.pi * 200 * t) * 0.4 +
                       np.sin(2 * np.pi * 800 * t) * 0.2).astype(np.float32)
        result = apply_g711_mulaw(speech_like, sample_rate=sr)
        correlation = float(np.corrcoef(speech_like, result)[0, 1])
        self.assertGreater(correlation, 0.80)

    def test_encode_decode_range(self):
        """Output should remain in [-1, 1]."""
        from telephony_simulator import apply_g711_mulaw
        audio = np.random.randn(8000).astype(np.float32) * 0.8
        result = apply_g711_mulaw(audio, sample_rate=16000)
        self.assertLessEqual(float(np.max(np.abs(result))), 1.01)


class TestG711ALaw(unittest.TestCase):
    """Test G.711 A-law codec simulation."""

    def test_output_length_preserved(self):
        from telephony_simulator import apply_g711_alaw
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = apply_g711_alaw(audio, sample_rate=16000)
        self.assertEqual(len(result), len(audio))

    def test_roundtrip_correlation(self):
        """A-law roundtrip should preserve signal structure (correlation > 0.80)."""
        from telephony_simulator import apply_g711_alaw
        sr = 16000
        t = np.linspace(0, 1.0, sr, endpoint=False, dtype=np.float32)
        speech_like = (np.sin(2 * np.pi * 200 * t) * 0.4 +
                       np.sin(2 * np.pi * 800 * t) * 0.2).astype(np.float32)
        result = apply_g711_alaw(speech_like, sample_rate=sr)
        correlation = float(np.corrcoef(speech_like, result)[0, 1])
        self.assertGreater(correlation, 0.80)


class TestAdditiveNoise(unittest.TestCase):
    """Test additive noise injection."""

    def test_output_length_preserved(self):
        from telephony_simulator import apply_additive_noise
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = apply_additive_noise(audio, snr_db=15.0)
        self.assertEqual(len(result), len(audio))

    def test_noise_added(self):
        """Result should differ from input (noise was actually added)."""
        from telephony_simulator import apply_additive_noise
        audio = np.sin(np.linspace(0, 2 * np.pi * 440, 16000)).astype(np.float32) * 0.5
        result = apply_additive_noise(audio, snr_db=10.0)
        diff = np.sum(np.abs(result - audio))
        self.assertGreater(diff, 1.0)  # Noise should cause measurable difference

    def test_output_range(self):
        """Output should remain in [-1, 1]."""
        from telephony_simulator import apply_additive_noise
        audio = np.random.randn(16000).astype(np.float32) * 0.9
        result = apply_additive_noise(audio, snr_db=5.0)
        self.assertLessEqual(float(np.max(np.abs(result))), 1.01)


class TestReverb(unittest.TestCase):
    """Test room reverb convolution."""

    def test_output_length_preserved(self):
        from telephony_simulator import apply_reverb
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = apply_reverb(audio, rt60=0.3)
        self.assertEqual(len(result), len(audio))

    def test_reverb_changes_signal(self):
        """Reverb should modify the signal."""
        from telephony_simulator import apply_reverb
        audio = np.zeros(16000, dtype=np.float32)
        audio[0] = 1.0  # Impulse
        result = apply_reverb(audio, rt60=0.3)
        # After reverb, energy should be spread beyond the initial impulse
        tail_energy = np.sum(result[100:] ** 2)
        self.assertGreater(tail_energy, 0.01)

    def test_output_range(self):
        from telephony_simulator import apply_reverb
        audio = np.random.randn(16000).astype(np.float32) * 0.7
        result = apply_reverb(audio, rt60=0.3)
        self.assertLessEqual(float(np.max(np.abs(result))), 1.01)


class TestPacketLoss(unittest.TestCase):
    """Test VoIP packet loss simulation."""

    def test_output_length_preserved(self):
        from telephony_simulator import apply_packet_loss
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = apply_packet_loss(audio, loss_rate=0.10)
        self.assertEqual(len(result), len(audio))

    def test_frames_zeroed(self):
        """With 10% loss on 50 frames (1 second), roughly 5 frames should be zeroed."""
        from telephony_simulator import apply_packet_loss
        audio = np.ones(16000, dtype=np.float32) * 0.5  # Non-zero constant
        result = apply_packet_loss(audio, loss_rate=0.10, frame_ms=20.0)

        frame_samples = int(16000 * 20.0 / 1000.0)  # 320
        n_frames = len(audio) // frame_samples  # 50

        zero_frames = 0
        for i in range(n_frames):
            s = i * frame_samples
            e = s + frame_samples
            if np.all(result[s:e] == 0.0):
                zero_frames += 1

        # With 10% loss rate and seed=77, expect some frames zeroed
        self.assertGreater(zero_frames, 0)
        self.assertLess(zero_frames, n_frames)  # Not all frames dropped


class TestRobustnessSuite(unittest.TestCase):
    """Test the full robustness suite orchestrator."""

    def test_returns_all_conditions(self):
        from telephony_simulator import run_robustness_suite
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = run_robustness_suite(audio, sample_rate=16000)

        self.assertIn('conditions', result)
        self.assertIn('summary', result)
        self.assertIn('duration_sec', result)
        self.assertEqual(len(result['conditions']), 7)

    def test_condition_structure(self):
        from telephony_simulator import run_robustness_suite
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = run_robustness_suite(audio, sample_rate=16000)

        for cond in result['conditions']:
            self.assertIn('name', cond)
            self.assertIn('fake_probability', cond)
            self.assertIn('trust_score', cond)
            self.assertIn('rating', cond)
            self.assertIn('inference_ms', cond)
            self.assertGreaterEqual(cond['fake_probability'], 0.0)
            self.assertLessEqual(cond['fake_probability'], 1.0)
            self.assertIn(cond['rating'], ['TRUSTED', 'SUSPICIOUS', 'CRITICAL'])

    def test_summary_structure(self):
        from telephony_simulator import run_robustness_suite
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = run_robustness_suite(audio, sample_rate=16000)

        summary = result['summary']
        self.assertIn('all_detected', summary)
        self.assertIn('min_fake_prob', summary)
        self.assertIn('max_fake_prob', summary)
        self.assertIn('mean_fake_prob', summary)
        self.assertIn('robust', summary)
        self.assertLessEqual(summary['min_fake_prob'], summary['max_fake_prob'])

    def test_condition_names(self):
        """All 7 expected condition names should be present."""
        from telephony_simulator import run_robustness_suite
        audio = np.random.randn(16000).astype(np.float32) * 0.3
        result = run_robustness_suite(audio, sample_rate=16000)

        names = [c['name'] for c in result['conditions']]
        self.assertIn('Clean 16 kHz', names)
        self.assertIn('8 kHz Narrowband', names)
        self.assertIn('G.711 μ-law', names)
        self.assertIn('G.711 A-law', names)
        self.assertIn('Noise (15 dB SNR)', names)
        self.assertIn('Room Reverb (RT60=0.3s)', names)
        self.assertIn('Packet Loss (10%)', names)


if __name__ == '__main__':
    unittest.main()

