# 捕梦剧本编辑平台 + 游戏主持 Agent 整合方案（修订版）

## 一、整合目标

将 **BUMENGweb-main（AI 跑团主持人 Agent）** 与 **ScriptPlatform（可视化剧本编辑器）** 融合为 **单一平台**——用户在同一站内完成"创作→试玩→发布→游戏"的完整闭环：

1. **创作模式**（原 ScriptPlatform）：可视化编辑剧本的人物、地点、物品、情节、机制
2. **游戏模式**（整合 BUMENGweb-main）：基于编辑成果（或沙盒生成、或导入 JSON）启动 AI 主持游戏
3. **广场浏览**：展示已发布剧本，用户可一键开始游戏
4. **LangGraph 架构**：游戏主持人（DM）采用 LangGraph 状态机替代原有单片 engine+manager+game_flow 架构
5. **多人分饰角色**：支持多玩家各自扮演剧中角色，轮次制推进（每轮全员行动，限时跳过），在创作平台中可为每个人物设定"可扮演角色"及扮演者数量约束

---

## 二、现有代码分析

### 2.1 ScriptPlatform（编辑平台）已有能力

| 模块                | 文件（实际路径）                                        | 能力                                                                          |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **后端入口**  | `backend/main.py`                                     | FastAPI, CORS 中间件,`/api/` 路由注册                                       |
| **项目 CRUD** | `backend/routers/projects.py`                         | 创建/读取/更新/删除/导入项目 JSON                                             |
| **AI 辅助**   | `backend/routers/ai.py`                               | AI 生成、字段填充、项目修改、撤销                                             |
| **数据模型**  | `backend/models/schemas.py`                           | Pydantic: ProjectData, GraphData, NodeData, EdgeData, PlotData, MechanicsData |
| **文件存储**  | `backend/services/file_store.py`                      | 按 `projects/{user_id}/{project_id}.json` 存储                              |
| **认证**      | `backend/routers/auth.py`                             | HMAC-SHA256 Token，10 个预置用户                                              |
| **前端入口**  | `frontend/src/App.tsx`                                | 登录/项目选择/页面路由                                                        |
| **页面布局**  | `frontend/src/components/Layout/MainLayout.tsx`       | 顶栏 + 6 Tab + 65/35 分栏                                                     |
| **图编辑**    | `frontend/src/components/GraphCanvas/GraphCanvas.tsx` | ReactFlow 通用画布                                                            |
| **状态管理**  | `frontend/src/store/useProjectStore.ts`               | Zustand 全局 store + 2s debounce 自动保存                                     |
| **导出**      | `frontend/src/utils/export.ts`                        | 三种格式：完整 JSON / LangGraph State / Python 初始化代码                     |
| **API 层**    | `frontend/src/api/index.ts`                           | Axios 封装 + Token 自动注入 + 401 拦截                                        |

### 2.2 BUMENGweb-main（游戏平台）已有能力

| 模块                 | 文件（实际路径）                              | 能力                                                                                       |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Web 后端**   | `BUMENGweb-main/backend/web_server.py`      | FastAPI + python-socketio, 房间管理, Socket.IO 事件处理                                    |
| **游戏引擎**   | `BUMENGweb-main/backend/engine.py`          | 状态管理(IDLE/LOBBY/PLAYING), 消息发送, TTS, 场景更新                                      |
| **游戏管理器** | `BUMENGweb-main/backend/manager.py`         | 游戏状态, 消息缓冲(3s), AI 指令执行, 检定的掷骰逻辑                                        |
| **游戏流程**   | `BUMENGweb-main/backend/game_flow.py`       | 标准模式(start_game): AI 实时生成剧本; 端午模式(start_festival_game): 加载 DBFestival.json |
| **剧情管理**   | `BUMENGweb-main/backend/plot_management.py` | AI 剧情推演(DeepSeek), 长期记忆, 结局判定, 场景图生成                                      |
| **AI 处理器**  | `BUMENGweb-main/backend/ai_handler.py`      | DeepSeek(剧本生成) + Qwen(日常剧情)                                                        |
| **图片缓存**   | `BUMENGweb-main/backend/image_cache.py`     | 按 scenario_name 区分缓存                                                                  |
| **前端主组件** | `BUMENGweb-main/src/App.jsx`                | 标题页→姓名输入→房间选择→等待大厅→游戏界面→结局卡片                                   |
| **样式系统**   | TailwindCSS 4 + 自定义 CSS 动画               | 暗色主题, 渐变动效, 骰子/回合横幅动画, 自定义滚动条                                        |

### 2.3 核心差距

| 维度               | ScriptPlatform 现状              | BUMENGweb-main 现状                | 整合需要                                   |
| ------------------ | -------------------------------- | ---------------------------------- | ------------------------------------------ |
| **通信**     | RESTful HTTP (`/api/`)         | Socket.IO WebSocket                | 创作侧保持 RESTful, 游戏侧新增 Socket.IO   |
| **游戏架构** | 无                               | 单体 engine+manager+game_flow      | 重构为 LangGraph 状态图                    |
| **剧本来源** | 文件存储的 Editor JSON           | AI 实时生成 / DBFestival.json 预设 | 统一：编辑导出 JSON + AI 沙盒 + 本地导入   |
| **前端样式** | Ant Design 5 (亮色) + 内联 style | TailwindCSS (暗色) + CSS 动画      | Ant Design 布局骨架 + TailwindCSS 视觉风格 |
| **前端构建** | CRA (react-scripts)              | Vite                               | 统一迁移到 Vite                            |
| **认证**     | HMAC-SHA256 (10 用户)            | 无（昵称制）                       | 保留 ScriptPlatform 认证, 游戏模块复用     |
| **多人游戏** | 无                               | 多 sid 可进同一房间，但无角色分配  | 新增角色-玩家绑定、轮次同步、限时跳过    |
| **角色配置** | 人物节点无"可扮演"标记           | 无                                 | 人物节点增加 isPlayable / minPlayers / maxPlayers |

---

## 三、整合架构

### 3.1 平台模式切换

