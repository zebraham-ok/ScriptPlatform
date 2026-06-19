# 项目合并检查点计划

> 基于 `GAME_INTEGRATION_PLAN.md` 制定的 6 个关键检查点，确保每一步都可独立验证后再继续推进。

---

## 检查点总览

```
CP1 基础设施     CP2 LangGraph核心    CP3 后端完整      CP4 前端可玩      CP5 闭环打通      CP6 最终验收
  │                │                   │                 │                 │                 │
  ▼                ▼                   ▼                 ▼                 ▼                 ▼
Phase 1 ────► Phase 3 ────────► Phase 2+4 ─────► Phase 5 ──────► Phase 6+7 ────► Phase 7B+8
 (9h)           (30h)            (26.5h)          (35h)            (17h)           (32h)
```

---

## Checkpoint 1：基础设施就绪

**覆盖阶段**：Phase 1（约 9h）

### 任务清单

| 序号 | 任务 | 涉及文件 |
|------|------|----------|
| 1.1 | 前端构建工具迁移：CRA → Vite | `package.json`, `vite.config.ts`, `index.html`, `tsconfig.json` |
| 1.2 | 引入 TailwindCSS 4 | `package.json`, `postcss.config.js`, `src/index.css` |
| 1.3 | 创建游戏模式暗色主题 CSS | `src/styles/game-theme.css` |
| 1.4 | 后端新增依赖安装 | `requirements.txt`（langgraph, python-socketio, edge-tts） |
| 1.5 | 后端 `.env` 扩展 | 新增 `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` |

### 验证标准

- [ ] `npm run dev` 正常启动 Vite 开发服务器，无报错
- [ ] 创作模式 6 个 Tab 页面（人物/地点/物品/世界观/情节/功能）正常渲染
- [ ] 页面能使用 TailwindCSS 类名，与 Ant Design 不冲突
- [ ] `game-theme.css` 可被正确加载
- [ ] `python main.py` 正常启动 FastAPI
- [ ] `import langgraph`, `import socketio`, `import edge_tts` 无报错
- [ ] DeepSeek 相关环境变量已配置并可用

### 风险提示

- CRA → Vite 迁移：注意 `%PUBLIC_URL%` 移除、环境变量 `REACT_APP_*` → `VITE_*`
- TailwindCSS 与 Ant Design 样式冲突：通过 `prefix` 或 `important` 配置隔离

---

## Checkpoint 2：LangGraph 状态机核心就绪

**覆盖阶段**：Phase 3（约 30h）

### 任务清单

| 序号 | 任务 | 涉及文件 |
|------|------|----------|
| 3.1 | 定义 GameState TypedDict | `game/state.py` |
| 3.2 | 实现基础节点 | `game/nodes/lobby_node.py`, `generate_node.py`, `json_load_node.py` |
| 3.3 | 实现游戏节点 | `game/nodes/playing_node.py`, `dm_response_node.py` |
| 3.4 | 实现机制节点 | `game/nodes/check_node.py`, `vote_node.py`, `ending_node.py` |
| 3.4a | 实现多人等待节点 | `game/nodes/wait_players_node.py`（轮次同步+超时跳过+断线处理） |
| 3.5 | 组装状态图 | `game/graph.py`（定义节点 + 边 + 条件路由） |
| 3.6 | 实现工具函数 | `game/utils/context_builder.py`, `script_loader.py`, `dice.py` |

### 验证标准

- [ ] `GameState` TypedDict 通过 Python 类型检查
- [ ] 9 个节点均可独立用 mock 数据运行，输出符合预期
- [ ] `graph.invoke(mock_state)` 完整遍历 LOBBY → PLAYING → ENDING
- [ ] 条件路由正确：沙盒模式走 `generate_node`，剧本/导入模式走 `json_load_node`
- [ ] `wait_players_node` 超时场景验证：超时后未行动玩家自动跳过
- [ ] `check_node` 掷骰逻辑正确：骰子结果 → 难度比对 → 成功/失败判定

### 风险提示

- LangGraph 学习曲线：先在测试环境用 mock AI 验证状态图；节点独立可单测
- 多房间隔离：每个房间创建独立 `graph.compile()` 实例 + MemorySaver

---

## Checkpoint 3：后端完整可通信

**覆盖阶段**：Phase 2 + Phase 4（约 26.5h）

### 任务清单

