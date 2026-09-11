"""
Phase 7: Multi-Signal Risk Fusion Engine
Combines three independent intelligence signals:
1. Acoustic Deepfake Probability (AASIST Graph Attention Network)
2. Biometric Speaker Verification Gap (ECAPA-TDNN 192-D Cosine Match)
3. Conversational Intent Risk (Meta Llama 3.2 1B & Semantic Rule Engine)

Mathematical Formulation:
    bio_penalty = max(0.0, 1.0 - speaker_match)
    normalized_weights = w_i / sum(w)
    risk = sum(w_i * signal_i) / sum(w) * 100.0

Example:
    Acoustic: 0.91 * 0.50 = 0.455
    Biometric mismatch: (1.0 - 0.34) * 0.30 = 0.198
    Intent: 0.87 * 0.20 = 0.174
    Total Risk = (0.455 + 0.198 + 0.174) * 100 = 82.7 -> Risk 82
"""

from typing import Dict, Any, Optional
import threading

POLICY_PRESETS: Dict[str, Dict[str, Any]] = {
    "balanced": {
        "name": "Balanced (50/30/20)",
        "description": "Standard balanced multi-modal defense (Default)",
        "w_acoustic": 0.50,
        "w_biometric": 0.30,
        "w_intent": 0.20,
        "low_max": 30.0,
        "critical_min": 70.0,
    },
    "anti_spoof": {
        "name": "Anti-Spoof Heavy (70/20/10)",
        "description": "Maximum weight on neural vocoder artifacts and synthetic acoustics",
        "w_acoustic": 0.70,
        "w_biometric": 0.20,
        "w_intent": 0.10,
        "low_max": 30.0,
        "critical_min": 70.0,
    },
    "biometric_strict": {
        "name": "Biometric Identity Heavy (20/60/20)",
        "description": "Strict caller identity verification against enrolled executive voiceprints",
        "w_acoustic": 0.20,
        "w_biometric": 0.60,
        "w_intent": 0.20,
        "low_max": 30.0,
        "critical_min": 70.0,
    },
    "social_eng": {
        "name": "Social-Engineering Guard (20/20/60)",
        "description": "Prioritizes urgency, pressure, credential theft, and wire fraud intent",
        "w_acoustic": 0.20,
        "w_biometric": 0.20,
        "w_intent": 0.60,
        "low_max": 30.0,
        "critical_min": 70.0,
    },
}


