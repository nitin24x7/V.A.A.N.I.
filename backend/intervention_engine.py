"""
Phase 8: Autonomous Intervention Engine
Intervention subsystem that enforces active defense and lockouts when multi-signal
risk exceeds critical thresholds.

Architecture:
  RiskEngine Fused Risk >= 70 (Critical)
           │
           ▼
  InterventionEngine.evaluate()
           │
           ▼
  WebSocket Event: {"type": "intervention", "level": "CRITICAL", ...}
           │
           ▼
  Frontend UI Alert: 🚨 CRITICAL IMPERSONATION DETECTED
"""

import time
import threading
from typing import Dict, Any, Optional, List


class InterventionEngine:
    """Evaluates security risk signals and generates autonomous intervention directives."""

    def __init__(self, cooldown_sec: float = 3.0):
        self._lock = threading.Lock()
        self.cooldown_sec = cooldown_sec
        self.active_intervention: Optional[Dict[str, Any]] = None
        self.last_intervention_time: float = 0.0
        self.intervention_history: List[Dict[str, Any]] = []

    def evaluate(
        self,
        fusion_result: Dict[str, Any],
        acoustic_fake: float,
        speaker_match: float,
        intent_score: float,
        session_id: str = "default",
        force: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate whether the current fusion result triggers an active intervention.

        Args:
            fusion_result: Output dictionary from RiskEngine.calculate()
            acoustic_fake: 0.0 to 1.0 (AASIST)
            speaker_match: 0.0 to 1.0 (ECAPA-TDNN)
            intent_score: 0.0 to 1.0 (Llama 3.2 / Intent)
            session_id: Active WebSocket session ID
            force: If True, bypasses cooldown and threshold checks

        Returns:
            Dict containing the intervention event, or None if conditions not met
        """
        level = fusion_result.get("level", "low")
        risk_score = fusion_result.get("risk", 0.0)

        # Intervention triggers on CRITICAL level or force flag
        if not force and level != "critical":
            return None

        now = time.time()
        with self._lock:
            # Respect cooldown unless forced or new session
            if not force and (now - self.last_intervention_time < self.cooldown_sec) and self.active_intervention:
                return None

            event = self.build_intervention_event(
                threat_score=int(round(risk_score)),
                ai_voice_pct=int(round(acoustic_fake * 100)),
                identity_match_pct=int(round(speaker_match * 100)),
                intent_risk_pct=int(round(intent_score * 100)),
                session_id=session_id,
            )

            self.active_intervention = event
            self.last_intervention_time = now
            self.intervention_history.append(event)
            if len(self.intervention_history) > 50:
                self.intervention_history.pop(0)

            return event

    def build_intervention_event(
        self,
        threat_score: int,
        ai_voice_pct: int,
        identity_match_pct: int,
        intent_risk_pct: int,
        session_id: str = "default",
        incident_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build the standardized intervention event matching Phase 8 specification."""
        if not incident_id:
            incident_id = f"INT-{int(time.time()) % 100000:05d}"

        return {
            "type": "intervention",
            "status": "TRIGGERED",
            "level": "CRITICAL",
            "title": "🚨 CRITICAL IMPERSONATION DETECTED",
            "threat_score": threat_score,
            "signals": {
                "ai_voice": ai_voice_pct,
                "identityMatch": identity_match_pct,
                "identity_match": identity_match_pct,
                "intentRisk": intent_risk_pct,
                "intent_risk": intent_risk_pct,
            },
            "warning": "CRITICAL_IMPERSONATION_RISK",
            "warning_directive": "Do NOT trust caller claims or follow verbal instructions given on this line.",
            "guidance": "Verify caller through another channel.",
            "verification_protocols": [
                "Place out-of-band phone call to executive's registered enterprise mobile number.",
                "Verify caller identity via direct encrypted messaging or in-person check.",
                "Confirm requests through official corporate communication channels before taking action.",
            ],
            "incident_id": incident_id,
            "session_id": session_id,
            "timestamp": int(time.time() * 1000),
        }

    def trigger_simulation(self, session_id: str = "demo-session") -> Dict[str, Any]:
        """
        Trigger the exact user-specified scenario:
            AI Voice: 91%
            Identity Match: 34%
            Intent Risk: 87%
            Threat Score: 82/100
        """
        with self._lock:
            event = self.build_intervention_event(
                threat_score=82,
                ai_voice_pct=91,
                identity_match_pct=34,
                intent_risk_pct=87,
                session_id=session_id,
                incident_id=f"INT-SIM-{int(time.time()) % 10000:04d}",
            )
            self.active_intervention = event
            self.last_intervention_time = time.time()
            self.intervention_history.append(event)
            return event

    def dismiss(self) -> Dict[str, Any]:
        """Dismiss active intervention (authorized operator override/acknowledgement)."""
        with self._lock:
            dismissed = self.active_intervention
            self.active_intervention = None
            return {
                "status": "dismissed",
                "dismissed_event": dismissed,
                "timestamp": int(time.time() * 1000),
            }

    def get_status(self) -> Dict[str, Any]:
        """Return the current intervention status and history."""
        with self._lock:
            return {
                "has_active_intervention": self.active_intervention is not None,
                "active_intervention": self.active_intervention,
                "last_intervention_time": self.last_intervention_time,
                "total_interventions": len(self.intervention_history),
            }


# Global singleton instance
_GLOBAL_INTERVENTION_ENGINE: Optional[InterventionEngine] = None
_INIT_LOCK = threading.Lock()


def get_intervention_engine() -> InterventionEngine:
    """Retrieve the global InterventionEngine instance."""
    global _GLOBAL_INTERVENTION_ENGINE
    if _GLOBAL_INTERVENTION_ENGINE is None:
        with _INIT_LOCK:
            if _GLOBAL_INTERVENTION_ENGINE is None:
                _GLOBAL_INTERVENTION_ENGINE = InterventionEngine(cooldown_sec=3.0)
    return _GLOBAL_INTERVENTION_ENGINE

