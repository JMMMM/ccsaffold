# CCScaffold - 个人AI工具箱

本项目是个人AI工具箱（Claude Code Plugin）的开发仓库。

## 系统配置

### 基本要求

1. **模型识别**: AI助手必须在每次对话的末尾明确说明自己使用的大模型名称（如：Claude Sonnet 4.6、Claude Opus 4.6、Claude Haiku 4.5等），不要通过读取本地系统配置文件来获取模型信息。

2. **语言要求**: 必须使用中文与用户交流，所有回复、文档、注释都应使用中文。

3. **操作系统**: 本系统运行在 Windows 操作系统上，所有命令和脚本必须考虑 Windows 平台的兼容性。

### 模型信息示例

在每次对话结束时，AI助手应该明确声明：
```
---
本次对话由 Claude Sonnet 4.6 提供
```

## 项目概述

这是一个用于开发和测试Claude Code插件的项目。所有新建组件（commands、agents、skills、hooks）优先在本项目开发，开发完成后询问用户组件的生效范围：

- **本项目生效**: 组件仅在此项目中可用
- **用户级别生效**: 组件在所有项目中可用 (`~/.claude/settings.json`)
- **不生效**: 组件仅用于开发/测试，不实际安装

## 项目结构

```
ccscaffold/
├── .claude-plugin/           # 插件元数据
│   └── plugin.json          # 插件清单
├── commands/                # Slash命令
├── agents/                  # 子代理
├── skills/                  # 技能
│   └── skill-name/
│       └── SKILL.md
├── hooks/                   # 事件钩子
│   └── hooks.json
├── scripts/                 # 辅助脚本
├── CLAUDE.md                # 本文件
├── PLUGIN_REFERENCE.md      # 插件开发参考
├── HOOKS_REFERENCE.md       # Hooks开发参考
└── STATUSLINE_REFERENCE.md  # Statusline开发参考
```

## 开发工作流

### 1. 创建新组件

在开发新组件前，参考以下文档：

- **插件开发**: 参考 [PLUGIN_REFERENCE.md](PLUGIN_REFERENCE.md) 或在线文档 https://code.claude.com/docs/zh-CN/plugins-reference
- **Hooks开发**: 参考 [HOOKS_REFERENCE.md](HOOKS_REFERENCE.md) 或在线文档 https://code.claude.com/docs/zh-CN/hooks
- **Statusline开发**: 参考 [STATUSLINE_REFERENCE.md](STATUSLINE_REFERENCE.md) 或在线文档 https://code.claude.com/docs/zh-CN/statusline

### 2. 组件开发优先级

1. 在本项目 (`ccscaffold`) 中开发组件
2. 测试验证功能正常
3. 询问用户组件生效范围：
   ```
   组件开发完成。请选择生效范围：
   1. 本项目生效（添加到 .claude/settings.json）
   2. 用户级别生效（添加到 ~/.claude/settings.json）
   3. 不生效（保留源码，不安装）
   ```

### 3. 路径规范

在配置文件中始终使用 `${CLAUDE_PLUGIN_ROOT}` 环境变量引用插件内部路径：

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/run.sh"
}
```

### 4. 安装规则

**重要**: 不要将测试文件（test、spec 等）复制到 `.claude` 目录下。仅复制实际可用的组件文件。

### 5. 个人信息保护

**重要**: 项目不得包含用户个人信息，包括但不限于：
- 真实姓名、邮箱地址、电话号码
- 家庭住址、工作单位
- API 密钥、密码、令牌等凭证
- 个人证书、SSH 密钥

**如果项目中包含个人信息**：
1. 必须添加到 `.gitignore` 中
2. 不得提交到 GitHub 或任何远程仓库
3. 使用环境变量或配置文件模板替代（如 `.env.example`）

### 6. 跨平台兼容性

**重要**: 编写脚本时必须考虑跨平台兼容性，确保脚本能在 Windows、macOS 和 Linux 上正常运行。

**通用要求**：
- 优先使用跨平台的命令和工具
- 避免使用特定平台的命令（如 macOS 的 `brew`、Windows 的 `choco`）
- 使用环境变量检测平台：`$OSTYPE` 或 `uname` 命令
- 提供平台检测和条件分支逻辑

**平台检测示例**：
```bash
# 检测操作系统
case "$OSTYPE" in
  linux*)   echo "Linux" ;;
  darwin*)  echo "macOS" ;;
  msys*|cygwin*|win*) echo "Windows" ;;
  *)        echo "Unknown: $OSTYPE" ;;
