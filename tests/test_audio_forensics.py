"""
Automated Test Suite for Prerecorded Audio Forensics & Deepfake Detection.
Validates:
  1. AASIST output logit mapping: synthetic voice produces high spoof probability (fake_prob > 0.90).
  2. Multi-window full audio deepfake evaluation (predict_full_audio).
  3. Multilingual Speech-to-Text transcription and language identification.
  4. DSP full-audio acoustic metrics (F0 pitch, jitter, shimmer, centroid, rolloff).
  5. 128-point waveform envelope and 64-band frequency spectrum generation.
  6. Endpoint /api/analyze-audio produces CRITICAL UNTRUSTED trust score for synthetic audio.
"""

import sys
import os
import io
import unittest
import numpy as np

# Ensure backend and dependencies are on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'deps')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from deepfake_detector import deepfake_detector
from dsp import analyze_full_audio, analyze_audio_window
from transcriber import get_whisper_model
from main import app, decode_audio_bytes
from fastapi.testclient import TestClient


class TestAudioForensics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_mp3_path = '/home/deepin/.gemini/antigravity/brain/9a295c7b-f91f-4c38-91e4-72b6725ecf91/.user_uploaded/uploaded_media_1789197129828.mp3'
        cls.has_user_audio = os.path.exists(cls.test_mp3_path)

    def test_aasist_synthetic_voice_detection(self):
        """AASIST must flag synthetic audio as spoof (fake_prob > 0.90)."""
        if not self.has_user_audio:
            self.skipTest("User audio sample not found")

        with open(self.test_mp3_path, 'rb') as f:
            audio, sr = decode_audio_bytes(f.read())

        res = deepfake_detector.predict_full_audio(audio, sample_rate=16000)
        self.assertGreater(res["acoustic_fake_probability"], 0.90)
        self.assertTrue(res["pretrained"])
        self.assertEqual(res["model_type"], "aasist")
        self.assertGreater(len(res.get("window_scores", [])), 0)

    def test_dsp_full_audio_metrics(self):
        """DSP full audio analysis must generate waveform envelope, 64-band spectrum, and acoustic metrics."""
        sr = 16000
        duration = 3.0
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        # Synthetic test wave
        audio = (0.5 * np.sin(2 * np.pi * 220 * t) + 0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

        res = analyze_full_audio(audio, sample_rate=sr)
        self.assertTrue(res["is_speech"])
        self.assertGreater(res["f0"], 150)
        self.assertLess(res["f0"], 300)
        self.assertEqual(len(res["waveform_envelope"]), 128)
        self.assertEqual(len(res["spectrum_data"]), 64)
        self.assertGreater(res["spectral_centroid"], 0)
        self.assertGreater(res["rolloff"], 0)

    def test_whisper_multilingual_loading(self):
        """Whisper model must load on CPU and provide transcribe capability."""
        model = get_whisper_model()
        self.assertIsNotNone(model)

    def test_analyze_audio_endpoint_synthetic_detection(self):
        """Endpoint /api/analyze-audio must return CRITICAL UNTRUSTED for synthetic AI voice."""
        if not self.has_user_audio:
            self.skipTest("User audio sample not found")

        with open(self.test_mp3_path, 'rb') as f:
            file_bytes = f.read()

        resp = self.client.post(
            '/api/analyze-audio',
            files={'file': ('ai_sample.mp3', io.BytesIO(file_bytes), 'audio/mpeg')}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        # Signal 1: AI Voice
        self.assertGreater(data["acoustic_fake_probability"], 0.90)
        self.assertTrue(data["is_fake"])
        self.assertEqual(data["verdict"], "SYNTHETIC VOICE DETECTED")

        # Trust Score & Threat Level
        self.assertLess(data["trust_score"], 35.0)
        self.assertEqual(data["trust_verdict"], "CRITICAL UNTRUSTED")

        # Waveform & Spectrum
        self.assertEqual(len(data["waveform_data"]), 128)
        self.assertEqual(len(data["spectrum_data"]), 64)

        # STT & Language
        self.assertIn("transcript", data)
        self.assertTrue(len(data["transcript"]) > 0)
        self.assertEqual(data["detected_language"], "hi")


if __name__ == '__main__':
    unittest.main()