```
┌─────────────────────────────────────────────────────────────┐
│                     统一平台入口                              │
│                                                             │
│   登录 → 项目选择器                                          │
│           │                                                 │
│           ├── 打开项目 → 【创作模式】(原 ScriptPlatform)      │
│           │     └── 6 Tab: 人物/地点/物品/世界观/情节/功能    │
│           │         ├── 导出 JSON                           │
│           │         └── 【试玩】→ 自动跳转【游戏模式】        │
│           │                                                 │
│           ├── 【游戏广场】→ 浏览已发布剧本卡片               │
│           │     └── 选择剧本 → 【游戏模式】                   │
│           │                                                 │
│           └── 【快速开局】→ 直接进入【游戏模式】              │
│                 ├── 沙盒模式：输入偏好 → AI 实时生成角色+剧本  │
│                 └── 导入模式：上传 JSON → 角色卡填写 → 开局   │
│                                                                 │
│           多人流程：                                             │
│           房主创建房间 → 分享链接（或房号）→ 玩家加入            │
│           → 游客可直接通过链接加入，无需平台账号                 │
│           → 角色分配（每人选一个可扮演角色）                    │
│           → 若有"玩家自定"属性 → 填写角色卡                    │
│           → 房主开局 → 轮次制推进（全员行动，限时跳过）         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                         前端 (React + Vite)                       │
│                                                                   │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐ │
│  │       创作模式               │  │       游戏模式               │ │
│  │  Ant Design 布局骨架         │  │  TailwindCSS 暗色沉浸风格    │ │
│  │  ReactFlow 图编辑器           │  │  Socket.IO 实时通信          │ │
│  │  Zustand Store               │  │  聊天 + 角色卡 + 场景图      │ │
│  │  HTTP RESTful API            │  │  骰子/检定动画              │ │
│  └──────────────┬──────────────┘  └──────────────┬──────────────┘ │
│                 │                                │                 │
│          Axios (HTTP)                    Socket.IO Client         │
└─────────────────┼────────────────────────────────┼────────────────┘
                  │                                │
┌─────────────────┼────────────────────────────────┼────────────────┐
│                 ▼                                ▼                 │
│                      后端 (Python FastAPI)                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    RESTful API (/api/)                        │ │
│  │  routers/auth.py     → 认证                                  │ │
│  │  routers/projects.py → 项目 CRUD                             │ │
│  │  routers/ai.py       → AI 辅助创作                           │ │
│  │  routers/game.py     → 【新增】游戏管理（房间/广场/导入）     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               Socket.IO (WebSocket 实时通信)                  │ │
│  │  game_server.py → 【新增】房间事件/消息/游戏状态同步          │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             │                                     │
│  ┌──────────────────────────▼──────────────────────────────────┐ │
│  │              LangGraph 游戏状态机（核心重构）                  │ │
│  │                                                              │ │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │ │
│  │  │ LOBBY    │──▶│ GENERATE │──▶│ PLAYING  │──▶│ ENDING   │  │ │
│  │  │ 征集阶段  │   │ 剧本生成  │   │ 游戏进行  │   │ 结局结算  │  │ │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘  │ │
│  │       │              │              │              │          │ │
│  │       │         ┌────▼────┐         │              │          │ │
│  │       │         │JSON 模式 │         │              │          │ │
│  │       │         │(跳过生成)│         │              │          │ │
│  │       │         └─────────┘         │              │          │ │
│  │       └─────────────────────────────┘              │          │ │
│  │                                                              │ │
│  │  services/                                                    │ │
│  │  ├── ai_service.py      → AI 调用 (DeepSeek + Qwen)           │ │
│  │  ├── file_store.py     → 文件读写                             │ │
│  │  ├── tts_service.py    → EdgeTTS 语音合成                     │ │
│  │  └── image_service.py  → 场景图/头像生成 + 缓存               │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 四、前端整合方案

### 4.1 总体策略

**核心原则**：保留 ScriptPlatform 的页面结构（布局/尺寸/Tab 切换），但将视觉风格向 BUMENGweb-main 靠拢。

| 维度               | 策略                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| **构建工具** | 从 CRA 迁移至 Vite（与 BUMENGweb-main 一致）                                        |
| **UI 框架**  | 保留 Ant Design 5（表单/Modal/Tabs/Button），作为布局骨架                           |
| **样式方案** | 引入 TailwindCSS 4，创作模式保留 Ant Design Token 色系，游戏模式采用暗色沉浸主题    |
| **颜色系统** | 创作模式：亮色（Ant Design 默认）；游戏模式：深色（`bg-slate-900` + 渐变）        |
| **动画**     | 引入 BUMENGweb-main 的 CSS 动画：gradientShift, fadeSlideUp, diceRoll, pulseRing    |
| **页面尺寸** | 保持 `100vh` 全屏布局，65/35 分栏比例不变                                         |
| **游戏 UI**  | 从 BUMENGweb-main `App.jsx` 中提取：聊天面板、角色卡、DM 私信、骰子动效、结局卡片 |
| **通信**     | 创作模式使用 Axios HTTP；游戏模式使用 Socket.IO Client                              |
| **状态管理** | 保留 Zustand（创作模式）+ 新增 gameStore（游戏模式）                                |

### 4.2 前端页面清单

| 页面                 | 路由/条件                  | 来源                   | 说明                                 |
| -------------------- | -------------------------- | ---------------------- | ------------------------------------ |
| **登录**       | Modal                      | ScriptPlatform         | 保留现有登录 Modal                   |
| **项目选择器** | Modal                      | ScriptPlatform         | 保留，新增"游戏广场"和"快速开局"入口 |
| **创作页面**   | `currentPage = 'editor'` | ScriptPlatform         | 6 Tab 图编辑 + AI 面板，保持不变     |
| **游戏广场**   | `currentPage = 'plaza'`  | 新增                   | 剧本卡片瀑布流，支持筛选/搜索        |
| **游戏房间**   | `currentPage = 'game'`   | 从 BUMENGweb-main 提取 | 聊天+角色卡+场景图+DM 私信+骰子      |
| **等待大厅**   | `currentPage = 'lobby'`  | 从 BUMENGweb-main 提取 | 世界观/角色偏好提交，仅沙盒模式      |
| **角色选择**   | `currentPage = 'role_select'` | 新增                   | 多玩家选择角色 + 填写自定属性        |

### 4.3 新增/修改前端文件

```
frontend/src/
├── App.tsx                        # 【修改】新增游戏模式路由
├── store/
│   ├── useProjectStore.ts         # 【保留】创作模式 store
│   └── useGameStore.ts            # 【新增】游戏模式 Zustand store
├── api/
│   ├── index.ts                   # 【修改】新增游戏相关 API
│   └── socket.ts                  # 【新增】Socket.IO 客户端封装
├── pages/
│   ├── CharacterPage.tsx          # 【保留】
│   ├── LocationPage.tsx           # 【保留】
│   ├── ItemPage.tsx               # 【保留】
│   ├── WorldviewPage.tsx          # 【保留】
│   ├── PlotPage.tsx               # 【保留】
│   ├── MechanicsPage.tsx          # 【保留】
│   ├── PlazaPage.tsx              # 【新增】剧本广场
│   ├── GamePage.tsx               # 【新增】游戏主界面（~从 App.jsx 提取）
│   ├── LobbyPage.tsx              # 【新增】等待大厅（~从 App.jsx 提取）
│   └── RoleSelectPage.tsx         # 【新增】角色选择与角色卡填写
├── components/
│   ├── GameRoom/                  # 【新增】游戏房间相关组件
│   │   ├── ChatPanel.tsx          # 公屏聊天
│   │   ├── DMPrivateMessage.tsx   # DM 私密消息
│   │   ├── CharacterSheet.tsx     # 角色卡面板
│   │   ├── SceneBackground.tsx    # 场景背景图
│   │   ├── DiceAnimation.tsx      # 骰子动画
│   │   ├── RoundBanner.tsx        # 回合切换横幅
│   │   ├── EndingCard.tsx         # 结局卡片
│   │   └── ActionInput.tsx        # 行动输入框 + DM 选项
│   └── Plaza/                     # 【新增】广场相关组件
│       ├── ScriptCard.tsx         # 剧本卡片
│       └── ScriptFilter.tsx       # 筛选/搜索栏
└── styles/
    └── game-theme.css             # 【新增】游戏模式暗色主题 + 动画
```

### 4.4 视觉风格迁移要点

从 BUMENGweb-main 的 `App.jsx` 和 `App.css` 中提取以下视觉元素：

```
游戏模式颜色方案：
  背景：bg-slate-900（主）/ bg-slate-800（面板）
  文本：text-white / text-slate-300（次要）
  强调：text-amber-400（标题）/ text-blue-400（链接）
  按钮：bg-amber-500 hover:bg-amber-400
  DM 消息：bg-slate-700 + border-l-4 border-amber-500
  角色卡：bg-slate-800 + border border-slate-600

动画（从 App.css 迁移）：
  @keyframes gradientShift    → 标题渐变位移动画
  @keyframes fadeSlideUp       → 内容淡入上滑
  @keyframes roundBannerIn     → 回合切换横幅
  @keyframes diceRoll          → 骰子弹出
  @keyframes pulseRing         → 脉冲光环
  @keyframes breathe           → 呼吸光效
