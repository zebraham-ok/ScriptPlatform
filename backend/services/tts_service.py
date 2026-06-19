"""TTS service — text-to-speech using edge-tts. Migrated from BUMENGweb-main chat_tts_handler.py."""

import os
import asyncio
import edge_tts
import base64
from typing import Optional

# Voice mapping: Chinese voices by character type
VOICE_MAP = {
    "male": "zh-CN-YunxiNeural",
    "female": "zh-CN-XiaoxiaoNeural",
    "dm": "zh-CN-YunyangNeural",      # DM voice (narrative)
    "boy": "zh-CN-YunxiNeural",
    "girl": "zh-CN-XiaoyouNeural",
    "default": "zh-CN-XiaoxiaoNeural",
}

TTS_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tts_cache")
os.makedirs(TTS_CACHE_DIR, exist_ok=True)


async def text_to_speech(
    text: str,
    voice: str = "default",
    rate: str = "+0%",
    pitch: str = "+0Hz",
) -> str:
    """
    Convert text to speech and return base64-encoded MP3.

    Args:
        text: Chinese text to synthesize
        voice: Voice type ("male", "female", "dm", or edge-tts voice name)
        rate: Speaking rate modifier (e.g., "+10%", "-5%")
        pitch: Pitch modifier (e.g., "+0Hz", "-10Hz")

    Returns:
        Base64-encoded MP3 data, or empty string on failure.
    """
    voice_name = VOICE_MAP.get(voice, voice)

    # Hash the parameters for caching
    import hashlib
    cache_key = hashlib.md5(f"{text[:100]}:{voice_name}:{rate}:{pitch}".encode()).hexdigest()
    cache_path = os.path.join(TTS_CACHE_DIR, f"{cache_key}.mp3")

    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=voice_name,
            rate=rate,
            pitch=pitch,
        )
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

        if audio_chunks:
            audio_data = b"".join(audio_chunks)
            # Cache it
            with open(cache_path, "wb") as f:
                f.write(audio_data)
            return base64.b64encode(audio_data).decode("utf-8")
        else:
            return ""

    except Exception as e:
        print(f"[TTS] Synthesis failed: {e}")
        return ""


async def dm_tts(text: str) -> Optional[str]:
    """Generate TTS for DM narration with DM voice."""
    return await text_to_speech(text, voice="dm", rate="-5%")

