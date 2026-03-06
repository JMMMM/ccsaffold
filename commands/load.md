---
name: load
description: "加载最近 x 次会话总结，帮助恢复上下文。用法: /load [count] [--headers-only]"
---

# 加载会话历史

请执行以下命令来加载会话历史：

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-load.js <count> [--headers-only]
```

## 参数说明

- `count`: 加载数量，默认 5
- `--headers-only`: 仅返回 YAML 表头，不加载完整内容

## 示例

- `/load` - 加载最近 5 次会话
- `/load 10` - 加载最近 10 次会话
- `/load 3 --headers-only` - 仅加载表头