```

---

## 五、后端整合方案

### 5.1 总体策略

| 维度               | 策略                                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| **框架**     | 保留 ScriptPlatform 的 FastAPI（`backend/main.py`）                           |
| **路由结构** | 保留现有 `/api/auth`, `/api/projects`, `/api/ai`，新增 `/api/game`      |
| **实时通信** | 新增 `backend/game_server.py`，挂载 `python-socketio` 到同一 FastAPI app    |
| **数据存储** | 保留文件系统 JSON（`projects/{user_id}/{project_id}.json`）                   |
| **广场数据** | 新增 `projects/plaza_index.json`（剧本索引）                                  |
| **游戏状态** | 内存 dict 管理房间（从 BUMENGweb-main `web_server.py` 的 `rooms` 字典迁移） |
| **AI 引擎**  | 复用 ScriptPlatform `services/ai_service.py` 的 OpenAI/Qwen 客户端配置        |
| **游戏核心** | 全新 LangGraph 状态机替代 engine+manager+game_flow                              |

### 5.2 后端目录结构（整合后）

```
backend/
├── main.py                        # 【修改】注册 game_server Socket.IO + game 路由
├── requirements.txt               # 【修改】新增 langgraph, python-socketio, edge-tts
├── .env                           # 【修改】新增 DEEPSEEK_API_KEY
├── models/
│   ├── schemas.py                 # 【修改】新增游戏相关 Pydantic 模型
│   └── game_schemas.py            # 【新增】游戏状态、房间、消息等模型
├── routers/
│   ├── auth.py                    # 【保留】
│   ├── projects.py                # 【保留】
│   ├── ai.py                      # 【保留】
│   └── game.py                    # 【新增】广场/剧本/房间 RESTful API
├── services/
│   ├── file_store.py              # 【修改】新增广场索引读写
│   ├── ai_service.py              # 【修改】新增 DeepSeek 客户端 + 游戏 Prompt
│   ├── tts_service.py             # 【新增】EdgeTTS 语音合成（从 chat_tts_handler.py 迁移）
│   └── image_service.py           # 【新增】场景图/头像生成 + 缓存（从 image_cache.py 迁移）
├── game/                          # 【新增】LangGraph 游戏引擎
│   ├── __init__.py
│   ├── game_server.py             # Socket.IO 事件处理（房间/消息）
│   ├── graph.py                   # LangGraph 状态图定义
│   ├── state.py                   # GameState TypedDict 定义
│   ├── nodes/                     # 状态图各节点实现
│   │   ├── __init__.py
│   │   ├── lobby_node.py          # LOBBY：征集偏好
│   │   ├── generate_node.py       # GENERATE：AI 剧本生成
│   │   ├── json_load_node.py      # JSON_LOAD：从预设/编辑器 JSON 加载
│   │   ├── playing_node.py        # PLAYING：主游戏循环
│   │   ├── dm_response_node.py    # DM_RESPONSE：AI 生成 DM 回应
│   │   ├── check_node.py          # CHECK：检定判定
│   │   ├── vote_node.py           # VOTE：投票处理
│   │   ├── wait_players_node.py    # WAIT_PLAYERS：等待全员行动+限时跳过
│   │   └── ending_node.py         # ENDING：结局结算
│   └── utils/
│       ├── __init__.py
│       ├── context_builder.py     # AI 上下文构建
│       ├── script_loader.py       # JSON 剧本加载与解析
│       └── dice.py                # 骰子工具
├── projects/                      # 项目数据存储
│   ├── plaza_index.json           # 【新增】广场剧本索引
│   ├── {user_id}/
│   │   └── {project_id}.json
│   └── scripts/                   # 【新增】已发布剧本 JSON 副本
│       └── {script_id}.json
└── user_secrets.json              # 【保留】
```

### 5.3 API 接口设计

#### 5.3.1 新增 RESTful API（`routers/game.py`）

所有接口挂载在 `/api/` 前缀下，遵循 ScriptPlatform 现有规范。

| 方法     | 路径                            | 说明                                            | 鉴权         |
| -------- | ------------------------------- | ----------------------------------------------- | ------------ |
| `GET`  | `/api/game/scripts`           | 广场剧本列表（分页、筛选、排序）                | Bearer Token |
| `GET`  | `/api/game/scripts/{id}`      | 剧本详情                                        | Bearer Token |
| `GET`  | `/api/game/scripts/{id}/json` | 下载剧本 JSON                                   | Bearer Token |
| `POST` | `/api/game/scripts`           | 发布剧本到广场                                  | Bearer Token |
| `POST` | `/api/game/rooms`             | 创建游戏房间（从广场剧本 / 编辑器 JSON / 沙盒） | Bearer Token |
| `GET`  | `/api/game/rooms/{room_id}`   | 房间状态查询                                    | —           |
| `POST` | `/api/game/rooms/import`      | 上传本地 JSON 创建房间                          | —           |
| `POST` | `/api/game/rooms/{room_id}/join` | 通过链接加入房间（游客可用）                 | —           |
| `POST` | `/api/game/rooms/{room_id}/roles` | 选择/绑定角色                                | —（会话标识） |
| `POST` | `/api/game/rooms/{room_id}/character-sheet` | 提交角色卡（自定属性）             | —（会话标识） |

#### 5.3.2 详细接口定义

**POST /api/game/rooms（创建房间）**

```json
// Request
{
  "mode": "script" | "sandbox" | "import",
  "scriptId": "xxx",           // mode=script 时必填
  "editorJson": { ... },       // mode=script（从编辑器试玩）时，直接传完整 JSON
  "file": null,                // mode=import 时用 multipart/form-data
  "worldview": "...",          // mode=sandbox 时，世界观偏好
  "rolePrefs": "...",          // mode=sandbox 时，角色偏好
  "totalRounds": 15            // 总轮次（5-30，默认 15）
}

// Response
{
  "success": true,
  "data": {
    "roomId": "123456",
    "mode": "script",
    "scriptTitle": "端午到，龙舟跑",
    "shareUrl": "https://平台域名/game/room/123456"
  }
}
```

**POST /api/game/rooms/{room_id}/join（通过链接加入房间，游客可用）**

```json
// Request（无需登录，只需提供昵称）
{
  "nickname": "小张"
}

// Response
{
  "success": true,
  "data": {
    "roomId": "123456",
    "playerId": "temp_abc123",     // 临时会话标识
    "role": "player"                // 或 "owner"
  }
}

// 错误响应
{
  "success": false,
  "error": "房间不存在" | "房间已满" | "游戏已开始无法加入"
}
```

**GET /api/game/scripts（广场列表）**

```json
// Query: ?page=1&pageSize=20&tag=悬疑&sort=hot&keyword=龙舟

// Response
{
  "success": true,
  "data": {
    "total": 42,
    "list": [
      {
        "id": "festival_dragonboat",
        "title": "端午到，龙舟跑",
        "author": "捕梦官方",
        "cover": "/api/game/scripts/festival_dragonboat/cover",
        "tags": ["悬疑", "时间循环", "亲情"],
        "rating": 4.8,
        "playCount": 1280,
        "duration": "2-3小时",
        "playerCount": "1-5人",
        "createTime": "2024-06-01",
        "isOfficial": true
      }
    ],
    "hasMore": true
  }
}
```

**POST /api/game/scripts（发布剧本）**

```json
// Request（需登录，从当前编辑器项目发布）
{
  "projectId": "xxx"
}

// Response
{
  "success": true,
  "data": {
    "scriptId": "script_abc123",
    "message": "剧本发布成功"
  }
}
```

#### 5.3.3 Socket.IO 事件（`game/game_server.py`）

从 BUMENGweb-main `web_server.py` 迁移，事件名保持兼容：

| 事件（前端→后端）      | 说明                                                  |
| ----------------------- | ----------------------------------------------------- |
| `create_room`         | 创建普通房间                                          |
| `create_sandbox_room` | 创建沙盒房间（新增，合并原 create_room + start_game） |
| `join_room`           | 加入房间（6 位房号 / 链接直入 / 游客）               |
| `submit_preference`   | 提交世界观/角色偏好（沙盒模式）                       |
| `start_game`          | 房主开始游戏                                          |
| `send_message`        | 发送玩家行动/对话                                     |
| `dm_option_select`    | 选择 DM 提供的快捷选项                                |
| `leave_room`          | 离开房间                                              |
| `select_role`         | 玩家选择一个可扮演角色（多人模式）                     |
| `submit_character_sheet` | 提交自定义属性角色卡（玩家自定属性）                  |
| `player_ready`        | 玩家确认准备就绪                                       |

| 事件（后端→前端）   | 说明                                   |
| -------------------- | -------------------------------------- |
| `room_created`     | 房间创建成功（返回房号）               |
| `room_joined`      | 加入房间成功                           |
| `room_state`       | 房间状态更新（玩家列表等）             |
| `stage_change`     | 阶段切换（LOBBY → PLAYING → ENDING） |
| `chat_message`     | 公屏消息                               |
| `private_message`  | DM 私密消息                            |
| `scene_update`     | 场景更新（背景图 + 描述）              |
| `dm_status`        | DM 思考状态（"主持人正在翻剧本..."）   |
| `dice_roll`        | 骰子动画触发                           |
| `character_update` | 角色属性变化                           |
| `ending_card`      | 结局卡片                               |
| `join_error`       | 加入/创建错误                          |
| `role_update`      | 角色分配更新（谁选了哪个角色）        |
| `all_ready`        | 所有玩家就绪通知                       |
| `turn_start`       | 新一轮开始（含倒计时秒数）            |
| `turn_timeout`     | 某玩家行动超时，自动跳过              |
| `turn_skip`        | 玩家主动跳过本轮                      |
| `all_acted`        | 本轮所有玩家行动完毕，DM 开始回应     |

#### 5.3.4 房间分享链接与游客模式

**设计原则**：房主需要登录（用于创建房间/发布剧本），但被邀请的玩家无需拥有平台账号，通过链接即可加入。

**分享链接机制**：

```
创建房间成功 → 响应中包含 shareUrl
  → 房主可复制链接发送给朋友（微信/QQ/...）
  → 游客点击链接 → 前端路由 /game/room/:roomId
  → 自动调用 POST /api/game/rooms/{roomId}/join（仅需填写昵称）
  → 获得临时 playerId（基于 UUID + sid）
  → 连接 Socket.IO → join_room → 进入房间
