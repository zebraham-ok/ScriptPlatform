# 后续开发计划 — 与 BUMENGweb-main 及 GAME_INTEGRATION_PLAN.md 差距分析

> 分析日期：2026-06-20
> 分析范围：对比 BUMENGweb-main 参考项目、GAME_INTEGRATION_PLAN.md 整合方案，以及当前 backend/ + frontend/ 的实现状态。

---

## 一、已实现功能总览

当前平台已经完成了 GAME_INTEGRATION_PLAN.md 中 **绝大部分核心架构工作**，是"几乎完整"的状态：

| 模块 | 状态 |
|------|------|
| Vite 构建 + TailwindCSS 4 + Ant Design 双风格 | ✅ 完成 |
| LangGraph 10 节点状态机 (lobby → generate/json_load → opening → playing → dm_response → check → vote → wait_players → ending) | ✅ 完成 |
| Socket.IO 实时通信 (20+ 事件双向) | ✅ 完成 |
| RESTful API (`/api/game/*` 广场/房间/发布) | ✅ 完成 |
| 三种游戏模式 (沙盒/剧本/导入) | ✅ 完成 |
| 广场剧本浏览/筛选/发布 | ✅ 完成 |
| 角色选择 + 角色卡编辑 + 属性约束校验 | ✅ 完成 |
| 多玩家轮次制 + 倒计时 + 跳过/延长 | ✅ 完成 |
| DM 叙述 + 私密消息 + 快捷选项 | ✅ 完成 |
| 检定/骰子 + 投票机制 | ✅ 完成 |
| 场景图 AI 生成 + 缓存 | ✅ 完成 |
| 角色头像生成 + 缓存 | ✅ 完成 |
| TTS 语音合成 (EdgeTTS) | ✅ 完成 |
| 长期记忆 (初始化 + 每轮更新) | ✅ 完成 |
| 结局卡片 + 多结局分支 | ✅ 完成 |
| 游客模式 + 房间分享链接 | ✅ 完成 |
| 编辑器试玩 (导出 → 创建房间 → 跳转游戏) | ✅ 完成 |
| 暗色游戏主题 (`game-theme.css`) | ✅ 完成 |
| 所有 GameRoom 组件 (12个) | ✅ 完成 |
| 所有页面 (10个) | ✅ 完成 |
| 项目导入/导出 (JSON/LangGraph/Python) | ✅ 完成 |

---

## 二、尚未实现的功能（来自 BUMENGweb-main）

以下功能在 BUMENGweb-main 中存在，但当前平台尚未实现。按 **优先级** 排列：

### 🔴 Tier 1 — 沉浸体验增强（高影响力，相对低投入）

#### 1. Web Audio API BGM 音效系统

> **来源**：BUMENGweb-main `frontend/src/useSound.js`（约 400 行）

BUMENGweb-main 使用纯 Web Audio API 合成了 7 种氛围背景音乐，根据场景/回合数自动切换，无需外部音频文件：
- 大厅 BGM（低沉悠扬）
- 探索 BGM（神秘轻快）
- 和平 BGM（温暖舒缓）
- 紧张 BGM（急促不安）
- 战斗 BGM（激烈鼓点）
- 等等

还有按钮音效（点击/确认/取消/骰子/成功）。当前 frontend/ 中 **完全没有音效系统**。

**建议**：
- 将 `useSound.js` 迁移为 `frontend/src/hooks/useSound.ts`
- 在 `GamePage.tsx` 中根据 `stage` 和场景自动切换 BGM
- 用户可手动静音

**预估工时**：4 小时

---

#### 2. 打字机逐字显示效果

> **来源**：BUMENGweb-main `App.jsx` 中的 DM 消息渲染

BUMENGweb-main 的 DM 叙述使用**逐字显示 + 闪烁光标**效果，大幅提升沉浸感。当前 `ChatPanel.tsx` 直接展示完整文本。

**建议**：
- 在 `ChatPanel.tsx` 中为 `role="dm"` 的消息添加 Typewriter 组件
- 支持点击跳过直接显示全文
- 与 TTS 播报进度同步（可选）

