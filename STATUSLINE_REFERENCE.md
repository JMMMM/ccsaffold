# Claude Code Statusline 开发参考

本文档提供了Claude Code Statusline系统的完整技术规范。更多详情请访问：https://code.claude.com/docs/zh-CN/statusline

## Statusline 概述

**Statusline** 是 Claude Code 底部的可自定义栏，可以运行任何 shell 脚本。它通过 stdin 接收 JSON 会话数据，并显示脚本打印的任何内容。

### 使用场景

- 监控上下文窗口使用情况
- 跟踪会话成本
- 在多个会话中工作时区分它们
- 始终显示 git 分支和状态

## 配置 Statusline

### 使用 /statusline 命令

```bash
/statusline show model name and context percentage with a progress bar
```

### 手动配置

将 `statusLine` 字段添加到用户设置（`~/.claude/settings.json`）或项目设置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2
  }
}
```

**字段说明**：
- `type` - 必须是 `"command"`
- `command` - 脚本路径或内联 shell 命令
- `padding` - 可选，额外的水平间距（字符），默认 `0`

### 内联命令示例

```json
{
  "statusLine": {
    "type": "command",
    "command": "jq -r '\"[\\(.model.display_name)] \\(.context_window.used_percentage // 0)% context\"'"
  }
}
```

## 可用数据

Claude Code 通过 stdin 向脚本发送以下 JSON 字段：

| 字段 | 描述 |
| --- | --- |
| `model.id`, `model.display_name` | 当前模型标识符和显示名称 |
| `cwd`, `workspace.current_dir` | 当前工作目录 |
| `workspace.project_dir` | 启动 Claude Code 的目录 |
| `session_id` | 唯一会话标识符 |
| `context_window.used_percentage` | 已使用上下文窗口百分比 |
| `context_window.remaining_percentage` | 剩余上下文窗口百分比 |
| `context_window.total_input_tokens` | 累积输入令牌数 |
| `context_window.total_output_tokens` | 累积输出令牌数 |
| `cost.total_cost_usd` | 总会话成本（美元） |
| `vim.mode` | Vim 模式 (`NORMAL` 或 `INSERT`) |
| `agent.name` | 代理名称 |

### 完整 JSON 架构

```json
{
  "cwd": "/current/working/directory",
  "session_id": "abc123...",
  "transcript_path": "/path/to/transcript.jsonl",
  "model": {
    "id": "claude-opus-4-6",
    "display_name": "Opus"
  },
  "workspace": {
    "current_dir": "/current/working/directory",
    "project_dir": "/original/project/directory"
  },
  "version": "1.0.80",
  "context_window": {
    "total_input_tokens": 15234,
    "total_output_tokens": 4521,
    "context_window_size": 200000,
    "used_percentage": 8,
    "remaining_percentage": 92,
    "current_usage": {
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  }
}
```

## 脚本输出

脚本可以输出：
- **多行** - 每个 `echo` 显示为单独的行
- **颜色** - 使用 ANSI 转义码（如 `\033[32m` 表示绿色）
- **链接** - 使用 OSC 8 转义序列创建可点击链接

### ANSI 颜色代码

```bash
\033[30m  # 黑色
\033[31m  # 红色
\033[32m  # 绿色
\033[33m  # 黄色
\033[34m  # 蓝色
\033[35m  # 品红
\033[36m  # 青色
\033[37m  # 白色
\033[0m   # 重置为默认
```

## 更新时机

脚本在以下情况下运行：
- 每条新的助手消息后
- 权限模式更改时
- Vim 模式切换时

更新在 300ms 处进行防抖，快速更改会批处理在一起。

## 常见示例

### 上下文使用情况

```bash
#!/bin/bash
input=$(cat)
percentage=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
model=$(echo "$input" | jq -r '.model.display_name // "?"')

echo "[$model] Context: ${percentage}%"
```

### 带颜色的上下文条

```bash
#!/bin/bash
input=$(cat)
percentage=$(echo "$input" | jq -r '.context_window.used_percentage // 0')

# 根据百分比选择颜色
if [ "$percentage" -lt 60 ]; then
    color="\033[32m"  # 绿色
elif [ "$percentage" -lt 80 ]; then
    color="\033[33m"  # 黄色
else
    color="\033[31m"  # 红色
fi

printf "${color}Context: ${percentage}%%\033[0m"
```

### 缓存慢速操作

```bash
#!/bin/bash
CACHE_FILE="/tmp/statusline-cache-$(echo $PWD | md5sum | cut -d' ' -f1)"
CACHE_DURATION=5

# 检查缓存是否有效
if [ -f "$CACHE_FILE" ]; then
    cache_age=$(($(date +%s) - $(stat -f%m "$CACHE_FILE" 2>/dev/null || stat -c%Y "$CACHE_FILE")))
    if [ $cache_age -lt $CACHE_DURATION ]; then
        cat "$CACHE_FILE"
        exit 0
    fi
fi

# 生成新内容并缓存
content=$(your_slow_command)
echo "$content" | tee "$CACHE_FILE"
```

## 会话隔离

**重要**: 每个状态行调用作为新进程运行，所以：
- 基于进程的标识符（`$$`、`os.getpid()`）每次都产生不同的值
- 使用稳定的固定文件名来缓存（如基于目录路径的哈希）
- 避免使用进程ID作为缓存键

## 故障排除

| 问题 | 解决方案 |
| --- | --- |
| Statusline未出现 | 验证脚本可执行 (`chmod +x`) |
| 显示 `--` 或空值 | 字段可能为 `null`，使用回退值 (`// 0`) |
| 上下文百分比异常 | 使用 `used_percentage` 而非累积总计 |
| 脚本错误或挂起 | 使用模拟输入测试脚本 |
| 会话间数据污染 | 使用会话ID或目录哈希隔离缓存 |

## 测试脚本

```bash
# 测试脚本
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":75}}' | ./statusline.sh
```

## 调试技巧

1. **保持输出简短** - 状态栏宽度有限
2. **缓存慢速操作** - `git status` 等命令会导致延迟
3. **使用回退值** - 处理可能为 `null` 的字段
4. **独立测试** - 用模拟输入验证脚本逻辑
