# Daily AI Tools Monitor — 执行工作流

当 CLAUDE.md 触发每日检查时，按以下步骤执行。**核心原则：不阻塞用户的开发任务，不自动安装任何东西。**

## 执行时机

在你的**第一条回复末尾**（已处理好用户的实际请求之后），如果检查有值得关注的内容，用 `---` 分隔后在末尾附加简短报告。如果 API 查询尚未完成或需要较长时间，直接回复用户，在**下一条消息中补上**报告。

## 步骤

### 0. 快速判断是否需要检查

读 `.claude/monitor/last_check.txt`：
- 日期 = 今天 → 跳过，不做任何事
- 日期 < 今天 → 继续步骤 1
- 文件不存在 → 视为首次运行，继续步骤 1

### 1. 查询 aihot API（最多 8 秒）

使用 PowerShell（Win）或 bash 调 aihot API。必须带浏览器 UA。

**关键词查询**（用 PowerShell `Invoke-WebRequest`，设置 8 秒超时）：

```powershell
$headers = @{"User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}
$since = "<ISO-8601 日期>T00:00:00Z"  # 用 last_check 的日期

# 核心查询（并行发起 2 个，覆盖主要关注范围）
$r1 = Invoke-WebRequest -Uri "https://aihot.virxact.com/api/public/items?q=Claude+Code+MCP+Skills&since=$since&take=40" -Headers $headers -TimeoutSec 8 -UseBasicParsing
$r2 = Invoke-WebRequest -Uri "https://aihot.virxact.com/api/public/items?mode=selected&category=tip&since=$since&take=30" -Headers $headers -TimeoutSec 8 -UseBasicParsing
```

如果全部请求失败（网络问题/API 不可用）→ 静默跳过，**不更新** last_check.txt。在回复中不提（避免干扰用户）。

如果至少一个成功 → 合并结果、按 `id` 去重。

### 2. 筛选相关条目

只保留标题或摘要包含以下任一关键词的条目（大小写不敏感）：
`Claude Code`, `MCP`, `Skill`, `Agent`, `Hook`, `Codex`, `Cursor`, `OpenCode`, `Windsurf`, `Cline`, `Gemini CLI`, `微信小游戏`, `Mini Game`, `Canvas`, `Anthropic`, `配置`, `settings.json`, `CLAUDE.md`, `AGENTS.md`, `Subagent`

排除明显不相关的（纯模型发布、纯商业融资、纯学术论文等）。

### 3. 快速分析（不超过 1 分钟）

对照当前项目状态：
- 项目类型：微信小游戏 Canvas 2D JS（读 CLAUDE.md 确认）
- 当前版本阶段（读 CLAUDE.md 确认）
- 已有技能列表（列 `.claude/skills/` 目录）
- 已有 MCP 工具（当前会话可见的）

判断每条：
- ✅ **可关注**：与 JS 工具链/Agent 配置/开发效率相关，且没有等价替代
- ⚠️ **观望**：相关但非当前阶段急需
- ❌ **不适合**：Python/Go/Rust 专用、Web 全栈框架、与微信小游戏平台冲突

### 4. 用户可见的输出（附加在第一条回复末尾）

```
---
🔍 **AI 工具动态 (today-date)**
- [title] — [source] → [一句话适配判断]
- [title] — [source] → [一句话适配判断]
...
*数据: aihot.virxact.com*
```

如果 0 条相关：**什么都不输出**（不在回复中加任何东西）。
如果超过 5 条：只展示最相关的 5 条，末尾加 `（还有 N 条，回复 "展开" 查看全部）`。

### 5. 更新 last_check.txt

把今天的日期（北京时间 `YYYY-MM-DD`）写入 `.claude/monitor/last_check.txt`。

## 铁律

- **绝不阻塞用户**：用户的第一条请求必须优先处理，监控报告只能作为附件
- **绝不自动安装**：再适合也只能给建议，不能动任何配置
- **静默失败**：API 不可用时直接跳过，用户不需要知道
- **零条时不输出**：没有相关内容就保持安静
- **短**：报告部分不超过 8 行
