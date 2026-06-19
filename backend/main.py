"""FastAPI application entry point."""

from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from routers import projects, ai, auth, game
from game.game_server import create_socketio_app

app = FastAPI(
    title="剧本编辑+游戏平台 API",
    description="在线剧本编辑与AI跑团游戏平台后端服务",
    version="2.0.0",
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

# Include REST routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(game.router, prefix="/api")

# Mount Socket.IO
socketio_app = create_socketio_app()
app.mount("/", socketio_app)  # Socket.IO handles /socket.io/* paths


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/")
async def root():
    return {"message": "剧本编辑+游戏平台 API 运行中"}


if __name__ == "__main__":
    import uvicorn
    use_reload = os.environ.get("RELOAD", "true").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=use_reload)
