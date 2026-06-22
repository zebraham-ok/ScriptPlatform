# 剧本编辑+游戏平台 — 部署指南

## 服务器信息

- IP: `39.97.238.76`
- 系统: CentOS (阿里云)
- 内存: 2 GB（构建前端时需设置 swap）

---

## 1. 服务器目录结构

```
/opt/script_platform/
├── backend/                  # 后端 Python 代码
│   ├── main.py               # FastAPI 入口
│   ├── resource/
│   │   └── music/            # BGM 音乐文件 (*.mp3, *.wav, ...)
│   └── ...
├── frontend/
│   └── build/                # 前端构建产物（只需这个目录）
└── ...
```

```
/etc/
├── nginx/
│   └── conf.d/
│       └── script_platform.conf   # Nginx 站点配置
└── systemd/system/
    └── fastapi.service            # 后端 systemd 服务
```

---

## 2. 关键文件清单

| 本地文件 | 服务器路径 | 用途 |
|---------|----------|------|
| `script_platform.conf` | `/etc/nginx/conf.d/script_platform.conf` | Nginx 代理规则 |
| `backend/main.py` | `/opt/script_platform/backend/main.py` | 后端入口（Socket.IO + FastAPI 组合） |
| `backend/` 全部代码 | `/opt/script_platform/backend/` | 后端全部 Python 文件 |
| `backend/resource/music/` | `/opt/script_platform/backend/resource/music/` | BGM 音乐文件 |
| `frontend/build/` | `/opt/script_platform/frontend/build/` | 前端构建产物（`npm run build` 输出） |
| `frontend/.env.production` | **无需上传**（仅构建时读取） | Vite 环境变量 |

---

## 3. 初始化新服务器

### 3.1 目录创建

```bash
mkdir -p /opt/script_platform/backend/resource/music
mkdir -p /opt/script_platform/frontend/build
```

### 3.2 后端 — 上传代码 + 安装依赖

```bash
# 1. 上传 backend/ 目录全部文件到 /opt/script_platform/backend/
# 2. 安装 Python 依赖
cd /opt/script_platform/backend
pip install -r requirements.txt
```
**注意**: 需要提前安装 `json_repair`（已在 requirements.txt 中）。

### 3.3 后端 — 创建 systemd 服务

创建文件 `/etc/systemd/system/fastapi.service`：

```ini
[Unit]
Description=Script Platform Backend API
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=/opt/script_platform/backend
ExecStart=/usr/local/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**关键点**: `--workers 1` 必须为单 worker（Socket.IO 无 Redis adapter，多 worker 会导致 WebSocket 跨进程 session 丢失）。

```bash
sudo systemctl daemon-reload
sudo systemctl enable fastapi.service   # 开机自启
sudo systemctl start fastapi.service    # 启动
```

### 3.4 Nginx 配置

将 `script_platform.conf` 上传到 `/etc/nginx/conf.d/script_platform.conf`，然后：

```bash
sudo nginx -t                    # 测试配置
sudo systemctl reload nginx      # 重载
```

### 3.5 BGM 文件

将音乐文件上传到 `/opt/script_platform/backend/resource/music/`，后端会自动通过 `/resource/music/` 路径暴露。

---

## 4. 日常更新

### 4.1 更新前端

**推荐方式：本地构建后上传**

```bash
# 本地
cd frontend
npm run build
# 将 build/ 目录上传到服务器 /opt/script_platform/frontend/build/

# 前端是静态文件，nginx 直接读取，无需重启任何服务
```

**备选方式：服务器上构建（内存不足时）**

```bash
cd /opt/script_platform/frontend
export NODE_OPTIONS=--max-old-space-size=1024
npm run build
```

> 服务器仅 2GB 内存，直接 `npm run build` 会 OOM。建议本地构建后上传。

### 4.2 更新后端

```bash
# 1. 上传新代码覆盖 /opt/script_platform/backend/
# 2. 重启服务（支持热重载，通常几秒完成）
sudo systemctl restart fastapi.service

# 3. 查看日志确认启动正常
journalctl -u fastapi.service -f
```

### 4.3 更新 Nginx 配置

```bash
# 1. 上传 script_platform.conf → /etc/nginx/conf.d/script_platform.conf
# 2. 测试 + 重载
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. 日常运维命令速查

