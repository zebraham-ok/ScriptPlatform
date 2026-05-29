"""AI generation API routes."""

import json
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from models.schemas import AIGenerateRequest, AIGenerateResponse, AIChatRecord, AIHistoryResponse
from services import ai_service, file_store

router = APIRouter()


def _serialize_project(project) -> dict:
    """Serialize full project data to a JSON-safe dictionary."""
    return json.loads(project.model_dump_json())


@router.post("/ai/generate", response_model=AIGenerateResponse)
async def ai_generate(body: AIGenerateRequest):
    """Generate content using AI based on full project context. Saves to history."""
    # Verify project exists
    project = file_store.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    model = project.aiConfig.model if project.aiConfig else "gpt-4"

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
