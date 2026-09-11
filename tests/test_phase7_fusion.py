"""
Automated Test Suite for Phase 7: Multi-Signal Risk Fusion Engine.
Validates mathematical fusion formulation, weight configuration, normalization,
idle baseline clamping, and preset switching.
"""

import sys
import os
import unittest

# Ensure backend and dependencies are on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'deps')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from risk_engine import RiskEngine, POLICY_PRESETS


class TestPhase7RiskFusion(unittest.TestCase):
    def setUp(self):
        # Create a fresh RiskEngine instance for each test
        self.engine = RiskEngine(
            w_acoustic=0.50,
            w_biometric=0.30,
            w_intent=0.20,
            low_max=30.0,
            critical_min=70.0,
        )

    def test_user_prompt_exact_fusion_scenario(self):
        """
        Verify the exact scenario specified by the user:
            Acoustic: 0.91
            Biometric: 0.34  (gap = 1 - 0.34 = 0.66)
            Intent: 0.87
            Weights: 0.50, 0.30, 0.20
            Expected Risk = 82.7 (~82-83)
        """
        res = self.engine.calculate(
            acoustic_fake=0.91,
            speaker_match=0.34,
            intent_score=0.87,
            is_speech=True,
        )

        # 0.50 * 0.91 = 0.455 (45.5)
        # 0.30 * 0.66 = 0.198 (19.8)
        # 0.20 * 0.87 = 0.174 (17.4)
        # Total = 82.7
        self.assertAlmostEqual(res["risk"], 82.7, places=1)
        self.assertEqual(res["level"], "critical")
        self.assertAlmostEqual(res["contributions"]["acoustic"], 45.5, places=1)
        self.assertAlmostEqual(res["contributions"]["biometric"], 19.8, places=1)
        self.assertAlmostEqual(res["contributions"]["intent"], 17.4, places=1)

    def test_zero_baseline_when_no_speech(self):
        """When not speaking (ambient/idle), risk must strictly remain 0.0."""
        res = self.engine.calculate(
            acoustic_fake=0.91,
            speaker_match=0.34,
            intent_score=0.87,
            is_speech=False,
        )

        self.assertEqual(res["risk"], 0.0)
        self.assertEqual(res["level"], "low")
        self.assertEqual(res["contributions"]["acoustic"], 0.0)
        self.assertEqual(res["contributions"]["biometric"], 0.0)
        self.assertEqual(res["contributions"]["intent"], 0.0)

    def test_perfect_legitimate_executive_call(self):
        """Legitimate call: Acoustic=0.02, SpeakerMatch=0.98, Intent=0.01."""
        res = self.engine.calculate(
            acoustic_fake=0.02,
            speaker_match=0.98,
            intent_score=0.01,
            is_speech=True,
        )

        # 0.50 * 0.02 + 0.30 * 0.02 + 0.20 * 0.01 = 0.01 + 0.006 + 0.002 = 0.018 * 100 = 1.8
        self.assertLess(res["risk"], 10.0)
        self.assertEqual(res["level"], "low")

    def test_weight_normalization(self):
        """Verify normalization when weights do not sum to 1.0 (e.g. 70, 20, 10)."""
        self.engine.update_policy(w_acoustic=70, w_biometric=20, w_intent=10)
        res = self.engine.calculate(
            acoustic_fake=1.0,
            speaker_match=0.0,
            intent_score=1.0,
            is_speech=True,
        )

        # All worst signals -> Risk should be exactly 100.0
        self.assertEqual(res["risk"], 100.0)
        self.assertEqual(res["level"], "critical")

    def test_preset_switching(self):
        """Verify switching between predefined policy presets."""
        for preset_name in ["balanced", "anti_spoof", "biometric_strict", "social_eng"]:
            policy = self.engine.load_preset(preset_name)
            self.assertEqual(policy["active_preset"], preset_name)
            preset_def = POLICY_PRESETS[preset_name]
            self.assertEqual(policy["weights"]["w_acoustic"], preset_def["w_acoustic"])
            self.assertEqual(policy["weights"]["w_biometric"], preset_def["w_biometric"])
            self.assertEqual(policy["weights"]["w_intent"], preset_def["w_intent"])

    def test_custom_weight_update(self):
        """Verify dynamic custom weight updating."""
        policy = self.engine.update_policy(w_acoustic=0.40, w_biometric=0.40, w_intent=0.20)
        self.assertEqual(policy["active_preset"], "custom")
        self.assertEqual(policy["weights"]["w_acoustic"], 0.40)
        self.assertEqual(policy["weights"]["w_biometric"], 0.40)
        self.assertEqual(policy["weights"]["w_intent"], 0.20)


class TestPhase7PolicyEndpoints(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        import main
        self.client = TestClient(main.app)

    def test_get_policy_endpoint(self):
        """Test GET /api/policy."""
        resp = self.client.get("/api/policy")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("weights", data)
        self.assertIn("thresholds", data)
        self.assertIn("presets", data)
        self.assertIn("formula", data)

    def test_post_policy_endpoint(self):
        """Test POST /api/policy with camelCase and snake_case."""
        resp = self.client.post("/api/policy", json={
            "wAcoustic": 0.60,
            "wBiometric": 0.25,
            "wIntent": 0.15,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["weights"]["w_acoustic"], 0.60)
        self.assertEqual(data["weights"]["w_biometric"], 0.25)
        self.assertEqual(data["weights"]["w_intent"], 0.15)

    def test_activate_preset_endpoint(self):
        """Test POST /api/policy/preset/{name}."""
        resp = self.client.post("/api/policy/preset/anti_spoof")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["active_preset"], "anti_spoof")
        self.assertEqual(data["weights"]["w_acoustic"], 0.70)

        # Reset back to balanced
        resp = self.client.post("/api/policy/preset/balanced")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["active_preset"], "balanced")


if __name__ == '__main__':
    unittest.main()

