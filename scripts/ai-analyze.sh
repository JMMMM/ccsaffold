#!/bin/bash
# ai-analyze.sh
# 从 stdin 读取会话数据，延迟执行 AI 分析，生成会话总结
# 用法: node session-summarize.js <session_id> | bash ai-analyze.sh

set -e

# 配置
DELAY_SECONDS=0
TIMEOUT_SECONDS=180
MODEL="GLM-4.5-Air"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$PROJECT_ROOT/logs"

# 确保日志目录存在
mkdir -p "$LOGS_DIR"

# 日志文件
LOG_FILE="$LOGS_DIR/ai-analyze-$(date '+%Y%m%d-%H%M%S').log"

# 日志函数
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log "=== AI Analysis Started ==="
log "Reading session data from stdin..."

# 从 stdin 读取 JSON 数据
INPUT_JSON=$(cat)
log "Input length: ${#INPUT_JSON} bytes"

# 使用 node 解析 JSON（更可靠）
parse_json() {
    echo "$INPUT_JSON" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.$1||'')"
}

SESSION_ID=$(parse_json "session_id")
DATE=$(parse_json "date")
PROJECT=$(parse_json "project")
HISTORY_DIR=$(parse_json "history_dir")
PROMPT=$(parse_json "prompt")
SKIP_AI_ANALYSIS=$(parse_json "skip_ai_analysis")
SKIP_REASON=$(parse_json "reason")

log "Session ID: $SESSION_ID"
log "Date: $DATE"
log "Project: $PROJECT"
log "History Dir: $HISTORY_DIR"

# 检查是否需要跳过 AI 分析
if [ "$SKIP_AI_ANALYSIS" = "true" ]; then
    log "Skipping AI analysis: $SKIP_REASON"
    # 清理并退出
    rm -f "$HISTORY_DIR/.prompt-${SESSION_ID}.txt" 2>/dev/null || true
    log "=== AI Analysis Skipped ==="
    exit 0
fi

# 如果 date 是 UTC 格式，转换为东八区
if [ -n "$DATE" ] && echo "$DATE" | grep -q "Z$"; then
    DATE=$(echo "$DATE" | node -e "const d=require('fs').readFileSync(0,'utf8').trim(); const date=new Date(d); const offset=8*60*60*1000; const beijing=new Date(date.getTime()+offset); console.log(beijing.toISOString().replace('Z','').replace(/\\\.\d{3}Z?$/,'+08:00'))")
    log "Converted to Beijing time: $DATE"
fi

# 保存提示词到临时文件
PROMPT_FILE="$HISTORY_DIR/.prompt-${SESSION_ID}.txt"
echo "$PROMPT" > "$PROMPT_FILE"
log "Prompt file: $PROMPT_FILE"
log "Prompt length: ${#PROMPT} chars"

# 立即执行分析
log "Starting analysis..."

# JSON Schema for structured output
JSON_SCHEMA='{"type":"object","properties":{"description":{"type":"string","maxLength":120},"completion_status":{"type":"string","enum":["completed","in_progress"]}},"required":["description","completion_status"]}'

# 使用 GLM-4.5-Air，保留 --json-schema 和 --output-format json
CMD="claude -p --model $MODEL --dangerously-skip-permissions --no-session-persistence --output-format json --tools \"\" --setting-sources user --disable-slash-commands --json-schema '$JSON_SCHEMA' @$PROMPT_FILE"
log "Command: $CMD"

# 执行 AI 分析（后台运行，不等待超时）
log "Starting AI analysis..."
START_TIME=$(date +%s)

# 直接执行命令，捕获输出
AI_OUTPUT=$(eval "$CMD" 2>&1)
EXIT_CODE=$?

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
log "AI analysis completed in ${ELAPSED}s, exit code: $EXIT_CODE"

# 解析 AI 输出
DESCRIPTION="Session completed"
COMPLETION_STATUS="completed"
AI_ANALYZED="false"

if [ -n "$AI_OUTPUT" ]; then
    log "AI output length: ${#AI_OUTPUT}"

    # 尝试解析 JSON（GLM-4.5-Air 可能返回纯文本或 JSON）
    PARSED=$(echo "$AI_OUTPUT" | node -e "
        const fs = require('fs');
        const input = fs.readFileSync(0, 'utf8').trim();
        try {
            let result = null;
            // 尝试解析 structured_output
            try {
                const wrapper = JSON.parse(input);
                if (wrapper.structured_output) result = wrapper.structured_output;
            } catch(e) {}
            // 尝试直接解析
            if (!result) {
                let jsonStr = input;
                // 移除可能的 markdown 代码块标记
                jsonStr = jsonStr.replace(/^[\s\S]*?\{/,'{').replace(/\}[\s\S]*$/,'}');
                result = JSON.parse(jsonStr);
            }
            const desc = (result.description || 'Session completed').substring(0, 120);
            console.log(JSON.stringify({
                description: desc,
                completion_status: result.completion_status || 'completed'
            }));
        } catch(e) {
            // 解析失败，返回空值
            console.log('');
        }
    " 2>/dev/null)

    if [ -n "$PARSED" ]; then
        DESCRIPTION=$(echo "$PARSED" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).description)")
        COMPLETION_STATUS=$(echo "$PARSED" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).completion_status)")
        AI_ANALYZED="true"
        log "Parsed: description='$DESCRIPTION' status=$COMPLETION_STATUS"
    else
        log "Failed to parse JSON, using fallback"
    fi
fi

# 获取 user_questions 用于 markdown
USER_QUESTIONS_MD=$(echo "$INPUT_JSON" | node -e "
    const d = require('fs').readFileSync(0, 'utf8');
    const j = JSON.parse(d);
    (j.user_questions || []).forEach(q => console.log('- ' + q.substring(0,200).replace(/\\n/g,' ')));
" 2>/dev/null || echo "")

MODIFIED_FILES_MD=$(echo "$INPUT_JSON" | node -e "
    const d = require('fs').readFileSync(0, 'utf8');
    const j = JSON.parse(d);
    (j.modified_files || []).forEach(f => console.log('- ' + f.path + ' (' + f.action + ')'));
" 2>/dev/null || echo "")

# 生成 Markdown 文件（符合 skills 格式）
OUTPUT_FILE="$HISTORY_DIR/${SESSION_ID}.md"
log "Generating markdown: $OUTPUT_FILE"

cat > "$OUTPUT_FILE" << ENDOFFILE
---
session_id: $SESSION_ID
date: $DATE
project: $PROJECT
description: "$DESCRIPTION"
completion_status: $COMPLETION_STATUS
ai_analyzed: $AI_ANALYZED
---

## User Questions

$USER_QUESTIONS_MD

## Modified Files

$MODIFIED_FILES_MD
ENDOFFILE

log "Markdown file generated: $OUTPUT_FILE"

# 清理临时文件
rm -f "$PROMPT_FILE" 2>/dev/null || true
log "Cleaned up temporary files"

log "=== AI Analysis Complete ==="
