# Learning Assistant Skill 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个 Claude Code Skill，通过 subAgent 方式学习代码、生成文档和 TDD 验证脚本，支持编码前后对比。

**Architecture:** 单一 skill 文件 + Agent 工具调用。Skill 解析用户输入，启动独立的 Explore agent 进行代码学习，生成结构化文档和验证脚本。

**Tech Stack:** Claude Code Skill (.skill.md), Agent tool, Glob/Grep/Read tools, Excalidraw

---

## Task 1: 创建 Skill 基础结构

**Files:**
- Create: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 确定 skill 存放位置**

Run: `echo $HOME` 或检查 Windows 用户目录
Expected: 用户主目录路径

**Step 2: 创建 skills 目录（如不存在）**

Run: `mkdir -p ~/.claude/skills`
Expected: 目录创建成功

**Step 3: 创建 skill 文件头部**

```markdown
---
name: learning-assistant
description: |
  辅助代码学习和变更对比工具。

  主要功能：
  - 编码前：学习现有代码，生成可读文档 + TDD 验证脚本
  - 编码后：重新学习，对比变更，验证核心测试

  使用方式：
  - /learning-assistant <目标路径> - 学习指定代码
  - /learning-assistant --compare <before.md> <after.md> - 对比变更

  触发词: learning-assistant, 学习助手, 代码学习, 学习
---

# Learning Assistant - 代码学习助手

```

**Step 4: 验证文件创建**

Run: `cat ~/.claude/skills/learning-assistant.skill.md | head -20`
Expected: 显示 skill 头部内容

---

## Task 2: 添加核心规则和使用说明

**Files:**
- Modify: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 添加核心规则部分**

```markdown

## ⚠️ 核心规则（贯穿始终，不可违背）

```
🚫 禁止修改任何代码
🚫 禁止进行任何 git 提交
🚫 禁止 git add/commit/push 任何操作
✅ 仅读取代码，生成文档
✅ 仅在 docs/learning/ 目录创建文档
```

**这些规则必须在整个学习过程中严格遵守，即使上下文压缩也不能丢弃。**

## 📖 使用说明

### 学习代码

```
/learning-assistant <目标路径或描述>
```

示例：
- `/learning-assistant src/api/user` - 学习 user 模块
- `/learning-assistant 用户登录接口` - 通过描述定位学习

### 对比变更

```
/learning-assistant --compare <before.md> <after.md>
```

示例：
- `/learning-assistant --compare docs/learning/before.md docs/learning/after.md`

```

**Step 2: 验证添加成功**

Run: `cat ~/.claude/skills/learning-assistant.skill.md | grep -A 10 "核心规则"`
Expected: 显示核心规则内容

---

## Task 3: 添加工作流程定义

**Files:**
- Modify: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 添加工作流程部分**

```markdown

## 🔄 工作流程

### 模式一：学习代码（默认）

当用户调用 `/learning-assistant <目标>` 时，执行以下流程：

**Phase 1: 解析输入**
1. 解析用户输入的目标路径或描述
2. 如果是 `--compare` 参数，跳转到对比模式

**Phase 2: 启动学习 Agent**
1. 使用 Agent 工具启动 `Explore` 类型的 subAgent
2. 传递干净的上下文：仅包含目标路径，不包含任何需求或修改点
3. 确保上下文隔离，避免学习内容有偏向性

**Phase 3: 代码学习（由 subAgent 执行）**
1. 定位入口文件/函数
2. 追踪调用链：
   - 向上：谁调用了这个接口？（数据来源）
   - 向下：这个接口调用了什么？（数据处理）
   - 横向：相关的工具函数、配置？（数据加工）
3. 仅追踪项目内代码，外部依赖作为黑盒
4. 整理数据流：输入 → 处理 → 输出

**Phase 4: 生成文档**
1. 使用输出模板生成 MD 文档
2. 检测项目语言，生成对应的验证脚本
3. 如需要，使用 excalidraw-diagram 生成流程图
4. 保存到 `docs/learning/YYYY-MM-DD-<target>.md`

### 模式二：对比变更

当用户调用 `/learning-assistant --compare <before> <after>` 时：

**Phase 1: 读取文档**
1. 读取编码前文档（before.md）
2. 读取编码后文档（after.md）

**Phase 2: 对比分析**
1. 对比关键代码文件列表变化
2. 对比数据流追踪变化
3. 对比核心功能验证点

**Phase 3: 生成对比报告**
1. 输出变更摘要（新增/修改/删除）
2. 输出详细变更说明
3. 输出核心测试验证结果
4. 保存到 `docs/learning/YYYY-MM-DD-<target>-compare.md`

```

**Step 2: 验证添加成功**

Run: `cat ~/.claude/skills/learning-assistant.skill.md | grep -A 5 "工作流程"`
Expected: 显示工作流程内容

---

## Task 4: 添加 Agent 配置和调用方式

**Files:**
- Modify: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 添加 Agent 配置部分**

