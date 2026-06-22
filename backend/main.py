"""FastAPI application entry point."""

from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.routing import Mount, Route
from starlette.applications import Starlette
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

# Serve music files as static resources
MUSIC_DIR = os.path.join(os.path.dirname(__file__), "resource", "music")
if os.path.isdir(MUSIC_DIR):
    app.mount("/resource/music", StaticFiles(directory=MUSIC_DIR), name="music")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/music/list")
async def list_music():
    """List available BGM files in the resource/music directory."""
    # print(f"[MusicList] MUSIC_DIR={MUSIC_DIR}, exists={os.path.isdir(MUSIC_DIR)}")
    if os.path.isdir(MUSIC_DIR):
        files = [f for f in os.listdir(MUSIC_DIR) if f.endswith(('.mp3', '.wav', '.ogg', '.flac', '.m4a'))]
        # print(f"[MusicList] Found {len(files)} music files: {files}")
        return {"music": sorted(files)}
    # print("[MusicList] MUSIC_DIR does not exist, returning empty list")
    return {"music": []}


@app.get("/")
async def root():
    return {"message": "剧本编辑+游戏平台 API 运行中"}


# ---- Composite ASGI app: FastAPI routes + Socket.IO at /socket.io ----
# We wrap everything in a Starlette Router so that:
#   - /socket.io/*  → Socket.IO ASGIApp (with FastAPI as fallback for static music)
#   - /*             → FastAPI (all REST routes, health, music list, etc.)
# This avoids the problem where app.mount("/", sio_app) swallows all requests.

sio_app = create_socketio_app(fastapi_app=app)

composite_app = Starlette(routes=[
    Mount("/socket.io", app=sio_app),  # Socket.IO must come FIRST
    Mount("/", app=app),               # FastAPI handles everything else
])

# Replace the app reference so uvicorn serves the composite
app = composite_app


if __name__ == "__main__":
    import uvicorn
    use_reload = os.environ.get("RELOAD", "true").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=use_reload)