| 序号 | 任务 | 涉及文件 |
|------|------|----------|
| 2.1 | 创建游戏路由模块 | `routers/game.py`（广场 CRUD、房间 API） |
| 2.2 | 创建广场索引存储 | `services/file_store.py` 扩展 + `projects/plaza_index.json` |
| 2.3 | 创建游戏数据模型 | `models/game_schemas.py` |
| 2.4 | 剧本发布功能 | `routers/game.py` → `POST /api/game/scripts` |
| 2.5 | 注册路由到 main.py | `main.py` |
| 4.1 | 创建 Socket.IO 服务器 | `game/game_server.py`（房间管理 + 事件处理） |
| 4.2 | 集成到 FastAPI app | `main.py`（挂载 `socketio.ASGIApp`） |
| 4.3 | 房间生命周期管理 | `game/game_server.py`（创建/加入/离开/重连） |
| 4.4 | 后端 AI 服务扩展 | `services/ai_service.py`（新增 DeepSeek 客户端） |
| 4.5 | TTS 服务迁移 | `services/tts_service.py`（从 `chat_tts_handler.py`） |
| 4.6 | 图片服务迁移 | `services/image_service.py`（从 `image_cache.py`） |
| 4.7 | 房间分享链接 + 游客加入 | `routers/game.py` + `game/game_server.py` |

### 验证标准

**REST API**
- [ ] `GET /api/game/scripts` 返回广场剧本列表（分页、筛选正常）
- [ ] `GET /api/game/scripts/{id}` 返回剧本详情
- [ ] `POST /api/game/scripts` 发布剧本成功，索引文件更新
- [ ] `POST /api/game/rooms` 三种模式（script/sandbox/import）均可创建
- [ ] `POST /api/game/rooms/{id}/join` 登录用户和游客均可加入
- [ ] `POST /api/game/rooms/{id}/import` 上传 JSON 成功

**Socket.IO**
- [ ] 创建房间 → 收到 `room_created` 事件
- [ ] 加入房间 → 收到 `room_joined` + `room_state` 事件
- [ ] 发送消息 → 收到 `chat_message` 事件（含 DM 回复）
- [ ] 阶段切换 → 收到 `stage_change` 事件
- [ ] 骰子检定 → 收到 `dice_roll` 事件

**LangGraph 联动**
- [ ] 房间发消息 → LangGraph `playing_node` 响应 → `dm_response_node` 生成回复 → 前端收到
- [ ] 切换至不同状态图路径（检定/投票）时事件正确

**游客模式**
- [ ] 分享链接生成正确
- [ ] 游客通过链接 + 昵称加入成功
- [ ] 房间满/游戏已开始时游客被正确拒绝

### 风险提示

- Socket.IO + LangGraph 异步协调：LangGraph 节点使用 async；game_server 通过事件驱动触发 graph.invoke()
- 文件存储并发：广场索引加 `asyncio.Lock`
- 上传恶意 JSON：服务端 Pydantic schema 校验，限制文件大小 < 5MB

---

## Checkpoint 4：前端游戏可玩（单人）

**覆盖阶段**：Phase 5（约 35h）

### 任务清单

| 序号 | 任务 | 涉及文件 |
|------|------|----------|
| 5.1 | 创建 Socket.IO 客户端封装 | `src/api/socket.ts` |
| 5.2 | 创建游戏模式 Zustand store | `src/store/useGameStore.ts` |
| 5.3 | 提取/创建游戏 UI 组件 | `GameRoom/ChatPanel.tsx`, `DMPrivateMessage.tsx`, `CharacterSheet.tsx`, `SceneBackground.tsx`, `DiceAnimation.tsx`, `RoundBanner.tsx`, `EndingCard.tsx`, `ActionInput.tsx` |
| 5.4 | 创建等待大厅页面 | `pages/LobbyPage.tsx` |
| 5.5 | 创建游戏主页面 | `pages/GamePage.tsx` |
| 5.6 | App.tsx 路由扩展 | `App.tsx`（新增游戏/大厅/广场/角色选择路由） |
| 5.7 | 角色选择页面 | `pages/RoleSelectPage.tsx` |
| 5.8 | 角色卡填写面板（自定属性） | `components/GameRoom/CharacterSheetEditor.tsx` |
| 5.9 | 轮次倒计时 + 行动状态指示 | `GamePage.tsx` 扩展 + `TurnTimer.tsx` |
| 5.10 | 链接加入路由 + 游客昵称弹窗 | `App.tsx` 新增 `/game/room/:roomId` 路由 |
| 5.11 | 房间内分享链接复制按钮 | `LobbyPage.tsx` + `GamePage.tsx` |

### 验证标准

