"""AI service with prompt templates, OpenAI integration, and Qwen fallback."""

import os
import json
from typing import Optional
from openai import OpenAI, AsyncOpenAI

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
    model: str = "qwen-plus",
) -> str:
    """Generate text using AI API with Qwen primary and OpenAI fallback."""

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


MODIFY_SYSTEM_PROMPT = """你是一个专业的剧本创作助手，同时也是一个精确的JSON编辑器。

用户会给你一个完整的剧本项目JSON数据，以及一条修改指令。你只需要返回【需要修改的部分】，系统会自动将你的修改合并到原项目中。

【重要规则】：
- 只返回需要修改的顶层字段（如 title, worldSetting, characters, locations, items, plot 等）
- 未修改的顶层字段不要出现在返回的JSON中
- 如果要修改某个分类（characters/locations/items），必须返回该分类的完整 GraphData，nodes 和 edges 中的每个元素都必须是【完整的对象】，绝对不要只返回 ID 字符串
- 如果要修改 worldSetting，必须返回完整的 worldSetting 数组（包含所有块对象）
- 如果要修改 plot，必须返回完整的 plot 对象（包含 initialCheckpoint, endCheckpoints, graph）
- 所有id必须保持不变（除非是新增节点）
- 保持 position 坐标、edges 关系等不变，除非用户明确要求修改
- 不要在JSON中添加任何解释文字

【Node 必须的完整格式】：
{ "id": "uuid", "type": "节点类型", "label": "显示名", "position": {"x": 数, "y": 数}, "data": { ... } }

【Edge 必须的完整格式】：
{ "id": "uuid", "source": "源节点uuid", "target": "目标节点uuid", "label": "关系名", "data": { ... } }

【JSON字段说明】：
- title: 项目标题（字符串）
- worldSetting: 世界观设定块数组，每个块有 id, title, content
- characters/locations/items: GraphData 对象，包含 nodes 和 edges（每个元素都是完整对象）
- plot: 剧情数据对象，包含 initialCheckpoint, endCheckpoints, graph{nodes, edges}
- 角色node的data字段: name, description, gender, appearance, personality, aliases等
- 地点node的data字段: name, description, locationType, terrain, sceneDescription等
- 剧情node的data字段: name, description, conditions, outcomes等"""

MODIFY_USER_TEMPLATE = """【项目完整JSON】
{project_json}

【当前编辑页面】
{current_page}
当前选中的元素ID：{selected_element_id}

【修改指令】
{instruction}

请只返回需要修改的JSON部分，不要返回完整项目JSON。"""

def modify_project(
    context: dict,
    instruction: str,
    model: str = "qwen-max",
) -> str:
    """Generate a modified project JSON based on user instruction. Returns raw AI response text."""
    current_page = context.get("current_page", "worldview")
    selected_element_id = context.get("selected_element_id", "")
    project_data = context.get("project_data", {})

    project_json = json.dumps(project_data, ensure_ascii=False, indent=2)

    full_prompt = MODIFY_USER_TEMPLATE.format(
        project_json=project_json,
        current_page=current_page,
        selected_element_id=selected_element_id,
        instruction=instruction,
    )

    errors = []

    # Try Qwen first (with JSON mode to ensure correct parsing)
    try:
        client = _get_client("qwen")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": MODIFY_SYSTEM_PROMPT},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0,  # Deterministic output for precise JSON editing
            response_format={"type": "json_object"},
        )
        result = response.choices[0].message.content or ""
        print(f"\n{'='*60}")
        print(f"[AI 修改结果] 供应商: QWEN | 模型: {model}")
        print(f"{'='*60}")
        print(result)
        print(f"{'='*60}\n")
        return result
    except Exception as e:
        errors.append(f"Qwen: {str(e)}")

    # Fallback to OpenAI (with response_format for JSON mode)
    try:
        client = _get_client("openai")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": MODIFY_SYSTEM_PROMPT},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        result = response.choices[0].message.content or ""
        print(f"\n{'='*60}")
        print(f"[AI 修改结果] 供应商: OPENAI | 模型: {model}")
        print(f"{'='*60}")
        print(result)
        print(f"{'='*60}\n")
        return result
    except Exception as e:
        errors.append(f"OpenAI: {str(e)}")

    raise RuntimeError("所有 API 均不可用。\n" + "\n".join(errors))


