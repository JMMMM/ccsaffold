#!/bin/bash
# CCScaffold Statusline Script
# 显示: session_id | model_name | Context: percentage% (带颜色)

set -euo pipefail

# 读取 stdin JSON
input=$(cat)

# 提取字段
session_id=$(echo "$input" | jq -r '.session_id // empty')
model_id=$(echo "$input" | jq -r '.model.id // .model.display_name // "unknown"')
used_percentage=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# 如果 session_id 为空，使用默认值
if [[ -z "$session_id" ]]; then
    session_id="unknown-session"
fi

# 输出调试信息 (测试时)
# echo "Session: $session_id, Model: $model_id, Percentage: $used_percentage" >&2