**沙盒模式**
- [ ] 输入世界观偏好 → LOBBY 等待 → AI 生成角色和剧本 → 进入游戏
- [ ] 游戏对话正常：玩家输入 → DM 回复含剧情叙述
- [ ] DM 快捷选项可点击选择
- [ ] 骰子动画正确展示
- [ ] 游戏进程推进至结局 → 结局卡片展示

**剧本模式**
- [ ] 加载预设 JSON 剧本 → 角色数据正确展示
- [ ] 角色选择 → 角色卡展示属性
- [ ] 基于剧本的剧情推进（非 AI 随机生成）
- [ ] 检定触发时弹出掷骰

**UI 效果**
- [ ] 暗色主题（bg-slate-900）正确渲染
- [ ] CSS 动画（gradientShift, fadeSlideUp, diceRoll, pulseRing）正常
- [ ] 聊天面板、角色卡、场景图布局正确
- [ ] 响应式无溢出/错位

**游客流程**
- [ ] 点击分享链接 → 昵称输入弹窗 → 加入成功 → 进入游戏
- [ ] 链接加入路由 `/game/room/:roomId` 正常工作

### 风险提示

- BUMENGweb-main `App.jsx` 约 104KB 单文件，提取时注意状态解耦
- 组件间通信通过 Zustand store，避免 prop drilling
- 游戏模式与创作模式样式隔离：创作模式保持 Ant Design 亮色

---

## Checkpoint 5：广场浏览 + 编辑器对接

**覆盖阶段**：Phase 6 + Phase 7（约 17h）

### 任务清单

| 序号 | 任务 | 涉及文件 |
|------|------|----------|
| 6.1 | 创建剧本卡片组件 | `components/Plaza/ScriptCard.tsx` |
| 6.2 | 创建筛选/搜索栏 | `components/Plaza/ScriptFilter.tsx` |
| 6.3 | 创建广场页面 | `pages/PlazaPage.tsx` |
| 6.4 | 广场 API 对接 | `src/api/index.ts` 扩展 |
| 6.5 | 项目选择器新增入口 | `App.tsx`（广场/快速开局按钮） |
| 7.1 | 导出并试玩按钮 | `MainLayout.tsx` + `App.tsx` |
| 7.2 | 试玩流程：导出 JSON → 创建房间 → 跳转游戏 | `export.ts` 扩展 + `App.tsx` |
| 7.3 | 剧本发布功能 | `MainLayout.tsx` + `routers/game.py` 对接 |
| 7.4 | 添加"前往游戏平台"入口 | `MainLayout.tsx` 顶部栏 |

### 验证标准

**广场**
- [ ] 剧本卡片瀑布流正确展示（标题、作者、标签、评分、封面）
- [ ] 分页加载正常（滚动加载更多）
- [ ] 按标签筛选（悬疑/时间循环/...）
- [ ] 按关键词搜索
- [ ] 按热度/时间排序
- [ ] 点击卡片 → 进入该剧本的游戏房间

**编辑器对接**
- [ ] 编辑器顶部"试玩"按钮可见
- [ ] 点击"试玩" → 自动导出 JSON → 创建房间 → 跳转游戏模式
- [ ] 编辑器顶部"发布"按钮 → 剧本发布到广场 → 广场可见
- [ ] 项目选择器新增"游戏广场"和"快速开局"入口

### 风险提示

- 试玩时导出的 JSON 需与后端 `json_load_node` 兼容
- 广场数据量增长后的分页性能（前期数据少，问题不大）

---

## Checkpoint 6：多人角色配置 + 全流程联调

**覆盖阶段**：Phase 7B + Phase 8（约 32h）

### 任务清单

| 序号 | 任务 | 涉及文件 |
|------|------|----------|
| 7B.1 | Schema 扩展：NodeData 增加 isPlayable 等 | `models/schemas.py` |
| 7B.2 | 人物卡片"可扮演角色"开关 + min/max 输入 | `CharacterPage.tsx` 扩展 |
| 7B.3 | 属性"玩家自定"勾选 + 约束条件面板 | `CharacterPage.tsx` 扩展 |
| 7B.4 | 剧本玩家数自动计算 + 顶部栏显示 | `CharacterPage.tsx` + `useProjectStore.ts` |
| 7B.5 | 发布校验：min/max 玩家数合法性 | `routers/game.py` |
| 8.1 | 编辑试玩全流程测试 | — |
| 8.2 | 广场浏览与选本游戏测试 | — |
| 8.3 | 沙盒模式 AI 生成测试 | — |
| 8.4 | JSON 导入模式测试（含格式校验/错误处理） | — |
| 8.5 | LangGraph checkpoint 暂停/恢复测试 | — |
| 8.6 | 性能测试（多房间并发、AI 响应时间） | — |
| 8.7 | UI 视觉回归（创作模式/游戏模式切换） | — |
| 8.8 | 多人轮次同步测试（含断线/超时/跳过） | — |

