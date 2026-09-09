import numpy as np
from typing import Optional

class VoiceprintManager:
    """
    Manages enrolled speaker voiceprints and computes 192-dimensional embeddings
    from acoustic samples for biometric identity verification.
    """
    def __init__(self):
        self.enrolled: dict[str, dict] = {}

    def extract_embedding(self, audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
        """
        Extract normalized 192-dimensional acoustic embedding vector.
        Combines 64-band log filterbanks, spectral delta dynamics, and statistical moments.
        """
        if len(audio) < 1024:
            # Pad with silence or duplicate
            audio = np.pad(audio, (0, max(0, 1024 - len(audio))))

        # Compute STFT magnitude
        window_length = 512
        hop_length = 160
        n_fft = 512
        
        # Simple triangular filterbank (64 filters)
        n_mels = 64
        mel_low = 0
        mel_high = 2595 * np.log10(1 + (sample_rate / 2) / 700)
        mel_points = np.linspace(mel_low, mel_high, n_mels + 2)
        hz_points = 700 * (10**(mel_points / 2595) - 1)
        bin_points = np.floor((n_fft + 1) * hz_points / sample_rate).astype(int)

        num_bins = n_fft // 2 + 1
        fbank = np.zeros((n_mels, num_bins))
        for m in range(1, n_mels + 1):
            f_m_minus = bin_points[m - 1]
            f_m = bin_points[m]
            f_m_plus = bin_points[m + 1]

            for k in range(f_m_minus, f_m):
                fbank[m - 1, k] = (k - bin_points[m - 1]) / max(1, (bin_points[m] - bin_points[m - 1]))
            for k in range(f_m, f_m_plus):
                if k < num_bins:
                    fbank[m - 1, k] = (bin_points[m + 1] - k) / max(1, (bin_points[m + 1] - bin_points[m]))

        # Spectrogram frames
        frames = []
        for i in range(0, len(audio) - window_length, hop_length):
            frame = audio[i:i + window_length] * np.hanning(window_length)
            mag = np.abs(np.fft.rfft(frame, n=n_fft))
            frames.append(mag)

        if len(frames) == 0:
            frames = [np.abs(np.fft.rfft(audio[:window_length] * np.hanning(window_length), n=n_fft))]

        spec = np.array(frames).T  # (num_bins, num_frames)
        mel_spec = np.dot(fbank, spec)
        log_mel = np.log(np.maximum(mel_spec, 1e-5))  # (64, num_frames)

        # 192-d embedding derived from:
        # 1. 64-d Mean of log-mel energy
        mean_feat = np.mean(log_mel, axis=1)
        # 2. 64-d Std-dev of log-mel energy
        std_feat = np.std(log_mel, axis=1)
        # 3. 64-d Temporal delta dynamics
        delta_feat = np.mean(np.abs(np.diff(log_mel, axis=1)), axis=1) if log_mel.shape[1] > 1 else np.zeros(64)

        raw_vec = np.concatenate([mean_feat, std_feat, delta_feat])
        norm = np.linalg.norm(raw_vec)
        if norm > 1e-6:
            embedding = raw_vec / norm
        else:
            embedding = np.zeros(192)

        return embedding.astype(np.float32)

    def enroll_speaker(self, speaker_id: str, name: str, role: str, audio: np.ndarray, sample_rate: int = 16000) -> dict:
        embedding = self.extract_embedding(audio, sample_rate)
        # Store preview (first 24 dimensions)
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
        }

    def verify(self, audio: np.ndarray, speaker_id: Optional[str] = None, sample_rate: int = 16000) -> float:
        """
        Compute cosine similarity match against enrolled voiceprint (0.0 to 1.0).
        """
        if not self.enrolled:
            return 0.5

        target_id = speaker_id or next(iter(self.enrolled))
        if target_id not in self.enrolled:
            return 0.5

        target_emb = self.enrolled[target_id]["embedding"]
        current_emb = self.extract_embedding(audio, sample_rate)

        dot = np.dot(target_emb, current_emb)
        norm_a = np.linalg.norm(target_emb)
        norm_b = np.linalg.norm(current_emb)

        if norm_a < 1e-6 or norm_b < 1e-6:
            return 0.5

        cosine_sim = float(dot / (norm_a * norm_b))
        # Map cosine similarity [-1, 1] to match probability [0, 1]
        # Typical genuine match is > 0.75
        match_prob = max(0.0, min(1.0, (cosine_sim + 0.3) / 1.3))
        return round(match_prob, 3)

voiceprint_manager = VoiceprintManager()

