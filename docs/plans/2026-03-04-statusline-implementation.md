# Statusline 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个自定义 Claude Code statusline，显示完整 session_id、模型名和带颜色编码的上下文使用百分比

**Architecture:** Bash + jq 脚本，通过 stdin 读取 JSON 会话数据，使用 session_id 隔离的缓存机制保留无法识别时的旧值

**Tech Stack:** Bash, jq (JSON 处理), ANSI 转义码 (颜色)

---

## Task 1: 创建 statusline 脚本骨架

**Files:**
- Create: `scripts/ccscaffold-statusline.sh`

**Step 1: 创建脚本文件并添加 shebang**

```bash
cat > scripts/ccscaffold-statusline.sh << 'EOF'
#!/bin/bash
# CCScaffold Statusline Script
# 显示: session_id | model_name | Context: percentage% (带颜色)

set -euo pipefail
EOF
```

**Step 2: 设置执行权限**

Run: `chmod +x scripts/ccscaffold-statusline.sh`
Expected: 文件变为可执行，无输出

**Step 3: 验证脚本可执行**

Run: `./scripts/ccscaffold-statusline.sh <<< '{"test":"data"}'`
Expected: 无错误 (脚本目前为空，正常退出)

**Step 4: 提交**

```bash
git add scripts/ccscaffold-statusline.sh
git commit -m "feat: add statusline script skeleton"
```

---

## Task 2: 实现数据提取逻辑

**Files:**
- Modify: `scripts/ccscaffold-statusline.sh`

**Step 1: 添加 JSON 数据提取**

在 `set -euo pipefail` 后添加：

```bash
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
EOF
```

**Step 2: 测试数据提取**

Run:
```bash
echo '{"session_id":"test-123","model":{"id":"glm-4.7"},"context_window":{"used_percentage":45}}' | ./scripts/ccscaffold-statusline.sh
```
Expected: 无错误 (此时还没输出)

**Step 3: 测试空值处理**

Run:
```bash
echo '{"model":{"id":"test"}}' | ./scripts/ccscaffold-statusline.sh
```
Expected: 无错误，session_id 应该使用默认值

**Step 4: 提交**

```bash
git add scripts/ccscaffold-statusline.sh
git commit -m "feat: add JSON data extraction"
```

---

## Task 3: 实现缓存机制

**Files:**
- Modify: `scripts/ccscaffold-statusline.sh`

**Step 1: 添加缓存函数**

在数据提取代码后添加：

```bash
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
EOF
```

**Step 2: 测试缓存读写**

Run:
```bash
# 第一次运行 (写入缓存)
echo '{"session_id":"test-cache","context_window":{"used_percentage":55}}' | ./scripts/ccscaffold-statusline.sh

# 检查缓存文件
cat /tmp/ccscaffold-statusline-test-cache.json
```
Expected: 缓存文件存在，包含 `{"last_percentage": 55, ...}`

**Step 3: 测试缓存读取**

Run:
```bash
# 第二次运行 (used_percentage 为空，应从缓存读取)
echo '{"session_id":"test-cache"}' | ./scripts/ccscaffold-statusline.sh

# 清理测试缓存
rm -f /tmp/ccscaffold-statusline-test-cache.json
```
Expected: 逻辑正确 (此时还没输出，但缓存逻辑运行)

**Step 4: 提交**

```bash
git add scripts/ccscaffold-statusline.sh
git commit -m "feat: add cache mechanism for percentage"
```

---

## Task 4: 实现颜色机制

**Files:**
- Modify: `scripts/ccscaffold-statusline.sh`

**Step 1: 添加颜色函数**

在缓存代码后添加：

```bash
# ANSI 颜色代码
readonly GREEN="\033[32m"
readonly YELLOW="\033[33m"
readonly RED="\033[31m"
readonly RESET="\033[0m"

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
EOF
```

**Step 2: 测试颜色函数**

Run: 添加临时测试代码后运行
```bash
# 临时添加测试
get_color 45  # 应输出绿色代码
get_color 75  # 应输出黄色代码
get_color 85  # 应输出红色代码
get_color "--" # 应输出空
```

**Step 3: 提交**

```bash
git add scripts/ccscaffold-statusline.sh
git commit -m "feat: add color mechanism based on percentage"
```

---

## Task 5: 实现格式化输出

**Files:**
- Modify: `scripts/ccscaffold-statusline.sh`

**Step 1: 添加输出逻辑**

在所有代码后添加：

```bash
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
EOF
```

**Step 2: 测试完整输出**

Run:
```bash
# 测试绿色 (<60%)
echo '{"session_id":"green-test","model":{"id":"test-model"},"context_window":{"used_percentage":45}}' | ./scripts/ccscaffold-statusline.sh

# 测试黄色 (60-79%)
echo '{"session_id":"yellow-test","model":{"id":"test-model"},"context_window":{"used_percentage":75}}' | ./scripts/ccscaffold-statusline.sh

# 测试红色 (>=80%)
echo '{"session_id":"red-test","model":{"id":"test-model"},"context_window":{"used_percentage":85}}' | ./scripts/ccscaffold-statusline.sh

# 测试缓存读取 (无 used_percentage)
echo '{"session_id":"green-test"}' | ./scripts/ccscaffold-statusline.sh

# 清理
rm -f /tmp/ccscaffold-statusline-*.json
```

