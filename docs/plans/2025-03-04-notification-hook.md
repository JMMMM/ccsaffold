# Notification Hook 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建 Notification Hook 用于监听 Claude Code 通知事件，并通过 terminal-notifier 显示中文系统通知

**Architecture:** 单一脚本集中处理方案 - notification-hook.sh 接收 JSON 输入，解析 notification_type，映射到相应的中文消息，调用 terminal-notifier 显示通知

**Tech Stack:** Bash脚本, terminal-notifier, Claude Code Hooks API

---

### Task 1: 创建 notification-hook.sh 脚本

**Files:**
- Create: `scripts/notification-hook.sh`

**Step 1: 创建脚本基础结构**

```bash
#!/bin/bash
# Notification Hook - 处理 Claude Code Notification 事件
# 通过 terminal-notifier 显示中文系统通知

set -euo pipefail

# 脚本路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 通知标题
NOTIFY_TITLE="Claude Code"

# 消息映射表
declare -A MESSAGE_MAP
MESSAGE_MAP["permission_prompt"]="Claude 需要你的许可"
MESSAGE_MAP["idle_prompt"]="Claude 等待你的安排"
MESSAGE_MAP["task_complete"]="Claude 任务完成"
MESSAGE_MAP["task_failed"]="Claude 执行任务失败"

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

    # 根据映射表获取通知消息
    if [[ -n "${notification_type:-}" && -n "${MESSAGE_MAP[$notification_type]:-}" ]]; then
        notify_message="${MESSAGE_MAP[$notification_type]}"
    else
        # 未知类型，使用原始消息
        notify_message="${original_message:-Claude 通知}"
    fi

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
```

**Step 2: 设置脚本可执行权限**

```bash
chmod +x scripts/notification-hook.sh
```

**Step 3: 测试脚本基本功能**

```bash
# 测试 permission_prompt
echo '{"notification_type":"permission_prompt","message":"test"}' | \
  ./scripts/notification-hook.sh

# 预期结果: 显示通知 "Claude 需要你的许可"
```

**Step 4: 验证所有消息类型**

```bash
for type in permission_prompt idle_prompt task_complete task_failed; do
    echo "{\"notification_type\":\"$type\",\"message\":\"test\"}" | \
      ./scripts/notification-hook.sh
    sleep 1
done
```

**Step 5: 提交**

```bash
git add scripts/notification-hook.sh
git commit -m "$(cat <<'EOF'
feat: add notification-hook.sh script

- 创建 Notification Hook 处理脚本
- 实现 notification_type 到中文消息的映射
- 支持 permission_prompt, idle_prompt, task_complete, task_failed
- 未知类型回退到原始 message

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 更新 hooks.json 配置

**Files:**
- Modify: `hooks/hooks.json`

**Step 1: 添加 Notification hook 配置**

将 `hooks/hooks.json` 的内容更新为：

```json
{
  "hooks": {},
  "Notification": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/notification-hook.sh"
    }]
  }]
}
```

**Step 2: 验证 JSON 格式**

```bash
jq '.' hooks/hooks.json
```

预期: 输出格式化的 JSON，无语法错误

**Step 3: 提交**

```bash
git add hooks/hooks.json
git commit -m "$(cat <<'EOF'
feat: add Notification hook configuration

- 配置 Notification 事件监听
- 使用 notification-hook.sh 处理所有通知类型
- matcher 为空字符串匹配所有通知

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 创建技术文档

**Files:**
- Create: `docs/notification-hook.md`

**Step 1: 编写技术文档**

