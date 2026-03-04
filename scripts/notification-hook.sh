#!/bin/bash
# Notification Hook - 处理 Claude Code Notification 事件
# 通过 terminal-notifier 显示中文系统通知

set -euo pipefail

# 脚本路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 通知标题
NOTIFY_TITLE="Claude Code"

# 消息映射函数 - 兼容 bash 3.x (macOS 默认)
get_notification_message() {
    local notification_type="$1"
    local original_message="$2"

    case "$notification_type" in
        permission_prompt)
            echo "Claude 需要你的许可"
            ;;
        idle_prompt)
            echo "Claude 等待你的安排"
            ;;
        task_complete)
            echo "Claude 任务完成"
            ;;
        task_failed)
            echo "Claude 执行任务失败"
            ;;
        *)
            # 未知类型，使用原始消息
            if [[ -n "$original_message" ]]; then
                echo "$original_message"
            else
                echo "Claude 通知"
            fi
            ;;
    esac
}

# 主函数
main() {
    local input
    local notification_type
    local original_message
    local notify_message

    # 读取 stdin 的 JSON 输入
    input=$(cat)

    # 解析 notification_type
    notification_type=$(echo "$input" | jq -r '.notification_type // empty' 2>/dev/null || true)

    # 解析原始 message
    original_message=$(echo "$input" | jq -r '.message // empty' 2>/dev/null || true)

    # 根据映射获取通知消息
    notify_message=$(get_notification_message "${notification_type:-}" "${original_message:-}")

    # 检查 terminal-notifier 是否可用
    if ! command -v terminal-notifier &>/dev/null; then
        echo "Error: terminal-notifier not found" >&2
        exit 0
    fi

    # 发送通知
    terminal-notifier -title "$NOTIFY_TITLE" -message "$notify_message" 2>/dev/null || true
}

# 执行主函数
main "$@"