| 操作 | 命令 |
|------|------|
| 启动后端 | `sudo systemctl start fastapi.service` |
| 停止后端 | `sudo systemctl stop fastapi.service` |
| 重启后端 | `sudo systemctl restart fastapi.service` |
| 查看后端状态 | `sudo systemctl status fastapi.service` |
| 查看后端日志 | `journalctl -u fastapi.service -f` |
| 重载 Nginx | `sudo nginx -t && sudo systemctl reload nginx` |
| 验证 Socket.IO | `curl "http://127.0.0.1:8000/socket.io/?EIO=4&transport=polling"` |
| 验证 API | `curl "http://127.0.0.1:8000/api/health"` |
| 验证 BGM 资源 | `curl -I "http://127.0.0.1:8000/resource/music/中国古风.mp3"` |

---

## 6. 架构说明（踩坑总结）

### 6.1 Nginx 代理规则顺序（重要！）

`/socket.io` 和 `/resource/` 必须放在 `/` 前面，否则被根路径吞掉：

```
location /socket.io → 后端 :8000（WebSocket）
location /resource/  → 后端 :8000（BGM 静态文件）
location /           → 前端 build/（SPA fallback）
location /api/       → 后端 :8000（REST API）
```

### 6.2 后端 main.py 架构

```
socketio.ASGIApp（主 ASGI 应用）
├── /socket.io/*  → Socket.IO 引擎
└── 其他所有请求   → FastAPI
    ├── /api/*         → REST 路由
    ├── /resource/music/ → StaticFiles（BGM）
    └── /              → 根路由
```

**不要**在外层套 Starlette `Mount("/socket.io", ...)`，它会剥离路径前缀导致 Socket.IO 不识别。

### 6.3 单 Worker 模式

使用 `--workers 1`，因为：
- Socket.IO 在无 Redis adapter 时，多 worker 会导致握手和 WebSocket 升级请求落到不同进程，session 丢失
- 整个后端是异步 I/O（等 AI API），单 worker asyncio 完全够用

### 6.4 环境变量

`frontend/.env.production` **只在 `npm run build` 时被 Vite 读取**，构建后这些值被内联到 JS 文件中。服务器上不需要 `.env.production`。

---

## 7. 常见问题排查

| 现象 | 可能原因 | 排查命令 |
|------|---------|---------|
| 网页打不开 / 空白 | Nginx 未运行 | `sudo systemctl status nginx` |
| API 返回 502/504 | 后端未运行 | `sudo systemctl status fastapi.service` |
| WebSocket 连接失败 | Nginx 缺 `/socket.io` 代理 | `sudo cat /etc/nginx/conf.d/script_platform.conf \| grep socket.io` |
| Socket.IO 握手返回 JSON 而非 sid | `main.py` 架构不对（socketio.ASGIApp 未生效） | `tail -20 /opt/script_platform/backend/main.py` |
| BGM 不播放 | Nginx 缺 `/resource/` 代理 | `curl -I "http://127.0.0.1:8000/resource/music/xxx.mp3"` |
| 页面改动不生效 | 浏览器缓存 | 强制刷新（Ctrl+F5）或无痕模式 |
| 前端构建 OOM | 服务器内存不足 | 本地 `npm run build` 后上传 |

---

## 8. 调试验证流水线

部署或更新后，依次执行以下验证：

```bash
# 1. 后端进程状态
sudo systemctl status fastapi.service

# 2. Socket.IO 握手（应返回 0{"sid":"..."}...）
curl "http://127.0.0.1:8000/socket.io/?EIO=4&transport=polling"

# 3. API 健康检查（应返回 {"status":"ok"}）
curl "http://127.0.0.1:8000/api/health"

# 4. BGM 列表
curl "http://127.0.0.1:8000/api/music/list"

# 5. Nginx 前端页
curl -I "http://127.0.0.1:80/"

# 6. 从浏览器访问
# http://39.97.238.76
# 打开 F12 → Network → 检查 WebSocket 连接和 /resource/ 请求
```
