"""FastAPI application entry point."""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import projects, ai

app = FastAPI(
    title="剧本编辑平台 API",
    description="在线剧本编辑平台后端服务",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "剧本编辑平台 API 运行中"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
