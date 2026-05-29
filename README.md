# Script Builder —— 剧本杀与小说创作平台

基于图结构的可视化剧本创作工具，支持人物关系图、地点拓扑图、情节树编辑，并集成 AI 辅助创作。

---

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| **前端** | React 18 + TypeScript | UI 框架 |
| | Ant Design 5 | 组件库（Layout / Tabs / Form / Modal 等） |
| | React Flow 11 | 图可视化编辑（关系图 / 拓扑图 / 情节树） |
| | Zustand | 全局状态管理 + 自动保存 |
| | Axios | HTTP 客户端 |
| **后端** | FastAPI (Python 3.10+) | Web 框架 |
| | OpenAI | LLM 调用（兼容 OpenAI API） |
| | Pydantic 2 | 数据校验 |
| | Uvicorn | ASGI 服务器 |
| **存储** | JSON 文件 | 按用户分目录，无数据库依赖 |

---

## 目录结构

```
script-builder/
├── frontend/                  # React 前端
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── api/index.ts               # 全部 API 调用
│   │   ├── components/
│   │   │   ├── AIPanel/AIPanel.tsx     # AI 创作助手面板
│   │   │   ├── DetailPanel/DetailPanel.tsx  # 右侧详情编辑
│   │   │   ├── GraphCanvas/
│   │   │   │   ├── GraphCanvas.tsx          # 图编辑画布（核心）
│   │   │   │   ├── CustomCharacterNode.tsx  # 人物节点
│   │   │   │   ├── CustomLocationNode.tsx   # 地点节点
│   │   │   │   └── CustomCheckpointNode.tsx # 情节检查点节点
│   │   │   └── Layout/MainLayout.tsx   # 顶部工具栏
│   │   ├── pages/
│   │   │   ├── CharacterPage.tsx       # 人物页面
│   │   │   ├── LocationPage.tsx        # 地点页面
│   │   │   ├── PlotPage.tsx            # 情节树页面
│   │   │   └── WorldviewPage.tsx       # 世界观页面
│   │   ├── store/useProjectStore.ts    # Zustand 全局 store
│   │   ├── types/index.ts             # TypeScript 类型定义
│   │   ├── utils/export.ts            # 导出功能
│   │   ├── App.tsx                    # 根组件（路由 + 项目列表）
│   │   └── index.tsx                  # 入口
│   └── package.json
│
└── backend/                   # FastAPI 后端
    ├── main.py                        # 入口（CORS 配置 + 路由注册）
    ├── requirements.txt               # Python 依赖
    ├── .env                           # 环境变量（API Key）
    ├── models/schemas.py              # Pydantic 数据模型
    ├── routers/
    │   ├── projects.py                # 项目 CRUD API
    │   └── ai.py                      # AI 生成 API
    ├── services/
    │   ├── file_store.py              # JSON 文件存储
    │   └── ai_service.py              # OpenAI 调用 + Prompt 模板
    └── projects/                      # 项目数据存储目录
        └── user1/
```

---

## 部署方法

### 1. 环境要求

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **npm** ≥ 9

### 2. 后端部署

```bash
cd script-builder/backend

# 创建虚拟环境（推荐）
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
# 编辑 .env 文件，填入你的 OpenAI API Key 和 Base URL
# OPENAI_API_KEY=sk-xxxxx
# OPENAI_BASE_URL=https://api.openai.com/v1

# 启动后端（默认端口 8000）
python main.py
```

后端启动后，API 文档自动可用：http://localhost:8000/docs

### 3. 前端部署

```bash
cd script-builder/frontend

# 安装依赖
npm install

# 启动开发服务器（默认端口 3000）
npm start
```

前端启动后访问：http://localhost:3000

### 4. 验证

1. 打开 http://localhost:3000
2. 点击「新建项目」或「打开项目」创建/选择一个项目
3. 在画布上自由编辑人物、地点、情节节点

---

## 主要模块

### 前端

