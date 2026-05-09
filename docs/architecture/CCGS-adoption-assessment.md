# CCGS 框架采纳评估 — 因果律消除项目

## 评估日期
2026-05-09

## 项目现状

| 维度 | 状态 |
|------|------|
| 开发模式 | Solo（单人） |
| 平台 | 微信小游戏 (纯 JS, Canvas 2D, 无引擎) |
| 已完成版本 | v0.0.1 — v0.0.9 (10 个可工作版本) |
| 当前阶段 | v0.1.0 发布准备 / v0.1.0-v0.2.0 架构规划 |
| 已具备的 CCGS 等价物 | ADR(5), Epic(4), Sprint 追踪, Smoke 测试, Release checklist, lean review mode |
| 开发风格 | 轻量流程：先写代码、后补文档、单智能体开发 |

## CCGS 框架结构

- **49 个 Agent**：3 个总监 + 8 个部门主管 + 38 个专家（含 Godot/Unity/Unreal 引擎专属）
- **72 个 Skill**：覆盖 Concept → Systems Design → Technical Setup → Pre-Production → Production → Polish → Release 七个阶段
- **12 个 Hook**：提交验证、资源规范检查、会话状态持久化等
- **11 个 Path-Scoped Rule**：按文件路径自动触发编码规范
- **39 个模板**：GDD/UX/Art Bible/Sprint Plan 等文档模板
- **3 种审查模式**：full / lean / solo

## 采纳分析

### ✅ 值得采纳的（低投入、高产出）

#### 1. Path-Scoped Rules（路径范围规则）
**投入**：复制 3-4 个规则文件到 `.claude/rules/`，无需修改代码
**产出**：每次编辑匹配文件时自动检查编码规范，预防硬编码、本地化遗漏、状态管理违规

具体规则：
- `ui-code.md` → `src/ui/**`：UI 不能直接修改 game state，必须通过命令/事件
- `gameplay-code.md` → `src/core/**`：核心数值必须来自外部配置，禁止硬编码
- `design-docs.md` → `design/**`：GDD 必须包含 8 个必要章节
- `test-standards.md` → `tests/**`：测试命名和覆盖要求

**建议**：直接复用，项目已经遵守了其中大部分规范（数据驱动、事件系统、Widget 命令模式）

#### 2. Commit 验证 Hook
**投入**：复制 `validate-commit.sh`，调整检查规则
**产出**：每次 git commit 自动检查硬编码值、TODO 格式、JSON 合法性

**建议**：安装，对微信小游戏的 levels.json / themes.json / strings.json 尤其有用

#### 3. Gate-Check（阶段门禁）
**投入**：在关键版本节点运行一次（当前：v0.1.0 发布前）
**产出**：自动检查必要的工件是否存在，产出 PASS/CONCERNS/FAIL 判定

**本项目的适用阶段边界**：
- v0.1.0 发布前 → 使用自定义 light gate（检查 ADR、Epic、Smoke test、Release checklist）
- v0.1.9 新机制完成 → 检查新机制 GDD、测试覆盖、关卡验证
- v0.1.16 社交完成 → 检查集成测试、边界条件处理
- v0.2.12 最终发布 → 检查全量验证、性能达标、审核自检

**建议**：不在每个子版本运行，只在 Epic 边界运行

#### 4. Design-System → CausalEngine GDD
**投入**：1-2 小时走一次完整的设计系统流程
**产出**：CausalEngine 的正式 GDD，包含玩家幻想、详细规则、公式、边界条件、依赖关系、调优参数、验收标准

**为什么值得**：CausalEngine 是整个游戏的核心（因果匹配 + 悖论 + 跨层回溯），目前只有代码中的注释隐含规则，没有正式的玩法文档。后续任何引擎改动都缺少设计参照。

**建议**：为核心系统（CausalEngine, BoardGenerator）各写一份 GDD

#### 5. Create-Stories → 从 Epic 拆 Story
**投入**：对 Epic-1（新机制）运行一次 create-stories
**产出**：9 个子版本对应的 Story 文件，每个 Story 嵌入 GDD 需求追踪 ID、ADR 指南、验收标准

