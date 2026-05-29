"""AI generation API routes."""

from fastapi import APIRouter, HTTPException
from models.schemas import AIGenerateRequest, AIGenerateResponse
from services import ai_service, file_store

router = APIRouter()


@router.post("/ai/generate", response_model=AIGenerateResponse)
async def ai_generate(body: AIGenerateRequest):
    """Generate content using AI based on project context."""
    # Verify project exists
    project = file_store.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    model = project.aiConfig.model if project.aiConfig else "gpt-4"

    # Build full context from project data
    context = {**body.context}

    # Add project-level context based on current page
    current_page = body.context.get("current_page", "")
    if current_page == "character" and project.characters.nodes:
        context["all_characters"] = [
            {"id": n.id, "label": n.label, "data": n.data}
            for n in project.characters.nodes
        ]
        context["all_relationships"] = [
            {
                "source": e.source,
                "target": e.target,
                "label": e.label,
                "data": e.data,
            }
            for e in project.characters.edges
        ]
    elif current_page == "location" and project.locations.nodes:
        context["all_locations"] = [
            {"id": n.id, "label": n.label, "data": n.data}
            for n in project.locations.nodes
        ]
    elif current_page == "plot" and project.plot.graph.nodes:
        context["all_checkpoints"] = [
            {"id": n.id, "label": n.label, "data": n.data}
            for n in project.plot.graph.nodes
        ]
    elif current_page == "worldview" and project.worldSetting:
        context["world_blocks"] = [
            {"id": w.id, "title": w.title, "content": w.content}
            for w in project.worldSetting
        ]

    generated = ai_service.generate_text(
        context=context,
        instruction=body.instruction,
        prompt_template=body.prompt_template,
        model=model,
    )

    return AIGenerateResponse(generated_text=generated)
