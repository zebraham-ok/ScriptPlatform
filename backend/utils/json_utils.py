"""
json_utils — Shared JSON extraction, repair, and parsing for LLM responses.

Provides robust JSON handling:
1. Extract JSON from LLM output (handles markdown code blocks, extra text)
2. Repair broken JSON via json_repair library
3. Parse with fallback chain: raw → repair → None
"""
import json
import re
from typing import Optional, Any

try:
    from json_repair import repair_json as _repair_json
    _HAS_JSON_REPAIR = True
except ImportError:
    _HAS_JSON_REPAIR = False


def extract_json_from_text(raw_text: str) -> Optional[str]:
    """Extract JSON object string from LLM response.

    Handles:
    - Markdown code blocks (```json ... ```)
    - Extra text before/after JSON
    - Common LLM quirks

    Returns trimmed JSON string or None if no JSON object found.
    """
    if not raw_text:
        return None

    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    # Find JSON boundaries: first '{' to last '}'
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1].strip()

    return None


def repair_json_string(json_str: str) -> str:
    """Repair a broken JSON string using json_repair library.

    Handles: missing commas, trailing commas, unquoted keys, single quotes, etc.
    Falls back to returning the original string if repair is unavailable or fails.
    """
    if not _HAS_JSON_REPAIR:
        return json_str
    try:
        return _repair_json(json_str)
    except Exception:
        return json_str


def parse_llm_json(raw_text: str) -> Optional[dict]:
    """Complete pipeline: extract → repair → parse JSON from LLM response.

    Returns parsed dict, or None if all attempts fail.
    """
    json_str = extract_json_from_text(raw_text)
    if not json_str:
        return None

    # Attempt 1: direct parse
    try:
        parsed = json.loads(json_str)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Attempt 2: repair then parse
    if _HAS_JSON_REPAIR:
        try:
            repaired = _repair_json(json_str)
            parsed = json.loads(repaired)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, Exception):
            pass

    return None
