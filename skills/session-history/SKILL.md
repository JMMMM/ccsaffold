---
description: 会话历史记录管理，支持加载、搜索和生成会话总结
triggers:
  - /load
  - /search
  - /summarize
---

# Session History - 会话历史记录

管理 Claude Code 会话的历史记录，帮助恢复上下文和查找历史修改。

## 命令

### /load [count]

加载最近 count 次会话总结（默认 5 次）。

**用法示例：**
- `/load` - 加载最近 5 次会话
- `/load 10` - 加载最近 10 次会话
- `/load 3 --headers-only` - 仅加载表头

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

手动生成或更新当前会话的总结。

**用法示例：**
- `/summarize` - 生成当前会话总结

**执行：**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js ${SESSION_ID}
```

## 工作流程

1. **会话结束**：自动后台生成总结（异步）
2. **会话开始**：补充处理失败的总结
3. **需要恢复上下文**：使用 `/load` 加载最近会话
4. **查找历史修改**：使用 `/search` 搜索关键词

## 文件位置

- 总结文件：`.session-history/{session_id}.md`
- 待处理队列：`.session-history/pending.json`
- 原始数据：`~/.claude/projects/{project}/{session_id}.jsonl`