Expected: 输出格式正确，颜色代码正确应用

**Step 3: 验证输出格式**

输出应类似于:
```
green-test | test-model | Context: 45%     (绿色)
yellow-test | test-model | Context: 75%    (黄色)
red-test | test-model | Context: 85%       (红色)
green-test | test-model | Context: 45%     (从缓存读取，绿色)
```

**Step 4: 提交**

```bash
git add scripts/ccscaffold-statusline.sh
git commit -m "feat: add formatted output with colors"
```

---

## Task 6: 添加错误处理和边界情况

**Files:**
- Modify: `scripts/ccscaffold-statusline.sh`

**Step 1: 添加 jq 不可用时的回退**

在脚本开头添加：

```bash
# 检查 jq 是否可用
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required. Install with: brew install jq" >&2
    exit 1
fi
```

**Step 2: 测试无 jq 环境**

Run: 临时重命名 jq 测试
```bash
# 临时移除 jq
PATH=/tmp:$PATH ./scripts/ccscaffold-statusline.sh <<< '{"test":"data"}'
# Expected: Error message
```

**Step 3: 添加空输入处理**

在读取输入后添加：

```bash
# 检查输入是否为空
if [[ -z "$input" ]]; then
    echo "unknown-session | unknown | Context: --%"
    exit 0
fi
```

**Step 4: 测试空输入**

Run: `echo "" | ./scripts/ccscaffold-statusline.sh`
Expected: 输出 `unknown-session | unknown | Context: --%`

**Step 5: 提交**

```bash
git add scripts/ccscaffold-statusline.sh
git commit -m "feat: add error handling and edge cases"
```

---

## Task 7: 集成测试

**Files:**
- Create: `tests/test-statusline.sh`

**Step 1: 创建测试脚本**

```bash
cat > tests/test-statusline.sh << 'TESTEOF'
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
TESTEOF

chmod +x tests/test-statusline.sh
```

**Step 2: 运行测试**

Run: `./tests/test-statusline.sh`
Expected: 所有测试通过

**Step 3: 提交**

```bash
git add tests/test-statusline.sh
git commit -m "test: add integration tests for statusline"
```

---

## Task 8: 更新 CLAUDE.md 和文档

**Files:**
- Modify: `CLAUDE.md`

**Step 1: 添加 statusline 配置说明到 CLAUDE.md**

在项目结构中添加 scripts 说明，在开发指南中添加 Statusline 部分

```markdown
### Statusline

已配置自定义 statusline 显示:
- 完整 session_id
- 实际使用的模型名
- 带颜色编码的上下文使用百分比

脚本位置: `scripts/ccscaffold-statusline.sh`

配置方式: 在用户设置 (`~/.claude/settings.json`) 中添加:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/Users/ming/Work/ccscaffold/scripts/ccscaffold-statusline.sh"
  }
}
```
```

**Step 2: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: add statusline configuration to CLAUDE.md"
```

---

## Task 9: 应用配置

**Step 1: 询问用户生效范围**

询问用户 statusline 配置的生效范围:
1. 本项目生效 (`.claude/settings.json`)
2. 用户级别生效 (`~/.claude/settings.json`)
3. 不生效 (仅保留源码)

**Step 2: 根据用户选择应用配置**

如果选择用户级别生效:

Run:
```bash
# 备份原设置
cp ~/.claude/settings.json ~/.claude/settings.json.bak

# 获取绝对路径
SCRIPT_PATH="$(pwd)/scripts/ccscaffold-statusline.sh"

# 添加 statusline 配置
# 注意: 需要手动编辑或使用 jq 工具
```

手动编辑 `~/.claude/settings.json` 添加:
```json
{
  ...
  "statusLine": {
    "type": "command",
    "command": "/Users/ming/Work/ccscaffold/scripts/ccscaffold-statusline.sh"
  }
}
```

**Step 3: 验证配置**

Run: 打开新的 Claude Code 会话，验证 statusline 显示正确

**Step 4: 提交 (如果配置文件在本项目)**

```bash
# 如果添加了 .claude/settings.json
git add .claude/settings.json
git commit -m "config: add statusline configuration"
```

---

## 测试清单

完成所有任务后，验证以下内容:

- [ ] 脚本可执行且有正确的 shebang
- [ ] 绿色显示: percentage < 60%
- [ ] 黄色显示: 60% <= percentage < 80%
- [ ] 红色显示: percentage >= 80%
- [ ] 缓存正常工作 (无 used_percentage 时显示旧值)
- [ ] 不同 session_id 互不影响
- [ ] 空输入有合理的默认输出
- [ ] 所有集成测试通过
- [ ] statusline 在 Claude Code 中正确显示

## 参考文档

- [STATUSLINE_REFERENCE.md](../STATUSLINE_REFERENCE.md)
- [设计文档](./2026-03-04-statusline-design.md)
- https://code.claude.com/docs/zh-CN/statusline
