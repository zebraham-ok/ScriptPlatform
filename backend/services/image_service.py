"""
Image service — scene image generation and caching.
Migrated from BUMENGweb-main image_cache.py + ai_handler.py.

Features:
- Scene image generation via Qwen dashscope MultiModalConversation
- Scene image caching (disk-based, keyed by scene name)
- Avatar caching (keyed by character_name + scenario_name)
- Character visual description cache (for scene consistency)
- URL → base64 conversion (async aiohttp + sync requests fallback)
"""

import os
import asyncio
import hashlib
import json
import base64
from typing import Optional
from dotenv import load_dotenv

# Load .env at module init
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(_ENV_PATH, override=True)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BACKEND_DIR, "image_cache")
VISUAL_FILE = os.path.join(CACHE_DIR, "character_visuals.json")

os.makedirs(CACHE_DIR, exist_ok=True)


# ========================================
#  Core Utilities
# ========================================

def _make_key(*parts: str) -> str:
    """Generate a safe filename key."""
    raw = "_".join(parts)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]


# ========================================
#  Scene Image Cache
# ========================================

def scene_cache_path(scene_name: str) -> str:
    """Scene image cache file path."""
    normalized = scene_name.strip()
    key = _make_key("scene", normalized)
    return os.path.join(CACHE_DIR, f"scene_{key}.png")


def scene_cache_exists(scene_name: str) -> bool:
    """Check if scene image cache exists."""
    return os.path.exists(scene_cache_path(scene_name))


def get_cached_scene_base64(scene_name: str) -> Optional[str]:
    """Read cached scene image as base64 data URI."""
    path = scene_cache_path(scene_name)
    if os.path.exists(path):
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return f"data:image/png;base64,{data}"
    return None


