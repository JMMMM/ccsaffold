---
name: search
description: "搜索会话历史，返回最匹配的结果。用法: /search <keyword> [--top <n>]"
---

# 搜索会话历史

搜索会话历史记录，在 YAML 表头中查找匹配关键词的会话。

## 用法

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-search.js <keyword> [--top <n>]
```

## 参数

- `<keyword>`: 搜索关键词（必需）
- `--top <n>`: 返回结果数量，默认 5

## 示例

- `/search hook` - 搜索包含 "hook" 的会话
- `/search 修复bug --top 10` - 搜索并返回前 10 个结果