class RiskEngine:
    """Configurable Multi-Signal Risk Fusion Engine."""

    def __init__(
        self,
        w_acoustic: float = 0.50,
        w_biometric: float = 0.30,
        w_intent: float = 0.20,
        low_max: float = 30.0,
        critical_min: float = 70.0,
    ):
        self._lock = threading.Lock()
        self.w_acoustic = float(w_acoustic)
        self.w_biometric = float(w_biometric)
        self.w_intent = float(w_intent)
        self.low_max = float(low_max)
        self.critical_min = float(critical_min)
        self.active_preset = "balanced"

    def get_policy(self) -> Dict[str, Any]:
        """Return the current policy configuration, weights, and available presets."""
        with self._lock:
            w_sum = self.w_acoustic + self.w_biometric + self.w_intent
            return {
                "weights": {
                    "w_acoustic": round(self.w_acoustic, 3),
                    "w_biometric": round(self.w_biometric, 3),
                    "w_intent": round(self.w_intent, 3),
                    "sum": round(w_sum, 3),
                },
                "thresholds": {
                    "low_max": self.low_max,
                    "critical_min": self.critical_min,
                },
                "active_preset": self.active_preset,
                "presets": POLICY_PRESETS,
                "formula": f"{self.w_acoustic:.2f}*Acoustic + {self.w_biometric:.2f}*(1-Bio) + {self.w_intent:.2f}*Intent",
            }

    def update_policy(
        self,
        w_acoustic: Optional[float] = None,
        w_biometric: Optional[float] = None,
        w_intent: Optional[float] = None,
        low_max: Optional[float] = None,
        critical_min: Optional[float] = None,
        preset: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dynamically update risk fusion weights and action thresholds."""
        with self._lock:
            if preset and preset in POLICY_PRESETS:
                p = POLICY_PRESETS[preset]
                self.w_acoustic = p["w_acoustic"]
                self.w_biometric = p["w_biometric"]
                self.w_intent = p["w_intent"]
                self.low_max = p["low_max"]
                self.critical_min = p["critical_min"]
                self.active_preset = preset
            else:
                if w_acoustic is not None:
                    self.w_acoustic = max(0.0, float(w_acoustic))
                if w_biometric is not None:
                    self.w_biometric = max(0.0, float(w_biometric))
                if w_intent is not None:
                    self.w_intent = max(0.0, float(w_intent))
                if low_max is not None:
                    self.low_max = float(low_max)
                if critical_min is not None:
                    self.critical_min = float(critical_min)
                self.active_preset = "custom"

        return self.get_policy()

    def load_preset(self, preset_name: str) -> Dict[str, Any]:
        """Load a predefined policy preset by name."""
        if preset_name not in POLICY_PRESETS:
            raise ValueError(f"Unknown preset: '{preset_name}'. Valid presets: {list(POLICY_PRESETS.keys())}")
        return self.update_policy(preset=preset_name)

    def calculate(
        self,
        acoustic_fake: float,
        speaker_match: float,
        intent_score: float,
        is_speech: bool = True,
    ) -> Dict[str, Any]:
        """
        Execute risk fusion on the three intelligence signals.

        Args:
            acoustic_fake: 0.0 to 1.0 (AASIST synthetic voice probability)
            speaker_match: 0.0 to 1.0 (ECAPA-TDNN speaker verification score)
            intent_score: 0.0 to 1.0 (Llama 3.2 1B / semantic intent risk)
            is_speech: boolean indicating whether active speech is present

        Returns:
            Dict containing:
                - risk: composite risk score (0.0 to 100.0)
                - level: 'low', 'medium', or 'critical'
                - formula: mathematical formula string
                - contributions: percentage points added by each signal
                - normalized_signals: the sanitized input signals
                - weights: weights used for calculation
        """
        with self._lock:
            w_a = self.w_acoustic
            w_b = self.w_biometric
            w_i = self.w_intent
            low_max = self.low_max
            critical_min = self.critical_min

        # Sanitize signal values into [0.0, 1.0]
        a_fake = max(0.0, min(1.0, float(acoustic_fake)))
        spk_match = max(0.0, min(1.0, float(speaker_match)))
        i_score = max(0.0, min(1.0, float(intent_score)))

        # Biometric mismatch penalty: gap between 1.0 (perfect match) and actual match
        bio_penalty = max(0.0, 1.0 - spk_match)

        # In non-speech or idle ambient noise, keep baseline risk cleanly at 0.0
        if not is_speech:
            return {
                "risk": 0.0,
                "level": "low",
                "formula": f"{w_a:.2f}*Acoustic + {w_b:.2f}*(1-Bio) + {w_i:.2f}*Intent",
                "contributions": {
                    "acoustic": 0.0,
                    "biometric": 0.0,
                    "intent": 0.0,
                },
                "normalized_signals": {
                    "acoustic_fake": 0.0,
                    "speaker_match": 0.0,
                    "bio_penalty": 0.0,
                    "intent_score": 0.0,
                },
                "weights": {
                    "w_acoustic": round(w_a, 3),
                    "w_biometric": round(w_b, 3),
                    "w_intent": round(w_i, 3),
                },
                "thresholds": {
                    "low_max": low_max,
                    "critical_min": critical_min,
                },
            }

        # Weight normalization
        total_w = w_a + w_b + w_i
        norm_factor = total_w if total_w > 0 else 1.0

        # Calculate individual weighted contributions (scaled to 0-100)
        c_acoustic = (w_a * a_fake / norm_factor) * 100.0
        c_biometric = (w_b * bio_penalty / norm_factor) * 100.0
        c_intent = (w_i * i_score / norm_factor) * 100.0

        # Sum total risk
        raw_risk = c_acoustic + c_biometric + c_intent
        fused_risk = max(0.0, min(100.0, round(raw_risk, 1)))

        # Threat classification based on configured thresholds
        if fused_risk >= critical_min:
            level = "critical"
        elif fused_risk > low_max:
            level = "medium"
        else:
            level = "low"

        return {
            "risk": fused_risk,
            "level": level,
            "formula": f"{w_a:.2f}*Acoustic + {w_b:.2f}*(1-Bio) + {w_i:.2f}*Intent",
            "contributions": {
                "acoustic": round(c_acoustic, 1),
                "biometric": round(c_biometric, 1),
                "intent": round(c_intent, 1),
            },
            "normalized_signals": {
                "acoustic_fake": round(a_fake, 3),
                "speaker_match": round(spk_match, 3),
                "bio_penalty": round(bio_penalty, 3),
                "intent_score": round(i_score, 3),
            },
            "weights": {
                "w_acoustic": round(w_a, 3),
                "w_biometric": round(w_b, 3),
                "w_intent": round(w_i, 3),
            },
            "thresholds": {
                "low_max": low_max,
                "critical_min": critical_min,
            },
        }


# Global singleton instance
_GLOBAL_RISK_ENGINE: Optional[RiskEngine] = None
_INIT_LOCK = threading.Lock()


def get_risk_engine() -> RiskEngine:
    """Retrieve the global RiskEngine instance."""
    global _GLOBAL_RISK_ENGINE
    if _GLOBAL_RISK_ENGINE is None:
        with _INIT_LOCK:
            if _GLOBAL_RISK_ENGINE is None:
                _GLOBAL_RISK_ENGINE = RiskEngine(
                    w_acoustic=0.50,
                    w_biometric=0.30,
                    w_intent=0.20,
                    low_max=30.0,
                    critical_min=70.0,
                )
    return _GLOBAL_RISK_ENGINE

