# Session Management 重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 session-history 重命名为 session-management，并新增 SessionStart 智能提示功能

**Architecture:** 保持现有脚本和命令结构，重命名 skill 目录，新增最近总结检测脚本，修改 SessionStart hook 调用新脚本

**Tech Stack:** Node.js, Claude Code Hooks

---

### Task 1: 创建最近总结检测脚本

**Files:**
- Create: `scripts/session-check-recent.js`

**Step 1: 创建检测脚本**

```javascript
#!/usr/bin/env node
/**
 * session-check-recent.js - 检测最近生成的会话总结
 *
 * 用法:
 *   node session-check-recent.js [--window-minutes <n>]
 *
 * 输出: 如果检测到最近的总结，输出提示信息到 stdout
 */

const fs = require('fs');
const path = require('path');

// 配置
const HISTORY_DIR = path.join(process.cwd(), '.session-history');
const DEFAULT_WINDOW_MINUTES = 5;

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  let windowMinutes = DEFAULT_WINDOW_MINUTES;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--window-minutes' && args[i + 1]) {
      windowMinutes = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { windowMinutes };
}

/**
 * 从 markdown 文件提取 YAML frontmatter
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // 移除引号
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

/**
 * 检查最近的总结
 */
function checkRecentSummaries(windowMinutes) {
  if (!fs.existsSync(HISTORY_DIR)) {
    return null;
  }

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: f,
      path: path.join(HISTORY_DIR, f),
      mtime: fs.statSync(path.join(HISTORY_DIR, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  for (const file of files) {
    const ageMs = now - file.mtime.getTime();

    if (ageMs <= windowMs) {
      const content = fs.readFileSync(file.path, 'utf-8');
      const frontmatter = extractFrontmatter(content);

      const ageMinutes = Math.floor(ageMs / 60000);
      const ageText = ageMinutes === 0 ? '刚刚' : `${ageMinutes}分钟前`;

      return {
        sessionId: frontmatter.session_id || file.name.replace('.md', ''),
        summary: frontmatter.summary || '无摘要',
        ageText,
        ageMinutes
      };
    }
  }

  return null;
}

/**
 * 格式化输出
 */
function formatOutput(result) {
  const lines = [
    '',
    '========================================',
    `检测到最近的会话总结 (${result.ageText}):`,
    `  会话ID: ${result.sessionId}`,
    `  摘要: ${result.summary}`,
    '',
    '是否加载？执行: /load ' + result.sessionId,
    '========================================',
    ''
  ];

  return lines.join('\n');
}

// 主入口
function main() {
  const { windowMinutes } = parseArgs();
  const result = checkRecentSummaries(windowMinutes);

  if (result) {
    console.log(formatOutput(result));
  }
}

main();
```

**Step 2: 测试脚本**

```bash
# 先手动创建一个测试总结（如果不存在）
node E:/ccsaffold/scripts/session-summarize.js ${SESSION_ID}

# 测试检测脚本
node E:/ccsaffold/scripts/session-check-recent.js
```

预期输出：如果最近5分钟有总结，输出提示信息

**Step 3: 提交**

```bash
git add scripts/session-check-recent.js
git commit -m "feat(session-management): 添加最近总结检测脚本"
```

---

### Task 2: 修改 SessionStart hook

**Files:**
- Modify: `hooks/hooks.json:10-16`

**Step 1: 更新 hooks.json**

将 SessionStart hook 从处理待处理队列改为检测最近总结：

```json
{
  "hooks": {
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js ${SESSION_ID} &"
      }]
    }],
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js --process-pending"
      }]
    }, {
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/session-check-recent.js"
      }]
    }],
    "Notification": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/notification-hook.sh"
      }]
    }]
  }
}
```

**Step 2: 验证 JSON 格式**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('hooks/hooks.json', 'utf8')))"
```

预期输出：JSON 对象被正确解析

**Step 3: 提交**

```bash
git add hooks/hooks.json
git commit -m "feat(session-management): SessionStart hook 添加最近总结检测"
```

---

### Task 3: 重命名 skill 目录

**Files:**
- Move: `skills/session-history/` → `skills/session-management/`

**Step 1: 重命名目录**

```bash
mv skills/session-history skills/session-management
```

**Step 2: 更新 SKILL.md 内容**

修改 `skills/session-management/SKILL.md`：

- 第2行：`name: session-history` → `name: session-management`
- 第3行：`description: 会话历史记录管理` → `description: 会话记录管理，支持总结、搜索、加载和智能恢复`
- 第26行：`# Session History - 会话历史记录` → `# Session Management - 会话记录管理`
- 添加触发词：`总结`、`会话恢复`

**Step 3: 提交**

```bash
git add skills/session-management/
git add -A skills/session-history/  # 删除旧目录
git commit -m "refactor: 重命名 session-history 为 session-management"
```

---

### Task 4: 更新命令文件路径引用

**Files:**
- Modify: `commands/load.md`
- Modify: `commands/search.md`
- Modify: `commands/summarize.md`

**Step 1: 检查路径引用**

当前命令文件中使用了硬编码路径 `E:/ccsaffold/scripts/...`，需要保持不变（因为这些是给 Claude 执行的具体命令）。

**Step 2: 更新描述（可选）**

在命令文件中添加说明，表明这是 session-management 的一部分。

**Step 3: 提交**

```bash
git add commands/
git commit -m "docs: 更新命令文件说明"
```

---

### Task 5: 更新文档

**Files:**
- Move: `docs/session-history.md` → `docs/session-management.md`
- Modify: `CLAUDE.md` - 更新引用

**Step 1: 重命名文档**

```bash
mv docs/session-history.md docs/session-management.md
```

**Step 2: 更新文档内容**

更新 `docs/session-management.md` 标题和描述，添加新功能说明。

**Step 3: 更新 plugin.json keywords**

修改 `.claude-plugin/plugin.json` 第8行：

```json
"keywords": ["toolbox", "development", "testing", "session-management"],
```

**Step 4: 提交**

```bash
git add docs/session-management.md .claude-plugin/plugin.json
git add -A docs/session-history.md
git commit -m "docs: 更新 session-history 文档为 session-management"
```

---

### Task 6: 集成测试

**Files:**
- None (验证操作)

**Step 1: 测试 /summarize 命令**

```bash
# 在 Claude Code 中执行
/summarize
```

预期：生成当前会话的总结文件

**Step 2: 测试最近总结检测**

```bash
node E:/ccsaffold/scripts/session-check-recent.js
```

预期：输出最近总结的提示信息

**Step 3: 测试 SessionStart hook**

启动新的 Claude Code 会话，观察是否显示最近总结提示。

**Step 4: 最终提交（如有修改）**

```bash
git status
# 如有未提交的修改
git add -A
git commit -m "fix: 修复测试中发现的问题"
```

---

## 验收清单

- [ ] `scripts/session-check-recent.js` 创建并正常工作
- [ ] `hooks/hooks.json` 包含新的 SessionStart hook
- [ ] `skills/session-management/` 目录存在，旧目录已删除
- [ ] `/summarize` 命令正常工作
- [ ] SessionStart 能检测最近总结并输出提示
- [ ] 文档已更新

## 回滚方案

如果出现问题，可以：

1. 恢复 `skills/session-history/` 目录
2. 移除 SessionStart hook 中的 `session-check-recent.js` 调用
3. 恢复 `docs/session-history.md`