```markdown

## 🤖 SubAgent 调用配置

### 学习 Agent 调用方式

使用 Agent 工具启动 Explore 类型的 subAgent：

```
Agent tool:
  subagent_type: "Explore"
  description: "学习代码 <目标路径>"
  prompt: |
    你是一个代码学习 Agent。你的任务是纯阅读代码，生成学习文档。

    ⚠️ 严格规则：
    - 禁止修改任何代码
    - 禁止执行任何 git 操作
    - 只能使用 Read、Glob、Grep 工具读取代码

    学习目标：<目标路径>

    请完成以下任务：
    1. 定位入口文件/函数
    2. 追踪数据流：来源 → 处理 → 加工 → 返回
    3. 识别关键代码文件和函数
    4. 生成结构化的学习报告

    输出格式要求：
    - 概述部分
    - 数据流追踪部分（按来源/处理/加工/返回组织）
    - 关键文件表格
    - 至少2个核心验证点（Given/When/Then格式）

    thoroughness level: very thorough
```

### 上下文隔离要求

- SubAgent 不接收当前对话的需求、修改点等上下文
- 仅接收目标路径/描述
- 使用 `isolation: "worktree"` 或确保 agent 是全新启动

```

**Step 2: 验证添加成功**

Run: `cat ~/.claude/skills/learning-assistant.skill.md | grep -A 3 "SubAgent"`
Expected: 显示 SubAgent 配置内容

---

## Task 5: 添加输出模板

**Files:**
- Modify: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 添加学习文档模板**

```markdown

## 📄 输出模板

### 学习文档模板

保存路径: `docs/learning/YYYY-MM-DD-<target-name>.md`

```markdown
# 学习报告: <目标名称>

> 生成时间: YYYY-MM-DD HH:mm
> 目标路径: <路径>
> 学习模式: 编码前/编码后

---

## 1. 概述

### 功能描述
<一句话描述该模块/接口的核心功能>

### 入口文件/函数
- 文件: `<文件路径>`
- 函数/类: `<函数名或类名>`
- 位置: `<文件路径>:<行号>`

### 核心职责
- <职责1>
- <职责2>
- ...

---

## 2. 数据流追踪

### 2.1 数据来源
- **调用方**: <谁调用了这个接口>
- **输入参数**: <参数结构>
- **数据来源**: <数据从哪里来>

### 2.2 数据处理
- **主要逻辑**: <核心处理步骤>
- **调用链**:
  1. `<函数1>` → `<函数2>` → `<函数3>`

### 2.3 数据加工
- **格式转换**: <数据格式如何转换>
- **业务规则**: <应用了哪些业务规则>

### 2.4 结果返回
- **返回值结构**: <返回值格式>
- **输出格式**: <JSON/Object/etc>

---

## 3. 关键代码文件

| 文件路径 | 职责 | 关键函数 |
|---------|------|---------|
| `<路径1>` | <职责> | `<函数名>` |
| `<路径2>` | <职责> | `<函数名>` |

---

## 4. 流程图

<使用 excalidraw-diagram 生成的流程图，或占位符>

---

## 5. 核心功能验证 (TDD)

### 验证点 1: <验证名称>
- **Given**: <前置条件>
- **When**: <操作/输入>
- **Then**: <期望结果>

### 验证点 2: <验证名称>
- **Given**: <前置条件>
- **When**: <操作/输入>
- **Then**: <期望结果>

---

## 6. 验证脚本

<根据项目语言自动生成的测试代码>

### 语言检测

| 检测文件 | 语言 | 测试格式 |
|---------|------|---------|
| package.json | JavaScript/TypeScript | *.test.js / *.spec.ts |
| requirements.txt | Python | test_*.py |
| go.mod | Go | *_test.go |
| pom.xml / build.gradle | Java | *Test.java |
| 无匹配 | 其他 | Markdown 验证清单 |

```
```

**Step 2: 添加对比报告模板**

```markdown

### 对比报告模板

保存路径: `docs/learning/YYYY-MM-DD-<target-name>-compare.md`

```markdown
# 对比报告: <目标名称>

> 对比时间: YYYY-MM-DD HH:mm
> 编码前文档: <before.md>
> 编码后文档: <after.md>

---

## 1. 变更摘要

| 类型 | 数量 |
|-----|------|
| 新增文件 | X 个 |
| 修改文件 | Y 个 |
| 删除文件 | Z 个 |

---

## 2. 详细变更

### 2.1 新增功能
- <新增内容1>
- <新增内容2>

### 2.2 修改逻辑

#### <修改项1>
- **原逻辑**: <编码前的实现>
- **新逻辑**: <编码后的实现>
- **影响**: <这个修改的影响范围>

#### <修改项2>
- **原逻辑**: ...
- **新逻辑**: ...
- **影响**: ...

### 2.3 删除功能
- <删除内容1>
- <删除内容2>

---

## 3. 数据流变化

### 变化前
<编码前的数据流描述>

