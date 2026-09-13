"""
Phase 11 — Actual Call Integration & Multi-Source Ingestion Tests.

Tests:
  1. WebRTCAdapter Int16 / Float32 PCM conversion.
  2. SipRtpAdapter RTP header unpacking, μ-law / A-law decode, and resample to 16kHz.
  3. TelephonyGatewayAdapter Twilio/Exotel JSON media event base64 decoding.
  4. MobileSdkAdapter session handshake and authenticated packet ingestion.
  5. IngestionManager call session lifecycle.
  6. FastAPI endpoints:
     - GET /api/ingestion/sources
     - POST /api/ingestion/simulate-call
     - POST /api/ingestion/end-call
     - POST /api/ingestion/test-packet
"""

import sys
import os
import struct
import base64
import unittest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'deps'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from ingestion_adapters import (
    WebRTCAdapter,
    SipRtpAdapter,
    TelephonyGatewayAdapter,
    MobileSdkAdapter,
    IngestionManager,
)


class TestWebRTCAdapter(unittest.TestCase):
    def test_parse_int16_pcm(self):
        adapter = WebRTCAdapter()
        # 320 bytes = 160 int16 samples (10ms at 16kHz)
        raw_int16 = (np.ones(160, dtype=np.int16) * 16384).tobytes()
        samples = adapter.parse(raw_int16)

        self.assertEqual(len(samples), 160)
        self.assertAlmostEqual(float(samples[0]), 0.5, places=3)
        self.assertEqual(adapter.packets_received, 1)

    def test_parse_float32_pcm(self):
        adapter = WebRTCAdapter()
        raw_f32 = (np.ones(100, dtype=np.float32) * 0.75).tobytes()
        samples = adapter.parse(raw_f32, fmt="float32")

        self.assertEqual(len(samples), 100)
        self.assertAlmostEqual(float(samples[0]), 0.75, places=4)


class TestSipRtpAdapter(unittest.TestCase):
    def test_rtp_header_unpack_and_mulaw_decode(self):
        adapter = SipRtpAdapter()

        # Build 12-byte RTP header: V=2, PT=0 (PCMU), Seq=1001, TS=160000, SSRC=0x12345678
        rtp_header = struct.pack("!BBHII", 0x80, 0x00, 1001, 160000, 0x12345678)
        # 160 bytes of μ-law payload (20ms at 8kHz)
        payload = bytes([0x7F] * 160)
        rtp_packet = rtp_header + payload

        samples, meta = adapter.parse_rtp_packet(rtp_packet)

        # 160 samples at 8kHz upsampled by 2x should yield 320 samples at 16kHz
        self.assertEqual(len(samples), 320)
        self.assertEqual(meta["protocol"], "SIP/RTP")
        self.assertEqual(meta["seq"], 1001)
        self.assertEqual(meta["payload_type"], 0)
        self.assertIn("G.711 μ-law", meta["codec"])

    def test_rtp_alaw_decode(self):
        adapter = SipRtpAdapter()
        rtp_header = struct.pack("!BBHII", 0x80, 0x08, 1002, 160160, 0x12345678)
        payload = bytes([0x55] * 160)
        rtp_packet = rtp_header + payload

        samples, meta = adapter.parse_rtp_packet(rtp_packet)
        self.assertEqual(len(samples), 320)
        self.assertEqual(meta["payload_type"], 8)
        self.assertIn("G.711 A-law", meta["codec"])

    def test_rtp_packet_loss_detection(self):
        adapter = SipRtpAdapter()
        # Packet 1
        p1 = struct.pack("!BBHII", 0x80, 0, 1000, 0, 1) + bytes(160)
        adapter.parse_rtp_packet(p1)

        # Packet 3 (packet 2 dropped, loss=1)
        p3 = struct.pack("!BBHII", 0x80, 0, 1002, 320, 1) + bytes(160)
        _, meta = adapter.parse_rtp_packet(p3)

        self.assertEqual(meta["dropped_packets"], 1)


