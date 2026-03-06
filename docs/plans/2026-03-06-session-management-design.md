# Session Management 重构设计

## 概述

将 `session-history` 功能重命名为 `session-management`，并新增 SessionStart 智能提示功能。

## 背景

当前 `session-history` 提供会话历史记录的加载、搜索和总结功能。为了更好地表达"管理会话记录"的定位，需要重命名并增强功能。

## 设计方案

### 1. 重命名

将 `session-history` 重命名为 `session-management`：

| 原路径 | 新路径 |
|--------|--------|
| `skills/session-history/` | `skills/session-management/` |
| `docs/session-history.md` | `docs/session-management.md` |

脚本文件保持 `scripts/session-*.js` 命名不变。

### 2. 新增功能：SessionStart 智能提示

#### 工作流程

```
用户执行 /summarize → 生成总结 → 记录时间戳
     ↓
新会话启动 → SessionStart hook → 检查最近5分钟是否有总结
     ↓
如果有 → 输出提示信息，告知用户可用 /load 加载
```

#### 技术实现

**SessionStart hook 逻辑：**
1. 扫描 `.session-history/` 目录中的总结文件
2. 检查每个文件的修改时间
3. 如果最近 N 分钟（默认5分钟）内有总结，输出提示信息

**输出格式：**
```
========================================
检测到最近的会话总结 (2分钟前):
  会话ID: abc123
  摘要: 修复了登录页面的bug...

是否加载？执行: /load abc123
========================================
```

#### 可配置项

- `SESSION_CHECK_WINDOW`: 检测时间窗口（毫秒），默认 5 分钟 = 300000ms

### 3. 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `skills/session-history/SKILL.md` | 重命名 + 更新 | 重命名为 `session-management/SKILL.md`，更新描述 |
| `hooks/hooks.json` | 修改 | 更新 SessionStart hook，添加最近总结检测逻辑 |
| `scripts/session-summarize.js` | 增强 | 添加 `--check-recent` 参数（可选，也可新建独立脚本） |
| `docs/session-history.md` | 重命名 | 重命名为 `docs/session-management.md` |
| `commands/*.md` | 更新 | 更新路径引用（如有硬编码路径） |

### 4. 保持不变的部分

- `/load` 命令：加载会话总结
- `/search` 命令：搜索历史记录
- `/summarize` 命令：手动生成总结
- SessionEnd hook：会话结束时异步生成总结
- 总结文件格式：`.session-history/{session_id}.md`

## 验收标准

1. [ ] `session-history` 已重命名为 `session-management`
2. [ ] `/summarize` 命令正常工作
3. [ ] SessionStart hook 能检测最近5分钟内的总结并输出提示
4. [ ] 现有功能（/load, /search）不受影响
5. [ ] 文档已更新

## 时间线

- 设计完成：2026-03-06
- 预计实现：单次会话内完成
