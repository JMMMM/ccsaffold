# Statusline 设计文档

**日期**: 2026-03-04
**项目**: CCScaffold 个人AI工具箱

## 概述

创建一个自定义的 Claude Code statusline，显示完整的 session_id、模型名和带颜色编码的上下文使用百分比。

## 需求

### 功能需求

1. **显示内容**:
   - 完整 session_id
   - 实际使用的模型名（如 glm-4.7）
   - 上下文使用百分比

2. **输出格式**:
   ```
   {session_id} | {model_name} | Context: {percentage}%
   ```
   示例:
   ```
   cfd98e73-fc87-4c10-a398-8991d72a1fa7 | glm-4.7 | Context: 45%
   ```

3. **颜色机制**:
   - < 60%: 绿色 (`\033[32m`)
   - >= 60% 且 < 80%: 黄色 (`\033[33m`)
   - >= 80%: 红色 (`\033[31m`)
   - 整个 `Context: XX%` 部分变色

4. **缓存策略**:
   - 当 `used_percentage` 无法识别时，保留旧值
   - 按 session_id 隔离缓存，确保会话间不相互影响
   - 缓存文件路径: `/tmp/ccscaffold-statusline-{session_id}.json`

### 非功能需求

1. **性能**: 脚本执行时间 < 100ms
2. **可靠性**: 缓存失败时不应中断 statusline 显示
3. **隔离性**: 不同 session 的缓存完全独立

## 设计方案

### 技术选型

选择 **Bash + jq** 方案:
- 轻量级，启动快
- jq 是常见的 JSON 处理工具
- 易于调试和维护

### 脚本结构

```
scripts/
└── ccscaffold-statusline.sh
```

### 数据流

```
┌─────────────────┐
│ Claude Code     │
│ (stdin JSON)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ ccscaffold-statusline.sh│
│ - 解析 JSON             │
│ - 读取缓存              │
│ - 计算颜色              │
│ - 输出格式化文本        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│ Statusline      │
│ 显示            │
└─────────────────┘
```

### 缓存设计

**缓存文件格式**:
```json
{
  "last_percentage": 45,
  "timestamp": 1234567890
}
```

**缓存逻辑**:
1. 根据 `session_id` 构建缓存文件路径
2. 尝试读取缓存
3. 如果当前 `used_percentage` 有效，更新缓存
4. 如果当前 `used_percentage` 无效，使用缓存值
5. 如果缓存无效，显示 `--%`

### 错误处理

| 场景 | 处理方式 |
|------|----------|
| jq 解析失败 | 使用默认值，不中断 |
| 缓存文件不存在 | 继续执行，显示 `--%` |
| used_percentage 为 null | 尝试从缓存读取 |
| 缓存读取失败 | 显示 `--%` |

## 实现细节

### 颜色代码

```bash
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"
```

### 缓存文件命名

```bash
CACHE_FILE="/tmp/ccscaffold-statusline-${session_id}.json"
```

使用 session_id 确保会话间完全隔离。

### 输出示例

```bash
# 绿色 (< 60%)
cfd98e73-fc87-4c10-a398-8991d72a1fa7 | glm-4.7 | \033[32mContext: 45%\033[0m

# 黄色 (>= 60%, < 80%)
cfd98e73-fc87-4c10-a398-8991d72a1fa7 | glm-4.7 | \033[33mContext: 75%\033[0m

# 红色 (>= 80%)
cfd98e73-fc87-4c10-a398-8991d72a1fa7 | glm-4.7 | \033[31mContext: 85%\033[0m
```

## 配置方式

脚本开发完成后，将添加到用户设置:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/Users/ming/Work/ccscaffold/scripts/ccscaffold-statusline.sh"
  }
}
```

## 测试计划

1. **单元测试**: 使用模拟 JSON 输入测试各种场景
2. **集成测试**: 在 Claude Code 中实际运行
3. **边界测试**: 测试 null 值、缓存缺失等情况

## 参考文档

- [STATUSLINE_REFERENCE.md](../STATUSLINE_REFERENCE.md)
- https://code.claude.com/docs/zh-CN/statusline
