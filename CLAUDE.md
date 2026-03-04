# CCScaffold - 个人AI工具箱

本项目是个人AI工具箱（Claude Code Plugin）的开发仓库。

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
- 缓存文件位于 `/tmp/ccscaffold-statusline-{session_id}.json`

脚本位置: `scripts/ccscaffold-statusline.sh`

**配置方式**:

要启用 statusline，在用户设置 (`~/.claude/settings.json`) 中添加:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/Users/ming/Work/ccscaffold/scripts/ccscaffold-statusline.sh"
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

## 技能使用

开发时可调用以下内置技能：

- `plugin-dev:plugin-structure` - 插件结构指南
- `plugin-dev:skill-development` - 技能开发
- `plugin-dev:agent-development` - 代理开发
- `plugin-dev:hook-development` - Hook开发
- `plugin-dev:mcp-integration` - MCP集成
- `plugin-dev:command-development` - 命令开发
- `plugin-dev:plugin-settings` - 设置管理
