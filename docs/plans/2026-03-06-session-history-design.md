# Session History 设计文档

> 创建时间: 2026-03-06
> 状态: 待批准

## 1. 概述

### 1.1 目标

创建会话历史记录功能，支持：
- 自动/手动生成会话总结
- 加载最近 x 次会话总结
- 搜索历史会话（两层搜索，先表头后内容）

### 1.2 核心价值

1. 快速恢复上下文，了解近期工作
2. 搜索历史修改，避免重复工作
3. 异步处理，不阻塞会话结束

## 2. 架构设计

```
ccsaffold/
├── .session-history/              # 总结存储目录
│   ├── pending.json               # 待处理队列
│   └── {session_id}.md            # 总结文件
├── skills/
│   └── session-history/
│       └── SKILL.md               # 主技能文档
├── scripts/
│   ├── session-load.js            # 加载最近 x 次总结
│   ├── session-search.js          # 搜索表头匹配
│   └── session-summarize.js       # 从 jsonl 生成总结
└── hooks/
    └── hooks.json                 # 添加 SessionEnd/SessionStart hooks
```

## 3. 文件格式

### 3.1 总结文件 (.md)

```markdown
---
session_id: abc123-def456
date: 2026-03-06T14:30:00Z
project: ccsaffold
summary: "实现会话历史记录和搜索功能"
keywords: [session, history, search, load]
user_questions:
  - "帮我实现一个会话历史功能"
modified_files:
  - path: skills/session-history/SKILL.md
    action: write
  - path: hooks/hooks.json
    action: edit
completion_status: completed
---

## 用户提问
帮我实现一个会话历史记录和搜索功能...

## LLM 回答
我将创建 session-history 技能来实现这个功能...
（仅保留实际文本输出，不含工具调用）
```

### 3.2 待处理队列 (pending.json)

```json
{
  "pending": [
    {"session_id": "abc123", "timestamp": "2026-03-06T14:30:00Z"}
  ]
}
```

## 4. 组件设计

### 4.1 脚本设计

#### session-load.js

**功能**：加载最近 x 次总结

```javascript
// 用法: node session-load.js [count] [--headers-only]
// 输出: 匹配的总结内容或仅表头
```

**参数**：
- `count`: 加载数量，默认 5
- `--headers-only`: 仅返回 YAML 表头

#### session-search.js

**功能**：搜索表头匹配

```javascript
// 用法: node session-search.js <keyword> [--top 5]
// 输出: 最匹配的 5 个文件的 YAML 表头
```

**参数**：
- `keyword`: 搜索关键词
- `--top`: 返回数量，默认 5

#### session-summarize.js

**功能**：从 jsonl 生成总结

```javascript
// 用法:
//   node session-summarize.js <session_id>           # 处理单个会话
//   node session-summarize.js --process-pending      # 处理待处理队列
```

**提取规则**：

| 保留 | jsonl 来源 | 说明 |
|------|-----------|------|
| 用户提问 | `type: "user"` | 过滤 `isMeta`、`<command-name>` |
| LLM 回答 | `type: "text"` 在 assistant message 中 | 实际文本输出，非工具调用 |
| 修改文件 | `name: "Edit/Write"` | 仅 `file_path` + `action` |

**过滤掉**：
- `tool_use` / `tool_result` - 过程调度
- `thinking` - 思考过程
- `progress` / `hook_progress` - 系统进度
- `isMeta: true` - 元消息

### 4.2 Skill 设计

**用户命令**：

| 命令 | 描述 |
|------|------|
| `/load [count]` | 加载最近 count 次总结（默认 5） |
| `/search <keyword>` | 搜索关键词，返回 top 5 表头 |
| `/summarize` | 手动生成/更新当前会话总结 |
| `/summarize --ai` | 手动触发 AI 总结（补充摘要） |

### 4.3 Hook 设计

**hooks.json 配置**：

```json
{
  "hooks": {
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "nohup node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js ${SESSION_ID} > /dev/null 2>&1 &"
      }]
    }],
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js --process-pending"
      }]
    }]
  }
}
```

## 5. 异步处理流程

```
┌─────────────────────────────────────────────────────────┐
│ SessionEnd                                              │
│   │                                                     │
│   ├─→ nohup node session-summarize.js ${SESSION_ID} &   │
│   │     (后台异步处理)                                   │
│   │                                                     │
│   └─→ 立即返回（0秒等待）                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SessionStart                                            │
│   │                                                     │
│   └─→ node session-summarize.js --process-pending       │
│         (检查并补充处理失败的会话)                        │
└─────────────────────────────────────────────────────────┘
```

## 6. 需求确认清单

| 项目 | 选择 |
|------|------|
| 存储位置 | 项目级别 `.session-history/` |
| 文件命名 | `{session_id}.md` |
| load 命令 | 可配置，默认 5 次 |
| search 命令 | 两层搜索（先表头 top 5） |
| 触发方式 | 混合模式（Hook 异步 + 手动） |
| YAML 字段 | session_id, date, project, summary, keywords, user_questions, modified_files, completion_status |
| 跨项目搜索 | 仅当前项目 |
| 脚本语言 | Node.js |
| 异步处理 | SessionEnd 后台处理 + SessionStart 补充 |

## 7. 实现计划

1. 创建 `.session-history/` 目录和 `.gitignore`
2. 实现 `session-summarize.js` 脚本
3. 实现 `session-load.js` 脚本
4. 实现 `session-search.js` 脚本
5. 创建 `session-history` Skill
6. 配置 `hooks.json`
7. 测试完整流程
