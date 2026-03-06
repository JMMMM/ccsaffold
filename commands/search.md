---
name: search
description: 搜索会话历史，返回最匹配的结果
---

搜索会话历史记录，在 YAML 表头中查找匹配关键词的会话。

## 用法

```
/search <keyword> [--top <n>]
```

## 参数

- `<keyword>`: 搜索关键词（必需）
- `--top <n>`: 返回结果数量，默认 5

## 示例

- `/search hook` - 搜索包含 "hook" 的会话
- `/search 修复bug --top 10` - 搜索并返回前 10 个结果

## 输出

- 显示匹配会话的文件名、session_id、日期、摘要和关键词
- 按匹配得分排序