### 验证标准

**多人角色配置**
- [ ] 人物卡片右上角"🎭 可扮演"开关正常工作
- [ ] 开启后可设置 min/max 玩家数
- [ ] 属性列表每个属性旁有"✏️ 玩家自定"复选框
- [ ] 勾选后显示约束条件面板（总和范围、单项最值）
- [ ] 顶部栏实时显示最小/最大玩家数
- [ ] 发布剧本时校验通过/拒绝

**全流程回归**
- [ ] 单人：编辑 → 试玩（无可扮演角色） → 游戏正常
- [ ] 多人：编辑 → 发布（有可扮演角色） → 广场 → 房主创建 → 玩家加入 → 角色选择 → 填写角色卡 → 开局
- [ ] 沙盒模式：快速开局 → 输入偏好 → AI 生成 → 游戏正常
- [ ] JSON 导入：上传合法 JSON → 开局正常；上传非法 JSON → 错误提示

**多人轮次**
- [ ] 2 人房间：两人均行动 → DM 回复；一人跳过 → 等待另一人
- [ ] 超时跳过：120s 倒计时 → 未行动者自动跳过 → DM 继续
- [ ] 断线处理：玩家断线 → 自动跳过 → 不影响其他玩家
- [ ] 仅剩 1 人时等待时间缩短为 60s
- [ ] 房主延长本轮时间（+30s，最多 3 次）

**性能**
- [ ] 3+ 房间并发，AI 响应时间 < 15s
- [ ] 无内存泄漏（长时间运行后内存稳定）

### 风险提示

- 多人并发时 AI 响应过慢：DM_RESPONSE 前合并所有行动为单次 AI 调用（非逐玩家调用）
- 网络波动导致 action 丢失：Socket.IO 自带重连+重发；state 中保留 action 确认机制
- 角色卡属性约束绕过：前后端双重校验

---

## 工时汇总

| 检查点 | 覆盖阶段 | 预估工时 |
|--------|----------|----------|
| CP1 基础设施就绪 | Phase 1 | 9h |
| CP2 LangGraph 核心 | Phase 3 | 30h |
| CP3 后端完整 | Phase 2 + 4 | 26.5h |
| CP4 前端可玩 | Phase 5 | 35h |
| CP5 闭环打通 | Phase 6 + 7 | 17h |
| CP6 最终验收 | Phase 7B + 8 | 32h |
| **合计** | — | **约 149.5h** |

---

## 使用说明

1. 每个检查点开始前，确认上游检查点已通过验证
2. 检查点内各任务完成后，逐一勾选验证标准
3. 所有验证项通过后，方可进入下一个检查点
4. 如验证失败，记录问题并修复后再验证
5. 检查点通过后在此文件末尾记录通过日期和备注

---

## 检查点通过记录

| 检查点 | 通过日期 | 备注 |
|--------|----------|------|
| CP1 | 2026-06-19 | CRA→Vite 迁移完成，TailwindCSS 配置完成，后端依赖安装完成，Vite build 成功产出 1.2MB JS + 12KB CSS |
| CP2 | 2026-06-19 | LangGraph 10 个节点全部实现并独立测试通过，状态图编译成功，路由条件正确，骰子/检定/等待/结局节点均通过 mock 验证 |
| CP3 | 2026-06-19 | Socket.IO + LangGraph 联动完成，AI 服务扩展（DeepSeek Async），TTS/图片服务就绪，REST API 10 端点注册，17 项测试全通过，后端完整可通信 |
| CP4 | 2026-06-19 | 前端游戏 UI 完成：16 新文件 + 4 修改文件，暗色主题 3 栏布局，Socket.IO 客户端封装，Zustand 游戏 store，Vite 构建成功 (1.27MB JS + 30KB CSS) |
| CP5 | 2026-06-19 | Plaza 独立组件（ScriptCard/ScriptFilter）创建并重构 PlazaPage；发布按钮上线 MainLayout → App.tsx → game.py 全链路打通；编辑器对接完成 |
| CP6 | 2026-06-19 | schemas.py CharacterNodeData 强类型化完成；Plaza 组件抽取完成；CharacterSheetEditor 组件创建；Stage 8 联调测试待执行 |