### 变化后
<编码后的数据流描述>

### 变化影响
<数据流变化对系统的影响>

---

## 4. 核心测试验证

| 验证点 | 状态 | 说明 |
|-------|------|------|
| 验证点 1 | ✅/❌ | <结果说明> |
| 验证点 2 | ✅/❌ | <结果说明> |

### 验证脚本执行结果

<执行验证脚本后的输出>

---

## 5. 建议

- <建议1>
- <建议2>
```
```

**Step 3: 验证添加成功**

Run: `cat ~/.claude/skills/learning-assistant.skill.md | grep -A 3 "输出模板"`
Expected: 显示输出模板内容

---

## Task 6: 添加执行检查清单

**Files:**
- Modify: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 添加执行检查清单**

```markdown

## ✅ 执行检查清单

在执行学习任务前，确认以下事项：

### 学习前检查
- [ ] 确认目标路径/描述已正确解析
- [ ] 确认 docs/learning/ 目录存在
- [ ] 确认不会修改任何代码文件
- [ ] 确认不会执行任何 git 操作

### 学习中检查
- [ ] SubAgent 仅使用 Read/Glob/Grep 工具
- [ ] SubAgent 没有使用 Edit/Write 工具（除非写入 docs/learning/）
- [ ] SubAgent 没有执行 Bash git 命令
- [ ] 学习内容客观，无偏向性

### 学习后检查
- [ ] 文档已保存到 docs/learning/ 目录
- [ ] 文档格式符合模板要求
- [ ] 包含至少 2 个核心验证点
- [ ] 验证脚本已根据项目语言生成

### 对比检查
- [ ] 两个文档都已成功读取
- [ ] 对比报告格式正确
- [ ] 变更摘要数据准确
- [ ] 核心测试验证已执行

```

**Step 2: 验证添加成功**

Run: `cat ~/.claude/skills/learning-assistant.skill.md | grep -A 3 "执行检查清单"`
Expected: 显示检查清单内容

---

## Task 7: 添加示例和注意事项

**Files:**
- Modify: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 添加使用示例**

```markdown

## 📝 使用示例

### 示例 1: 学习 API 接口

```
用户: /learning-assistant src/api/user

执行流程:
1. 解析目标: src/api/user
2. 启动 Explore agent
3. Agent 学习 user 相关代码
4. 生成文档: docs/learning/2026-03-05-user.md
5. 输出: "学习完成，文档已保存到 docs/learning/2026-03-05-user.md"
```

### 示例 2: 编码前后对比

```
用户: /learning-assistant --compare docs/learning/2026-03-05-user-before.md docs/learning/2026-03-05-user-after.md

执行流程:
1. 读取编码前文档
2. 读取编码后文档
3. 对比分析变更
4. 生成对比报告: docs/learning/2026-03-05-user-compare.md
5. 输出: "对比完成，报告已保存到 docs/learning/2026-03-05-user-compare.md"
```

## ⚡ 注意事项

1. **严格只读**: 学习过程中绝对不能修改代码，这是核心规则
2. **上下文干净**: SubAgent 不应该知道用户的意图或需求，只做客观学习
3. **追踪深度**: 仅追踪项目内代码，node_modules/vendor 等作为黑盒
4. **流程图优先**: 如需可视化，优先使用 excalidraw-diagram skill
5. **验证脚本**: 必须生成至少 2 个核心验证点
6. **文档命名**: 使用日期前缀，便于排序和查找

```

**Step 2: 验证添加成功**

Run: `cat ~/.claude/skills/learning-assistant.skill.md | grep -A 3 "使用示例"`
Expected: 显示使用示例内容

---

## Task 8: 最终验证和测试

**Files:**
- Modify: `~/.claude/skills/learning-assistant.skill.md`

**Step 1: 验证 skill 文件完整性**

Run: `wc -l ~/.claude/skills/learning-assistant.skill.md`
Expected: 文件行数 > 200

**Step 2: 验证关键部分存在**

Run: `grep -E "核心规则|工作流程|SubAgent|输出模板|检查清单" ~/.claude/skills/learning-assistant.skill.md | wc -l`
Expected: 匹配行数 >= 5

**Step 3: 验证 skill 语法**

检查 skill 文件：
- [ ] YAML front matter 正确（name, description 字段）
- [ ] Markdown 格式正确
- [ ] 代码块正确闭合

**Step 4: 记录完成**

确认以下内容已完成：
- [ ] Skill 文件创建成功
- [ ] 核心规则已添加
- [ ] 工作流程已定义
- [ ] Agent 配置已完成
- [ ] 输出模板已添加
- [ ] 检查清单已添加
- [ ] 使用示例已添加

---

## 完成标志

实现完成后，用户应该能够：

1. 使用 `/learning-assistant <目标>` 学习代码
2. 获得结构化的学习文档
3. 获得至少 2 个 TDD 验证点
4. 使用 `/learning-assistant --compare` 对比变更

---

**实现计划完成！**