```

**游客标识与管理**：

```python
# game/game_server.py 中玩家数据结构
players[sid] = {
    "player_id": "temp_abc123",      # 临时 ID（游客）/ user_id（登录用户）
    "nickname": "小张",               # 用户输入昵称
    "is_guest": True,                 # 标记为游客
    "character_id": None,             # 绑定角色前为空
    "character_name": None,
    "attributes": {},
    "connected_at": timestamp
}
```

**安全措施**：

| 措施 | 说明 |
|------|------|
| 房间存在性校验 | `POST /api/game/rooms/{room_id}/join` 先检查房间是否还存在 |
| 人数上限 | 已达 `maxPlayers` 时拒绝加入，返回"房间已满" |
| 游戏已开始拒绝 | `stage != "LOBBY"` 时拒绝，返回"游戏已开始无法加入" |
| 昵称去重 | 同房间内昵称不可重复（后端校验） |
| 房主权限隔离 | 游客只能是 player 角色，不可执行 `start_game` 等房主专属操作 |
| 会话绑定 | 游客通过 `playerId` + Socket.IO `sid` 双重标识。刷新页面后 `sid` 改变需重新 join——后端通过昵称识别同一玩家，恢复其角色绑定和属性（玩家仅需再次输入同一昵称即可） |

**前端路由扩展**：

```
前端路由：
  /game/room/:roomId  →  新路由（链接直入入口）
    1. 解析 roomId
    2. 检查当前是否已登录 → 已登录直接 join；未登录弹出昵称输入框
    3. POST /api/game/rooms/{roomId}/join
    4. 获得临时 playerId → 连接 Socket.IO
    5. 进入房间角色选择/等待大厅
```

**兼容房号输入**：保留房间大厅的"输入 6 位房号"入口，两种方式并存。

---

### 5.4 创作平台"人物"页面扩展（多人扮演支持）

#### 5.4.1 Schema 扩展（`models/schemas.py` 中 NodeData 字段新增）

在人物节点的 `NodeData` 中新增以下字段（均为可选，默认不影响现有功能）：

```python
# models/schemas.py 中 CharacterNodeData 新增字段
class CharacterNodeData(BaseModel):
    # ... 现有字段保持不变 ...
    
    # === 新增：可扮演角色配置 ===
    is_playable: bool = False            # 是否可作为玩家扮演角色（默认否）
    min_players: int = 0                 # 该角色最少需要几位扮演者（0=不限制）
    max_players: int = 1                 # 该角色最多容纳几位扮演者
    
    # === 新增：属性级"玩家自定"标记 ===
    customizable_attributes: List[str] = []  # 哪些属性可由玩家自定（如 ["力量","智力"]）
    attribute_constraints: Optional[dict] = None  
    # 示例：{"sum_max": 72, "sum_min": 60, "individual_min": 8, "individual_max": 18}
    # 若为 None，则无约束，玩家自由填写
```

#### 5.4.2 前端"人物"页面 UI 变更

| 变更项 | 说明 |
|--------|------|
| **可扮演角色按钮** | 每个人物卡片右上角新增开关按钮"🎭 可扮演"（默认关闭）。开启后显示 min/max 玩家数输入框 |
| **属性"玩家自定"勾选** | 在人物属性列表中的每个属性旁增加"✏️ 玩家自定"复选框。勾选后该属性在角色卡阶段可由玩家自行填写 |
| **约束条件配置** | 当至少一个属性勾选"玩家自定"时，显示约束条件面板：总属性值范围、单项最值 |
| **剧本玩家数自动计算** | 顶部栏实时显示：`最小玩家数 = Σ(min_players)`、`最大玩家数 = Σ(max_players)`。若所有人物均未开启可扮演，则显示"不限人数" |
| **类型筛选** | 在人物列表页新增筛选按钮"仅显示可扮演角色" |

#### 5.4.3 后端校验

`POST /api/game/scripts`（发布剧本时）增加校验：

```python
# 发布前校验
playable_characters = [c for c in characters if c.get("is_playable")]
min_players = sum(c.get("min_players", 0) for c in playable_characters)
max_players = sum(c.get("max_players", 1) for c in playable_characters) if playable_characters else 0

if min_players > max_players:
    raise HTTPException(400, "最小玩家数不能大于最大玩家数")

# 存储时附加 meta
script_meta = {
    "minPlayers": min_players,
    "maxPlayers": max_players if max_players > 0 else None,  # None = 不限
    "playableCharacters": [
        {"id": c["id"], "name": c["name"], "min": c["min_players"], "max": c["max_players"]}
        for c in playable_characters
    ]
}
```

#### 5.4.4 多人游戏角色卡填写流程

```
房主创建房间 (mode=script)
  ↓
后端根据剧本 meta 返回可选角色列表
  ↓
前端显示角色选择页 (RoleSelectPage)
  ├── 每个玩家选择一个角色（同一人不可多选；同一角色模板最多被 max_players 人选，各自填写不同内容）
  └── 若所选角色有 customizable_attributes：
        ↓
      弹出角色卡填写面板
      ├── 显示可自定的属性项（如力量、智力）
      ├── 实时显示当前属性总和 / 约束范围
      └── 提交时前端 + 后端双重校验约束
  ↓
所有玩家就绪 → 房主点"开始游戏"
  ↓
进入 PLAYING 阶段（轮次制）
```

---

## 六、LangGraph 游戏状态机设计（核心重构）

### 6.1 为什么用 LangGraph

现有 BUMENGweb-main 的游戏逻辑分布在 `engine.py`(状态)、`manager.py`(调度)、`game_flow.py`(流程)、`plot_management.py`(AI推演) 四个模块中，通过 Python 原生 `async/await` + 回调嵌套实现流程控制。这导致：

- 流程分支复杂时回调地狱
- 状态分散在多处，难以追踪
- 扩展新游戏阶段需修改多处代码
- 难以实现检查点/暂停/恢复

LangGraph 将游戏分解为**有向状态图**，每个节点是独立函数，边定义状态转移条件：

- **可观测**：状态图本身即文档
- **可暂停/恢复**：LangGraph 内置 checkpoint
- **可扩展**：新增节点只需插边
- **可测试**：每个节点独立可测

### 6.2 状态图定义

```
                        ┌─────────────┐
                        │   LOBBY     │
                        │  征集阶段     │
                        └──────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    │ 玩家提交偏好         │ 房主点击开始
                    │ (stay in LOBBY)     │
                    └─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     ROUTE_GAME      │  条件路由节点
                    │  判断游戏模式        │
                    └──────┬──────┬──────┘
                           │      │
              mode=sandbox │      │ mode=script/import
                           │      │
              ┌────────────▼─┐  ┌─▼──────────────┐
              │   GENERATE   │  │   JSON_LOAD     │
              │ AI 生成剧本   │  │ 加载预设 JSON   │
              └──────┬───────┘  └──────┬──────────┘
                     │                 │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │    PLAYING      │
                     │   游戏进行中     │◄──────────────┐
                     └────────┬────────┘               │
                              │                        │
                     ┌────────┼────────┐               │
                     │                  │               │
              ┌──────▼──────┐   ┌──────▼──────┐        │
              │ DM_RESPONSE │   │   CHECK     │        │
              │ AI 生成回应  │   │  检定判定    │        │
              └──────┬──────┘   └──────┬──────┘        │
                     │                  │               │
                     │          ┌───────▼───────┐       │
                     │          │     VOTE      │       │
                     │          │   投票处理     │       │
                     │          └───────┬───────┘       │
                     │                  │               │
                     ├──────────────────┤               │
                     │                  │               │
              ┌──────▼──────────────────▼──────┐        │
              │         WAIT_PLAYERS           │        │
              │         等待全员行动            │        │
              └──────────────┬─────────────────┘        │
                             │                          │
                     ┌────────▼────────┐                │
                     │  CHECK_ENDING   │──────────┐     │
                     │  结局条件判断    │ 未满足    │─────┘
                     └────────┬────────┘          │
                              │ 满足               │
                     ┌────────▼────────┐          │
                     │    ENDING       │          │
                     │   结局结算       │          │
                     └─────────────────┘          │
