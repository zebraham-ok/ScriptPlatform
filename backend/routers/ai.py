"""AI generation API routes."""

import json
import re
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from models.schemas import (
    AIGenerateRequest, AIGenerateResponse, AIChatRecord, AIHistoryResponse,
    AIModifyRequest, AIModifyResponse, AIUndoResponse,
    AIFillFieldRequest, AIFillFieldResponse,
)
from services import ai_service, file_store

router = APIRouter()


def _serialize_project(project) -> dict:
    """Serialize full project data to a JSON-safe dictionary."""
    return json.loads(project.model_dump_json())


def _find_outer_braces(text: str) -> list:
    """Find all outermost { ... } blocks in text, returning raw strings."""
    results = []
    start = 0
    while True:
        idx = text.find('{', start)
        if idx == -1:
            break
        depth = 0
        i = idx
        while i < len(text):
            ch = text[i]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    results.append(text[idx:i+1])
                    start = i + 1
                    break
            i += 1
        else:
            start = idx + 1
    return results


def _find_outer_brackets(text: str) -> list:
    """Find all outermost [ ... ] blocks in text, returning raw strings."""
    results = []
    start = 0
    while True:
        idx = text.find('[', start)
        if idx == -1:
            break
        depth = 0
        i = idx
        while i < len(text):
            ch = text[i]
            if ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    results.append(text[idx:i+1])
                    start = i + 1
                    break
            i += 1
        else:
            start = idx + 1
    return results


def _repair_json(raw: str) -> str:
    """Attempt to repair common JSON issues (trailing commas, unquoted keys)."""
    # Remove trailing commas before closing braces/brackets
    fixed = re.sub(r',\s*}', '}', raw)
    fixed = re.sub(r',\s*]', ']', fixed)
    # Fix single-quoted keys/values -> double-quoted (simple cases)
    # Only attempt if the string looks like it has single quotes
    return fixed


def _try_parse(raw: str, expected_keys: Optional[list] = None) -> Optional[dict]:
    """Try to parse a raw string as JSON. Validate with expected_keys if given."""
    raw = raw.strip()
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if expected_keys:
            if all(k in data for k in expected_keys):
                return data
            return None
        return data
    except json.JSONDecodeError:
        # Try repair
        try:
            repaired = _repair_json(raw)
            data = json.loads(repaired)
            if expected_keys:
                if all(k in data for k in expected_keys):
                    return data
                return None
            return data
        except:
            return None


def _extract_json_from_response(text: str, expected_keys: Optional[list] = None) -> dict:
    """Robust JSON extraction from AI response with multiple fallback strategies.

    Args:
        text: The raw AI response text
        expected_keys: Optional list of keys that must be present in the extracted JSON

    Returns:
        dict: Extracted JSON data
    """
    if not text or not isinstance(text, str):
        return {}

    # Strategy 0: Fast path — whole text is JSON
    if (text.strip().startswith('{') and text.strip().endswith('}')) or \
       (text.strip().startswith('[') and text.strip().endswith(']')):
        result = _try_parse(text.strip(), expected_keys)
        if result is not None:
            return result

    # Strategy 1: ```json code blocks (try all, pick first valid)
    json_blocks = re.findall(r'```json\s*([\s\S]*?)\s*```', text)
    for block in reversed(json_blocks):
        result = _try_parse(block.strip(), expected_keys)
        if result is not None:
            return result

    # Strategy 2: ``` generic code blocks
    code_blocks = re.findall(r'```\s*([\s\S]*?)\s*```', text)
    for block in reversed(code_blocks):
        result = _try_parse(block.strip(), expected_keys)
        if result is not None:
            return result

    # Strategy 3: If expected_keys given, search for JSON objects containing those keys
    if expected_keys:
        for key in expected_keys:
            pattern = r'\{[\s\S]*"' + re.escape(key) + r'"[\s\S]*\}'
            matches = re.findall(pattern, text)
            for match in matches:
                result = _try_parse(match, expected_keys)
                if result is not None:
                    return result

    # Strategy 4: Find outermost braces/brackets, try longest first
    braces = _find_outer_braces(text)
    brackets = _find_outer_brackets(text)
    all_blocks = braces + brackets
    all_blocks.sort(key=len, reverse=True)  # Longest first

    for block in all_blocks:
        result = _try_parse(block, expected_keys)
        if result is not None:
            return result

    # Last resort: try parsing whole text
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    raise ValueError(f"无法从AI返回中提取有效JSON")


@router.post("/ai/generate", response_model=AIGenerateResponse)
async def ai_generate(body: AIGenerateRequest):
    """Generate content using AI based on full project context. Saves to history."""
    # Verify project exists
    project = file_store.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    model = project.aiConfig.model if project.aiConfig else "qwen-plus"

    # Send the ENTIRE project JSON to the AI for comprehensive context
    context = {**body.context}

    # Attach full project data so AI sees all characters, locations, plot, worldview, items
    context["project_data"] = _serialize_project(project)

    generated = ai_service.generate_text(
        context=context,
        instruction=body.instruction,
        prompt_template=body.prompt_template,
        model=model,
    )

    # Save to history
    current_page = body.context.get("current_page", "")
    record = AIChatRecord(
        id=uuid.uuid4().hex[:12],
        timestamp=datetime.now().isoformat(),
        page=current_page,
        instruction=body.instruction,
        template=body.prompt_template or "",
        response=generated,
        model=model,
    )
    file_store.save_ai_record(body.project_id, record)

    return AIGenerateResponse(generated_text=generated)


