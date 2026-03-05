# Learning Assistant 设计文档

> 创建时间: 2026-03-05
> 状态: 已批准

## 1. 概述

### 1.1 目标

创建一个 Claude Code Skill，辅助人类：
- **编码前**: 学习现有代码，生成可读文档 + TDD 验证脚本
- **编码后**: 重新学习，对比变更，验证核心测试

### 1.2 核心价值

1. 降低代码理解成本
2. 提供变更前后的一致性验证
3. 保证学习过程上下文干净，不受当前对话影响

## 2. 整体架构

```
learning-assistant
├── 触发方式: /learning-assistant <目标路径或描述>
├── 工作模式:
│   ├── 默认模式: 学习代码 → 生成文档 + 验证脚本
│   └── 对比模式: /learning-assistant --compare <before-doc> <after-doc>
└── 输出位置: docs/learning/YYYY-MM-DD-<target>.md
```

### 2.1 工作流程

1. 用户调用 `/learning-assistant src/api/user`
2. Skill 启动独立的 subAgent 进行代码学习
3. subAgent 追踪数据流：来源 → 处理 → 加工 → 返回
4. 生成 MD 文档 + TDD 验证脚本
5. 保存到 `docs/learning/` 目录

## 3. SubAgent 学习机制

### 3.1 核心规则（不可违背）

```
🚫 禁止修改任何代码
🚫 禁止进行任何 git 提交
✅ 仅读取代码，生成文档
```

### 3.2 SubAgent 工作流程

```
1. 接收目标: "src/api/user" 或 "用户登录接口"
2. 定位入口: 找到目标文件/函数
3. 追踪调用链:
   - 向上: 谁调用了这个接口？（数据来源）
   - 向下: 这个接口调用了什么？（数据处理）
   - 横向: 相关的工具函数、配置？（数据加工）
4. 整理数据流: 输入 → 处理 → 输出
5. 生成文档: 结构化 MD 格式
```

### 3.3 上下文隔离

- SubAgent 不接收任何需求、修改点等上下文
- 仅接收目标路径/描述
- 确保学习内容客观、无偏向性

### 3.4 追踪深度

- 仅追踪项目内代码
- 外部库/依赖作为黑盒处理

## 4. 输出文档格式

### 4.1 文档结构

保存路径: `docs/learning/YYYY-MM-DD-<target>.md`

```markdown
# 学习报告: <目标名称>

> 生成时间: YYYY-MM-DD HH:mm
> 目标路径: <路径>

## 1. 概述
- 功能描述
- 入口文件/函数
- 核心职责

## 2. 数据流追踪

### 2.1 数据来源
- 调用方
- 输入参数
- 数据来源

### 2.2 数据处理
- 主要处理逻辑
- 关键函数调用链

### 2.3 数据加工
- 格式转换
- 业务规则

### 2.4 结果返回
- 返回值结构
- 输出格式

## 3. 关键代码文件
| 文件路径 | 职责 | 关键函数 |
|---------|------|---------|
| ... | ... | ... |

## 4. 流程图
[Excalidraw 流程图]

## 5. 核心功能验证 (TDD)
### 验证点 1: <名称>
- Given: 前置条件
- When: 操作
- Then: 期望结果

### 验证点 2: <名称>
...

## 6. 验证脚本
[根据项目语言自动生成的测试代码]
```

## 5. TDD 验证脚本生成

### 5.1 自动检测项目语言

| 项目类型 | 检测标志 | 测试文件格式 |
|---------|---------|-------------|
| JavaScript/TypeScript | package.json | `*.test.js` 或 `*.spec.ts` |
| Python | requirements.txt / pyproject.toml | `test_*.py` |
| Go | go.mod | `*_test.go` |
| Java | pom.xml / build.gradle | `*Test.java` |
| 其他 | - | 验证清单 (MD) |

### 5.2 核心验证点

最少 2 项核心功能验证：
```
1. 正向路径: 正常输入 → 期望输出
2. 边界/异常: 异常输入 → 错误处理
```

### 5.3 脚本存放位置

- 测试文件: `tests/learning/` 或项目测试目录
- 或直接嵌入文档的"验证脚本"章节

## 6. 编码前后对比机制

### 6.1 使用方式

```
/learning-assistant --compare docs/learning/before.md docs/learning/after.md
```

### 6.2 对比流程

```
1. 编码前:
   /learning-assistant src/api/user
   → 生成 docs/learning/2026-03-05-user-before.md

2. 编码后:
   /learning-assistant src/api/user
   → 生成 docs/learning/2026-03-05-user-after.md

3. 对比:
   /learning-assistant --compare before.md after.md
   → 生成对比报告
```

### 6.3 对比报告格式

```markdown
# 对比报告: <目标>

## 变更摘要
- 新增文件: X 个
- 修改文件: Y 个
- 删除文件: Z 个

## 详细变更

### 新增功能
- ...

### 修改逻辑
- 原逻辑: ...
- 新逻辑: ...
- 影响: ...

### 删除功能
- ...

## 核心测试验证
- [ ] 验证点 1: 通过/失败
- [ ] 验证点 2: 通过/失败
```

## 7. Skill 文件结构

### 7.1 文件位置

`E:/ccsaffold/skills/learning-assistant.skill.md`（ccscaffold 项目内目录）

### 7.2 Skill 结构

```markdown
---
name: learning-assistant
description: |
  辅助代码学习和变更对比。
  - 编码前: 学习现有代码，生成文档 + TDD 验证
  - 编码后: 重新学习，对比变更，验证测试
  触发词: learning-assistant, 学习, 代码学习
---

# Learning Assistant

## 核心规则
🚫 禁止修改任何代码
🚫 禁止任何 git 提交
✅ 仅读取代码，生成文档

## 使用方式
1. 学习代码: /learning-assistant <目标路径>
2. 对比变更: /learning-assistant --compare <before> <after>

## 工作流程
[详细步骤...]

## SubAgent 配置
[Agent 工具调用配置...]

## 输出模板
[文档模板...]
```

## 8. 设计决策记录

| 决策 | 选择 | 理由 |
|-----|------|------|
| 工具形态 | Claude Code Skill | 可复用，通过命令调用 |
| 文档位置 | docs/learning/ | 独立目录，易于管理 |
| 验证脚本 | 自动检测语言 | 适应性强 |
| 对比方式 | 重新学习+对比文档 | 上下文干净 |
| 追踪深度 | 项目内代码 | 外部库作为黑盒 |
| 触发方式 | 手动触发 | 用户可控 |
