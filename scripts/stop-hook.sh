#!/bin/bash
# Stop Hook - 处理 Claude Code Stop 事件
# 在会话结束时显示任务完成通知

set -euo pipefail

# 通知标题
NOTIFY_TITLE="Claude Code"
NOTIFY_MESSAGE="会话已结束 - 任务完成"

# 日志文件（可选，用于调试）
LOG_FILE="/tmp/stop-hook-debug.log"

# 记录触发时间
echo "=== Stop Hook Triggered at $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"

# 读取 stdin 的 JSON 输入（如果有）
if [[ -t 0 ]]; then
    # 没有 stdin 输入
    echo "No stdin input" >> "$LOG_FILE"
else
    input=$(cat)
    echo "Input: $input" >> "$LOG_FILE"
fi

# 检查 terminal-notifier 是否可用
if command -v terminal-notifier &>/dev/null; then
    echo "Sending stop notification..." >> "$LOG_FILE"
    terminal-notifier -title "$NOTIFY_TITLE" -message "$NOTIFY_MESSAGE" 2>/dev/null || true
else
    echo "Error: terminal-notifier not found" >> "$LOG_FILE"
fi

echo "=== Stop Hook Complete ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