**为什么值得**：28 个子版本的规划已经完成，但 Codex CLI 需要更结构化的 Story 文件（含 TR-ID、ADR 引用、测试证据路径）来逐一实现

**建议**：为 Epic-1 拆 3-5 个 Story，走一次 /dev-story → /code-review → /story-done 闭环，判断是否值得推广到其他 Epic

### ⚠️ 可以采纳但需裁剪的

#### 6. Agent 层次
**现状**：49 个 Agent 中，38 个是引擎专属（Godot/Unity/Unreal）或不需要的专家角色
**裁剪方案**：保留 6-8 个 Agent 用于特定场景

| 保留的 Agent | 用途 | 时机 |
|-------------|------|------|
| `producer` | Sprint 规划、里程碑追踪、风险管理 | Epic 边界 |
| `game-designer` | GDD 审查、机制一致性检查 | 新机制设计 |
| `gameplay-programmer` | 引擎代码审查、性能分析 | 引擎改动后 |
| `ui-programmer` | UI 代码审查、屏幕适配检查 | UI 改动后 |
| `qa-tester` | Bug 报告、测试计划、冒烟测试 | 集成测试阶段 |
| `ux-designer` | HUD/Toolbar/ResultPanel 交互审查 | UI 改动后 |

**不建议保留的**：所有引擎专属 Agent、团队协作 Agent、美术/音频/叙事 Agent

#### 7. Solo Review Mode
**现状**：项目已配置 `lean` 模式
**建议**：切换到 `solo` 模式——零导演开销，只保留工件存在性检查。适合单人快速迭代。

### ❌ 不值得采纳的

| 组件 | 理由 |
|------|------|
| 完整 7 阶段流水线 | 项目已过 Concept/Setup 阶段，处于 Production/Polish |
| 美术总监 / 画册模板 | 游戏用程序化几何图标 + JSON 配色，无手绘资源 |
| UX 规格模板 | 3-4 个核心屏幕，已在代码中迭代成熟 |
| Team 协作技能 | Solo 开发，不需要多智能体并行 |
| 引擎专属 Agent | 无 Godot/Unity/Unreal，WeChat Mini Game 不在覆盖范围 |
| 完整的 GDD 系统（所有系统各一份） | 只有 CausalEngine 和 BoardGenerator 足够复杂值得正式 GDD |
| 6 个 Phase Gate 全部运行 | 只需在关键发布节点运行 light gate |

## 建议执行计划（按优先级）

### 立即执行（今天，2-3 小时）

1. **安装 Path-Scoped Rules**（30 分钟）
   - 从 CCGS 复制 `ui-code.md`、`gameplay-code.md`、`test-standards.md` 到 `.claude/rules/`
   - 调整路径 glob 匹配当前项目结构
   - 移除不适用的规范条目（如 gamepad 输入支持）

2. **运行一次 Gate-Check**（15 分钟）
   - 在 v0.1.0 发布前 boundary 运行
   - 检查当前工件是否齐全
   - 识别遗漏

3. **为 CausalEngine 写一份 GDD**（1-2 小时）
   - 使用 `design-system` 技能走完 8 个章节
   - 重点：详细规则（直接因果 + 链式因果 + 悖论 + 跨层）、边界条件、调优参数

### 短期执行（本周内）

4. **为 Epic-1 拆 Story**（1 小时）
   - 用 `create-stories` 拆 3-5 个 Story
   - 走 `/dev-story → /code-review → /story-done` 闭环一次
   - 判断是否推广

5. **切换为 solo review mode**（1 分钟）
   - 编辑 `production/review-mode.txt` → `solo`

### 可选（视体验决定）

6. **安装 Commit 验证 Hook**
7. **为 BoardGenerator 写 GDD**
8. **保留 6 个 Agent 的裁剪 Agent 集合**

## 一句话结论

**CCGS 对当前项目最有价值的是「文档规范 + 自动化检查」，不是「多角色流程」。**
采纳 Path-Scoped Rules、Gate-Check（轻量版）、Design-System（仅核心系统），
忽略 Agent 层级、完整流水线、引擎专属工具。保持当前"工具箱"用法，不切换到"框架"模式。