FILL_FIELD_SYSTEM_PROMPT = """你是一个专业的剧本创作助手。请根据项目整体信息，为指定节点/元素的某个字段填充或扩充内容。

注意：你填写的内容属于"故事档案/设定档案"，并非主持词或叙事文本。因此应当简明扼要、清晰明确，使用平实的描述性语言，不需要过分文学化或煽情。

请返回一个严格的JSON对象，格式如下：
{
  "analysis": "你的分析过程（说明你如何根据项目上下文推断该字段的内容）",
  "content": "建议填充的内容"
}"""

FILL_FIELD_USER_TEMPLATE = """【项目文本摘要（含全部节点、世界观、机制等信息，已省略无关的ID等字段）】
{project_text}

【需要填充的对象完整信息】
{node_data}

【需要填充的字段】
字段名：{field_name}
元素类型：{node_type}

【该字段现有内容】
{existing_content}

请根据以上信息，为"{field_name}"字段生成合适的填充内容。如果现有内容不为空，请在现有内容基础上进行扩充和润色，保留原有的核心信息。"""


def _compress_project_json(project_data: dict) -> str:
    """Convert project JSON to a human-readable text summary, stripping meaningless tech fields (IDs, positions, etc.)."""
    lines = []

    # Worldview
    world_setting = project_data.get("worldSetting", [])
    if world_setting:
        lines.append("=== 世界观 ===")
        for block in world_setting:
            title = block.get("title", "")
            content = block.get("content", "")
            if content.strip():
                lines.append(f"【{title}】\n{content.strip()}")
            elif title.strip():
                lines.append(f"【{title}】（内容为空）")

    # Characters
    chars = project_data.get("characters", {})
    char_nodes = chars.get("nodes", [])
    char_edges = chars.get("edges", [])
    if char_nodes:
        lines.append("\n=== 角色列表 ===")
        for node in char_nodes:
            data = node.get("data", {})
            nlabel = data.get("name") or node.get("label", "")
            lines.append(f"\n▸ 角色：{nlabel}")
            if data.get("gender"):
                lines.append(f"  性别：{data['gender']}")
            if data.get("age") is not None:
                lines.append(f"  年龄：{data['age']}")
            if data.get("appearance"):
                lines.append(f"  外貌：{data['appearance'].strip()}")
            if data.get("personality"):
                lines.append(f"  性格：{data['personality'].strip()}")
            if data.get("motivation"):
                lines.append(f"  动机：{data['motivation'].strip()}")
            if data.get("description"):
                lines.append(f"  描述：{data['description'].strip()}")
            attr = data.get("attributes") or {}
            if attr:
                lines.append(f"  属性：{json.dumps(attr, ensure_ascii=False)}")
        if char_edges:
            lines.append("  角色关系：")
            for edge in char_edges:
                elabel = edge.get("label", "") or edge.get("data", {}).get("description", "")
                if elabel.strip():
                    lines.append(f"    - {elabel.strip()}")

    # Locations
    locs = project_data.get("locations", {})
    loc_nodes = locs.get("nodes", [])
    if loc_nodes:
        lines.append("\n=== 地点列表 ===")
        for node in loc_nodes:
            data = node.get("data", {})
            nlabel = data.get("name") or node.get("label", "")
            lines.append(f"\n▸ 地点：{nlabel}")
            if data.get("locationType"):
                lines.append(f"  类型：{data['locationType']}")
            if data.get("terrain"):
                lines.append(f"  地形：{data['terrain'].strip()}")
            if data.get("description"):
                lines.append(f"  描述：{data['description'].strip()}")

    # Items
    items = project_data.get("items", {})
    item_nodes = items.get("nodes", [])
    if item_nodes:
        lines.append("\n=== 物品列表 ===")
        for node in item_nodes:
            data = node.get("data", {})
            nlabel = data.get("name") or node.get("label", "")
            lines.append(f"\n▸ 物品：{nlabel}")
            if data.get("function"):
                lines.append(f"  功能：{data['function'].strip()}")
            if data.get("acquisitionMethod"):
                lines.append(f"  获取方式：{data['acquisitionMethod'].strip()}")
            if data.get("description"):
                lines.append(f"  描述：{data['description'].strip()}")

    # Plot
    plot = project_data.get("plot", {})
    plot_nodes = plot.get("graph", {}).get("nodes", [])
    plot_edges = plot.get("graph", {}).get("edges", [])
    if plot_nodes:
        lines.append("\n=== 情节节点列表 ===")
        for node in plot_nodes:
            data = node.get("data", {})
            nlabel = data.get("name") or node.get("label", "")
            lines.append(f"\n▸ 情节：{nlabel}")
            if data.get("sceneDescription"):
                lines.append(f"  场景描述：{data['sceneDescription'].strip()}")
            if data.get("description"):
                lines.append(f"  描述：{data['description'].strip()}")
            if data.get("conditions"):
                lines.append(f"  条件：{', '.join(data['conditions'])}")
        if plot_edges:
            lines.append("  情节连接：")
            for edge in plot_edges:
                elabel = edge.get("label", "") or edge.get("data", {}).get("description", "")
                if elabel.strip():
                    lines.append(f"    - {elabel.strip()}")

    # Mechanics
    mechanics = project_data.get("mechanics", {})
    checks = mechanics.get("checks", [])
    votes = mechanics.get("votes", [])
    if checks:
        lines.append("\n=== 检定列表 ===")
        for c in checks:
            lines.append(f"\n▸ 检定：{c.get('name', '')}")
            if c.get("description"):
                lines.append(f"  描述：{c['description'].strip()}")
            if c.get("checkTarget"):
                lines.append(f"  检定目标：{c['checkTarget']}")
            if c.get("difficulty") is not None:
                lines.append(f"  难度：{c['difficulty']}")
    if votes:
        lines.append("\n=== 投票列表 ===")
        for v in votes:
            lines.append(f"\n▸ 投票：{v.get('name', '')}")
            if v.get("options"):
                lines.append(f"  选项：{', '.join(v['options'])}")

    return "\n".join(lines) if lines else "(项目暂无内容)"