**预估工时**：3 小时

---

#### 3. Canvas 2D 粒子背景动效

> **来源**：BUMENGweb-main `App.jsx` 中 Canvas 粒子系统

BUMENGweb-main 标题画面有**30 个粒子 + 连线**的动态 Canvas 背景，增加科技感与氛围。当前平台无此效果。

**建议**：
- 创建 `frontend/src/components/Effects/ParticleBackground.tsx`
- 在 PlazaPage 和 LobbyPage 中使用（游戏页面有场景图，不需要）

**预估工时**：3 小时

---

#### 4. 玩家活跃度监控 + DM 自动干预

> **来源**：BUMENGweb-main `game_flow.py` 中的 `_monitor_activity()` 和 `_handle_inactivity()`

BUMENGweb-main 有后台任务监控玩家活跃度：如果 **5 分钟无玩家行动**，DM 会自动进行环境描写或私聊引导玩家，避免冷场。当前平台无此机制。

**建议**：
- 在 `game_server.py` 中添加 `_activity_monitor` 后台协程
- 5 分钟无消息 → 触发 DM 自动叙述（环境描写 / 私聊催促）
- 在 `player_action` 时重置计时器

**预估工时**：4 小时

---

#### 5. TTS 情绪自动推断

> **来源**：BUMENGweb-main `engine.py` 中的 `clean_tts_text()` 和情绪标记逻辑

BUMENGweb-main 根据 DM 文本内容自动推断 TTS 播报情绪（cheerful / sad / angry / whispering / calm），使用 SSML 情绪标记。当前 `tts_service.py` 仅支持固定的 voice 参数。

**建议**：
- 在 `tts_service.py` 中添加 `infer_tts_emotion(text)` 函数
- 基于关键词匹配（感叹号→激昂、省略号→低沉、问号→神秘...）
- 前端可选开启/关闭 TTS

**预估工时**：2 小时

---

### 🟡 Tier 2 — 核心功能补完（中等投入）

#### 6. 道具图片 AI 生成

> **来源**：BUMENGweb-main `engine.py` 中的 `add_inventory_item()`

BUMENGweb-main 在玩家获得道具时会异步生成道具图片（使用通义千问文生图），与场景图类似。当前平台只有场景图生成，道具获得后仅有文字通知。

**建议**：
- 在 `image_service.py` 中新增 `generate_item_image()` 函数
- 在 `game_server.py` 的 `character_update` 事件检测到新道具时触发生成
- 道具图缓存 key：`{item_name}_{scenario}`

**预估工时**：3 小时

---

#### 7. 自我介绍环节

> **来源**：BUMENGweb-main 中的 `self_intro` 系统

BUMENGweb-main 在游戏开始后有一个**自我介绍阶段**：每个玩家轮流介绍自己的角色（公开身份、背景故事）。当前平台跳过了此环节，直接进入游戏。

**建议**：
- 在 `GameState` 中新增 `intro_phase` 和 `intro_remaining` 字段
- 在 ROLE_SELECT → PLAYING 过渡后，插入 INTRO 阶段
- 前端显示"轮到 XXX 自我介绍"的提示

**预估工时**：4 小时

---

#### 8. 结局卡片导出为图片

> **来源**：BUMENGweb-main 使用 `html2canvas` 导出结局卡片

BUMENGweb-main 允许玩家将结局卡片导出为 PNG 图片分享。当前 `EndingCard.tsx` 仅显示卡片，无导出功能。`package.json` 中虽然有 `html2canvas` 依赖，但未在前端代码中使用。

**建议**：
- 在 `EndingCard.tsx` 中添加"导出图片"按钮
- 使用 `html2canvas` 截图卡片 DOM 并触发下载

**预估工时**：2 小时

---

#### 9. 断线重连与房主自动转移

> **来源**：BUMENGweb-main `web_server.py` 中的重连缓冲

BUMENGweb-main 的 Socket.IO 断开后保留 **30 秒宽限期**，玩家刷新页面可通过 `reconnect_room` 事件恢复状态。此外房主断线后自动将房主身份转移给下一个在线玩家。当前平台直接从 `players` 中移除断线玩家，无重连机制。

