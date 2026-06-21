"""TTS service — text-to-speech using edge-tts. Migrated from BUMENGweb-main chat_tts_handler.py."""

import os
import re
import asyncio
import edge_tts
import base64
import hashlib
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

# ============================================================
#  TTS 文本清洗（从 BUMENGweb-main engine.py 迁移）
#  所有 TTS 播报都必须经过此函数清洗，确保只读可朗读的文字内容
# ============================================================

def clean_tts_text(text: str, max_length: int = 500) -> str:
    """
    Clean text for TTS: remove formatting, URLs, markdown, emojis etc.
    Only keeps readable Chinese + English text.
    """
    if not text or not isinstance(text, str):
        return ""

    clean = str(text)

    # Step 1: Remove URLs, code blocks, HTML, markdown links
    clean = re.sub(r'https?://\S+', '', clean)
    clean = re.sub(r'www\.\S+', '', clean)
    clean = re.sub(r'[\w\-\.]+\.(com|cn|org|net|io|gg|dev|app|co|me|xyz|top|info|biz|tv|cc)/\S*', '', clean)
    clean = re.sub(r'/\S*/\S*', '', clean)
    clean = clean.replace('\\', '')
    clean = re.sub(r'```[\s\S]*?```', '', clean)
    clean = re.sub(r'`([^`]+)`', r'\1', clean)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', clean)

    # Step 2: Remove decoration lines, option lines, numbered lines
    clean = re.sub(r'^[\-*_]{3,}\s*$', '', clean, flags=re.MULTILINE)
    clean = re.sub(r'^={3,}\s*$', '', clean, flags=re.MULTILINE)
    clean = re.sub(r'^[→\-–—>]\s+.+$', '', clean, flags=re.MULTILINE)
    clean = re.sub(r'^\d+[\.\)、．]\s*.+$', '', clean, flags=re.MULTILINE)

    # Step 3: Inline formatting cleanup
    clean = re.sub(r'\*\*([^*]+)\*\*', r'\1', clean)
    clean = re.sub(r'__([^_]+)__', r'\1', clean)
    clean = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'\1', clean)
    clean = re.sub(r'(?<!_)_([^_]+)_(?!_)', r'\1', clean)
    clean = re.sub(r'~~([^~]+)~~', r'\1', clean)
    clean = re.sub(r'^#{1,6}\s+', '', clean, flags=re.MULTILINE)
    clean = re.sub(r'^>\s*', '', clean, flags=re.MULTILINE)
    clean = re.sub(r'(?<!\w):\w+:(?!\w)', '', clean)

    # Step 4: Whitelist — only keep Chinese + English + digits + common punctuation
    allowed_pattern = re.compile(
        r'[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffef'
        r'a-zA-Z0-9'
        r'。，！？；：""''【】《》（）—…·'
        r'.,!?;:\s\n\-'
        r']'
    )
    clean = allowed_pattern.sub('', clean)

    # Step 5: Remove bracket/parenthesis content
    clean = re.sub(r'（[^）]*）', '', clean)
    clean = re.sub(r'\([^)]*\)', '', clean)

    # Step 6: Final cleanup
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    clean = '\n'.join(line.strip() for line in clean.split('\n') if line.strip())
    clean = re.sub(r'[ \t]{2,}', ' ', clean)
    clean = clean.strip()

    if not clean or len(clean) < 2:
        return ""

    if len(clean) > max_length:
        clean = clean[:max_length] + "..."

    return clean


# ============================================================
#  情绪自动推断（从 BUMENGweb-main web_server.py 迁移）
#  根据文本内容关键词推断 TTS 播报情绪
# ============================================================

def infer_emotion(text: str) -> Optional[str]:
    """Auto-detect emotion/style for EdgeTTS from text content keywords.
    Returns one of: "cheerful", "sad", "angry", "whispering", "calm", or None.
    """
    text_lower = text.lower()
    if any(k in text_lower for k in ["愤怒", "怒", "吼", "危险", "警告", "战斗", "杀"]):
        return "angry"
    if any(k in text_lower for k in ["悲伤", "难过", "痛苦", "哀", "泪", "哭泣", "死亡"]):
        return "sad"
    if any(k in text_lower for k in ["开心", "恭喜", "欢呼", "庆祝", "笑", "太好了"]):
        return "cheerful"
    if any(k in text_lower for k in ["神秘", "悄悄", "秘密", "小声", "低语"]):
        return "whispering"
    if any(k in text_lower for k in ["冷静", "分析", "观察", "思考", "平静"]):
        return "calm"
    return None