class TestTelephonyGatewayAdapter(unittest.TestCase):
    def test_parse_media_event(self):
        adapter = TelephonyGatewayAdapter()

        # 160 bytes μ-law base64 encoded
        raw_mulaw = bytes([0x7F] * 160)
        b64_payload = base64.b64encode(raw_mulaw).decode()

        event = {
            "event": "media",
            "sequenceNumber": "1",
            "media": {
                "track": "inbound",
                "chunk": "1",
                "timestamp": "12345",
                "payload": b64_payload,
            },
            "streamSid": "MZ12345",
        }

        samples, meta = adapter.parse_media_event(event)

        self.assertEqual(len(samples), 320)
        self.assertEqual(meta["protocol"], "Telephony Gateway (Twilio/Exotel)")
        self.assertEqual(meta["stream_sid"], "MZ12345")
        self.assertEqual(adapter.packets_received, 1)


class TestMobileSdkAdapter(unittest.TestCase):
    def test_session_handshake_and_ingestion(self):
        adapter = MobileSdkAdapter()
        session = adapter.create_session({
            "caller_name": "Aditi Sharma",
            "caller_role": "Chief Financial Officer",
            "platform": "iOS In-Call SDK",
        })

        self.assertIn("token", session)
        self.assertEqual(session["caller_name"], "Aditi Sharma")

        raw_pcm = bytes(320)  # 160 samples of 16-bit PCM
        samples, meta = adapter.parse_sdk_chunk(session["token"], raw_pcm)

        self.assertEqual(len(samples), 160)
        self.assertEqual(meta["caller"], "Aditi Sharma")
        self.assertEqual(meta["protocol"], "Mobile Security SDK")


class TestIngestionManager(unittest.TestCase):
    def test_call_lifecycle(self):
        mgr = IngestionManager()
        call = mgr.start_call_session(
            caller_name="Aditi Sharma",
            caller_role="CFO",
            source="webrtc",
        )
        self.assertTrue(call["active"])
        self.assertEqual(call["caller_name"], "Aditi Sharma")

        ended = mgr.end_call_session()
        self.assertFalse(ended["active"])
        self.assertIn("duration_sec", ended)

    def test_sources_status(self):
        mgr = IngestionManager()
        status = mgr.get_sources_status()
        self.assertIn("sources", status)
        self.assertEqual(len(status["sources"]), 4)
        source_ids = [s["id"] for s in status["sources"]]
        self.assertIn("webrtc", source_ids)
        self.assertIn("sip", source_ids)
        self.assertIn("gateway", source_ids)
        self.assertIn("sdk", source_ids)


class TestIngestionApiEndpoints(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from main import app
        self.client = TestClient(app)

    def test_get_sources_api(self):
        res = self.client.get("/api/ingestion/sources")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("sources", data)
        self.assertEqual(len(data["sources"]), 4)

    def test_simulate_and_end_call_api(self):
        # Start call
        res_start = self.client.post("/api/ingestion/simulate-call", json={
            "caller_name": "Aditi Sharma",
            "caller_role": "Chief Financial Officer",
            "source": "webrtc",
            "mode": "legitimate",
        })
        self.assertEqual(res_start.status_code, 200)
        self.assertEqual(res_start.json()["status"], "call_started")

        # End call
        res_end = self.client.post("/api/ingestion/end-call")
        self.assertEqual(res_end.status_code, 200)
        self.assertEqual(res_end.json()["status"], "call_ended")

    def test_test_packet_api_all_sources(self):
        for src in ["webrtc", "sip", "gateway", "sdk"]:
            res = self.client.post("/api/ingestion/test-packet", json={
                "source": src,
                "sample_count": 160,
            })
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["source"], src)
            self.assertGreater(data["samples_decoded"], 0)
            self.assertEqual(data["target_sample_rate"], 16000)


if __name__ == "__main__":
    unittest.main()