def download_and_cache(image_url: str, cache_path: str) -> bool:
    """Download image from URL and save to cache path."""
    import requests
    try:
        resp = requests.get(image_url, stream=True, timeout=30)
        if resp.status_code == 200:
            with open(cache_path, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            print(f"💾 [Cache] 图片已缓存: {os.path.basename(cache_path)}")
            return True
        else:
            print(f"⚠️ [Cache] 下载失败: HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ [Cache] 下载异常: {e}")
        return False


async def url_to_base64(image_url: str) -> Optional[str]:
    """Async download image URL and return base64 data URI."""
    import aiohttp
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    data = await resp.read()
                    b64 = base64.b64encode(data).decode()
                    return f"data:image/png;base64,{b64}"
                else:
                    print(f"⚠️ [Base64] 下载失败: HTTP {resp.status}")
                    return None
    except Exception as e:
        print(f"❌ [Base64] 下载异常: {e}")
        return None


def _url_to_base64_sync(image_url: str) -> Optional[str]:
    """Sync fallback: download image URL and return base64 data URI."""
    import requests
    try:
        resp = requests.get(image_url, timeout=30)
        if resp.status_code == 200:
            b64 = base64.b64encode(resp.content).decode()
            return f"data:image/png;base64,{b64}"
        else:
            print(f"⚠️ [Base64-Sync] 下载失败: HTTP {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ [Base64-Sync] 下载异常: {e}")
        return None


def cached_file_base64(cache_path: str) -> Optional[str]:
    """Read cached file as base64 data URI."""
    if not os.path.exists(cache_path):
        return None
    with open(cache_path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return f"data:image/png;base64,{data}"


# ========================================
#  Avatar Cache
# ========================================

def avatar_cache_path(character_name: str, scenario_name: str = "default") -> str:
    """Avatar cache file path."""
    key = _make_key("avatar", character_name, scenario_name)
    return os.path.join(CACHE_DIR, f"avatar_{key}.png")


def avatar_cache_exists(character_name: str, scenario_name: str = "default") -> bool:
    """Check if avatar cache exists."""
    return os.path.exists(avatar_cache_path(character_name, scenario_name))


def get_cached_avatar_base64(character_name: str, scenario_name: str = "default") -> Optional[str]:
    """Read cached avatar as base64 data URI."""
    path = avatar_cache_path(character_name, scenario_name)
    return cached_file_base64(path)


# ========================================
#  Character Visual Description Cache
#  (for scene-to-scene character appearance consistency)
# ========================================

def load_character_visuals() -> dict:
    """Load all stored character visual descriptions."""
    if os.path.exists(VISUAL_FILE):
        with open(VISUAL_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_character_visual(character_name: str, scenario_name: str, visual_desc: str):
    """Save character visual description."""
    visuals = load_character_visuals()
    key = f"{character_name}::{scenario_name}"
    visuals[key] = visual_desc
    with open(VISUAL_FILE, "w", encoding="utf-8") as f:
        json.dump(visuals, f, ensure_ascii=False, indent=2)
    print(f"💾 [Cache] 角色形象描述已保存: {character_name}")


def get_character_visual(character_name: str, scenario_name: str = "default") -> Optional[str]:
    """Get saved character visual description."""
    visuals = load_character_visuals()
    key = f"{character_name}::{scenario_name}"
    return visuals.get(key)


def build_character_visual_desc(character_name: str, identity: str, public_bio: str) -> str:
    """Build a concise character visual description for scene image prompts."""
    parts = [f"主角{character_name}"]
    if identity:
        parts.append(f"身份{identity}")
    if public_bio:
        desc = public_bio.replace("\n", " ").strip()[:200]
        parts.append(f"{desc}")
    return "，".join(parts)


# ========================================
#  Qwen AI Image Generation
# ========================================

def _get_dashscope_key() -> Optional[str]:
    """Get dashscope API key (QWEN_SECRET or QWEN_API_KEY)."""
    return os.getenv("QWEN_SECRET") or os.getenv("QWEN_API_KEY")


def generate_image_url(
    prompt_text: str,
    api_key: Optional[str] = None,
    model: str = "qwen-image-plus-2026-01-09",
    size: str = "1024*1024",
) -> str:
    """
    Generate an image using Qwen dashscope MultiModalConversation.
    Returns the download URL of the generated image, or empty string on failure.

    Args:
        prompt_text: Image generation prompt
        api_key: Dashscope API key (auto-detected from env if not provided)
        model: Qwen image model name
        size: Image dimensions (e.g. "1024*1024")
    """
    if api_key is None:
        api_key = _get_dashscope_key()

    if not api_key:
        print("❌ [ImageGen] 未配置 QWEN_SECRET 或 QWEN_API_KEY，无法生成图片")
        return ""

    try:
        from dashscope import MultiModalConversation

        messages = [
            {
                "role": "user",
                "content": [{"text": prompt_text}]
            }
        ]

        response = MultiModalConversation.call(
            api_key=api_key,
            model=model,
            messages=messages,
            result_format="message",
            stream=False,
            watermark=False,
            prompt_extend=True,
            negative_prompt=(
                "低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，"
                "蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。"
            ),
            size=size,
        )

        if response.status_code == 200:
            # Extract image URL from response
            choices = response.output.get("choices", [])
            if choices:
                content_list = choices[0].get("message", {}).get("content", [])
                for item in content_list:
                    if isinstance(item, dict) and item.get("image"):
                        return item["image"]
            print(f"⚠️ [ImageGen] 响应中未找到图片URL")
            return ""
        else:
            print(f"❌ [ImageGen] HTTP返回码: {response.status_code}, {response}")
            return ""

    except ImportError:
        print("❌ [ImageGen] dashscope 未安装，请执行: pip install dashscope")
        return ""
    except Exception as e:
        print(f"❌ [ImageGen] 图像生成失败: {e}")
        return ""


async def generate_image_url_async(
    prompt_text: str,
    api_key: Optional[str] = None,
    model: str = "qwen-image-plus-2026-01-09",
    size: str = "1024*1024",
) -> str:
    """Async version of generate_image_url."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: generate_image_url(prompt_text, api_key, model, size)
    )


# ========================================
#  High-Level Scene Image Pipeline
# ========================================

async def generate_scene_image(
    scene_name: str,
    scene_description: str,
    character_visuals: Optional[str] = None,
    scenario_title: str = "",
) -> Optional[str]:
    """
    Full pipeline: generate a scene image and return base64 data URI.
    Uses cache-first strategy.

    Args:
        scene_name: Display name of the scene (used as cache key)
        scene_description: Scene description for the image prompt
        character_visuals: Optional character visual description for consistency
        scenario_title: Script/scenario title for context

    Returns:
        Base64 data URI string, or None if generation fails.
    """
    # 1. Check cache
    if scene_cache_exists(scene_name):
        print(f"📦 [Scene] 使用本地缓存的场景图: {scene_name}")
        return get_cached_scene_base64(scene_name)

    # 2. Build prompt
    desc_text = scene_description[:300] if scene_description else ""
    prompt = (
        f"请严格按照以下描述生成场景画面，必须与描述内容完全一致："
        f"地点「{scene_name}」。画面内容：{desc_text}。"
    )

    if character_visuals:
        prompt += f" 场景中出现主角：{character_visuals}。"

    prompt += " 风格为角色扮演游戏，写实风格，电影感，细节丰富，4K画质。"

    print(f"🎨 [Scene] 开始生成场景图片: scene={scene_name}, desc={desc_text[:80]}...")

    # 3. Generate via Qwen
    image_url = await generate_image_url_async(prompt)

    if not image_url:
        print(f"⚠️ [Scene] 场景图片生成返回空URL: {scene_name}")
        return None

    print(f"✅ [Scene] 场景图片URL生成成功: {image_url[:100]}...")

    # 4. Download and cache
    cache_path = scene_cache_path(scene_name)
    if download_and_cache(image_url, cache_path):
        return cached_file_base64(cache_path)

    # 5. Fallback: download as base64 directly (skip file cache on download failure)
    result_b64 = await url_to_base64(image_url)
    if not result_b64:
        result_b64 = await asyncio.get_event_loop().run_in_executor(
            None, _url_to_base64_sync, image_url
        )

    if result_b64:
        # Save to cache manually
        try:
            image_data = base64.b64decode(result_b64.split(",", 1)[-1])
            with open(cache_path, "wb") as f:
                f.write(image_data)
            print(f"💾 [Scene] 场景图已缓存(备用路径): {scene_name}")
        except Exception as e:
            print(f"⚠️ [Scene] 缓存保存失败(不影响展示): {e}")

    return result_b64


async def generate_avatar_image(
    character_name: str,
    identity: str,
    public_bio: str,
    scenario_name: str = "default",
) -> Optional[str]:
    """
    Full pipeline: generate a character avatar and return base64 data URI.
    Uses cache-first strategy.

    Args:
        character_name: Character's name
        identity: Character's identity/short desc
        public_bio: Character's public biography
        scenario_name: Script/scenario name for cache keying

    Returns:
        Base64 data URI string, or None if generation fails.
    """
    # 1. Check cache
    if avatar_cache_exists(character_name, scenario_name):
        print(f"📦 [Avatar] 使用本地缓存的 {character_name} 头像")
        return get_cached_avatar_base64(character_name, scenario_name)

    # 2. Build prompt
    prompt = (
        f"剧本杀角色头像：{character_name}，职业是{identity}，{public_bio}。"
        "风格为具有个人特点的角色立绘，正面半身像，高质量，4K画质。"
    )

    print(f"🎨 [Avatar] 开始AI生成头像: {character_name}")

    # 3. Generate via Qwen
    image_url = await generate_image_url_async(prompt)

    if not image_url:
        print(f"⚠️ [Avatar] 头像生成返回空URL: {character_name}")
        return None

    # 4. Download and cache
    cache_path = avatar_cache_path(character_name, scenario_name)
    if download_and_cache(image_url, cache_path):
        # Also save character visual description for scene consistency
        visual_desc = build_character_visual_desc(character_name, identity, public_bio)
        save_character_visual(character_name, scenario_name, visual_desc)
        return cached_file_base64(cache_path)

    return None
