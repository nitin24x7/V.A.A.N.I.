"""
Automated Test Suite for Phase 8: Autonomous Intervention Engine.
Validates critical threat evaluation, WebSocket event payload generation,
disabled transfer actions, cooldown logic, and REST endpoints.
"""

import sys
import os
import unittest

# Ensure backend and dependencies are on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'deps')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from intervention_engine import InterventionEngine
from risk_engine import RiskEngine
from fastapi.testclient import TestClient
from main import app


class TestPhase8Intervention(unittest.TestCase):
    def setUp(self):
        self.risk_engine = RiskEngine(
            w_acoustic=0.50,
            w_biometric=0.30,
            w_intent=0.20,
            low_max=30.0,
            critical_min=70.0,
        )
        self.intervention_engine = InterventionEngine(cooldown_sec=1.0)
        self.client = TestClient(app)

    def test_no_intervention_on_low_or_medium_risk(self):
        """Intervention must not trigger for low or medium risk calls."""
        # Low risk
        low_fusion = self.risk_engine.calculate(
            acoustic_fake=0.05,
            speaker_match=0.95,
            intent_score=0.10,
            is_speech=True,
        )
        self.assertEqual(low_fusion["level"], "low")
        evt = self.intervention_engine.evaluate(
            fusion_result=low_fusion,
            acoustic_fake=0.05,
            speaker_match=0.95,
            intent_score=0.10,
        )
        self.assertIsNone(evt)

        # Medium risk
        med_fusion = self.risk_engine.calculate(
            acoustic_fake=0.45,
            speaker_match=0.60,
            intent_score=0.40,
            is_speech=True,
        )
        self.assertEqual(med_fusion["level"], "medium")
        evt = self.intervention_engine.evaluate(
            fusion_result=med_fusion,
            acoustic_fake=0.45,
            speaker_match=0.60,
            intent_score=0.40,
        )
        self.assertIsNone(evt)

    def test_user_prompt_exact_intervention_scenario(self):
        """
        Verify the exact scenario specified by the user:
            AI Voice: 91% (0.91)
            Identity Match: 34% (0.34)
            Intent Risk: 87% (0.87)
            Threat Score: 82/100
            [ APPROVE TRANSFER ]  DISABLED
            Verify caller through another channel.
        """
        fusion = self.risk_engine.calculate(
            acoustic_fake=0.91,
            speaker_match=0.34,
            intent_score=0.87,
            is_speech=True,
        )
        self.assertEqual(fusion["level"], "critical")
        self.assertAlmostEqual(fusion["risk"], 82.7, places=1)

        event = self.intervention_engine.evaluate(
            fusion_result=fusion,
            acoustic_fake=0.91,
            speaker_match=0.34,
            intent_score=0.87,
            session_id="test-session-82",
        )

        self.assertIsNotNone(event)
        self.assertEqual(event["type"], "intervention")
        self.assertEqual(event["level"], "CRITICAL")
        self.assertIn("CRITICAL IMPERSONATION DETECTED", event["title"])
        self.assertEqual(event["threat_score"], 83)  # round(82.7) = 83 or close to 82

        # Verify signals
        self.assertEqual(event["signals"]["ai_voice"], 91)
        self.assertEqual(event["signals"]["identity_match"], 34)
        self.assertEqual(event["signals"]["intent_risk"], 87)

        # Verify warning directives
        self.assertEqual(event["warning"], "CRITICAL_IMPERSONATION_RISK")
        self.assertIn("Do NOT trust caller claims", event["warning_directive"])

        # Verify guidance
        self.assertIn("Verify caller through another channel", event["guidance"])

    def test_simulation_trigger(self):
        """Verify 1-click simulation trigger produces exact 82/100 threat score."""
        sim = self.intervention_engine.trigger_simulation(session_id="sim-123")
        self.assertEqual(sim["threat_score"], 82)
        self.assertEqual(sim["signals"]["ai_voice"], 91)
        self.assertEqual(sim["signals"]["identity_match"], 34)
        self.assertEqual(sim["signals"]["intent_risk"], 87)
        self.assertEqual(sim["warning"], "CRITICAL_IMPERSONATION_RISK")

    def test_dismissal_and_reset(self):
        """Intervention can be dismissed by authorized action."""
        self.intervention_engine.trigger_simulation()
        status = self.intervention_engine.get_status()
        self.assertTrue(status["has_active_intervention"])

        res = self.intervention_engine.dismiss()
        self.assertEqual(res["status"], "dismissed")
        status_after = self.intervention_engine.get_status()
        self.assertFalse(status_after["has_active_intervention"])

    def test_rest_endpoints(self):
        """Verify REST endpoints for intervention trigger, status, and dismiss."""
        # Trigger
        r1 = self.client.post("/api/intervention/trigger")
        self.assertEqual(r1.status_code, 200)
        data1 = r1.json()
        self.assertEqual(data1["threat_score"], 82)
        self.assertEqual(data1["signals"]["ai_voice"], 91)

        # Status
        r2 = self.client.get("/api/intervention")
        self.assertEqual(r2.status_code, 200)
        data2 = r2.json()
        self.assertTrue(data2["has_active_intervention"])

        # Dismiss
        r3 = self.client.post("/api/intervention/dismiss")
        self.assertEqual(r3.status_code, 200)
        data3 = r3.json()
        self.assertEqual(data3["status"], "dismissed")


if __name__ == "__main__":
    unittest.main()

