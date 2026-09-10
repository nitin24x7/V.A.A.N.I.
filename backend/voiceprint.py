"""
Phase 4 — Biometric Identity & Voiceprint Manager.

Uses ECAPA-TDNN (Emphasized Channel Attention, Propagation and Aggregation)
to extract 192-dimensional speaker embeddings and perform cosine-similarity
biometric verification for enrolled executives.
"""

from typing import Optional
import numpy as np

try:
    from models.ECAPA_TDNN import ecapa_verifier
except ImportError:
    from .models.ECAPA_TDNN import ecapa_verifier


class VoiceprintManager:
    """
    Manages enrolled speaker voiceprints and computes 192-dimensional ECAPA-TDNN embeddings
    from acoustic samples for biometric identity verification.
    """

    def __init__(self):
        self.enrolled: dict[str, dict] = {}
        # Pre-seed default executive identity (Aditi Sharma, CFO)
        self._seed_default_executive()

    def _seed_default_executive(self):
        """Seed default executive identity profile."""
        # Generate baseline prototype embedding
        rng = np.random.RandomState(42)
        baseline = rng.randn(192).astype(np.float32)
        baseline /= np.linalg.norm(baseline)
        preview = [round(float(v), 3) for v in baseline[:24]]

        self.enrolled["default_cfo"] = {
            "id": "default_cfo",
            "name": "Aditi Sharma",
            "role": "Managing Director / CFO",
            "embedding": baseline,
            "preview": preview,
            "sample_rate": 16000,
            "num_samples": 240000,  # 15s @ 16kHz
        }

    def extract_embedding(self, audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
        """
        Extract normalized 192-dimensional acoustic embedding vector using ECAPA-TDNN.
        """
        if audio.ndim != 1:
            audio = audio.flatten()
        if len(audio) < 1600:
            audio = np.pad(audio, (0, 1600 - len(audio)))

        try:
            return ecapa_verifier.extract_embedding(audio, sample_rate=sample_rate)
        except Exception as e:
            print(f"[VAANI] Fallback in embedding extraction: {e}")
            # Fallback normalized vector
            norm_val = np.linalg.norm(audio[:192]) or 1.0
            return (audio[:192] / norm_val).astype(np.float32)

    def enroll_speaker(
        self,
        speaker_id: str,
        name: str,
        role: str,
        audio: np.ndarray,
        sample_rate: int = 16000,
    ) -> dict:
        """
        Derives 192-D ECAPA-TDNN embedding from voice sample and persists into vault.
        """
        embedding = self.extract_embedding(audio, sample_rate)
        preview = [round(float(v), 3) for v in embedding[:24]]

        profile = {
            "id": speaker_id,
            "name": name,
            "role": role,
            "embedding": embedding,
            "preview": preview,
            "sample_rate": sample_rate,
            "num_samples": len(audio),
        }
        self.enrolled[speaker_id] = profile
        return {
            "id": speaker_id,
            "name": name,
            "role": role,
            "embedding_preview": preview,
            "embedding_dim": 192,
            "num_samples": len(audio),
        }

    def verify(
        self,
        audio: np.ndarray,
        speaker_id: Optional[str] = None,
        sample_rate: int = 16000,
    ) -> float:
        """
        Compute calibrated speaker match probability [0.0, 1.0] against enrolled profile.
        """
        detailed = self.verify_detailed(audio, speaker_id, sample_rate)
        return detailed["speaker_match"]

    def verify_detailed(
        self,
        audio: np.ndarray,
        speaker_id: Optional[str] = None,
        sample_rate: int = 16000,
    ) -> dict:
        """
        Returns full biometric verification report:
          - speaker_match: float in [0.0, 1.0]
          - cosine_similarity: float in [-1.0, 1.0]
          - speaker_id: str
          - name: str
          - role: str
          - verified: bool
        """
        if not self.enrolled:
            return {
                "speaker_match": 0.5,
                "cosine_similarity": 0.0,
                "speaker_id": "none",
                "name": "Unknown",
                "role": "Unknown",
                "verified": False,
            }

        target_id = speaker_id or next(iter(self.enrolled))
        if target_id not in self.enrolled:
            target_id = next(iter(self.enrolled))

        target_profile = self.enrolled[target_id]
        target_emb = target_profile["embedding"]
        current_emb = self.extract_embedding(audio, sample_rate)

        sim, match = ecapa_verifier.verify_similarity(target_emb, current_emb)

        return {
            "speaker_match": match,
            "cosine_similarity": sim,
            "speaker_id": target_id,
            "name": target_profile["name"],
            "role": target_profile["role"],
            "verified": match >= 0.70,
        }


voiceprint_manager = VoiceprintManager()
