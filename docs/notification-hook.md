# Notification Hook 技术文档

## 概述

Notification Hook 用于监听 Claude Code 的 Notification 事件，并通过 macOS 的 `terminal-notifier` 显示中文系统通知。

## Notification 事件规范

### 事件结构

Claude Code 通过 stdin 传递以下 JSON 数据：

```json
{
  "notification_type": "permission_prompt",
  "message": "原始消息"
}
```

### notification_type 枚举

| 类型 | 触发时机 | 通知消息 |
|---|---|---|
| `permission_prompt` | 权限对话框出现时 | Claude 需要你的许可 |
| `idle_prompt` | Claude 等待用户输入时 | Claude 等待你的安排 |
| `task_complete` | 任务完成时 | Claude 任务完成 |
| `task_failed` | 任务失败时 | Claude 执行任务失败 |

## 实现设计

### 脚本位置

```
scripts/notification-hook.sh
```

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

```json
{
  "Notification": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/notification-hook.sh"
    }]
  }]
}
```

- `matcher`: 空字符串匹配所有通知类型
- `command`: 使用 `${CLAUDE_PLUGIN_ROOT}` 引用插件内路径

## 依赖项

### terminal-notifier

macOS 系统通知工具，需要预先安装。

**安装方式:**

```bash
brew install terminal-notifier
```

**验证安装:**

```bash
which terminal-notifier
```

## 调试指南

### 手动测试

```bash
# 测试特定通知类型
echo '{"notification_type":"permission_prompt","message":"test"}' | \
  ./scripts/notification-hook.sh

# 测试所有类型
for type in permission_prompt idle_prompt task_complete task_failed; do
    echo "{\"notification_type\":\"$type\",\"message\":\"test\"}" | \
      ./scripts/notification-hook.sh
    sleep 1
done
```

### 查看日志

如果通知未显示，检查：

1. terminal-notifier 是否安装: `which terminal-notifier`
2. 脚本是否有执行权限: `ls -l scripts/notification-hook.sh`
3. hooks.json 格式是否正确: `jq '.' hooks/hooks.json`

### Claude Code 调试模式

```bash
claude --debug
```

查看 Hook 触发日志。

## 参考

- [Claude Code Hooks 文档](https://code.claude.com/docs/zh-CN/hooks)
- [terminal-notifier GitHub](https://github.com/julienXX/terminal-notifier)