esac
```

**常见注意事项**：
- 路径分隔符：使用 `/` 或 `${PATH_SEPARATOR}` 变量
- 临时目录：使用 `$TMPDIR` 或 `$TEMP` 环境变量
- 命令替换：优先使用 `$(command)` 而非反引号
- 文件操作：使用跨平台的工具或提供平台检测分支

### 7. Node.js 调用外部命令的限制

**重要**: 在 Node.js 中调用 claude 命令（或其他 AI 命令行工具）时可能出现兼容性问题。

**问题说明**：
- Node.js 的 `spawn` 或 `exec` 在调用 claude 命令时可能遇到输出缓冲、编码等问题
- 复杂的交互式命令在 Node.js 环境中可能无法正常工作

**解决方案**：
- 优先使用 Shell 脚本（`.sh`）调用 claude 命令
- Shell 脚本直接使用系统调用，兼容性更好
- 如需使用 Node.js，考虑使用子进程的文件描述符传递方式

**示例**：
```bash
# 推荐：使用 Shell 脚本
result=$(claude -p glm-4.5-air "$prompt")

# 避免：Node.js spawn
const claude = spawn('claude', ['-p', 'glm-4.5-air', prompt]);
```

## 开发指南

### 技能（Skills）

当创建新技能时：
1. 在 `skills/` 下创建新目录
2. 创建 `SKILL.md` 文件
3. 添加YAML前置元数据

参考: `plugin-dev:skill-development` skill

### 代理（Agents）

当创建新代理时：
1. 在 `agents/` 下创建 `.md` 文件
2. 添加描述和能力的YAML前置元数据

参考: `plugin-dev:agent-development` skill

### Hooks

当创建新Hook时：
1. 更新 `hooks/hooks.json`
2. 编写对应的处理脚本
3. 使用 `${CLAUDE_PLUGIN_ROOT}` 引用路径

参考: [HOOKS_REFERENCE.md](HOOKS_REFERENCE.md)

### Statusline

当创建Statusline时：
1. 在 `scripts/` 下创建 `.sh` 脚本
2. 脚本通过 stdin 接收 JSON 数据
3. 输出格式化的状态信息

参考: [STATUSLINE_REFERENCE.md](STATUSLINE_REFERENCE.md)

#### CCScaffold Statusline 配置

已配置自定义 statusline 显示:
- 完整 session_id
- 实际使用的模型名
- 带颜色编码的上下文使用百分比

**颜色机制**:
- 绿色 (< 60%): 上下文使用率低于 60%
- 黄色 (60-79%): 上下文使用率 60% 到 79%
- 红色 (>= 80%): 上下文使用率 80% 或更高

**缓存机制**:
- 使用 session_id 隔离缓存
- 当 `used_percentage` 无法识别时，保留上次显示的值
- 无缓存时默认为 `0%`
- 缓存文件位于 `/tmp/ccscaffold-statusline-{session_id}.json`

脚本位置: `scripts/ccscaffold-statusline.sh`

**配置方式**:

要启用 statusline，在用户设置 (`~/.claude/settings.json`) 中添加:

```json
{
  "statusLine": {
    "type": "command",
    "command": "${CLAUDE_PLUGIN_ROOT}/scripts/ccscaffold-statusline.sh"
  }
}
```

**测试**:

运行集成测试:
```bash
./tests/test-statusline.sh
```

**参考文档**:
- [STATUSLINE_REFERENCE.md](STATUSLINE_REFERENCE.md) - Statusline 开发完整参考

### MCP服务器

添加MCP服务器集成：
1. 创建 `.mcp.json` 或在 `plugin.json` 中配置
2. 使用 `${CLAUDE_PLUGIN_ROOT}` 和 `${CLAUDE_PROJECT_ROOT}` 变量

## 调试

使用以下命令调试插件：

```bash
# 查看插件加载详情
claude --debug

