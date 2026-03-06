# CCScaffold

> 个人 AI 工具箱 - Claude Code 插件开发和测试项目

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://github.com/your-username/ccscaffold)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 项目简介

CCScaffold 是一个用于开发和测试 Claude Code 插件的项目，提供了一系列实用工具来增强 Claude Code 的功能。主要包括会话管理、通知系统、状态栏显示等功能。

## 功能特性

### 会话管理

- **会话总结**：自动生成会话总结，支持智能恢复上下文
- **历史搜索**：快速搜索历史会话记录
- **云端同步**：加密会话记录并同步到云端 Git 仓库
- **智能恢复**：新会话启动时自动检测并提示加载最近的会话

### 通知系统

- **桌面通知**：支持 Windows、macOS 和 Linux 的原生桌面通知
- **事件钩子**：自动响应 Claude Code 事件

### 状态栏

- **实时显示**：显示会话 ID、模型名称和上下文使用率
- **颜色编码**：根据上下文使用率自动切换颜色（绿色 < 60%、黄色 60-79%、红色 >= 80%）

## 项目结构

```
ccscaffold/
├── .claude-plugin/           # 插件元数据
│   └── plugin.json          # 插件清单
├── commands/                # Slash 命令
│   ├── load.md              # /load - 加载会话历史
│   ├── search.md            # /search - 搜索会话
│   ├── summarize.md         # /summarize - 生成总结
│   ├── push.md              # /push - 推送到云端
│   └── pull.md              # /pull - 从云端拉取
├── skills/                  # 技能
│   └── session-management/  # 会话管理技能
│       └── SKILL.md
├── hooks/                   # 事件钩子
│   └── hooks.json
├── scripts/                 # 辅助脚本
│   ├── session-*.js         # 会话管理脚本
│   ├── notification-*.sh    # 通知脚本
│   └── ccscaffold-statusline.sh  # 状态栏脚本
├── docs/                    # 文档
│   └── plans/               # 设计文档
├── CLAUDE.md                # 项目指令
├── PLUGIN_REFERENCE.md      # 插件开发参考
├── HOOKS_REFERENCE.md       # Hooks 开发参考
└── STATUSLINE_REFERENCE.md  # Statusline 开发参考
```

## 安装

### 前置要求

- Node.js >= 14.0.0
- Claude Code CLI

### 安装插件

```bash
# 安装到用户级别（所有项目可用）
claude plugin install /path/to/ccscaffold --scope user

# 安装到项目级别
claude plugin install /path/to/ccscaffold --scope project
```

## 使用方法

### 会话管理命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/load` | 加载最近会话总结 | `/load 10` |
| `/search` | 搜索历史会话 | `/search hook --top 10` |
| `/summarize` | 生成当前会话总结 | `/summarize` |
| `/push` | 加密并推送到云端 | `/push 添加今天的会话` |
| `/pull` | 从云端拉取并解密 | `/pull` |

### 智能触发

会话管理技能会在以下情况下自动触发：

- 提到"最近"、"上次"、"之前"等时间关键词
- 提到"历史"、"回顾"、"总结"等操作关键词
- 提到"恢复上下文"、"云端同步"等功能

### 云端同步

配置环境变量以避免每次输入加密密码：

```bash
export SESSION_ENCRYPT_PASSWORD="your-password"
```

## 开发指南

### 创建新组件

1. **Skills**: 在 `skills/` 目录下创建子目录，包含 `SKILL.md` 文件
2. **Commands**: 在 `commands/` 目录下创建 `.md` 文件，包含 YAML 前置数据
3. **Hooks**: 更新 `hooks/hooks.json` 配置文件
4. **Scripts**: 在 `scripts/` 目录下添加脚本，注意跨平台兼容性

### 路径规范

始终使用 `${CLAUDE_PLUGIN_ROOT}` 环境变量引用插件内部路径：

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/run.sh"
}
```

### 跨平台兼容性

- 使用跨平台的命令和工具
- 提供平台检测和条件分支逻辑
- 使用 `$OSTYPE` 或 `uname` 命令检测操作系统

## 参考文档

- [PLUGIN_REFERENCE.md](PLUGIN_REFERENCE.md) - 插件开发完整参考
- [HOOKS_REFERENCE.md](HOOKS_REFERENCE.md) - Hooks 开发完整参考
- [STATUSLINE_REFERENCE.md](STATUSLINE_REFERENCE.md) - Statusline 开发完整参考
- [Claude Code Plugins 文档](https://code.claude.com/docs/zh-CN/plugins-reference)
- [Claude Code Hooks 文档](https://code.claude.com/docs/zh-CN/hooks)

## 调试

```bash
# 查看插件加载详情
claude --debug

# 验证插件配置
claude plugin validate
```

## 许可证

MIT License

---

本次对话由 Claude Sonnet 4.6 提供