@router.get("/ai/history/{project_id}", response_model=AIHistoryResponse)
async def get_ai_history(project_id: str):
    """Load all AI chat history for a project."""
    project = file_store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    history = file_store.load_ai_history(project_id)
    return AIHistoryResponse(records=history.records)


# Valid top-level keys in ProjectData — used to validate extracted JSON
_PROJECT_TOP_KEYS = ["title", "worldSetting", "characters", "locations", "items", "plot", "aiConfig"]


@router.post("/ai/modify", response_model=AIModifyResponse)
async def ai_modify(body: AIModifyRequest):
    """Let AI directly modify the project JSON. Creates a backup first for undo."""
    project = file_store.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # Use qwen-max for modify mode (independent of aiConfig)
    model = "qwen-max"
    current_page = body.context.get("current_page", "")
    raw_response = ""
    error_message = None
    updated_project_data = None

    # 1. Backup current project
    file_store.backup_project(body.project_id)
    print(f"[修改模式] 项目 {body.project_id} 已备份")

    # 2. Build context
    context = {**body.context}
    context["project_data"] = _serialize_project(project)

    # 3. Call AI to modify
    try:
        raw_response = ai_service.modify_project(
            context=context,
            instruction=body.instruction,
            model=model,
        )
    except Exception as e:
        error_message = f"AI调用失败: {str(e)}"
        print(f"[修改模式] {error_message}")

    # 4. Extract partial JSON from response (AI only returns changed fields)
    if error_message is None:
        print(f"[修改模式] AI原始返回长度: {len(raw_response)} 字符")
        print(f"[修改模式] AI返回前200字符: {raw_response[:200]}")

        try:
            partial_dict = _extract_json_from_response(raw_response, expected_keys=None)
        except Exception as e:
            error_message = f"AI返回的不是有效JSON: {str(e)}\n\n原始返回前500字符:\n{raw_response[:500]}"
            print(f"[修改模式] JSON提取失败: {e}")
        else:
            print(f"[修改模式] 提取到的部分JSON keys: {list(partial_dict.keys())}")

            # Validate that extracted keys are known project fields
            unknown_keys = [k for k in partial_dict.keys() if k not in _PROJECT_TOP_KEYS]
            if unknown_keys:
                print(f"[修改模式] 警告: 发现未知key {unknown_keys}，尝试继续")

            # 5. Apply changes via deep-merge (patch)
            try:
                updated_project = file_store.patch_project(body.project_id, partial_dict)
            except Exception as e:
                error_message = f"应用修改到项目时出错: {str(e)}"
                print(f"[修改模式] patch_project失败: {e}")
            else:
                if updated_project is None:
                    error_message = "应用修改失败，项目不存在"
                    print(f"[修改模式] patch_project返回None")
                else:
                    print(f"[修改模式] 项目修改成功！更新时间: {updated_project.updatedAt}")
                    updated_project_data = _serialize_project(updated_project)

    # 6. Always save to history (success or failure)
    record = AIChatRecord(
        id=uuid.uuid4().hex[:12],
        timestamp=datetime.now().isoformat(),
        page=current_page,
        instruction=f"[修改] {body.instruction}",
        template="",
        response=raw_response or error_message or "(无响应)",
        model=model,
    )
    try:
        file_store.save_ai_record(body.project_id, record)
        print(f"[修改模式] 历史记录已保存 (id={record.id})")
    except Exception as e:
        print(f"[修改模式] 保存历史记录失败: {e}")

    if error_message:
        return AIModifyResponse(success=False, error=error_message, has_backup=True)

    return AIModifyResponse(
        success=True,
        modified_project=updated_project_data,
        has_backup=True,
    )


@router.post("/ai/undo/{project_id}", response_model=AIUndoResponse)
async def ai_undo(project_id: str):
    """Undo the last AI modification by restoring from backup."""
    if not file_store.has_backup(project_id):
        return AIUndoResponse(success=False, error="没有可撤销的备份")

    restored = file_store.restore_backup(project_id)
    if restored is None:
        return AIUndoResponse(success=False, error="恢复备份失败")

    return AIUndoResponse(
        success=True,
        restored_project=_serialize_project(restored),
    )


@router.post("/ai/fill-field", response_model=AIFillFieldResponse)
async def ai_fill_field(body: AIFillFieldRequest):
    """AI fills a single field based on full project context. Returns analysis + content."""
    project = file_store.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    model = project.aiConfig.model if project.aiConfig else "qwen-plus"

    context = {
        "project_data": _serialize_project(project),
        "field_name": body.field_name,
        "existing_content": body.existing_content,
        "node_type": body.node_type,
    }

    try:
        result = ai_service.fill_field(context=context, model=model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI字段填充失败: {str(e)}")

    print(f"[字段填充] {body.field_name}: analysis={result.get('analysis', '')[:80]}...")

    return AIFillFieldResponse(
        content=result.get("content", ""),
        analysis=result.get("analysis", ""),
    )
