#!/bin/bash
# Statusline 测试脚本

SCRIPT_PATH="$(dirname "$0")/../scripts/ccscaffold-statusline.sh"
FAILED=0

# 测试函数
test_case() {
    local name=$1
    local input=$2
    local expected_contains=$3

    echo "Testing: $name"
    result=$(echo "$input" | "$SCRIPT_PATH")

    if echo "$result" | grep -q "$expected_contains"; then
        echo "  PASS"
    else
        echo "  FAIL: Expected to contain '$expected_contains', got: $result"
        ((FAILED++))
    fi
}

# 清理旧缓存
rm -f /tmp/ccscaffold-statusline-*.json

# 运行测试
test_case "绿色 (<60%)" \
    '{"session_id":"test-green","model":{"id":"glm-4.7"},"context_window":{"used_percentage":45}}' \
    "test-green.*glm-4\.7.*Context: 45%"

test_case "黄色 (60-79%)" \
    '{"session_id":"test-yellow","model":{"id":"test-model"},"context_window":{"used_percentage":75}}' \
    "test-yellow"

test_case "红色 (>=80%)" \
    '{"session_id":"test-red","model":{"id":"test-model"},"context_window":{"used_percentage":85}}' \
    "test-red"

test_case "缓存读取" \
    '{"session_id":"test-green"}' \
    "Context: 45%"

test_case "空输入" \
    '' \
    "unknown-session"

# 清理
rm -f /tmp/ccscaffold-statusline-*.json

# 总结
echo ""
if [[ $FAILED -eq 0 ]]; then
    echo "All tests passed!"
    exit 0
else
    echo "$FAILED test(s) failed!"
    exit 1
fi
