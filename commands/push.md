---
name: push
description: "加密会话记录并推送到云端。用法: /push [message]"
---

# 推送会话记录到云端

请执行以下命令来加密并推送会话记录：

```bash
node E:/ccsaffold/scripts/session-cloud.js push <message>
```

## 参数说明

- `message`: 可选，提交信息

## 环境变量

- `SESSION_ENCRYPT_PASSWORD`: 加密密码（可选，未设置时提示输入）

## 示例

- `/push` - 推送会话记录（使用默认提交信息）
- `/push 添加今天的会话` - 推送并指定提交信息