**建议**：
- `disconnect` 事件中增加 30 秒宽限期，而非立即移除玩家
- 添加 `reconnect_room` Socket.IO 事件
- 房主断线时自动选择在线时间最长的玩家为新房主
- 全部玩家断线后保留房间一段时间后再清理

**预估工时**：4 小时

---

#### 10. LangGraph Checkpoint 暂停/恢复

> **来源**：GAME_INTEGRATION_PLAN.md 第 6.1 节

LangGraph 内置的 `MemorySaver` Checkpoint 机制支持游戏暂停/恢复。当前平台使用全新的 `thread_id` 每次调用（避免 checkpoint 混乱），实际上**未利用** checkpoint 功能。GAME_INTEGRATION_PLAN.md 将此列为 LangGraph 的核心优势之一。

**建议**：
- 设计 checkpoint 持久化方案（存为 JSON 文件或 Redis）
- 支持 `pause_game` / `resume_game` Socket.IO 事件
- 玩家全部离开后，将 checkpoint 保存，下次可恢复游戏

**预估工时**：5 小时

---

### 🟢 Tier 3 — 高级功能（较大投入）

#### 11. 文学语义搜索集成

> **来源**：BUMENGweb-main `literature_search.py`（约 300 行）+ `storage/` 中的 embeddings

BUMENGweb-main 包含一个**文学参考搜索引擎**：
- **905 部文学作品**的语义索引（`storage/literature_mentor.json` + `literature_embeddings.pkl`）
- **220 个角色高光时刻**的索引（`storage/highpoints.json` + `highpoint_embeddings.pkl`）
- 使用 Qwen Embedding (`text-embedding-v3`) + scikit-learn BallTree 进行快速语义检索
- 在游戏初始化时自动检索相似作品，将文学参考注入 AI Prompt，提升剧本质量

当前 `context_builder.py` 中**没有**集成文学搜索。

**建议**：
- 将 `literature_search.py` 和 `storage/` 文件迁移到 backend
- 在 `json_load_node` 和 `generate_node` 中注入文学参考
- 可选：在 AI 辅助创作面板中也提供文学参考

**预估工时**：5 小时

---

#### 12. 深度剧情推演增强

> **来源**：BUMENGweb-main `plot_management.py` 中的 `_generate_deep_plot_inspection()`

BUMENGweb-main 的 `_generate_deep_plot_inspection()` 调用 DeepSeek 生成导演手册，包含：
- 主线逻辑推导
- 多结局路径规划
- 回合节奏控制建议
- 玩家高光时刻设计

当前 `script_loader.py` 从 JSON 中提取 `plot_inspection`，但**不进行 AI 深度推演增强**。

**建议**：
- 在 `json_load_node` 中增加可选的 AI 深度推演（对广场剧本/编辑器剧本进行二次分析）
- 可作为"高级开局"选项

**预估工时**：4 小时

---

#### 13. 数据存储升级（文件系统 → 数据库）

> **来源**：GAME_INTEGRATION_PLAN.md 第 13 节（后续扩展方向）

当前所有数据存储在文件系统 JSON 中。对于以下功能，文件系统不够：
- 剧本评分/评论系统
- 用户收藏功能
- 游玩历史记录
- 作者主页

**建议**：
- 引入 SQLite（轻量级）+ SQLAlchemy
- 迁移 `projects/` → 数据库，保留文件系统作为备份
- 新增 `ratings`、`comments`、`favorites`、`play_history` 表
- 配置文件系统 + DB 双写过渡期

**预估工时**：12 小时

---

### 🔵 Tier 4 — 编辑器增强

#### 14. 人物页面"可扮演角色"UI 开关

> **来源**：GAME_INTEGRATION_PLAN.md 第 5.4 节（Phase 7-B）

GAME_INTEGRATION_PLAN.md 规划了编辑器人物页面的多人扮演配置 UI：

