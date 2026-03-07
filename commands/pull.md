---
name: pull
description: "从云端拉取并解密会话记录。用法: /pull"
---

# 从云端拉取会话记录

请执行以下命令来拉取并解密会话记录：

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-cloud.js pull
```

## 环境变量

- `SESSION_ENCRYPT_PASSWORD`: 加密密码（可选，未设置时提示输入）

## 示例

- `/pull` - 从云端拉取并解密会话记录
