"""FastAPI application entry point."""

from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from routers import projects, ai, auth

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

# Private Network Access middleware (required by Chrome when accessing from public IP)
class PrivateNetworkMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

app.add_middleware(PrivateNetworkMiddleware)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "剧本编辑平台 API 运行中"}


if __name__ == "__main__":
    import uvicorn
    # reload=True for local dev; set RELOAD=false for production
    use_reload = os.environ.get("RELOAD", "true").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=use_reload)
