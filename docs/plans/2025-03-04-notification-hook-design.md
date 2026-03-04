# Notification Hook 设计文档

**日期**: 2025-03-04
**作者**: Claude
**状态**: 已批准

## 1. 概述

本设计描述了 CCScaffold 项目中 Notification Hook 的实现方案。该 Hook 用于监听 Claude Code 的 Notification 事件，并根据不同的 `notification_type` 通过 `terminal-notifier` 显示中文系统通知。

### 1.1 使用场景

- **后台监控**: Claude Code 在后台运行时，通过通知了解状态变化
- **长时间任务**: 执行耗时任务时，切换到其他工作后收到完成通知

## 2. Notification 事件规范

### 2.1 事件结构

Claude Code 通过 stdin 传递以下 JSON 数据：

```json
{
  "notification_type": "permission_prompt",
  "message": "原始消息"
}
```

### 2.2 notification_type 枚举

| 类型 | 说明 |
|---|---|
| `permission_prompt` | 权限对话框出现时 |
| `idle_prompt` | Claude 等待用户输入时 |
| `task_complete` | 任务完成时 |
| `task_failed` | 任务失败时 |

## 3. 架构设计

### 3.1 方案选择

**方案A: 单一脚本集中处理**（已选中）

- 创建一个 `notification-hook.sh` 脚本
- 脚本内部根据 `notification_type` 分发消息
- hooks.json 中配置一个 Notification hook

### 3.2 文件结构

```
ccscaffold/
├── hooks/
│   └── hooks.json           # 更新 Notification hook 配置
├── scripts/
│   └── notification-hook.sh # 新建：通知处理脚本
├── docs/
│   └── notification-hook.md # 新建：技术文档
└── CLAUDE.md                # 更新：引用技术文档
```

## 4. 组件设计

### 4.1 hooks.json 配置

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

### 4.2 消息映射表

| notification_type | 标题 | 消息 |
|---|---|---|
| `permission_prompt` | Claude Code | Claude 需要你的许可 |
| `idle_prompt` | Claude Code | Claude 等待你的安排 |
| `task_complete` | Claude Code | Claude 任务完成 |
| `task_failed` | Claude Code | Claude 执行任务失败 |
| 其他类型 | Claude Code | 使用原始 message |

### 4.3 notification-hook.sh 脚本逻辑

1. 从 stdin 读取 JSON
2. 解析 `notification_type` 字段
3. 匹配消息映射表
4. 调用 `terminal-notifier` 显示通知

```bash
terminal-notifier -title "Claude Code" -message "对应消息"
```

## 5. 数据流

```
Notification事件触发
        ↓
Claude Code 读取 hooks.json
        ↓
执行 notification-hook.sh
        ↓
通过 stdin 接收 JSON
        ↓
解析 notification_type 字段
        ↓
匹配消息映射表
        ↓
调用 terminal-notifier
        ↓
显示系统通知
```

## 6. 错误处理

| 场景 | 处理方式 |
|---|---|
| JSON 解析失败 | 记录错误日志，静默退出 |
| terminal-notifier 未安装 | 记录错误日志，静默退出 |
| 未知的 notification_type | 使用原始 message 内容 |

## 7. 依赖项

- **terminal-notifier**: macOS 系统通知工具
  - 安装: `brew install terminal-notifier`
  - 验证: `which terminal-notifier`

## 8. 测试策略

```bash
# 手动测试脚本
echo '{"notification_type":"permission_prompt","message":"test"}' | \
  ./scripts/notification-hook.sh

# 验证每种类型
for type in permission_prompt idle_prompt task_complete task_failed; do
  echo "{\"notification_type\":\"$type\",\"message\":\"test\"}" | \
    ./scripts/notification-hook.sh
done
```

## 9. 实现计划

下一步将调用 `writing-plans` 技能创建详细的实现步骤。