| 模块 | 文件 | 功能 |
|---|---|---|
| **图编辑画布** | `GraphCanvas.tsx` | 基于 React Flow 封装的通用画布，支持节点拖拽、连线、吸附网格、缩放，通过 `onNodeClick`/`onEdgeClick`/`onPaneClick` 精确控制选中状态 |
| **自定义节点** | `CustomCharacterNode.tsx`<br>`CustomLocationNode.tsx`<br>`CustomCheckpointNode.tsx` | 人物节点（显示姓名 + 别名）、地点节点（显示名称 + 类型）、情节节点（显示标题 + 序号），起始检查点带绿色标识 |
| **详情面板** | `DetailPanel.tsx` | 根据选中元素类型渲染对应表单：人物→名称/性别/外貌/性格；地点→类型/描述/地貌；边→关系标签/权重；情节→场景描述/达成条件/触发事件/条件逻辑 |
| **AI 面板** | `AIPanel.tsx` | 右侧抽屉，输入指令调用后端 OpenAI API，根据当前页面类型自动拼接上下文生成内容 |
| **顶部工具栏** | `MainLayout.tsx` | 项目列表切换、四个编辑页面 Tab（人物/地点/世界观/情节树）、导出按钮 |
| **全局 Store** | `useProjectStore.ts` | Zustand store，管理项目数据（nodes/edges/worldBlocks/plotData）、选中状态，并内建 debounce 2 秒自动保存到后端 |
| **导出工具** | `export.ts` | 支持三种导出：完整项目 JSON、LangGraph State 结构化数据、Python 初始化代码 |

### 后端

| 模块 | 文件 | 功能 |
|---|---|---|
| **项目 CRUD** | `routers/projects.py` | 创建/查询/更新/删除/列出项目，支持按用户隔离 |
| **AI 生成** | `routers/ai.py` | 接收前端指令 + 当前页面上下文，调用 `ai_service.py` 生成内容 |
| **AI 服务** | `services/ai_service.py` | 封装 OpenAI 调用，内置四种 Prompt 模板（角色和关系 / 地点 / 情节 / 世界观） |
| **文件存储** | `services/file_store.py` | 按 `projects/{user_id}/{project_id}.json` 路径读写 JSON |
| **数据模型** | `models/schemas.py` | Pydantic 模型定义（ProjectData, NodeData, EdgeData, GraphData, WorldBlock, PlotData 等） |

---

## 使用方法

### 1. 项目入口

打开 http://localhost:3000 → 弹出项目选择框 → 可新建或选择已有项目。

### 2. 人物编辑

切换到「人物」Tab：

- **添加角色**：右键画布空白处 → 添加节点，或点击右侧「+ 添加角色」
- **编辑角色**：点击角色节点 → 右侧面板显示详情表单（姓名、别名、性别、外貌、性格、自定义属性）
- **建立关系**：从节点底部连接点拖拽到另一个节点 → 弹出关系标签输入 → 点击连线可编辑关系详情
- **删除**：选中节点或边后按 `Backspace` / `Delete`

### 3. 地点编辑

切换到「地点」Tab：

- 操作逻辑与人物页面一致，节点代表场景/地点
- 边代表路径或方位关系
- 编辑时可选地点类型（室内/室外/建筑等）、地貌描述

### 4. 世界观编辑

切换到「世界观」Tab：

- 以文本块列表形式编辑世界观设定
- 每块含标题和正文内容
- 支持增删文本块

### 5. 情节树编辑

切换到「情节树」Tab：

- 有向图结构，节点代表剧情检查点，边代表情节推进
- 可右键节点设定为「起始检查点」（显示绿色标识）
- 编辑内容包括：场景描述、达成条件、触发事件、条件逻辑（if-else 分支）

### 6. AI 辅助创作

- 点击顶部「AI 助手」按钮 → 打开右侧抽屉
- 在输入框描述需求（如"生成一个神秘的反派角色"）
- 系统会根据当前 Tab 自动拼接合适的前缀上下文
- 生成结果后可直接复制使用

### 7. 导出

点击顶部「导出」按钮，支持三种格式：

- **导出完整项目**：包含画布坐标、UI 状态的完整 JSON，用于备份和恢复
- **导出 LangGraph State**：去除 UI 字段的结构化数据，适用于下游 Pipeline
- **导出 Python 代码**：生成 `initial_state = {...}` Python 初始化代码

### 8. 自动保存

编辑操作后约 2 秒自动保存到后端，无需手动操作。

---

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/projects` | 列出当前用户所有项目 |
| `POST` | `/api/projects` | 创建项目 |
| `GET` | `/api/projects/{id}` | 获取项目详情 |
| `PATCH` | `/api/projects/{id}` | 更新项目 |
| `DELETE` | `/api/projects/{id}` | 删除项目 |
| `POST` | `/api/ai/generate` | AI 生成内容 |

---

## 配置说明

### 环境变量（`.env`）

```ini
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
```

- `OPENAI_API_KEY`：你的 OpenAI（或兼容服务）API Key
- `OPENAI_BASE_URL`：API 端点地址，支持任何 OpenAI 兼容服务（如 Azure OpenAI、本地模型等）

### 前端 API 地址

默认指向 `http://localhost:8000/api`，在 `src/api/index.ts` 中配置。如需修改，编辑 `baseURL` 即可。