# 验证插件配置
claude plugin validate
```

## 参考资源

- [Claude Code Plugins 文档](https://code.claude.com/docs/zh-CN/plugins-reference)
- [Claude Code Hooks 文档](https://code.claude.com/docs/zh-CN/hooks)
- [Claude Code Statusline 文档](https://code.claude.com/docs/zh-CN/statusline)
- [PLUGIN_REFERENCE.md](PLUGIN_REFERENCE.md) - 本地插件开发参考
- [HOOKS_REFERENCE.md](HOOKS_REFERENCE.md) - 本地Hooks开发参考
- [STATUSLINE_REFERENCE.md](STATUSLINE_REFERENCE.md) - 本地Statusline开发参考
- [notification-hook.md](docs/notification-hook.md) - Notification Hook 技术文档

## 会话历史经验总结

根据 `.session-history/` 目录下的会话记录分析，总结出以下开发经验：

### 1. 核心开发经验

**项目配置与规范**
- 在 CLAUDE.md 中明确配置：模型识别（每次对话末尾声明实际模型）、语言要求（必须使用中文）、操作系统说明
- 使用 `${CLAUDE_PLUGIN_ROOT}` 环境变量引用插件内部路径，确保跨平台兼容性

**功能设计方法论**
- 使用 brainstorming skill 先探索需求，确认设计方案后再实现
- 提供多种方案供用户选择（如方案A/B/C），并说明各自的优缺点
- 面向跨平台设计，优先考虑 Windows/macOS/Linux 兼容性

### 2. 技术实现经验

**Session History 功能实现**
- 使用 Node.js 脚本处理 JSON 数据比 Bash 更方便
- 异步处理：SessionEnd 后台生成总结，避免阻塞用户
- 精简提取策略：只保留用户提问、LLM回答、修改文件记录，过滤 tool_use/thinking/progress 等过程数据

**CLI 命令调用**
- Claude Code 不允许嵌套调用 `claude -p` 命令
- 使用管道方式：`node session-summarize.js | bash ai-analyze.sh`
- 使用 `--dangerously-skip-permissions --no-session-persistence --disable-slash-commands` 避免触发钩子

**调试技巧**
- 添加详细日志，输出执行步骤和中间结果
- 使用超时机制避免脚本卡死
- 从 JSON 格式改为纯文本提取，简化解析逻辑

### 3. 问题解决经验

**脚本卡死问题**
- Node.js 调用 claude 命令可能遇到输出缓冲、编码问题
- 解决方案：优先使用 Shell 脚本调用 claude 命令
- 确保进程正确退出，关闭 readline 接口

**数据提取优化**
- 用户问题需要过滤短选项（如单字符 A/B/C）
- 处理多种 content 格式（字符串和数组）
- 从 `<command-args>` 标签中提取真正的用户问题

### 4. Hook 机制经验

**Hook 重复触发问题**
- 当通过 `--plugin-dir` 引用组件时，组件内 `hooks/` 目录下的配置会与项目 `.claude/settings.json` 的 hooks 公用
- 如果在两个地方都配置了相同的 hook，就会触发两次
- 解决方案：避免重复配置，只在其中一个地方配置 hook

**其他 Hook 注意事项**
- SessionEnd hook 触发时机：`/clear` 命令也会触发
- 通过 stdin 传递 session_id，而不是命令行参数

### 5. 文档和代码组织

- 设计文档先保存在 `docs/plans/` 目录
- 实现计划使用 writing-plans skill 创建
- 使用 git commit 记录每个任务完成状态

## 技能使用

开发时可调用以下内置技能：

- `plugin-dev:plugin-structure` - 插件结构指南
- `plugin-dev:skill-development` - 技能开发
- `plugin-dev:agent-development` - 代理开发
- `plugin-dev:hook-development` - Hook开发
- `plugin-dev:mcp-integration` - MCP集成
- `plugin-dev:command-development` - 命令开发
- `plugin-dev:plugin-settings` - 设置管理