def fill_field(
    context: dict,
    model: str = "qwen-plus",
) -> dict:
    """Fill or expand a single field based on full project context. Returns {"analysis": str, "content": str}."""
    project_data = context.get("project_data", {})
    field_name = context.get("field_name", "")
    existing_content = context.get("existing_content", "")
    node_type = context.get("node_type", "")
    node_data_str = context.get("node_data", "")

    # Compress project to text summary (strip IDs and meaningless fields)
    project_text = _compress_project_json(project_data)

    full_prompt = FILL_FIELD_USER_TEMPLATE.format(
        project_text=project_text,
        node_data=node_data_str or "(该对象暂无详细数据)",
        field_name=field_name,
        node_type=node_type,
        existing_content=existing_content or "(空)",
    )

    errors = []

    # Try Qwen first
    try:
        client = _get_client("qwen")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": FILL_FIELD_SYSTEM_PROMPT},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        print(f"\n{'='*60}")
        print(f"[AI 字段填充] 字段: {field_name} | 模型: {model}")
        print(f"{'='*60}")
        print(raw)
        print(f"{'='*60}\n")
        result = json.loads(raw)
        return {
            "analysis": result.get("analysis", ""),
            "content": result.get("content", ""),
        }
    except Exception as e:
        errors.append(f"Qwen: {str(e)}")

    # Fallback to OpenAI
    try:
        client = _get_client("openai")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": FILL_FIELD_SYSTEM_PROMPT},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        result = json.loads(raw)
        return {
            "analysis": result.get("analysis", ""),
            "content": result.get("content", ""),
        }
    except Exception as e:
        errors.append(f"OpenAI: {str(e)}")

    raise RuntimeError("所有 API 均不可用。\n" + "\n".join(errors))


