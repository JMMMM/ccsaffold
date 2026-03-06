# Session History - 会话历史记录功能

> 版本: 1.0.0
> 创建时间: 2026-03-06

## 概述

Session History 是一个 Claude Code 插件功能，用于自动记录和管理会话历史。它可以帮助你：

- **快速恢复上下文**：加载最近几次会话的总结
- **搜索历史修改**：通过关键词查找相关的历史会话
- **自动记录**：每次会话结束时自动生成总结

## 安装

### 方式一：用户级别生效（推荐）

将以下配置添加到 `~/.claude/settings.json`：

```json
{
  "skills": [
    "${CLAUDE_PLUGIN_ROOT}/skills/session-history"
  ],
  "hooks": {
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js ${SESSION_ID} &"
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

### 方式二：项目级别生效

将配置添加到项目的 `.claude/settings.json`。

## 命令

### /load [count]

加载最近 count 次会话总结（默认 5 次）。

**用法示例：**
```
/load           # 加载最近 5 次会话
/load 10        # 加载最近 10 次会话
/load 3 --headers-only  # 仅加载表头（快速预览）
```

### /search <keyword>

搜索会话历史，返回最匹配的结果。

**用法示例：**
```
/search hook            # 搜索包含 "hook" 的会话
/search 修复bug --top 10  # 搜索并返回前 10 个结果
```

### /summarize

手动生成或更新当前会话的总结。

**用法示例：**
```
/summarize      # 生成当前会话总结
```

## 文件结构

```
项目目录/
├── .session-history/           # 会话历史存储目录
│   ├── pending.json            # 待处理队列
│   └── {session_id}.md         # 会话总结文件
```

## 总结文件格式

每个会话总结文件包含 YAML 表头和内容：

```markdown
---
session_id: abc123-def456
date: 2026-03-06T14:30:00Z
project: myproject
summary: "一句话摘要"
keywords: [关键词1, 关键词2]
user_questions:
  - "用户问题1"
  - "用户问题2"
modified_files:
  - path: /path/to/file1.js
    action: edit
  - path: /path/to/file2.js
    action: write
completion_status: completed
---

## 用户提问
用户问题详细内容...

## LLM 回答
LLM 回答详细内容...
```

## 自动化

### SessionEnd Hook

会话结束时自动：
1. 后台异步生成会话总结
2. 提取用户问题和 LLM 回答
3. 记录修改的文件列表

### SessionStart Hook

会话开始时自动：
1. 检查待处理队列
2. 补充处理失败的会话总结

## 提取规则

### 保留的内容

| 类型 | 来源 | 说明 |
|------|------|------|
| 用户提问 | `type: "user"` | 过滤短选项（如 A/B/C）和命令 |
| LLM 回答 | `type: "text"` | 实际文本输出 |
| 修改文件 | `Edit/Write` 工具 | 仅记录文件路径和操作类型 |

### 过滤的内容

- `tool_use` / `tool_result` - 工具调用过程
- `thinking` - 思考过程
- `progress` - 系统进度
- `isMeta: true` - 元消息
- Skill 文档加载内容

## 配置选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| 默认加载数量 | 5 | `/load` 不带参数时的数量 |
| 搜索返回数量 | 5 | `/search` 默认返回数量 |
| 最小问题长度 | 10字符 | 过滤短于该长度的用户输入 |

## 注意事项

1. **存储位置**：总结文件存储在项目目录的 `.session-history/` 下
2. **Git 忽略**：建议将 `.session-history/*.md` 和 `pending.json` 添加到 `.gitignore`
3. **跨平台**：使用 Node.js 实现，支持 Windows/macOS/Linux
4. **异步处理**：SessionEnd 使用后台进程，不阻塞会话结束

## 故障排除

### 总结未生成

1. 检查 `pending.json` 是否有待处理项
2. 手动运行 `node scripts/session-summarize.js --process-pending`
3. 检查 jsonl 文件是否存在

### 搜索无结果

1. 确认 `.session-history/` 目录下有 `.md` 文件
2. 检查 YAML 表头是否正确格式

## 版本历史

### v1.0.0 (2026-03-06)

- 初始版本
- 支持 `/load`、`/search`、`/summarize` 命令
- 支持 SessionEnd/SessionStart Hooks
- 支持从 command-args 提取原始用户提问