```

### 6.3 GameState 定义

```python
# backend/game/state.py
from typing import TypedDict, List, Dict, Optional, Any, Annotated
from langgraph.graph.message import add_messages

class GameState(TypedDict):
    # === 房间信息 ===
    room_id: str
    room_name: str
    mode: str                          # "sandbox" | "script" | "import"
    owner_sid: str
  
    # === 玩家 ===
    players: Dict[str, dict]           # {sid: {name, character_id, character_name, attributes, ...}}
    player_count: int
    assigned_roles: Dict[str, str]     # {character_id: sid} 角色-玩家绑定
    available_roles: List[str]         # 尚未被选择的角色 ID 列表
    ready_players: set[str]            # 已就绪的玩家 sid 集合
  
    # === 阶段 ===
    stage: str                         # "LOBBY" | "GENERATE" | "JSON_LOAD" | "PLAYING" | "ENDING"
    round: int                         # 当前回合
    total_rounds: int                  # 总回合
  
    # === 沙盒模式 ===
    suggestions: List[str]             # 玩家世界观建议
    role_prefs: Dict[str, str]         # 玩家角色偏好 {player_name: preference}
  
    # === 剧本数据（script/import 模式从 JSON 加载） ===
    script_title: str
    world_setting: List[dict]          # 世界观文本块
    characters_data: List[dict]        # 角色数据
    locations_data: List[dict]         # 地点数据
    items_data: List[dict]             # 物品数据
    plot_graph: dict                   # 剧情节点图
    mechanics_checks: List[dict]       # 检定定义
    mechanics_votes: List[dict]        # 投票定义
    character_attributes: Dict[str, Dict[str, int]]  # 角色属性值
  
    # === 剧本模式运行时 ===
    current_node: str                  # 当前剧情节点 ID
    node_history: List[str]            # 已访问节点
  
    # === 游戏运行时 ===
    scene: str                         # 当前场景名
    scene_description: str             # 场景描述
    scene_image: Optional[str]         # 场景图 base64
    inventory: List[dict]              # 道具列表
    chat_history: Annotated[list, add_messages]  # 对话历史
    long_term_memory: dict             # 长期记忆（角色关系/线索等）
    plot_inspection: dict              # 剧情监控（深层推演）
    
    # === 多人轮次管理 ===
    turn_number: int                   # 当前轮次序号
    turn_timeout_seconds: int          # 每轮限时秒数（默认 120）
    players_acted_this_turn: set[str]  # 本轮已行动的玩家 sid
    players_skipped_this_turn: set[str] # 本轮已跳过的玩家 sid
    turn_started_at: Optional[float]   # 本轮开始时间戳
  
    # === DM 状态 ===
    dm_response: str                   # 当前 DM 回应
    dm_actions: List[dict]             # AI 指令列表 [{type, params}]
    dm_options: List[str]              # 给玩家的快捷选项
  
    # === 检定/投票 ===
    pending_check: Optional[dict]      # 待处理的检定
    pending_vote: Optional[dict]       # 待处理的投票
    dice_result: Optional[dict]        # 掷骰结果
  
    # === 结局 ===
    ending_reached: bool
    ending_data: Optional[dict]        # 结局内容
```

### 6.4 节点实现摘要

#### `lobby_node` — 征集阶段

- 职责：收集玩家世界观偏好和角色偏好
- 输入：Socket.IO `submit_preference` 事件更新 `suggestions` / `role_prefs`
- 转移条件：房主发送 `start_game` → `route_game`

#### `route_game` — 条件路由（无实际逻辑）

- 职责：根据 `mode` 字段路由到不同生成路径
- 条件：`mode == "sandbox"` → `generate_node`；`mode in ("script", "import")` → `json_load_node`

#### `generate_node` — AI 实时生成剧本

- 职责：调用 AI（Qwen-Turbo）根据玩家偏好一次性生成世界观、角色、场景、开场剧情
- 核心逻辑：从 `game_flow.py` 的 `start_game()` 方法提取 AI prompt 构建逻辑
- 完成后填充 `characters_data`, `locations_data`, `items_data`, `plot_inspection` 等字段
- **沙盒模式角色处理**：AI 生成的角色即为可扮演角色，属性值由 AI 自动分配（无"玩家自定"环节）。`is_playable` 默认全部为 true，`min_players`/`max_players` 由 AI 根据剧本规模自动设定（如 4 个角色各 min=1 max=1 → 需要 4 人）。沙盒模式跳过 RoleSelectPage，玩家在 LOBBY 提交偏好后直接由 AI 生成并分配角色

#### `json_load_node` — 加载预设 JSON 剧本

- 职责：从编辑器项目 JSON 或广场剧本 JSON 中提取游戏所需数据
- 核心逻辑：
  1. 读取 ProjectData JSON → 提取 characters/locations/items/plot/mechanics
  2. 构建 `player_characters`（可选角色列表）
  3. 构建 `simplified_plot`（简化剧情图供 AI 参考）
  4. 构建 `plot_inspection`（导演手册）
  5. 设置 `character_attributes`（各角色属性初始值）
- 集成了原 `game_flow.py` 的 `start_festival_game()` 逻辑

#### `playing_node` — 主游戏循环

- 职责：等待玩家输入，批量收集（3秒缓冲），构建上下文，调用 DM AI
- 输入：Socket.IO `send_message` 事件追加到 `chat_history`
- 核心逻辑：从 `game_flow.py` `handle_player_input()` 提取，但去掉对 manager 的直接依赖
- 转移条件：有新消息缓冲 → `dm_response_node`

#### `dm_response_node` — AI 生成 DM 回应

- 职责：调用 DeepSeek 生成 DM 叙述 + AI 指令
- 核心逻辑：从 `plot_management.py` 提取 prompt 构建，合并 `_process_ai_response`
- 输出：`dm_response`（公屏叙述）、`dm_actions`（指令列表）、`dm_options`（快捷选项）、可能的私密消息
- AI 指令类型：`change_scene`, `add_item`, `roll_dice`, `start_vote`, `update_node`, `update_attribute`, `festival_check`

#### `check_node` — 检定判定

- 职责：执行 `dm_actions` 中的检定指令（掷骰 → 比对难度 → 判定成功/失败）
- 核心逻辑：从 `manager.py` `festival_check` 提取
- 输出：`dice_result`（发送骰子动画）、更新 `character_attributes`（成功/失败影响）

#### `wait_players_node` — 等待全员行动（多人模式核心）

- 职责：每轮 DM 叙述结束后，等待所有在线玩家提交行动，支持限时跳过
- 输入：Socket.IO `send_message` 事件追加到 `chat_history`，标记玩家已行动；`turn_skip` 事件标记玩家跳过
- 超时机制：
  ```python
  # 伪代码
  try:
      await asyncio.wait_for(
          wait_all_players_acted(state),
          timeout=state["turn_timeout_seconds"]
      )
  except asyncio.TimeoutError:
      # 未行动的玩家自动跳过
      for sid in state["players"]:
          if sid not in state["players_acted_this_turn"]:
              emit_turn_timeout(sid)  # 通知该玩家被跳过
  ```
- 转移条件：
  - 全员已行动 → `all_acted` 路径 → PLAYING 节点继续（汇总行动后进入 DM_RESPONSE）
  - 超时 → 同上，未行动者跳过
  - 仅剩 1 人 → 等待时间缩短（如 60s）
- 特殊处理：
  - 房主可延长本轮时间（`extend_turn` 事件，+30s，最多延长 3 次）
  - 玩家断线 → 自动跳过，不影响其他玩家

#### `vote_node` — 投票处理

- 职责：发起投票、收集选项、公布结果
- 核心逻辑：从 `manager.py` `start_vote` 提炼

#### `ending_node` — 结局结算

- 职责：生成结局叙述、发送结局卡片
- 触发条件：`endCheckpoints` 节点被访问 / 总回合耗尽 / AI 判定故事结束
- 输出：`ending_data`

### 6.5 与 BUMENGweb-main 现有逻辑的映射

| LangGraph 节点       | 对应原代码                                                    | 迁移方式                            |
| -------------------- | ------------------------------------------------------------- | ----------------------------------- |
| `lobby_node`       | `game_flow.py::start_lobby()`                               | 提取偏好收集逻辑，去掉 Discord 耦合 |
| `generate_node`    | `game_flow.py::start_game()` (line 43-228)                  | 提取 AI prompt 构建 + 剧本生成逻辑  |
| `json_load_node`   | `game_flow.py::start_festival_game()` (line 230-462)        | 完整迁移，参数化 `script_json`    |
| `playing_node`     | `game_flow.py::handle_player_input()`                       | 提取消息缓冲 + 上下文构建           |
| `dm_response_node` | `plot_management.py` + `manager.py::_process_ai_response` | 合并 prompt 构建 + 响应解析         |
| `check_node`       | `manager.py::_execute_ai_action` (festival_check)           | 提取检定逻辑                        |
| `wait_players_node` | 新增（无原代码对应）                                        | 全新：轮次同步 + 限时跳过            |
| `vote_node`        | `manager.py::_execute_ai_action` (start_vote)               | 提取投票逻辑                        |
| `ending_node`      | `plot_management.py` 结局判定                               | 提取结局条件判断 + 结局生成         |

---

## 七、数据模型扩展

### 7.1 广场剧本索引（`projects/plaza_index.json`）

```json
{
  "version": "1.0",
  "scripts": [
    {
      "id": "festival_dragonboat",
      "title": "端午到，龙舟跑",
      "author": "捕梦官方",
      "coverPath": "/scripts/covers/dragonboat.png",
      "tags": ["悬疑", "时间循环", "亲情"],
      "rating": 4.8,
      "playCount": 1280,
      "duration": "2-3小时",
      "playerCount": "1-5人",
      "jsonPath": "/scripts/DBFestival.json",
      "createTime": "2024-06-01",
      "isOfficial": true
    }
  ]
}
```

### 7.2 新增 Pydantic 模型（`models/game_schemas.py`）

```python
class CreateRoomRequest(BaseModel):
    mode: str = "sandbox"                 # "sandbox" | "script" | "import"
    scriptId: Optional[str] = None        # 广场剧本 ID
    editorJson: Optional[Dict] = None     # 编辑器 JSON（试玩用）
    worldview: Optional[str] = None       # 沙盒：世界观偏好
    rolePrefs: Optional[str] = None       # 沙盒：角色偏好
    totalRounds: int = 15

