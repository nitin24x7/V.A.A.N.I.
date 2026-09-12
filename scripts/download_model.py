#!/usr/bin/env python3
"""
Model Downloader for VAANI Speech-to-Text.
Downloads and verifies Faster-Whisper models (e.g. large-v3-turbo, small, base).
"""
import sys
import os
import argparse

# Ensure backend dependencies are on sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(root_dir, "backend", "deps"))
sys.path.insert(0, os.path.join(root_dir, "backend"))

# Enforce internal workspace cache location
cache_dir = os.path.join(root_dir, "backend", "models", "cache")
os.environ["HF_HOME"] = cache_dir
os.environ["HUGGINGFACE_HUB_CACHE"] = os.path.join(cache_dir, "hub")

def download_model(model_name: str = "large-v3-turbo", compute_type: str = "int8"):
    print(f"============================================================")
    print(f"📥 Downloading Faster-Whisper model: '{model_name}' (INT8 CPU)")
    print(f"   Size: ~800 MB (pruned 4-layer decoder, state-of-the-art accuracy)")
    print(f"   Destination: {cache_dir}/hub/ (100% inside Vaani project)")
    print(f"============================================================")

    try:
        from faster_whisper import WhisperModel
        print(f"\n[1/2] Connecting to repository and downloading weights...")
        model = WhisperModel(
            model_name,
            device="cpu",
            compute_type=compute_type,
            cpu_threads=8,
            num_workers=1,
        )
        print(f"\n[2/2] Verifying model initialization on CPU...")
        import numpy as np
        dummy_audio = np.zeros(16000, dtype=np.float32)
        segments, info = model.transcribe(dummy_audio, beam_size=1)
        _ = list(segments)

        print(f"\n============================================================")
        print(f"✅ SUCCESS: Faster-Whisper '{model_name}' is downloaded and ready!")
        print(f"   The VAANI backend will now automatically use this model")
        print(f"   for ultra-accurate Hindi & English speech recognition.")
        print(f"============================================================")
        return True
    except Exception as e:
        print(f"\n❌ Download note: {e}")
        print(f"\nTip: If your network connection is throttled or interrupted, you can retry.")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download Faster-Whisper STT model")
    parser.add_argument(
        "--model",
        default="large-v3-turbo",
        help="Model name: 'large-v3-turbo' (~800MB), 'small' (~240MB), 'base' (~75MB)",
    )
    args = parser.parse_args()
    download_model(args.model)