| 功能 | 状态 |
|------|------|
| 人物卡片"可扮演"开关 (PlayCircle 图标) | ✅ CustomCharacterNode 已有显示 |
| min/max 玩家数输入框 | ❓ 需确认 DetailPanel 中是否有对应表单 |
| 属性"玩家自定"勾选 | ❓ 需确认 |
| 约束条件面板 | ❓ 需确认 |
| 剧本玩家数自动计算 | ❓ 需确认 |
| "仅显示可扮演角色"筛选 | ❓ 需确认 |

GAME_INTEGRATION_PLAN.md 中 Phase 7-B 包含 5 个子任务，预估 10 小时。当前 `types/index.ts` 中已有 `isPlayable`、`minPlayers`、`maxPlayers` 等类型定义，但需确认前端编辑 UI 是否完整实现。

**建议**：
- 审查 `DetailPanel.tsx` 中人物编辑面板的实际字段
- 补充缺失的表单控件
- 在人物列表页实现"仅显示可扮演"筛选

**预估工时**：6 小时

---

### 🔵 Tier 5 — 测试与优化

#### 15. 全流程端到端测试

> **来源**：GAME_INTEGRATION_PLAN.md 第 8 节

| 测试项 | 状态 | 预估工时 |
|--------|------|----------|
| 编辑试玩全流程（创作→导出→创建房间→选角→游戏→结局） | ❌ 未测试 | 3h |
| 广场浏览与选本游戏 | ❌ 未测试 | 2h |
| 沙盒模式 AI 生成 | ❌ 未测试 | 3h |
| JSON 导入模式（含错误格式处理） | ❌ 未测试 | 2h |
| 多人轮次同步（含断线/超时/跳过） | ❌ 未测试 | 5h |
| 多房间并发（3+ 房间同时运行） | ❌ 未测试 | 3h |
| UI 视觉回归（创作/游戏模式切换） | ❌ 未测试 | 2h |
| 移动端响应式适配 | ❌ 未测试 | 3h |

**预估总工时**：23 小时

---

## 三、汇总对比表

### 3.1 GAME_INTEGRATION_PLAN.md 阶段完成度

| 阶段 | 内容 | 完成度 | 遗漏项 |
|------|------|--------|--------|
| 阶段一 | 基础设施迁移 | 100% ✅ | — |
| 阶段二 | 游戏广场 API | 100% ✅ | — |
| 阶段三 | LangGraph 状态机 | 95% ⚠️ | Checkpoint 暂停/恢复未实现 |
| 阶段四 | Socket.IO 游戏服务器 | 95% ⚠️ | 房主断线自动转移、重连缓冲 |
| 阶段五 | 前端游戏模式 | 90% ⚠️ | 打字机效果、粒子背景、BGM、自我介络、html2canvas 导出 |
| 阶段六 | 前端广场 | 100% ✅ | — |
| 阶段七 | 编辑器对接 | 95% ⚠️ | 人物页面 UI 细节待确认 |
| 阶段七-B | 编辑器多人角色配置 | 80% ⚠️ | 需审查 DetailPanel 字段完整性 |
| 阶段八 | 联调与测试 | 0% ❌ | 全部未测试 |

### 3.2 BUMENGweb-main 功能覆盖度

| 功能 | 当前状态 |
|------|----------|
| 多人房间系统 | ✅ 完整 |
| AI 剧本生成 | ✅ 完整 |
| 回合制推进 + DM 叙述 | ✅ 完整 |
| 角色卡系统 | ✅ 完整 |
| 场景图 AI 生成 | ✅ 完整 |
| DM 语音播报 (TTS) | ✅ 基本完整（缺情绪推断） |
| 骰子判定 + 投票 | ✅ 完整 |
| 公屏 + 私密消息 | ✅ 完整 |
| 端午特辑剧本模式 | ✅ 演化为通用 script 模式 |
| 长期记忆 | ✅ 完整（初始化+更新） |
| 文学参考检索 | ❌ 缺失 |
| 活跃度监控 | ❌ 缺失 |
| Web Audio BGM | ❌ 缺失 |
| 打字机逐字效果 | ❌ 缺失 |
| Canvas 粒子背景 | ❌ 缺失 |
| 道具图生成 | ❌ 缺失 |
| 自我介绍环节 | ❌ 缺失 |
| 结局卡片导出 | ❌ 缺失 |
| 断线重连 30s 宽限 | ❌ 缺失 |
| 房主自动转移 | ❌ 缺失 |
| 头像水印 (PIL) | ❌ 缺失（非必要） |
| Discord 模式 | ❌ 缺失（非必要） |

