#!/bin/bash
# CCScaffold Statusline Script
# 显示: session_id | model_name | Context: percentage% (带颜色)

set -euo pipefail

# 检查 jq 是否可用
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required. Install with: brew install jq" >&2
    exit 1
fi

# 读取 stdin JSON
input=$(cat)

# 检查输入是否为空
if [[ -z "$input" ]]; then
    echo "unknown-session | unknown | Context: --%"
    exit 0
fi

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

# 缓存配置
CACHE_DIR="/tmp"
CACHE_FILE="${CACHE_DIR}/ccscaffold-statusline-${session_id}.json"

# 从缓存读取旧值
read_cache() {
    if [[ -f "$CACHE_FILE" ]]; then
        jq -r '.last_percentage // empty' "$CACHE_FILE" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# 写入缓存
write_cache() {
    local percentage=$1
    local timestamp=$(date +%s)
    echo "{\"last_percentage\": $percentage, \"timestamp\": $timestamp}" > "$CACHE_FILE"
}

# 确定要显示的百分比
display_percentage="$used_percentage"
if [[ -z "$display_percentage" || "$display_percentage" == "null" ]]; then
    display_percentage=$(read_cache)
    if [[ -z "$display_percentage" ]]; then
        display_percentage="--"
    fi
else
    # 有新值时更新缓存
    write_cache "$display_percentage"
fi

# ANSI 颜色代码
readonly GREEN=$'\033[32m'
readonly YELLOW=$'\033[33m'
readonly RED=$'\033[31m'
readonly RESET=$'\033[0m'

# 根据百分比获取颜色
get_color() {
    local pct=$1
    # 如果是 "--" 或非数字，使用默认颜色
    if ! [[ "$pct" =~ ^[0-9]+$ ]]; then
        echo ""
        return
    fi

    if (( pct < 60 )); then
        echo "$GREEN"
    elif (( pct < 80 )); then
        echo "$YELLOW"
    else
        echo "$RED"
    fi
}

# 获取颜色
color=$(get_color "$display_percentage")

# 格式化输出
if [[ -n "$color" ]]; then
    printf "%s | %s | %sContext: %s%%%s\n" \
        "$session_id" \
        "$model_id" \
        "$color" \
        "$display_percentage" \
        "$RESET"
else
    printf "%s | %s | Context: %s%%\n" \
        "$session_id" \
        "$model_id" \
        "$display_percentage"
fi
