"""AI service with prompt templates, OpenAI integration, and Qwen fallback."""

import os
import json
from typing import Optional
from openai import OpenAI

# Default prompt templates - standardized output format
PROMPT_TEMPLATES = {
    "character": """你是一个专业的剧本创作助手。请根据项目整体设定和当前角色信息，为角色提供标准化格式的创作建议。

【项目完整数据（JSON）】
{project_json}

【当前聚焦元素】
当前选中的元素ID：{selected_element_id}
相关关联元素：
{nearby_text}

【用户指令】
{instruction}

请按以下标准化格式输出角色创作建议：

## 角色基本信息
- 姓名：
- 年龄：
- 性别：
- 职业/身份：

## 性格特征
- 核心性格：
- 优点：
- 缺点：
- 行为习惯：

## 背景故事
- 出身：
- 重要经历：
- 内心创伤/执念：

## 行为动机
- 当前目标：
- 深层欲望：
- 与其他角色的关系定位：

## 台词风格建议
- 口头禅：
- 说话特点：

## 创作备注
- 与整体设定的关联：
- 潜在发展空间：""",

    "location": """你是一个专业的剧本创作助手。请根据项目整体设定和当前地点信息，为场景提供标准化格式的创作建议。

【项目完整数据（JSON）】
{project_json}

【当前聚焦元素】
当前选中的元素ID：{selected_element_id}
相关关联元素：
{nearby_text}

【用户指令】
{instruction}

请按以下标准化格式输出场景创作建议：

## 场景基本信息
- 名称：
- 类型（室内/室外/特殊空间）：
- 所属世界观区域：

## 环境描写
- 视觉印象（光线、色彩、空间布局）：
- 听觉氛围（环境音、标志性声响）：
- 嗅觉/触觉细节：

## 场景功能
- 在此场景可能发生的剧情事件：
- 适合出现的角色：
- 对剧情的推动作用：

## 象征意义
- 场景隐喻：
- 与主题的关联：

## 创作备注
- 氛围关键词：
- 可用的细节道具：""",

    "plot": """你是一个专业的剧本创作助手。请根据项目整体设定和当前剧情状态，为情节发展提供标准化格式的创作建议。

【项目完整数据（JSON）】
{project_json}

【当前聚焦元素】
当前选中的元素ID：{selected_element_id}
相关关联元素：
{nearby_text}

【用户指令】
{instruction}

请按以下标准化格式输出情节创作建议：

## 情节事件
- 事件名称：
- 触发条件：
- 参与角色：
- 发生地点：

## 事件流程
- 起因：
- 经过（关键节点）：
- 结果/后果：

## 情节功能
- 对主线的推动：
- 角色发展作用：
- 悬念/反转设置：

## 与其他情节的衔接
- 前置事件：
- 后置事件：
- 平行事件：

## 创作备注
- 节奏建议：
- 情感基调：""",

    "worldview": """你是一个专业的剧本创作助手。请根据项目整体设定，为世界观提供标准化格式的创作建议。

【项目完整数据（JSON）】
{project_json}

【当前聚焦元素】
当前选中的元素ID：{selected_element_id}
相关关联元素：
{nearby_text}

【用户指令】
{instruction}

请按以下标准化格式输出世界观创作建议：

## 设定分类
- 类别（历史/科技/魔法/社会等）：
- 层级（全局设定/区域设定/细节设定）：

## 设定内容
- 核心规则/原理：
- 具体表现：
- 与其他设定的关联：

## 逻辑一致性检查
- 与已有设定的兼容性：
- 可能的矛盾点：
- 解决建议：

## 叙事应用
- 如何影响角色行为：
- 如何推动剧情发展：
- 可引发的冲突类型：

## 创作备注
- 灵感来源建议：
- 扩展方向：""",
}

DEFAULT_TEMPLATE = """你是一个专业的剧本创作助手。

【项目完整数据（JSON）】
{project_json}

【当前聚焦元素】
当前选中的元素ID：{selected_element_id}
相关关联元素：
{nearby_text}

【用户指令】
{instruction}

请提供专业、详细、标准化的创作建议。"""


def _get_client(provider: str = "openai") -> OpenAI:
    """Get OpenAI-compatible client for specified provider."""
    if provider == "qwen":
        api_key = os.environ.get("QWEN_API_KEY", "")
        base_url = os.environ.get("QWEN_BASE_URL", None)
    else:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        base_url = os.environ.get("OPENAI_BASE_URL", None)

    if not api_key:
        return OpenAI(api_key="sk-placeholder", base_url=base_url)
    return OpenAI(api_key=api_key, base_url=base_url, timeout=180.0)


def _try_generate(
    client: OpenAI,
    model: str,
    full_prompt: str,
    provider: str = "openai",
) -> str:
    """Attempt generation with given client, return result or raise exception."""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "你是一个专业的剧本创作助手，请用中文回答。"},
            {"role": "user", "content": full_prompt},
        ],
        temperature=0.8,
        max_tokens=4000,
    )
    result = response.choices[0].message.content or ""
    print(f"\n{'='*60}")
    print(f"[AI 生成结果] 供应商: {provider.upper()} | 模型: {model}")
    print(f"{'='*60}")
    print(result)
    print(f"{'='*60}\n")
    return result


def generate_text(
    context: dict,
    instruction: str,
    prompt_template: Optional[str] = None,
    model: str = "gpt-4",
) -> str:
    """Generate text using AI API with OpenAI primary and Qwen fallback."""

    current_page = context.get("current_page", "worldview")
    selected_element_id = context.get("selected_element_id", "")
    nearby_elements = context.get("nearby_elements", [])
    project_data = context.get("project_data", {})

    # Build project JSON text
    project_json = json.dumps(project_data, ensure_ascii=False, indent=2)

    # Build nearby elements text
    nearby_parts = []
    if nearby_elements:
        for elem in nearby_elements:
            if isinstance(elem, dict):
                nearby_parts.append(f"  - {elem.get('label', elem.get('id', ''))}: {json.dumps(elem, ensure_ascii=False)}")
            else:
                nearby_parts.append(f"  - {elem}")
    nearby_text = "\n".join(nearby_parts) if nearby_parts else "暂无关联元素。"

    # Select template
    if prompt_template:
        template = prompt_template
    else:
        template = PROMPT_TEMPLATES.get(current_page, DEFAULT_TEMPLATE)

    full_prompt = template.format(
        project_json=project_json,
        selected_element_id=selected_element_id,
        nearby_text=nearby_text,
        instruction=instruction,
    )

    errors = []

    # Try Qwen first (primary)
    try:
        qwen_model = model if model != "gpt-4" else "qwen-plus"
        client = _get_client("qwen")
        return _try_generate(client, qwen_model, full_prompt, provider="qwen")
    except Exception as e:
        errors.append(f"Qwen: {str(e)}")

    # Fallback to OpenAI
    try:
        client = _get_client("openai")
        return _try_generate(client, model, full_prompt, provider="openai")
    except Exception as e:
        errors.append(f"OpenAI: {str(e)}")

    return f"[AI 生成失败] 所有 API 均不可用。\n请检查 OPENAI_API_KEY 和 QWEN_API_KEY 环境变量。\n错误信息：\n" + "\n".join(errors)
