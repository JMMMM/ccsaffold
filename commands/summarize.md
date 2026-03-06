---
description: "手动生成或更新当前会话的总结"
---

# 生成会话总结

手动触发生成当前会话的总结文件。

## 用法

```bash
node E:/ccsaffold/scripts/session-summarize.js ${SESSION_ID}
```

## 功能

- 从当前会话的 jsonl 文件中提取用户问题和 LLM 回答
- 记录修改的文件列表（Edit/Write 操作）
- 生成 YAML 表头，包含摘要、关键词等元数据
- 保存到 `.session-history/{session_id}.md`
