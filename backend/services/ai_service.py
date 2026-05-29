"""AI service with prompt templates and OpenAI integration."""

import os
from typing import Optional
from openai import OpenAI

# Default prompt templates
PROMPT_TEMPLATES = {
    "character": """你是一个专业的剧本创作助手。请根据以下现有角色设定，为这个角色丰富背景故事和人物细节。

{context_text}

用户指令：{instruction}

请提供详细的角色背景、性格特征、行为动机等方面的内容。""",

    "location": """你是一个专业的剧本创作助手。请根据以下地点设定，为这个场景进行详细的环境描写。

{context_text}

用户指令：{instruction}

请提供生动的环境描写，包括视觉、听觉、氛围等方面的细节。""",

    "plot": """你是一个专业的剧本创作助手。请根据当前剧情状态，为剧情发展提供建议。

{context_text}

用户指令：{instruction}

请提出合理的情节发展建议，包括事件转化和触发条件。""",

    "worldview": """你是一个专业的剧本创作助手。请根据已有世界观设定，扩展和丰富世界观内容。

{context_text}

用户指令：{instruction}

请提供详细的世界观设定内容，注重逻辑自洽和创意。""",
}

DEFAULT_TEMPLATE = """你是一个专业的剧本创作助手。

{context_text}

用户指令：{instruction}

请提供专业、详细的回答。"""


def _get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    base_url = os.environ.get("OPENAI_BASE_URL", None)
    if not api_key:
        return OpenAI(api_key="sk-placeholder", base_url=base_url)
    return OpenAI(api_key=api_key, base_url=base_url)


def generate_text(
    context: dict,
    instruction: str,
    prompt_template: Optional[str] = None,
    model: str = "gpt-4",
) -> str:
    """Generate text using OpenAI API based on context and instruction."""

    current_page = context.get("current_page", "worldview")
    selected_element_id = context.get("selected_element_id", "")
    nearby_elements = context.get("nearby_elements", [])

    # Build context text
    context_parts = []
    if selected_element_id:
        context_parts.append(f"当前选中的元素ID：{selected_element_id}")
    if nearby_elements:
        context_parts.append("相关元素信息：")
        for elem in nearby_elements:
            if isinstance(elem, dict):
                context_parts.append(f"  - {elem.get('label', elem.get('id', ''))}: {elem}")
            else:
                context_parts.append(f"  - {elem}")

    context_text = "\n".join(context_parts) if context_parts else "暂无上下文信息。"

    # Select template
    if prompt_template:
        template = prompt_template
    else:
        template = PROMPT_TEMPLATES.get(current_page, DEFAULT_TEMPLATE)

    full_prompt = template.format(
        context_text=context_text,
        instruction=instruction,
    )

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你是一个专业的剧本创作助手，请用中文回答。"},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0.8,
            max_tokens=2000,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"[AI 生成失败] 请确保已正确配置 OPENAI_API_KEY 环境变量。错误信息：{str(e)}"
