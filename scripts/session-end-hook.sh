#!/bin/bash
# SessionEnd Hook 包装脚本
# 从 stdin 读取 JSON 输入，获取 session_id

LOG_FILE="/Users/ming/Work/ccscaffold/logs/session-end-hook.log"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 从 stdin 读取 JSON 输入
INPUT=$(cat)

# 使用 jq 或 node 解析 JSON 获取 session_id
if command -v jq &>/dev/null; then
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
    REASON=$(echo "$INPUT" | jq -r '.reason // empty')
else
    SESSION_ID=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');try{const j=JSON.parse(d);console.log(j.session_id||'')}catch(e){console.log('')}")
    REASON=$(echo "$INPUT" | node -e "const d=require('fs').readFileSync(0,'utf8');try{const j=JSON.parse(d);console.log(j.reason||'')}catch(e){console.log('')}")
fi

# 如果没有获取到 session_id，跳过
if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ] || [ "$SESSION_ID" = "empty" ]; then
    log "No session_id from stdin, skipping"
    exit 0
fi

# 获取 PLUGIN_ROOT
if [ -n "$CLAUDE_PLUGIN_ROOT" ]; then
    PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
else
    PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

# 记录触发信息
log "=== SessionEnd: $SESSION_ID (reason:$REASON) ==="

# 后台执行分析（立即返回，不等待）
SUMMARIZE_SCRIPT="$PLUGIN_ROOT/scripts/session-summarize.js"
ANALYZE_SCRIPT="$PLUGIN_ROOT/scripts/ai-analyze.sh"

if [ -f "$SUMMARIZE_SCRIPT" ] && [ -f "$ANALYZE_SCRIPT" ]; then
    # 使用 nohup 在后台执行，输出重定向到单独日志
    ANALYSIS_LOG="/Users/ming/Work/ccscaffold/logs/analysis-${SESSION_ID}-$(date +%s).log"
    nohup bash -c "node \"$SUMMARIZE_SCRIPT\" \"$SESSION_ID\" | bash \"$ANALYZE_SCRIPT\"" > "$ANALYSIS_LOG" 2>&1 &
    log "Started: $ANALYSIS_LOG"
else
    log "ERROR: Scripts not found"
    [ ! -f "$SUMMARIZE_SCRIPT" ] && log "  Missing: $SUMMARIZE_SCRIPT"
    [ ! -f "$ANALYZE_SCRIPT" ] && log "  Missing: $ANALYZE_SCRIPT"
fi

exit 0