---

## 四、推荐行动路线

### 第一优先级：沉浸体验（约 16 小时）

这些功能**直接影响产品质量感知**，且实现难度较低：

| 序号 | 任务 | 预估 | 理由 |
|------|------|------|------|
| 1 | Web Audio BGM 系统 | 4h | 无音频的游戏体验严重不足 |
| 2 | 打字机逐字显示 | 3h | DM 叙述的核心沉浸元素 |
| 3 | 活跃度监控 + DM 自动干预 | 4h | 防止玩家冷场/弃游 |
| 4 | TTS 情绪自动推断 | 2h | 小幅改动，体验大幅提升 |
| 5 | 道具图片生成 | 3h | 补全视觉完整性 |

### 第二优先级：系统健壮性（约 10 小时）

| 序号 | 任务 | 预估 | 理由 |
|------|------|------|------|
| 6 | 断线重连 (30s 宽限 + 房主转移) | 4h | 多人在线体验的基本保障 |
| 7 | html2canvas 结局卡片导出 | 2h | 社交分享需求 |
| 8 | 自我介绍环节 | 4h | 角色扮演游戏的重要仪式感 |

### 第三优先级：编辑器 + 联调（约 35 小时）

| 序号 | 任务 | 预估 | 理由 |
|------|------|------|------|
| 9 | 人物页面"可扮演"UI 细节完善 | 6h | Phase 7-B 的收尾工作 |
| 10 | 全流程端到端测试 | 23h | 发布前的质量保障 |
| 11 | 文学语义搜索集成 | 5h | 提升 AI 剧本质量 |
| 12 | LangGraph Checkpoint 暂停/恢复 | 5h | 架构完整性 |

### 远期：平台生态（约 20+ 小时）

| 序号 | 任务 | 预估 | 理由 |
|------|------|------|------|
| 13 | 数据库迁移 (JSON → SQLite) | 12h | 支撑评分/评论/收藏 |
| 14 | 深度剧情推演增强 | 4h | 剧本模式质量提升 |
| 15 | Canvas 粒子动效 | 3h | 锦上添花 |
| 16 | 剧本评分/评论/收藏系统 | 8h+ | 社区生态 |

---

## 五、风险提示

| 风险 | 说明 | 应对 |
|------|------|------|
| 后端改动影响现有游戏流程 | BGM、道具图等功能在 game_server.py 中插入新逻辑 | 保持 `_process_graph_results` 函数的内聚性，新增逻辑以独立函数注入 |
| Web Audio API 浏览器兼容性 | Safari/iOS 对 Web Audio 限制较多 | 做降级处理：不支持则静默跳过 |
| BGM 与 TTS 冲突 | 同时播放可能互相干扰 | BGM 在 TTS 播放时自动降低音量 (ducking) |
| 断线重连的状态一致性 | 重连后需恢复角色绑定、属性、道具 | 通过昵称匹配识别同一玩家，从 state 中恢复 |
| 活跃度监控的资源占用 | 每个房间一个后台协程 | 使用 asyncio.create_task，房间销毁时自动取消 | 

---

## 六、预估总工时汇总

| 优先级 | 任务数 | 预估工时 |
|--------|--------|----------|
| 第一优先级（沉浸体验） | 5 | 16h |
| 第二优先级（系统健壮性） | 3 | 10h |
| 第三优先级（编辑器+联调） | 4 | 39h |
| 远期（平台生态） | 4 | 27h+ |
| **总计** | **16** | **约 92 小时** |

---

*该计划基于 2026-06-20 代码库状态编制。建议每完成一个优先级的任务后重新评估剩余工时。*
