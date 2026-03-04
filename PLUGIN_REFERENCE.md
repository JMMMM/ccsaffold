# Claude Code 插件开发参考

本文档提供了Claude Code插件系统的完整技术规范。更多详情请访问：https://code.claude.com/docs/zh-CN/plugins-reference

## 插件概述

**Plugin** 是一个自包含的组件目录，用于扩展 Claude Code 的自定义功能。

### 插件组件

- **Skills** - `/name` 快捷方式，可被用户或Claude调用
- **Agents** - 专门任务的子代理
- **Hooks** - 事件处理程序，自动响应事件
- **MCP Servers** - 连接外部工具和服务
- **LSP Servers** - 提供代码智能

## 目录结构

```
plugin-name/
├── .claude-plugin/           # 元数据目录
│   └── plugin.json          # 插件清单
├── commands/                # 默认命令位置
├── agents/                  # 默认agent位置
├── skills/                  # Agent Skills
│   └── skill-name/
│       └── SKILL.md
├── hooks/                   # Hook配置
│   └── hooks.json
├── .mcp.json                # MCP server定义
├── .lsp.json                # LSP server配置
└── scripts/                 # 辅助脚本
```

**重要规则**：
- 清单 `plugin.json` 必须在 `.claude-plugin/` 目录中
- 组件目录（commands、agents、skills、hooks）必须在插件根目录，不能嵌套在 `.claude-plugin/` 中

## 插件清单 (plugin.json)

### 必需字段

```json
{
  "name": "plugin-name"
}
```

**命名规范**：
- 使用kebab-case格式（小写加连字符）
- 必须唯一
- 无空格或特殊字符
- 示例: `code-review-assistant`, `test-runner`

### 推荐元数据

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "简要描述插件用途",
  "author": {
    "name": "作者名称",
    "email": "author@example.com"
  },
  "keywords": ["testing", "automation"]
}
```

### 组件路径配置

```json
{
  "name": "plugin-name",
  "commands": "./custom-commands",
  "agents": ["./agents", "./specialized-agents"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

**路径规则**：
- 必须相对于插件根目录
- 必须以 `./` 开头
- 自定义路径补充（不替换）默认目录

## 组件组织

### Skills

**位置**: `skills/` 目录
**格式**: 包含 `SKILL.md` 的目录

```
skills/
├── pdf-processor/
│   ├── SKILL.md
│   ├── reference.md (可选)
│   └── scripts/ (可选)
└── code-reviewer/
    └── SKILL.md
```

**SKILL.md 格式**：
```markdown
---
name: Skill Name
description: 何时使用此技能
version: 1.0.0
---

技能说明和指导...
```

### Commands

**位置**: `commands/` 目录
**格式**: 带有YAML前置数据的Markdown文件

```markdown
---
name: command-name
description: 命令描述
---

命令实现说明...
```

### Agents

**位置**: `agents/` 目录
**格式**: 描述agent功能的Markdown文件

```markdown
---
description: Agent角色和专业能力
capabilities:
  - 特定任务1
  - 特定任务2
---

详细的agent说明...
```

### Hooks

**位置**: `hooks/hooks.json` 或在 `plugin.json` 中内联
**格式**: 定义事件处理程序的JSON配置

```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
    }]
  }]
}
```

**可用事件**：
- `PreToolUse` - 使用工具之前
- `PostToolUse` - 工具成功使用之后
- `PostToolUseFailure` - 工具执行失败之后
- `UserPromptSubmit` - 用户提交提示时
- `Notification` - 发送通知时
- `Stop` - Claude尝试停止时
- `SessionStart` - 会话开始时
- `SessionEnd` - 会话结束时

更多详情请参考 [HOOKS_REFERENCE.md](HOOKS_REFERENCE.md)

### MCP Servers

**位置**: `.mcp.json` 或在 `plugin.json` 中内联

```json
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

## 环境变量

### ${CLAUDE_PLUGIN_ROOT}

包含插件目录的绝对路径。在hooks、MCP servers和脚本中使用：

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/process.sh"
}
```

## 安装范围

| 范围 | 设置文件 | 用例 |
| --- | --- | --- |
| `user` | `~/.claude/settings.json` | 所有项目中可用的个人插件（默认）|
| `project` | `.claude/settings.json` | 通过版本控制共享的团队插件 |
| `local` | `.claude/settings.local.json` | 项目特定插件，gitignored |

## CLI 命令

### 安装插件

```bash
claude plugin install <plugin> [options]

# 选项
-s, --scope <scope>  # 安装范围：user、project 或 local (默认: user)
```

### 卸载插件

```bash
claude plugin uninstall <plugin> [options]
```

### 启用/禁用插件

```bash
claude plugin enable <plugin>
claude plugin disable <plugin>
```

## 常见问题

| 问题 | 原因 | 解决方案 |
| --- | --- | --- |
| Plugin未加载 | 无效的 `plugin.json` | 验证JSON语法 |
| 命令未出现 | 目录结构错误 | 确保 `commands/` 在根目录 |
| Hooks未触发 | 脚本不可执行 | 运行 `chmod +x script.sh` |
| 路径错误 | 使用了绝对路径 | 路径必须相对，以 `./` 开头 |

## 调试

```bash
# 查看插件加载详情
claude --debug

# 验证插件
claude plugin validate
```