class PublishScriptRequest(BaseModel):
    projectId: str

class ScriptCard(BaseModel):
    id: str
    title: str
    author: str
    coverPath: Optional[str]
    tags: List[str]
    rating: float
    playCount: int
    duration: str
    playerCount: str
    createTime: str
    isOfficial: bool

class PlayableRole(BaseModel):
    characterId: str
    name: str
    minPlayers: int
    maxPlayers: int
    customizableAttributes: List[str]     # 可自定的属性名列表
    attributeConstraints: Optional[dict]  # 属性约束

class SelectRoleRequest(BaseModel):
    characterId: str

class CharacterSheetRequest(BaseModel):
    characterId: str
    attributes: Dict[str, int]   # 玩家填写的属性值 {"力量": 16, "智力": 12, ...}

class ScriptListResponse(BaseModel):
    total: int
    list: List[ScriptCard]
    hasMore: bool
```

### 7.3 与 ScriptPlatform ProjectData 的映射

游戏模式需要从编辑器导出 JSON 中提取结构化数据。映射关系：

| GameState 字段           | ProjectData 来源                                          | 提取逻辑                                                   |
| ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| `script_title`         | `project.title`                                         | 直接映射                                                   |
| `world_setting`        | `project.worldSetting`                                  | 直接映射                                                   |
| `characters_data`      | `project.characters.nodes` + `edges`                  | 节点提取 + 边关系展开                                      |
| `locations_data`       | `project.locations.nodes` + `edges`                   | 同上                                                       |
| `items_data`           | `project.items.nodes` + `edges`                       | 同上                                                       |
| `plot_graph`           | `project.plot.graph`                                    | 节点 + 边，保留 `initialCheckpoint` / `endCheckpoints` |
| `mechanics_checks`     | `project.mechanics.checks`                              | 直接映射                                                   |
| `mechanics_votes`      | `project.mechanics.votes`                               | 直接映射                                                   |
| `character_attributes` | `project.characterParams` + `characters.nodes[].data` | 参数名 → 初始值（取中值向上取整）                         |

此映射即前端的 "导出 LangGraph State" 功能的扩展版（`frontend/src/utils/export.ts::buildLangGraphState()`）。

---

## 八、详细实施计划

### 阶段一：基础设施迁移（优先级：最高）

| 序号 | 任务                          | 涉及文件                                                                | 预估工时 |
| ---- | ----------------------------- | ----------------------------------------------------------------------- | -------- |
| 1.1  | 前端构建工具迁移：CRA → Vite | `package.json`, `vite.config.ts`, `index.html`, `tsconfig.json` | 4h       |
| 1.2  | 引入 TailwindCSS 4            | `package.json`, `postcss.config.js`, `src/index.css`              | 2h       |
| 1.3  | 创建游戏模式暗色主题 CSS      | `src/styles/game-theme.css`                                           | 2h       |
| 1.4  | 后端新增依赖安装              | `requirements.txt`（langgraph, python-socketio, edge-tts）            | 0.5h     |
| 1.5  | 后端 `.env` 扩展            | 新增 `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`                        | 0.5h     |

### 阶段二：游戏广场 API（优先级：高）

| 序号 | 任务               | 涉及文件                                                        | 预估工时 |
| ---- | ------------------ | --------------------------------------------------------------- | -------- |
| 2.1  | 创建游戏路由模块   | `routers/game.py`（广场 CRUD、房间 API）                      | 3h       |
| 2.2  | 创建广场索引存储   | `services/file_store.py` 扩展 + `projects/plaza_index.json` | 2h       |
| 2.3  | 创建游戏数据模型   | `models/game_schemas.py`                                      | 1h       |
| 2.4  | 剧本发布功能       | `routers/game.py` → `POST /api/game/scripts`               | 2h       |
| 2.5  | 注册路由到 main.py | `main.py`                                                     | 0.5h     |

### 阶段三：LangGraph 状态机（优先级：最高）

| 序号 | 任务                     | 涉及文件                                                                  | 预估工时 |
| ---- | ------------------------ | ------------------------------------------------------------------------- | -------- |
| 3.1  | 定义 GameState TypedDict | `game/state.py`                                                         | 2h       |
| 3.2  | 实现基础节点             | `game/nodes/lobby_node.py`, `generate_node.py`, `json_load_node.py` | 6h       |
| 3.3  | 实现游戏节点             | `game/nodes/playing_node.py`, `dm_response_node.py`                   | 6h       |
| 3.4  | 实现机制节点             | `game/nodes/check_node.py`, `vote_node.py`, `ending_node.py`        | 4h       |
| 3.4a | 实现多人等待节点         | `game/nodes/wait_players_node.py`（轮次同步+超时跳过+断线处理）    | 5h       |
| 3.5  | 组装状态图               | `game/graph.py`（定义节点 + 边 + 条件路由）                             | 3h       |
| 3.6  | 实现工具函数             | `game/utils/context_builder.py`, `script_loader.py`, `dice.py`      | 4h       |

### 阶段四：Socket.IO 游戏服务器（优先级：高）

| 序号 | 任务                  | 涉及文件                                                  | 预估工时 |
| ---- | --------------------- | --------------------------------------------------------- | -------- |
| 4.1  | 创建 Socket.IO 服务器 | `game/game_server.py`（房间管理 + 事件处理）            | 4h       |
| 4.2  | 集成到 FastAPI app    | `main.py`（挂载 `socketio.ASGIApp`）                  | 2h       |
| 4.3  | 房间生命周期管理      | `game/game_server.py`（创建/加入/离开/重连）            | 3h       |
| 4.4  | 后端 AI 服务扩展      | `services/ai_service.py`（新增 DeepSeek 客户端）        | 2h       |
| 4.5  | TTS 服务迁移          | `services/tts_service.py`（从 `chat_tts_handler.py`） | 2h       |
| 4.6  | 图片服务迁移          | `services/image_service.py`（从 `image_cache.py`）    | 2h       |
| 4.7  | 房间分享链接 + 游客加入 | `routers/game.py` + `game/game_server.py`            | 3h       |

### 阶段五：前端游戏模式（优先级：高）

| 序号 | 任务                       | 涉及文件                              | 预估工时 |
| ---- | -------------------------- | ------------------------------------- | -------- |
| 5.1  | 创建 Socket.IO 客户端封装  | `src/api/socket.ts`                 | 2h       |
| 5.2  | 创建游戏模式 Zustand store | `src/store/useGameStore.ts`         | 3h       |
| 5.3  | 提取/创建游戏 UI 组件      | `GameRoom/*.tsx`（7 个组件）        | 8h       |
| 5.4  | 创建等待大厅页面           | `pages/LobbyPage.tsx`               | 3h       |
| 5.5  | 创建游戏主页面             | `pages/GamePage.tsx`                | 4h       |
| 5.6  | App.tsx 路由扩展           | `App.tsx`（新增游戏/大厅/广场/角色选择路由） | 2h       |
| 5.7  | 角色选择页面               | `pages/RoleSelectPage.tsx`                  | 4h       |
| 5.8  | 角色卡填写面板（自定属性） | `components/GameRoom/CharacterSheetEditor.tsx` | 3h       |
| 5.9  | 轮次倒计时 + 行动状态指示  | `GamePage.tsx` 扩展 + `TurnTimer.tsx`       | 3h       |
| 5.10 | 链接加入路由 + 游客昵称弹窗 | `App.tsx` 新增 `/game/room/:roomId` 路由         | 2h       |
| 5.11 | 房间内分享链接复制按钮     | `LobbyPage.tsx` + `GamePage.tsx`                | 1h       |

### 阶段六：前端广场（优先级：中）

| 序号 | 任务               | 涉及文件                              | 预估工时 |
| ---- | ------------------ | ------------------------------------- | -------- |
| 6.1  | 创建剧本卡片组件   | `components/Plaza/ScriptCard.tsx`   | 3h       |
| 6.2  | 创建筛选/搜索栏    | `components/Plaza/ScriptFilter.tsx` | 2h       |
| 6.3  | 创建广场页面       | `pages/PlazaPage.tsx`               | 3h       |
| 6.4  | 广场 API 对接      | `src/api/index.ts` 扩展             | 1h       |
| 6.5  | 项目选择器新增入口 | `App.tsx`（广场/快速开局按钮）      | 1h       |

### 阶段七：编辑器对接（优先级：中）

| 序号 | 任务                                        | 涉及文件                                      | 预估工时 |
| ---- | ------------------------------------------- | --------------------------------------------- | -------- |
| 7.1  | 导出并试玩按钮                              | `MainLayout.tsx` + `App.tsx`              | 2h       |
| 7.2  | 试玩流程：导出 JSON → 创建房间 → 跳转游戏 | `export.ts` 扩展 + `App.tsx`              | 2h       |
| 7.3  | 剧本发布功能                                | `MainLayout.tsx` + `routers/game.py` 对接 | 2h       |
| 7.4  | 添加"前往游戏平台"入口                      | `MainLayout.tsx` 顶部栏                     | 1h       |

### 阶段七-B：编辑器多人角色配置（优先级：中）

| 序号 | 任务                                        | 涉及文件                                      | 预估工时 |
| ---- | ------------------------------------------- | --------------------------------------------- | -------- |
| 7B.1 | Schema 扩展：NodeData 增加 isPlayable 等    | `models/schemas.py`                           | 1.5h     |
| 7B.2 | 人物卡片"可扮演角色"开关 + min/max 输入     | `CharacterPage.tsx` 扩展                      | 3h       |
| 7B.3 | 属性"玩家自定"勾选 + 约束条件面板           | `CharacterPage.tsx` 扩展                      | 3h       |
| 7B.4 | 剧本玩家数自动计算 + 顶部栏显示             | `CharacterPage.tsx` + `useProjectStore.ts`   | 1.5h     |
| 7B.5 | 发布校验：min/max 玩家数合法性              | `routers/game.py`                             | 1h       |

### 阶段八：联调与测试（优先级：中）

| 序号 | 任务                                     | 预估工时 |
| ---- | ---------------------------------------- | -------- |
| 8.1  | 编辑试玩全流程测试                       | 3h       |
| 8.2  | 广场浏览与选本游戏测试                   | 2h       |
| 8.3  | 沙盒模式 AI 生成测试                     | 3h       |
| 8.4  | JSON 导入模式测试（含格式校验/错误处理） | 2h       |
| 8.5  | LangGraph checkpoint 暂停/恢复测试       | 2h       |
| 8.6  | 性能测试（多房间并发、AI 响应时间）      | 3h       |
| 8.7  | UI 视觉回归（创作模式/游戏模式切换）     | 2h       |
| 8.8  | 多人轮次同步测试（含断线/超时/跳过）    | 5h       |

---

## 九、关键实现细节

### 9.1 模式切换机制

```
前端 App.tsx 状态管理：
  currentMode: 'editor' | 'plaza' | 'game' | 'lobby' | 'role_select'

创作模式 → 游戏模式：
  1. 用户点击"试玩"
  2. 调用 export.ts::buildLangGraphState() 生成 GameState 兼容 JSON
  3. POST /api/game/rooms { mode: "script", editorJson: {...} }
  4. 获得 roomId
  5. 若有可扮演角色 → setCurrentMode('role_select')，角色分配完成后 → 'game'
  6. 若无 → setCurrentMode('game') + 连接 Socket.IO
  7. 前端自动 join_room(roomId)

快速开局（沙盒/导入）：
  1. 用户从项目选择器点"快速开局"
  2. 输入偏好 / 上传 JSON
  3. POST /api/game/rooms { mode: "sandbox"|"import", ... }
  4. 同上步骤 4-7
```

### 9.2 LangGraph 与 Socket.IO 的集成

```python
# game/graph.py 伪代码
from langgraph.graph import StateGraph, END
from game.state import GameState

builder = StateGraph(GameState)

builder.add_node("lobby", lobby_node)
builder.add_node("route_game", route_game)       # 条件路由
builder.add_node("generate", generate_node)
builder.add_node("json_load", json_load_node)
builder.add_node("playing", playing_node)
builder.add_node("dm_response", dm_response_node)
builder.add_node("check", check_node)
builder.add_node("vote", vote_node)
builder.add_node("wait_players", wait_players_node)
builder.add_node("ending", ending_node)

builder.add_edge("lobby", "route_game")
builder.add_conditional_edges("route_game", route_condition, {
    "sandbox": "generate",
    "script": "json_load",
    "import": "json_load"
})
builder.add_edge("generate", "playing")
builder.add_edge("json_load", "playing")
builder.add_conditional_edges("playing", playing_condition, {
    "dm_turn": "dm_response",
    "check": "check",
    "vote": "vote",
    "ending": "ending",
    "wait": "playing"       # 等待更多输入
})
builder.add_edge("dm_response", "wait_players")  # DM 叙述后等待全员行动
builder.add_edge("check", "wait_players")
builder.add_edge("vote", "wait_players")
builder.add_conditional_edges("wait_players", wait_condition, {
    "continue": "playing",    # 回到 playing 汇总处理
    "ending": "ending"        # 可能因所有玩家退出等触发结束
})
builder.add_edge("ending", END)

# 编译图，启用 checkpoint（支持暂停/恢复）
graph = builder.compile(checkpointer=MemorySaver())
```

### 9.3 两种游戏模式的数据流

**沙盒模式**：

```
LOBBY → route_game(mode=sandbox) → GENERATE → AI调用Qwen-Turbo
→ 生成 world_setting, characters_data, locations_data, plot_inspection
→ PLAYING → 玩家输入 → DM_RESPONSE(DeepSeek) → 更新状态 → ...
```

**剧本模式（编辑器试玩 / 广场选本 / JSON 导入）**：

```
[编辑器导出 JSON] → POST /api/game/rooms → JSON_LOAD
→ 加载 characters_data, locations_data, items_data, plot_graph, mechanics
→ PLAYING → 玩家输入 → DM_RESPONSE(DeepSeek) 
→ AI 基于 preset plot_graph 推进，使用 mechanics_checks 触发检定
→ CHECK_NODE(掷骰) → 更新 character_attributes → ...
```

### 9.4 前端游戏 UI 组件提取策略

从 BUMENGweb-main `src/App.jsx`（约 104KB 单文件）中提取：

- **聊天面板**：`chatHistory.map()` 渲染的公屏消息列表
- **角色卡**：`playerCharacters` 状态渲染的角色属性面板
- **场景背景**：`backgroundImage` 状态渲染的场景图
- **DM 选项**：`dmOptions` 状态渲染的快捷按钮
- **骰子动效**：`showDiceAnimation` / `diceResult` 状态的 SVG 动画
- **结局卡片**：`endingState` 状态的 Modal
- **阶段切换**：`gameStage` 状态的画面过渡

提取后封装为独立组件，用 TailwindCSS 重写样式（保持与 BUMENGweb-main 视觉一致），用 Zustand `useGameStore` 管理状态。

### 9.5 后端服务迁移细节

| 原 BUMENGweb-main 文件        | 迁移到                                     | 关键变更                                                                        |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `ai_handler.py`             | `services/ai_service.py` 扩展            | 复用现有 OpenAI 客户端，新增 DeepSeek client；合并 prompt 模板到 `prompts.py` |
| `prompts.py`                | `services/ai_service.py` 内置            | 整合进 ai_service，按场景组织 prompt 模板                                       |
| `chat_tts_handler.py`       | `services/tts_service.py`                | 去掉 Discord 耦合，纯 Web 接口                                                  |
| `image_cache.py`            | `services/image_service.py`              | 保留 `scenario_name` 分区逻辑                                                 |
| `literature_search.py`      | `game/utils/context_builder.py`          | 语义搜索作为上下文构建的可选增强                                                |
| `web_server.py`（房间部分） | `game/game_server.py`                    | 保留 Socket.IO 事件处理，替换底层引擎调用为 LangGraph                           |
| `engine.py`                 | 拆分到 `game_server.py` + LangGraph 节点 | 状态管理归 Graph，消息发送归 game_server                                        |
| `manager.py`                | 拆分到 LangGraph 节点                      | 游戏状态 → GameState TypedDict；AI 指令 → dm_actions 字段                     |
| `game_flow.py`              | 拆分到 LangGraph 节点                      | 流程控制 → 状态图边；AI prompt 构建 → 各节点                                  |

### 9.6 多人轮次同步机制

```
每轮流程：
  
  DM_RESPONSE 节点输出叙述
        ↓
  WAIT_PLAYERS 节点【等待全员行动】
  ├── 广播 turn_start (倒计时 120s)
  ├── 收集玩家 send_message 事件
  │   ├── 玩家 A 发出行动 → players_acted.add("A")
  │   └── 广播 action_update 告知其他玩家"A 已行动"
  ├── 若玩家点"跳过"→ players_skipped.add("X")
  ├── 若超时 → 未行动的玩家标记 skipped
  │   └── 广播 turn_timeout
  ├── 条件检查：
  │   ├── 全员 acted/skipped → 立即结束等待
  │   ├── 仅剩 1 人未行动 → 等待时间缩短为 60s
  │   └── 所有在线玩家均已 acted/skipped → 结束等待
  └── 转移 → PLAYING 节点（汇总行动消息）
        ↓
  DM 基于全员行动生成叙述（context 中附加每条行动的来源角色）
        ↓
  DM_RESPONSE → WAIT_PLAYERS → ...
```

**轮次间的 DM 上下文构建**：

```python
# 构建 DM prompt 时，将每个玩家的行动与其角色绑定
actions_context = []
for sid in room_state.players_acted_this_turn:
    char_name = room_state.players[sid]["character_name"]
    action = room_state.players[sid].get("last_action", "（未行动）")
    actions_context.append(f"{char_name}：{action}")

prompt = f"""
...前情提要...
本回合各角色行动：
{chr(10).join(actions_context)}
请作为 DM 基于以上所有角色的行动，推进剧情...
"""
```

### 9.7 前端构建迁移要点（CRA → Vite）

```
关键变更：
1. package.json: react-scripts → vite + @vitejs/plugin-react
2. 新增 vite.config.ts
3. public/index.html → index.html（移至根目录，添加 <script type="module" src="/src/index.tsx">）
4. 环境变量：REACT_APP_* → VITE_*
5. tsconfig.json 调整 paths
6. proxy 配置：package.json proxy → vite.config.ts server.proxy
7. 移除 %PUBLIC_URL% 引用
```

---

## 十、风险与应对

| 风险                              | 影响 | 应对策略                                                                 |
| --------------------------------- | ---- | ------------------------------------------------------------------------ |
| LangGraph 学习曲线                | 高   | 先在测试环境用 mock AI 验证状态图；节点独立可单测                        |
| CRA→Vite 迁移兼容问题            | 中   | 保留 CRA 分支作为回退；分步迁移验证                                      |
| TailwindCSS + Ant Design 样式冲突 | 中   | 用 Tailwind `prefix` 或 `important` 配置隔离；游戏模式单独 CSS scope |
| Socket.IO + LangGraph 异步协调    | 高   | LangGraph 节点使用 async；game_server 通过事件驱动触发 graph.invoke()    |
| AI Prompt 模板质量退化            | 中   | 保留 BUMENGweb-main 原有 prompt 文本；仅重构调用方式                     |
| 多房间 LangGraph 实例隔离         | 中   | 每个房间创建独立 `graph.compile()` 实例 + MemorySaver                  |
| 文件系统存储并发问题              | 低   | `file_store.py` 已有简单读写，广场索引加 `asyncio.Lock`              |
| 用户上传恶意 JSON                 | 中   | 服务端 schema 校验（Pydantic），限制文件大小 < 5MB                       |
| 多人轮次同步延迟                  | 中   | 用 asyncio.wait_for 精确控制超时；玩家断线自动跳过，不动全局等待        |
| 角色卡属性约束绕过                | 低   | 前后端双重校验；发布时预存 constraints 到剧本 meta                       |
| 多人并发时 AI 响应过慢            | 中   | DM_RESPONSE 前合并所有行动为单次 AI 调用（非逐玩家调用）                 |
| 网络波动导致玩家 action 丢失      | 中   | Socket.IO 自带重连+重发；state 中保留 action 确认机制

---

## 十一、与原始方案的差异总结

| 维度               | 原始方案（GAME_INTEGRATION_PLAN v1）     | 修订方案（v2）                                              |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| **架构**     | 两个独立平台通过 API 连接                | 单一平台，创作/游戏模式切换                                 |
| **游戏核心** | 保留 BUMENGweb-main 单体架构             | 全新 LangGraph 状态机                                       |
| **代码基础** | 以 BUMENGweb-main 为主                   | 以 ScriptPlatform 为主体结构                                |
| **前端样式** | 未提及                                   | 创造模式保留 Ant Design + 游戏模式引入 TailwindCSS 暗色主题 |
| **API 设计** | 自定义格式                               | 遵循 ScriptPlatform `/api/` RESTful + Pydantic 规范       |
| **构建工具** | 未提及                                   | CRA → Vite 迁移                                            |
| **认证**     | 未提及                                   | 复用 ScriptPlatform HMAC-SHA256 Token                       |
| **剧本导入** | 临时 JSON 上传 / 广场 JSON 下载          | 编辑器直接导出 → 创建房间 / 广场发布 / 本地文件导入        |
| **多人扮演** | 未提及                                   | 角色-玩家绑定、轮次同步、限时跳过、角色卡填写               |
| **文件引用** | 泛称 `web_server.py`, `game_flow.py` | 精确标注实际文件路径 + 行号                                 |
| **数据模型** | 自定义 `ScriptCard` 结构               | 基于 ScriptPlatform `models/schemas.py` 扩展              |

---

## 十二、预估总工时

| 阶段           | 内容                 | 预估工时                |
| -------------- | -------------------- | ----------------------- |
| 阶段一         | 基础设施迁移         | 9h                      |
| 阶段二         | 游戏广场 API         | 8.5h                    |
| 阶段三         | LangGraph 状态机     | 30h（含 wait_players_node 5h） |
| 阶段四         | Socket.IO 游戏服务器 | 18h（含分享链接+游客 3h） |
| 阶段五         | 前端游戏模式         | 35h（含链接加入/分享按钮 3h） |
| 阶段六         | 前端广场             | 10h                     |
| 阶段七         | 编辑器对接           | 7h                      |
| 阶段七-B       | 编辑器多人角色配置   | 10h                     |
| 阶段八         | 联调与测试           | 22h（含多人在线同步测试 5h） |
| **合计** |                      | **约 149.5 小时** |

---

## 十三、后续扩展方向

1. **LangGraph Agent 可视化编辑**：前端直接编辑状态图节点和边，生成 LangGraph Python 代码
2. **剧本评分/评论系统**：玩后打分、写评论（需引入数据库）
3. **收藏功能**：用户收藏喜欢的剧本
4. **作者主页**：展示作者的所有作品
5. **语音/视频通话**：多人游戏时内置语音频道
6. **数值平衡分析**：创作时自动分析检定难度与角色属性平衡
7. **模板拖拽**：预制人物/地点/情节模板，拖拽到画布使用
8. **剧本变现**：优质剧本付费下载/体验
