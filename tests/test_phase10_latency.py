"""
Phase 10 — Latency Optimization & Milestone Timing Unit Tests.

Validates:
  1. Stage-by-stage latency tracking precision and milestone calculation.
  2. Sub-400ms SLA compliance verification.
  3. AASIST fast direct-streaming inference (< 250ms).
  4. End-to-end benchmark pipeline execution.
  5. GET /api/benchmark/latency API endpoint contract.
"""

import sys
import os
import time
import unittest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'deps'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


class TestLatencyTracker(unittest.TestCase):
    """Test stage marking, duration calculation, and milestone timing."""

    def test_tracker_milestones_and_breakdown(self):
        from latency_tracker import LatencyTracker

        t0 = time.perf_counter()
        tracker = LatencyTracker(t_arrive=t0)

        # Simulate stage latencies
        tracker.mark_vad(duration_ms=18.5)
        tracker.mark_detection(duration_ms=115.0)
        tracker.mark_identity(duration_ms=12.0)
        tracker.mark_stt(duration_ms=1.5)
        tracker.mark_intent(duration_ms=1.2)
        tracker.mark_risk(duration_ms=0.5)
        tracker.mark_alert(duration_ms=25.0)

        metrics = tracker.get_metrics()
        self.assertIn("milestones", metrics)
        self.assertIn("breakdown", metrics)
        self.assertIn("sla", metrics)

        breakdown = metrics["breakdown"]
        self.assertEqual(breakdown["vad_ms"], 18.5)
        self.assertEqual(breakdown["acoustic_ms"], 115.0)
        self.assertEqual(breakdown["speaker_ms"], 12.0)
        self.assertEqual(breakdown["stt_ms"], 1.5)
        self.assertEqual(breakdown["intent_ms"], 1.2)
        self.assertEqual(breakdown["fusion_ms"], 0.5)

        sla = metrics["sla"]
        self.assertEqual(sla["target_ms"], 400.0)
        self.assertTrue(sla["compliant"])
        self.assertGreater(sla["margin_ms"], 0)

    def test_sla_compliance_logic(self):
        from latency_tracker import LatencyTracker

        # Case 1: Fast run (< 400ms)
        t_fast = time.perf_counter() - 0.230  # 230ms ago
        tracker_fast = LatencyTracker(t_arrive=t_fast)
        tracker_fast.mark_alert(duration_ms=230.0)
        metrics_fast = tracker_fast.get_metrics()
        self.assertTrue(metrics_fast["sla"]["compliant"])

        # Case 2: Slow run (> 400ms)
        t_slow = time.perf_counter() - 0.500  # 500ms ago
        tracker_slow = LatencyTracker(t_arrive=t_slow)
        tracker_slow.t_alert = time.perf_counter()
        metrics_slow = tracker_slow.get_metrics()
        self.assertFalse(metrics_slow["sla"]["compliant"])
        self.assertEqual(metrics_slow["sla"]["margin_ms"], 0.0)


class TestAasistLatencyOptimization(unittest.TestCase):
    """Test AASIST direct streaming evaluation (< 250ms)."""

    def test_fast_mode_inference_speed(self):
        from deepfake_detector import deepfake_detector

        dummy_audio = np.random.randn(16000).astype(np.float32) * 0.3
        # Warmup
        _ = deepfake_detector.predict(dummy_audio, sample_rate=16000, fast_mode=True)

        t0 = time.perf_counter()
        res = deepfake_detector.predict(dummy_audio, sample_rate=16000, fast_mode=True)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        self.assertIn("acoustic_fake_probability", res)
        self.assertGreaterEqual(res["acoustic_fake_probability"], 0.0)
        self.assertLessEqual(res["acoustic_fake_probability"], 1.0)
        # Fast direct evaluation on 1.0s window should be well under 250ms
        self.assertLess(elapsed_ms, 250.0, f"AASIST took {elapsed_ms:.1f}ms, expected < 250ms")


class TestPipelineBenchmark(unittest.TestCase):
    """Test full live pipeline benchmark orchestrator."""

    def test_benchmark_live_pipeline_returns_valid_milestones(self):
        from latency_tracker import benchmark_live_pipeline

        metrics = benchmark_live_pipeline()

        self.assertIn("milestones", metrics)
        self.assertIn("breakdown", metrics)
        self.assertIn("sla", metrics)
        self.assertIn("results", metrics)

        ms = metrics["milestones"]
        self.assertIn("audio_to_detection_ms", ms)
        self.assertIn("audio_to_identity_ms", ms)
        self.assertIn("audio_to_risk_ms", ms)
        self.assertIn("audio_to_intervention_ms", ms)

        # Assert all milestones are non-negative and satisfy < 400ms SLA
        self.assertGreater(ms["audio_to_detection_ms"], 0.0)
        self.assertGreater(ms["audio_to_identity_ms"], 0.0)
        self.assertGreater(ms["audio_to_risk_ms"], 0.0)
        self.assertGreater(ms["audio_to_intervention_ms"], 0.0)

        self.assertLess(ms["audio_to_detection_ms"], 400.0)
        self.assertLess(ms["audio_to_identity_ms"], 400.0)
        self.assertLess(ms["audio_to_risk_ms"], 400.0)
        self.assertLess(ms["audio_to_intervention_ms"], 400.0)

        self.assertTrue(metrics["sla"]["compliant"])


class TestLatencyBenchmarkEndpoint(unittest.TestCase):
    """Test GET /api/benchmark/latency API endpoint."""

    def test_get_latency_benchmark_api(self):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        response = client.get("/api/benchmark/latency")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn("milestones", data)
        self.assertIn("breakdown", data)
        self.assertIn("sla", data)
        self.assertIn("results", data)
        self.assertTrue(data["sla"]["compliant"])


if __name__ == '__main__':
    unittest.main()

