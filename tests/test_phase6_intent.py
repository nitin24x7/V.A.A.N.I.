"""
Phase 6 Automated Test Suite: AI-Powered Intent & Social-Engineering Analysis Agent.
Validates multi-vector social engineering detection, schema compliance, and REST endpoints.
"""

import sys
import os
import unittest

# Ensure backend and dependencies are on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'deps')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from intent_analyzer import SocialEngineeringAgent, get_intent_analyzer
from fastapi.testclient import TestClient
import main


class TestPhase6IntentAnalyzer(unittest.TestCase):
    def setUp(self):
        self.agent = get_intent_analyzer()
        self.agent.reset_session()
        self.client = TestClient(main.app)

    def test_ceo_wire_fraud_triad(self):
        """Test classic CEO/CFO wire fraud triad (Authority + Urgency + Bypass)."""
        transcript = (
            "Hello, this is the CFO calling from executive office. "
            "You need to approve this transfer immediately. "
            "Penalty fees are accumulating, please bypass standard dual-authorization "
            "and wire $450,000 to the offshore escrow account."
        )
        res = self.agent.analyze(transcript, mode="attack")

        # Schema validation
        for key in ["intent_risk", "risk_level", "threats", "confidence", "evidence", "analysis_time_ms"]:
            self.assertIn(key, res)

        self.assertEqual(res["risk_level"], "HIGH")
        self.assertGreaterEqual(res["intent_risk"], 0.80)
        self.assertGreaterEqual(res["confidence"], 0.85)

        # Expected threats
        self.assertIn("authority_impersonation", res["threats"])
        self.assertIn("urgency_manipulation", res["threats"])
        self.assertIn("verification_bypass", res["threats"])
        self.assertIn("financial_manipulation", res["threats"])

        # Latency check: must be real-time (< 10 ms on CPU)
        self.assertLess(res["analysis_time_ms"], 10.0)

    def test_credential_harvesting_attack(self):
        """Test MFA / OTP credential harvesting attempt."""
        transcript = (
            "This is IT security compliance. We have an emergency alert on your account. "
            "Read me your OTP one-time passcode and portal credentials immediately."
        )
        res = self.agent.analyze(transcript, mode="attack")

        self.assertEqual(res["risk_level"], "HIGH")
        self.assertIn("sensitive_info_request", res["threats"])
        self.assertIn("urgency_manipulation", res["threats"])

    def test_inconsistency_evasion_tactics(self):
        """Test channel inconsistency and evasion pretext."""
        transcript = (
            "I am calling from my personal phone because I am traveling. "
            "Keep this strictly off-channel and do not use Slack."
        )
        res = self.agent.analyze(transcript)

        self.assertIn("inconsistency_detection", res["threats"])

    def test_benign_business_conversation(self):
        """Test benign routine enterprise conversation with 0 threats."""
        transcript = (
            "Hi team, just checking in on the quarterly budget report. "
            "Please send over the updated reconciliation sheet when you get a chance. "
            "All figures look aligned with our projections."
        )
        res = self.agent.analyze(transcript, mode="legitimate")

        self.assertEqual(res["risk_level"], "LOW")
        self.assertLessEqual(res["intent_risk"], 0.15)
        self.assertEqual(len(res["threats"]), 0)

    def test_placeholder_transcripts(self):
        """Test empty and default listening placeholders."""
        for phrase in ["", "   ", "Listening on microphone stream...", "..."]:
            res = self.agent.analyze(phrase, mode="legitimate")
            self.assertEqual(res["risk_level"], "LOW")
            self.assertEqual(len(res["threats"]), 0)

    def test_rest_api_analyze_intent_endpoint(self):
        """Test POST /api/analyze-intent endpoint."""
        payload = {
            "text": "Wire $450,000 immediately and bypass dual-authorization",
            "mode": "attack",
        }
        response = self.client.post("/api/analyze-intent", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["risk_level"], "HIGH")
        self.assertIn("urgency_manipulation", data["threats"])
    def test_session_transcription_accumulation(self):
        """Test multi-turn session transcription accumulation in StreamingTranscriber."""
        from transcriber import StreamingTranscriber
        st = StreamingTranscriber()
        st.reset()
        st.session_transcript = "Hello this is the CFO."
        st.set_live_text("Hello this is the CFO. Please bypass standard verification and wire funds.")
        self.assertIn("CFO", st.session_transcript)
        self.assertIn("bypass", st.session_transcript)
        self.assertIn("wire funds", st.current_text)

    def test_background_slm_incorporation(self):
        """Test that analyze() updates score and reasoning when a background SLM result arrives."""
        self.agent.reset_session()
        self.agent._last_slm_result = {
            "intent_risk": 0.94,
            "risk_level": "HIGH",
            "threats": ["authority_impersonation", "urgency_manipulation"],
            "confidence": 0.96,
            "explanation": "Executive impersonation with immediate coercive wire instruction."
        }
        self.agent._slm_result_fresh = True
        res = self.agent.analyze("Please wire the funds immediately as discussed.")
        self.assertEqual(res["risk_level"], "HIGH")
        self.assertGreaterEqual(res["intent_risk"], 0.70)
        self.assertIn("authority_impersonation", res["threats"])
        self.assertEqual(res["slm_reasoning"], "Executive impersonation with immediate coercive wire instruction.")


if __name__ == "__main__":
    unittest.main()