# ========================================
#  Game Mode AI Client (DeepSeek primary, Qwen fallback)
# ========================================

_async_clients: dict = {}
_sync_clients: dict = {}
_active_provider: Optional[str] = None


def _get_provider_config(provider: str) -> tuple:
    """Get API key and base URL for a provider."""
    if provider == "deepseek":
        api_key = os.environ.get("DEEPSEEK_API_KEY", "")
        base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    elif provider == "qwen":
        api_key = os.environ.get("QWEN_API_KEY", "")
        base_url = os.environ.get("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    else:  # openai
        api_key = os.environ.get("OPENAI_API_KEY", "")
        base_url = os.environ.get("OPENAI_BASE_URL", None)

    return api_key, base_url


def get_active_provider() -> Optional[str]:
    """Return the active AI provider name ('deepseek', 'qwen', 'openai') or None."""
    global _active_provider
    if _active_provider:
        return _active_provider

    # Check DeepSeek first (primary)
    api_key, _ = _get_provider_config("deepseek")
    if api_key and api_key != "sk-your-deepseek-key-here":
        _active_provider = "deepseek"
        return _active_provider

    # Check Qwen (fallback)
    api_key, _ = _get_provider_config("qwen")
    if api_key:
        _active_provider = "qwen"
        return _active_provider

    # Check OpenAI (last resort)
    api_key, _ = _get_provider_config("openai")
    if api_key:
        _active_provider = "openai"
        return _active_provider

    return None


def get_default_model() -> str:
    """Get the default model name for the active provider.

    Respects env vars: DEEPSEEK_MODEL, QWEN_MODEL, OPENAI_MODEL.
    """
    provider = get_active_provider()
    if provider == "deepseek":
        return os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")
    elif provider == "qwen":
        return os.environ.get("QWEN_MODEL", "qwen-turbo")
    else:
        return os.environ.get("OPENAI_MODEL", "gpt-4o")


def get_ai_client(provider: str = "deepseek") -> Optional[AsyncOpenAI]:
    """
    Get an async OpenAI-compatible client for game mode.
    Used by LangGraph nodes (generate_node, dm_response_node, ending_node).

    Auto-detects the best available provider (DeepSeek > Qwen > OpenAI).
    Returns None if no API key is configured.
    """
    active = get_active_provider()
    if active is None:
        return None

    api_key, base_url = _get_provider_config(active)

    cache_key = f"{active}:{api_key[:8]}"
    if cache_key not in _async_clients:
        kwargs = {"api_key": api_key, "timeout": 180.0}
        if base_url:
            kwargs["base_url"] = base_url
        _async_clients[cache_key] = AsyncOpenAI(**kwargs)

    return _async_clients[cache_key]


def get_sync_ai_client(provider: str = "deepseek") -> Optional[OpenAI]:
    """Get a sync OpenAI-compatible client (for non-async code)."""
    active = get_active_provider()
    if active is None:
        return None

    api_key, base_url = _get_provider_config(active)

    cache_key = f"sync:{active}:{api_key[:8]}"
    if cache_key not in _sync_clients:
        kwargs = {"api_key": api_key, "timeout": 180.0}
        if base_url:
            kwargs["base_url"] = base_url
        _sync_clients[cache_key] = OpenAI(**kwargs)

    return _sync_clients[cache_key]


async def ai_chat(
    messages: list,
    model: Optional[str] = None,
    temperature: float = 0.8,
    max_tokens: int = 2000,
) -> str:
    """Send a chat completion request to the AI (async).

    If model is not specified, auto-detects the correct model for the active provider.
    """
    if model is None:
        model = get_default_model()

    client = get_ai_client()
    if client is None:
        raise RuntimeError("没有可用的 AI API 密钥。请配置 DEEPSEEK_API_KEY 或 QWEN_API_KEY。")

    print(f"[ai_chat] provider={get_active_provider()}, model={model}")

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""
