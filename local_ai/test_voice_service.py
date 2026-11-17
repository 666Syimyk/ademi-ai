import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from local_ai.voice_service import (
    MAX_AUDIO_BYTES,
    MAX_TTS_CHARS,
    create_app,
    normalize_language,
    validate_speech_request,
)


class VoiceServiceContractTests(unittest.TestCase):
    def test_only_russian_voice_and_bounded_text_are_accepted(self):
        self.assertEqual(
            validate_speech_request("Привет", "svetlana"),
            ("Привет", "ru-RU-SvetlanaNeural"),
        )

        with self.assertRaises(ValueError):
            validate_speech_request("x" * (MAX_TTS_CHARS + 1), "svetlana")

        with self.assertRaises(ValueError):
            validate_speech_request("hello", "unknown")

    def test_language_is_limited_to_ru_kg_en(self):
        self.assertEqual(normalize_language("KG"), "KG")
        self.assertEqual(normalize_language("unsupported"), "RU")
        self.assertGreater(MAX_AUDIO_BYTES, 0)

    @patch("local_ai.voice_service.decoder_available", return_value=False)
    def test_health_reports_decoder_readiness_without_loading_the_transcription_model(
        self, _decoder_available
    ):
        response = TestClient(create_app()).get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "sttModel": "small",
                "sttLoaded": False,
                "decoderAvailable": False,
            },
        )

    def test_speech_endpoint_rejects_an_invalid_voice_without_calling_a_provider(self):
        response = TestClient(create_app()).post(
            "/v1/audio/speech",
            json={"text": "Привет", "voice": "unknown"},
        )

        self.assertEqual(response.status_code, 422)

    def test_decode_failure_is_reported_as_a_gateway_error(self):
        decode_error = RuntimeError("audio decode unavailable")
        decode_error.__cause__ = OSError("ffprobe unavailable")
        with patch(
            "local_ai.voice_service.audio_duration_seconds",
            side_effect=decode_error,
        ):
            response = TestClient(create_app()).post(
                "/v1/audio/transcribe",
                data={"language": "RU"},
                files={"audio": ("message.webm", b"voice", "audio/webm")},
            )

        self.assertEqual(response.status_code, 502)


if __name__ == "__main__":
    unittest.main()