```markdown
# Notification Hook 技术文档

## 概述

Notification Hook 用于监听 Claude Code 的 Notification 事件，并通过 macOS 的 `terminal-notifier` 显示中文系统通知。

## Notification 事件规范

### 事件结构

Claude Code 通过 stdin 传递以下 JSON 数据：

\`\`\`json
{
  "notification_type": "permission_prompt",
  "message": "原始消息"
}
\`\`\`

### notification_type 枚举

| 类型 | 触发时机 | 通知消息 |
|---|---|---|
| `permission_prompt` | 权限对话框出现时 | Claude 需要你的许可 |
| `idle_prompt` | Claude 等待用户输入时 | Claude 等待你的安排 |
| `task_complete` | 任务完成时 | Claude 任务完成 |
| `task_failed` | 任务失败时 | Claude 执行任务失败 |

## 实现设计

### 脚本位置

\`\`\`
scripts/notification-hook.sh
\`\`\`

### 消息映射逻辑

1. 脚本从 stdin 读取 JSON
2. 解析 `notification_type` 字段
3. 根据预定义映射表获取中文消息
4. 调用 `terminal-notifier` 显示通知

### 错误处理

| 场景 | 处理方式 |
|---|---|
| JSON 解析失败 | 忽略，静默退出 |
| terminal-notifier 未安装 | 输出错误到 stderr，静默退出 |
| 未知的 notification_type | 使用原始 message 内容 |

## 配置说明

### hooks.json 配置

\`\`\`json
{
  "Notification": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/notification-hook.sh"
    }]
  }]
}
\`\`\`

- `matcher`: 空字符串匹配所有通知类型
- `command`: 使用 `${CLAUDE_PLUGIN_ROOT}` 引用插件内路径

## 依赖项

### terminal-notifier

macOS 系统通知工具，需要预先安装。

**安装方式:**

\`\`\`bash
brew install terminal-notifier
\`\`\`

**验证安装:**

\`\`\`bash
which terminal-notifier
\`\`\`

## 调试指南

### 手动测试

\`\`\`bash
# 测试特定通知类型
echo '{"notification_type":"permission_prompt","message":"test"}' | \
  ./scripts/notification-hook.sh

# 测试所有类型
for type in permission_prompt idle_prompt task_complete task_failed; do
    echo "{\"notification_type\":\"$type\",\"message\":\"test\"}" | \
      ./scripts/notification-hook.sh
    sleep 1
done
\`\`\`

### 查看日志

如果通知未显示，检查：

1. terminal-notifier 是否安装: `which terminal-notifier`
2. 脚本是否有执行权限: `ls -l scripts/notification-hook.sh`
3. hooks.json 格式是否正确: `jq '.' hooks/hooks.json`

### Claude Code 调试模式

\`\`\`bash
claude --debug
\`\`\`

查看 Hook 触发日志。

## 参考

- [Claude Code Hooks 文档](https://code.claude.com/docs/zh-CN/hooks)
- [terminal-notifier GitHub](https://github.com/julienXX/terminal-notifier)
```

**Step 2: 提交**

```bash
git add docs/notification-hook.md
git commit -m "$(cat <<'EOF'
docs: add Notification Hook technical documentation

- 记录 Notification 事件规范和 notification_type 枚举
- 说明实现设计和消息映射逻辑
- 提供配置说明和调试指南

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 更新 CLAUDE.md 引用

**Files:**
- Modify: `CLAUDE.md`

**Step 1: 添加技术文档引用**

在 `CLAUDE.md` 中找到参考文档部分，添加：

```markdown
## 参考资源

- [Claude Code Plugins 文档](https://code.claude.com/docs/zh-CN/plugins-reference)
- [Claude Code Hooks 文档](https://code.claude.com/docs/zh-CN/hooks)
- [Claude Code Statusline 文档](https://code.claude.com/docs/zh-CN/statusline)
- [PLUGIN_REFERENCE.md](PLUGIN_REFERENCE.md) - 本地插件开发参考
- [HOOKS_REFERENCE.md](HOOKS_REFERENCE.md) - 本地Hooks开发参考
- [STATUSLINE_REFERENCE.md](STATUSLINE_REFERENCE.md) - 本地Statusline开发参考
- [notification-hook.md](docs/notification-hook.md) - Notification Hook 技术文档
```

**Step 2: 提交**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: reference notification-hook.md in CLAUDE.md

- 添加 Notification Hook 技术文档链接
- 更新参考资源部分

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 集成测试

**Files:**
- Test: 验证 Hook 功能

**Step 1: 验证 Hook 已配置**

```bash
jq '.Notification' hooks/hooks.json
```

预期: 输出 Notification hook 配置

**Step 2: 测试 terminal-notifier 可用性**

```bash
terminal-notifier -help
```

预期: 显示帮助信息

**Step 3: 端到端测试**

启动 Claude Code 会话，触发各种通知：
1. 执行需要权限的操作（触发 permission_prompt）
2. 等待任务完成（触发 task_complete）

**Step 4: 最终提交**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
test: complete Notification Hook implementation

- 验证所有 notification_type 消息映射
- 确认 terminal-notifier 集成正常工作
- 完成 Notification Hook 实现

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 生效范围确认

实现完成后，询问用户组件的生效范围：

```
Notification Hook 开发完成。请选择生效范围：
1. 本项目生效（添加到 .claude/settings.json）
2. 用户级别生效（添加到 ~/.claude/settings.json）
3. 不生效（保留源码，不安装）
```
