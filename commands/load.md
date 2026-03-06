---
name: load
description: 加载最近 x 次会话总结，帮助恢复上下文
---

# 加载会话历史

加载最近 x 次会话的总结内容，帮助快速恢复上下文。

## 用法

```
/load [count]           # 加载最近 count 次会话总结（默认 5 次）
/load 10                # 加载最近 10 次会话
/load 3 --headers-only  # 仅加载 YAML 表头（快速预览）
```

## 执行

请执行以下命令来加载会话历史：

```bash
node E:/ccsaffold/scripts/session-load.js <count> [--headers-only]
```

## 参数

- `count`: 加载数量，默认 5
- `--headers-only`: 仅返回 YAML 表头，不加载完整内容

## 输出

- 显示每个会话的 session_id、日期、摘要、关键词和修改文件列表
- 如果使用 `--headers-only`，仅显示表头信息
