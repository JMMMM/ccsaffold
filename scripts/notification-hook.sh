#!/bin/bash
# Notification Hook - 处理 Claude Code Notification 事件
# 跨平台支持：macOS (terminal-notifier), Windows (PowerShell), Linux (notify-send)

set -euo pipefail

# 通知标题
NOTIFY_TITLE="Claude Code"

# 获取脚本所在目录（用于跨平台调用）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 检测操作系统
detect_os() {
    case "$OSTYPE" in
        darwin*)  echo "macos" ;;
        msys*|cygwin*|win*) echo "windows" ;;
        linux*)   echo "linux" ;;
        *)        echo "unknown" ;;
    esac
}

# 消息映射函数 - 兼容 bash 3.x (macOS 默认)
#
# 根据通知类型返回对应的中文消息
#
# 参数:
#   $1 - notification_type: 通知类型 (permission_prompt/idle_prompt/task_complete/task_failed)
#   $2 - original_message: 原始消息（未知类型时使用）
#
# 输出:
#   返回中文通知消息文本
#
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

# macOS 通知发送函数
send_notification_macos() {
    local title="$1"
    local message="$2"

    if ! command -v terminal-notifier &>/dev/null; then
        echo "Error: terminal-notifier not found. Install with: brew install terminal-notifier" >&2
        return 1
    fi

    terminal-notifier -title "$title" -message "$message" 2>/dev/null || true
}

# Windows 通知发送函数
send_notification_windows() {
    local title="$1"
    local message="$2"

    local ps_script="${SCRIPT_DIR}/windows-notification.ps1"

    if [[ ! -f "$ps_script" ]]; then
        echo "Error: Windows notification script not found: $ps_script" >&2
        return 1
    fi

    # 使用 PowerShell 执行通知脚本
    powershell.exe -ExecutionPolicy Bypass -File "$ps_script" -Title "$title" -Message "$message" 2>/dev/null || true
}

# Linux 通知发送函数
send_notification_linux() {
    local title="$1"
    local message="$2"

    if ! command -v notify-send &>/dev/null; then
        echo "Error: notify-send not found. Install with: apt install libnotify-bin" >&2
        return 1
    fi

    notify-send "$title" "$message" 2>/dev/null || true
}

# 主函数
main() {
    local input
    local notification_type
    local original_message
    local notify_message
    local os

    # 检测操作系统
    os=$(detect_os)

    # 读取 stdin 的 JSON 输入
    input=$(cat)

    # 检查输入是否为空
    if [[ -z "$input" ]]; then
        echo "Error: No input provided" >&2
        exit 0
    fi

    # 检查 jq 是否可用
    if ! command -v jq &>/dev/null; then
        echo "Error: jq is required. Install with: brew install jq (macOS) or apt install jq (Linux)" >&2
        exit 0
    fi

    # 解析 notification_type（Notification 事件）
    notification_type=$(echo "$input" | jq -r '.notification_type // empty' 2>/dev/null || true)

    # 检测事件类型：Stop 事件没有 notification_type 字段
    local is_stop_event="false"
    if [[ -z "$notification_type" ]]; then
        # Stop 事件的特征：有 reason 或 stop_reason 字段，或者没有 notification_type
        local reason=$(echo "$input" | jq -r '.reason // .stop_reason // empty' 2>/dev/null || true)
        if [[ -n "$reason" || -z "$notification_type" ]]; then
            is_stop_event="true"
        fi
    fi

    # 解析原始 message
    original_message=$(echo "$input" | jq -r '.message // empty' 2>/dev/null || true)

    # 根据事件类型获取通知消息
    if [[ "$is_stop_event" == "true" ]]; then
        notify_message="Claude 任务完成"
    else
        notify_message=$(get_notification_message "${notification_type:-}" "${original_message:-}")
    fi

    # 根据操作系统发送通知
    case "$os" in
        macos)
            send_notification_macos "$NOTIFY_TITLE" "$notify_message"
            ;;
        windows)
            send_notification_windows "$NOTIFY_TITLE" "$notify_message"
            ;;
        linux)
            send_notification_linux "$NOTIFY_TITLE" "$notify_message"
            ;;
        *)
            echo "Error: Unsupported operating system: $OSTYPE" >&2
            exit 0
            ;;
    esac
}

# 执行主函数
main "$@"
