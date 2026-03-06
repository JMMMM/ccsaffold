---
name: session-management
description: 会话记录管理，支持总结、搜索、加载和智能恢复
triggers:
  - /load
  - /search
  - /summarize
  - 最近修改
  - 最近新增
  - 最近开发
  - 上次
  - 历史记录
  - 历史
  - 之前的
  - 之前做的
  - 恢复上下文
  - 上下文恢复
  - 翻阅历史
  - 查看历史
  - 历史会话
  - 之前会话
  - 上次会话
  - 回顾
  - 总结
  - 会话恢复
  - 智能恢复
---

# Session Management - 会话记录管理

管理 Claude Code 会话的记录，支持总结、搜索、加载和智能恢复功能。

## 自动触发

当用户提到以下关键词时，自动触发此技能：
- **时间相关**：最近修改、最近新增、最近开发、上次、之前的、之前做的
- **历史相关**：历史记录、历史、翻阅历史、查看历史、历史会话、之前会话、上次会话
- **操作相关**：恢复上下文、上下文恢复、回顾、总结、会话恢复、智能恢复

## 智能恢复

新会话启动时，自动检测最近 5 分钟内生成的会话总结。如果检测到，会显示提示：

```
========================================
检测到最近的会话总结 (2分钟前):
  会话ID: abc123
  摘要: 修复了登录页面的bug...

是否加载？执行: /load abc123
========================================
```

## 命令

### /load [count]

加载最近 count 次会话总结（默认 5 次）。

**用法示例：**
- `/load` - 加载最近 5 次会话
- `/load 10` - 加载最近 10 次会话
- `/load 3 --headers-only` - 仅加载表头
- `/load abc123` - 加载指定会话ID的总结

**执行：**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-load.js <count>
```

### /search <keyword>

搜索会话历史，返回最匹配的 5 个会话表头。

**用法示例：**
- `/search hook` - 搜索包含 "hook" 的会话
- `/search 修复bug --top 10` - 搜索包含 "修复bug" 的会话，返回前 10 个

**执行：**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-search.js <keyword> --top <n>
```

### /summarize

手动生成或更新当前会话的总结。建议在执行 `/compact` 之前使用。

**用法示例：**
- `/summarize` - 生成当前会话总结

**执行：**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js ${SESSION_ID}
```

## 工作流程

1. **会话结束**：自动后台生成总结（异步）
2. **会话开始**：补充处理失败的总结 + 检测最近总结并提示
3. **需要恢复上下文**：使用 `/load` 加载最近会话
4. **查找历史修改**：使用 `/search` 搜索关键词
5. **压缩前准备**：使用 `/summarize` 生成总结，然后新会话可智能恢复

## 文件位置

- 总结文件：`.session-history/{session_id}.md`
- 待处理队列：`.session-history/pending.json`
- 原始数据：`~/.claude/projects/{project}/{session_id}.jsonl`