TTS_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tts_cache")
os.makedirs(TTS_CACHE_DIR, exist_ok=True)


async def text_to_speech(
    text: str,
    voice: str = "default",
    rate: str = "+0%",
    pitch: str = "+0Hz",
    style: Optional[str] = None,
) -> str:
    """
    Convert text to speech and return base64-encoded MP3.

    Args:
        text: Chinese text to synthesize
        voice: Voice type ("male", "female", "dm", or edge-tts voice name)
        rate: Speaking rate modifier (e.g., "+10%", "-5%")
        pitch: Pitch modifier (e.g., "+0Hz", "-10Hz")
        style: Emotion style (e.g., "cheerful", "sad", "angry", "whispering", "calm")

    Returns:
        Base64-encoded MP3 data, or empty string on failure.
    """
    voice_name = VOICE_MAP.get(voice, voice)

    # Hash the parameters for caching
    cache_key = hashlib.md5(
        f"{text[:100]}:{voice_name}:{rate}:{pitch}:{style or ''}".encode()
    ).hexdigest()
    cache_path = os.path.join(TTS_CACHE_DIR, f"{cache_key}.mp3")

    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    # Build SSML if style is specified
    ssml_text = text
    use_ssml = style is not None
    if use_ssml:
        ssml_text = (
            f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xmlns:mstts="https://www.w3.org/2001/mstts">'
            f'<voice name="{voice_name}">'
            f'<mstts:express-as style="{style}">{text}</mstts:express-as>'
            f'</voice></speak>'
        )

    async def _do_synthesize(synth_text: str) -> list:
        communicate = edge_tts.Communicate(
            text=synth_text,
            voice=voice_name,
            rate=rate,
            pitch=pitch,
        )
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        return chunks

    try:
        audio_chunks = await _do_synthesize(ssml_text)
        # If SSML failed and we used style, retry without SSML
        if not audio_chunks and use_ssml:
            print(f"[TTS] SSML with style='{style}' failed for {voice_name}, retrying without style")
            audio_chunks = await _do_synthesize(text)

        if audio_chunks:
            audio_data = b"".join(audio_chunks)
            # Cache it
            with open(cache_path, "wb") as f:
                f.write(audio_data)
            return base64.b64encode(audio_data).decode("utf-8")
        else:
            return ""

    except Exception as e:
        # If SSML error, retry without SSML
        if use_ssml:
            try:
                print(f"[TTS] SSML exception for style='{style}', retrying without style: {e}")
                audio_chunks = await _do_synthesize(text)
                if audio_chunks:
                    audio_data = b"".join(audio_chunks)
                    with open(cache_path, "wb") as f:
                        f.write(audio_data)
                    return base64.b64encode(audio_data).decode("utf-8")
            except Exception as e2:
                print(f"[TTS] Retry also failed: {e2}")
        else:
            print(f"[TTS] Synthesis failed: {e}")
        return ""


async def dm_tts(text: str) -> Optional[str]:
    """Generate TTS for DM narration with DM voice."""
    clean = clean_tts_text(text)
    if not clean:
        return None
    emotion = infer_emotion(clean)
    return await text_to_speech(clean, voice="dm", rate="+10%", style=emotion)


async def generate_tts_for_chat(
    text: str,
    speaker: str = "dm",
) -> Optional[str]:
    """
    Generate TTS audio for a chat message. Auto-detects voice & emotion.

    Args:
        text: The message content
        speaker: "dm" or character name

    Returns:
        Base64-encoded MP3 string, or None.
    """
    clean = clean_tts_text(text)
    if not clean:
        return None

    if speaker.lower() in ("dm", "主持人", "dm-bot"):
        voice = "dm"
        rate = "+10%"
    else:
        voice = "female"
        rate = "+15%"

    emotion = infer_emotion(clean)
    return await text_to_speech(clean, voice=voice, rate=rate, style=emotion)

