# Claude Code Hooks 开发参考

本文档提供了Claude Code Hooks系统的完整技术规范。更多详情请访问：https://code.claude.com/docs/zh-CN/hooks

## Hooks 概述

**Hooks** 是用户定义的 shell 命令、HTTP 端点或 LLM 提示，在 Claude Code 生命周期中的特定点自动执行。

## Hook 生命周期

Hooks 在 Claude Code 会话期间的特定点触发。当事件触发且匹配器匹配时，Claude Code 会将关于该事件的 JSON 上下文传递给您的 hook 处理程序。

### 触发时机

| Event | 触发时机 |
| --- | --- |
| `SessionStart` | 会话开始或恢复时 |
| `UserPromptSubmit` | 提交提示时，Claude处理之前 |
| `PreToolUse` | 工具调用执行之前（可阻止）|
| `PermissionRequest` | 权限对话框出现时 |
| `PostToolUse` | 工具调用成功之后 |
| `PostToolUseFailure` | 工具调用失败之后 |
| `Notification` | Claude Code发送通知时 |
| `SubagentStart` | 子代理启动时 |
| `SubagentStop` | 子代理完成时 |
| `Stop` | Claude完成响应时 |
| `TeammateIdle` | Agent队友即将空闲时 |
| `TaskCompleted` | 任务被标记为已完成时 |
| `ConfigChange` | 会话期间配置文件更改时 |
| `WorktreeCreate` | 通过 `--worktree` 或 `isolation: "worktree"` 创建worktree时 |
| `WorktreeRemove` | Worktree被移除时 |
| `PreCompact` | 上下文压缩之前 |
| `SessionEnd` | 会话终止时 |

## Hook 配置

### 配置位置

Hooks 配置位于：
- `hooks/hooks.json` - 插件根目录
- 或在 `plugin.json` 中内联

### 基本配置格式

```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/process.sh"
    }]
  }]
}
```

## Hook 类型

### 1. Command Hooks

执行 shell 命令或脚本。

```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
      "timeout": 30
    }]
  }]
}
```

**输入**: JSON 通过 stdin 传递
**输出**: 返回决定的 JSON 到 stdout

**退出代码**:
- `0` - 继续（默认）
- `1` - 阻止操作

### 2. Prompt Hooks

使用 LLM 评估提示。

```json
{
  "PreToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "prompt",
      "prompt": "审查此工具调用是否安全。上下文: $ARGUMENTS"
    }]
  }]
}
```

**占位符**: `$ARGUMENTS` 替换为事件的 JSON 上下文

### 3. Agent Hooks

运行具有工具的代理验证器。

```json
{
  "PostToolUse": [{
    "hooks": [{
      "type": "agent",
      "agent": "code-reviewer",
      "description": "审查代码更改"
    }]
  }]
}
```

### 4. HTTP Hooks

发送 HTTP 请求到外部端点。

```json
{
  "PostToolUse": [{
    "hooks": [{
      "type": "http",
      "url": "https://api.example.com/hook",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json"
      }
    }]
  }]
}
```

### 5. MCP Tool Hooks

使用 MCP 工具执行验证。

```json
{
  "PostToolUse": [{
    "hooks": [{
      "type": "mcp",
      "server": "my-mcp-server",
      "tool": "validate",
      "arguments": {"path": "$FILE_PATH"}
    }]
  }]
}
```

## 事件架构

### PreToolUse / PostToolUse

```json
{
  "tool": "Write",
  "input": {
    "file_path": "/path/to/file",
    "content": "file content"
  },
  "result": {
    "success": true
  }
}
```

### UserPromptSubmit

```json
{
  "prompt": "用户输入的内容",
  "sessionId": "session-id"
}
```

### SessionStart / SessionEnd

```json
{
  "sessionId": "session-id",
  "workingDirectory": "/path/to/project"
}
```

### Notification

```json
{
  "type": "info",
  "message": "通知内容"
}
```

## Matcher 语法

使用正则表达式匹配工具名称：

```json
{
  "matcher": "Write|Edit",           // 匹配 Write 或 Edit
  "matcher": ".*",                   // 匹配所有工具
  "matcher": "^Read.*File$",         // 匹配以 Read 开头、File 结尾的工具
}
```

## 决定控制

Hooks 可以返回决定来控制行为：

```json
{
  "decision": "block",
  "reason": "不安全的操作被阻止"
}
```

**决定类型**:
- `"continue"` - 继续执行（默认）
- `"block"` - 阻止操作

## 路径规范

始终使用 `${CLAUDE_PLUGIN_ROOT}` 引用插件内路径：

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
}
```

## 调试 Hooks

### 验证脚本可执行

```bash
chmod +x ./scripts/your-script.sh
```

### 验证 Shebang

脚本第一行应该是：
```bash
#!/bin/bash
# 或
#!/usr/bin/env bash
```

### 手动测试

```bash
# 直接运行脚本测试
./scripts/your-script.sh

# 使用调试模式
claude --debug
```

### 常见问题

| 问题 | 解决方案 |
| --- | --- |
| Hook脚本未执行 | 检查脚本是否可执行 (`chmod +x`) |
| Hook未在预期事件触发 | 验证事件名称大小写正确 (`PostToolUse`) |
| 路径错误 | 使用 `${CLAUDE_PLUGIN_ROOT}` 变量 |
| 匹配器不匹配 | 检查正则表达式语法 |

## 高级功能

### 异步 Hooks

```json
{
  "hooks": [{
    "type": "command",
    "async": true,
    "command": "${CLAUDE_PLUGIN_ROOT}/scripts/async-process.sh"
  }]
}
```

### 条件 Hooks

```json
{
  "PreToolUse": [{
    "matcher": ".*",
    "when": {
      "env": {
        "ENABLE_HOOK": "true"
      }
    },
    "hooks": [...]
  }]
}
```

### Hook 链

多个 hooks 按顺序执行：

```json
{
  "PostToolUse": [{
    "hooks": [
      {"type": "command", "command": "..."},
      {"type": "prompt", "prompt": "..."},
      {"type": "agent", "agent": "reviewer"}
    ]
  }]
}
```

## 完整示例

```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
      "timeout": 30
    },
    {
      "type": "prompt",
      "prompt": "审查此更改: $ARGUMENTS"
    }]
  }],
  "PreToolUse": [{
    "matcher": "Bash",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bash.sh"
    }]
  }]
}
```
