# Session History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建会话历史记录功能，支持自动生成总结、加载最近会话、搜索历史修改

**Architecture:** 使用 Node.js 脚本处理 jsonl 数据，Skill 提供用户命令接口，Hook 实现异步自动化处理

**Tech Stack:** Node.js, YAML frontmatter, Claude Code Hooks/Skills

---

## Task 1: 创建目录结构和配置

**Files:**
- Create: `.session-history/.gitkeep`
- Create: `.session-history/pending.json`
- Modify: `.gitignore`

**Step 1: 创建 .session-history 目录**

```bash
mkdir -p .session-history
touch .session-history/.gitkeep
```

**Step 2: 初始化 pending.json**

```bash
cat > .session-history/pending.json << 'EOF'
{
  "pending": []
}
EOF
```

**Step 3: 更新 .gitignore**

在 `.gitignore` 中添加：
```
# Session history (local only)
.session-history/*.md
.session-history/pending.json
```

**Step 4: 验证目录结构**

Run: `ls -la .session-history/`
Expected: 显示 `.gitkeep` 和 `pending.json`

**Step 5: Commit**

```bash
git add .session-history/.gitkeep .gitignore
git commit -m "feat(session-history): 创建目录结构和 gitignore"
```

---

## Task 2: 实现 session-summarize.js 核心逻辑

**Files:**
- Create: `scripts/session-summarize.js`

**Step 1: 创建脚本框架**

```javascript
#!/usr/bin/env node
/**
 * session-summarize.js - 从 jsonl 生成会话总结
 *
 * 用法:
 *   node session-summarize.js <session_id>           # 处理单个会话
 *   node session-summarize.js --process-pending      # 处理待处理队列
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 配置
const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
const HISTORY_DIR = path.join(process.cwd(), '.session-history');
const PENDING_FILE = path.join(HISTORY_DIR, 'pending.json');

// 解析命令行参数
const args = process.argv.slice(2);
const sessionId = args.find(arg => !arg.startsWith('--'));
const processPending = args.includes('--process-pending');

// TODO: 实现主逻辑
console.log('Session Summarize - Ready');
```

**Step 2: 实现 jsonl 解析函数**

```javascript
/**
 * 解析 jsonl 文件，提取核心内容
 * @param {string} jsonlPath - jsonl 文件路径
 * @returns {Object} 提取的内容
 */
async function parseJsonl(jsonlPath) {
  const userQuestions = [];
  const llmResponses = [];
  const modifiedFiles = [];

  const fileStream = fs.createReadStream(jsonlPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const record = JSON.parse(line);

      // 提取用户问题
      if (record.type === 'user' && !record.isMeta) {
        const content = record.message?.content;
        if (typeof content === 'string' && !content.includes('<command-name>')) {
          userQuestions.push(content);
        }
      }

      // 提取 LLM 文本回答
      if (record.type === 'assistant' && record.message?.content) {
        for (const block of record.message.content) {
          if (block.type === 'text') {
            llmResponses.push(block.text);
          }
          // 提取修改文件
          if (block.type === 'tool_use' && (block.name === 'Edit' || block.name === 'Write')) {
            modifiedFiles.push({
              path: block.input?.file_path,
              action: block.name.toLowerCase()
            });
          }
        }
      }
    } catch (e) {
      // 跳过解析错误的行
    }
  }

  return { userQuestions, llmResponses, modifiedFiles };
}
```

**Step 3: 实现 YAML frontmatter 生成**

```javascript
/**
 * 生成 YAML frontmatter
 * @param {Object} data - 会话数据
 * @returns {string} YAML 格式的 frontmatter
 */
function generateFrontmatter(data) {
  const { sessionId, userQuestions, modifiedFiles } = data;

  // 从用户问题提取关键词（简单实现：取前5个单词）
  const keywords = [];
  if (userQuestions.length > 0) {
    const words = userQuestions[0].match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
    keywords.push(...words.slice(0, 5).map(w => w.toLowerCase()));
  }

  // 生成简短摘要（取第一个用户问题的前50字）
  const summary = userQuestions.length > 0
    ? userQuestions[0].substring(0, 50) + (userQuestions[0].length > 50 ? '...' : '')
    : '无摘要';

  return `---
session_id: ${sessionId}
date: ${new Date().toISOString()}
project: ${path.basename(process.cwd())}
summary: "${summary.replace(/"/g, '\\"')}"
keywords: ${JSON.stringify(keywords)}
user_questions:
${userQuestions.map(q => `  - "${q.substring(0, 200).replace(/"/g, '\\"')}${q.length > 200 ? '...' : ''}"`).join('\n')}
modified_files:
${modifiedFiles.map(f => `  - path: ${f.path}\n    action: ${f.action}`).join('\n')}
completion_status: completed
---`;
}
```

**Step 4: 实现主处理函数**

```javascript
/**
 * 处理单个会话，生成总结文件
 * @param {string} sessionId - 会话 ID
 */
async function processSession(sessionId) {
  // 查找 jsonl 文件
  const projectsDir = path.join(CLAUDE_DIR, 'projects');
  let jsonlPath = null;

  // 遍历项目目录查找 session_id.jsonl
  const projectDirs = fs.readdirSync(projectsDir);
  for (const projectDir of projectDirs) {
    const candidatePath = path.join(projectsDir, projectDir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidatePath)) {
      jsonlPath = candidatePath;
      break;
    }
  }

  if (!jsonlPath) {
    console.error(`找不到会话 ${sessionId} 的 jsonl 文件`);
    return false;
  }

  console.log(`处理会话: ${sessionId}`);

  // 解析 jsonl
  const { userQuestions, llmResponses, modifiedFiles } = await parseJsonl(jsonlPath);

  // 生成总结内容
  const frontmatter = generateFrontmatter({ sessionId, userQuestions, modifiedFiles });
  const content = `${frontmatter}

## 用户提问
${userQuestions.map(q => q).join('\n\n')}

## LLM 回答
${llmResponses.map(r => r).join('\n\n')}
`;

  // 写入总结文件
  const outputPath = path.join(HISTORY_DIR, `${sessionId}.md`);
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`总结已保存: ${outputPath}`);

  return true;
}
```

**Step 5: 实现 pending 队列处理**

```javascript
/**
 * 处理待处理队列
 */
async function processPendingQueue() {
  if (!fs.existsSync(PENDING_FILE)) {
    console.log('没有待处理的会话');
    return;
  }

  const pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
  const stillPending = [];

  for (const item of pending.pending) {
    const success = await processSession(item.session_id);
    if (!success) {
      stillPending.push(item);
    }
  }

  // 更新 pending.json
  fs.writeFileSync(PENDING_FILE, JSON.stringify({ pending: stillPending }, null, 2));
  console.log(`处理完成，剩余待处理: ${stillPending.length}`);
}

/**
 * 添加会话到待处理队列
 */
function addToPending(sessionId) {
  let pending = { pending: [] };
  if (fs.existsSync(PENDING_FILE)) {
    pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
  }
  pending.pending.push({
    session_id: sessionId,
    timestamp: new Date().toISOString()
  });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
}
```

**Step 6: 实现主入口**

```javascript
// 主入口
async function main() {
  // 确保目录存在
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  if (processPending) {
    await processPendingQueue();
  } else if (sessionId) {
    await processSession(sessionId);
  } else {
    console.log('用法: node session-summarize.js <session_id> | --process-pending');
    process.exit(1);
  }
}

main().catch(console.error);
```

**Step 7: 手动测试**

Run: `node scripts/session-summarize.js --process-pending`
Expected: 显示处理结果或"没有待处理的会话"

**Step 8: Commit**

```bash
git add scripts/session-summarize.js
git commit -m "feat(session-history): 实现 session-summarize.js 核心脚本"
```

---

## Task 3: 实现 session-load.js

**Files:**
- Create: `scripts/session-load.js`

**Step 1: 创建脚本框架**

```javascript
#!/usr/bin/env node
/**
 * session-load.js - 加载最近 x 次会话总结
 *
 * 用法:
 *   node session-load.js [count]           # 加载最近 count 次总结
 *   node session-load.js [count] --headers-only  # 仅加载 YAML 表头
 */

const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(process.cwd(), '.session-history');

// 解析参数
const args = process.argv.slice(2);
const headersOnly = args.includes('--headers-only');
const countArg = args.find(arg => !arg.startsWith('--'));
const count = parseInt(countArg) || 5;
```

**Step 2: 实现获取最近文件列表**

```javascript
/**
 * 获取最近的会话总结文件
 * @param {number} count - 数量
 * @returns {string[]} 文件路径列表
 */
function getRecentSummaries(count) {
  if (!fs.existsSync(HISTORY_DIR)) {
    return [];
  }

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: f,
      path: path.join(HISTORY_DIR, f),
      mtime: fs.statSync(path.join(HISTORY_DIR, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, count);

  return files.map(f => f.path);
}
```

**Step 3: 实现 YAML 表头提取**

```javascript
/**
 * 提取 YAML frontmatter
 * @param {string} content - 文件内容
 * @returns {Object} YAML 数据
 */
function extractYaml(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yamlText = match[1];
  const data = {};

  // 简单解析 YAML（不引入依赖）
  yamlText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // 解析数组
    if (value.startsWith('[')) {
      value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
    }
    // 解析字符串
    else if (value.startsWith('"')) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  });

  return data;
}
```

**Step 4: 实现主加载逻辑**

```javascript
/**
 * 加载会话总结
 */
function loadSummaries(count, headersOnly) {
  const files = getRecentSummaries(count);

  if (files.length === 0) {
    console.log('没有找到会话历史记录');
    return;
  }

  console.log(`找到 ${files.length} 个会话记录:\n`);

  files.forEach((filePath, index) => {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (headersOnly) {
      const yaml = extractYaml(content);
      if (yaml) {
        console.log(`--- 会话 ${index + 1} ---`);
        console.log(`ID: ${yaml.session_id}`);
        console.log(`日期: ${yaml.date}`);
        console.log(`摘要: ${yaml.summary}`);
        console.log(`关键词: ${Array.isArray(yaml.keywords) ? yaml.keywords.join(', ') : yaml.keywords}`);
        console.log(`修改文件: ${yaml.modified_files || '无'}`);
        console.log('');
      }
    } else {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`会话 ${index + 1}: ${path.basename(filePath)}`);
      console.log('='.repeat(50));
      console.log(content);
    }
  });
}

// 执行
loadSummaries(count, headersOnly);
```

**Step 5: 测试加载功能**

Run: `node scripts/session-load.js 3 --headers-only`
Expected: 显示最近 3 个会话的 YAML 表头

**Step 6: Commit**

```bash
git add scripts/session-load.js
git commit -m "feat(session-history): 实现 session-load.js 加载脚本"
```

---

## Task 4: 实现 session-search.js

**Files:**
- Create: `scripts/session-search.js`

**Step 1: 创建脚本框架**

```javascript
#!/usr/bin/env node
/**
 * session-search.js - 搜索会话历史
 *
 * 用法:
 *   node session-search.js <keyword> [--top 5]
 */

const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(process.cwd(), '.session-history');

// 解析参数
const args = process.argv.slice(2);
const topIndex = args.indexOf('--top');
const top = topIndex !== -1 ? parseInt(args[topIndex + 1]) || 5 : 5;
const keyword = args.find(arg => !arg.startsWith('--') && arg !== '--top' && args[args.indexOf(arg) - 1] !== '--top');

if (!keyword) {
  console.log('用法: node session-search.js <keyword> [--top 5]');
  process.exit(1);
}
```

**Step 2: 实现搜索逻辑**

```javascript
/**
 * 计算关键词匹配得分
 * @param {Object} yaml - YAML 数据
 * @param {string} keyword - 搜索关键词
 * @returns {number} 匹配得分
 */
function calculateScore(yaml, keyword) {
  const kw = keyword.toLowerCase();
  let score = 0;

  // 摘要匹配（权重最高）
  if (yaml.summary && yaml.summary.toLowerCase().includes(kw)) {
    score += 10;
  }

  // 关键词匹配
  if (Array.isArray(yaml.keywords)) {
    yaml.keywords.forEach(k => {
      if (k.toLowerCase().includes(kw)) {
        score += 5;
      }
    });
  }

  // 用户问题匹配
  if (Array.isArray(yaml.user_questions)) {
    yaml.user_questions.forEach(q => {
      if (q.toLowerCase().includes(kw)) {
        score += 3;
      }
    });
  }

  return score;
}

/**
 * 提取 YAML frontmatter（复用）
 */
function extractYaml(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yamlText = match[1];
  const data = {};

  yamlText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    if (value.startsWith('[')) {
      // 处理多行数组
      if (!value.endsWith(']')) {
        // 简单处理：取第一行
        value = [value.substring(1).replace(/"/g, '').trim()];
      } else {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
      }
    } else if (value.startsWith('"')) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  });

  return data;
}
```

**Step 3: 实现主搜索函数**

```javascript
/**
 * 搜索会话历史
 */
function searchSessions(keyword, top) {
  if (!fs.existsSync(HISTORY_DIR)) {
    console.log('没有找到会话历史目录');
    return;
  }

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(HISTORY_DIR, f));

  const results = [];

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const yaml = extractYaml(content);

    if (yaml) {
      const score = calculateScore(yaml, keyword);
      if (score > 0) {
        results.push({
          file: path.basename(filePath),
          path: filePath,
          score,
          yaml
        });
      }
    }
  });

  // 按得分排序，取 top
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, top);

  if (topResults.length === 0) {
    console.log(`未找到包含 "${keyword}" 的会话记录`);
    return;
  }

  console.log(`找到 ${results.length} 个匹配，显示前 ${topResults.length} 个:\n`);

  topResults.forEach((result, index) => {
    console.log(`--- 匹配 ${index + 1} (得分: ${result.score}) ---`);
    console.log(`文件: ${result.file}`);
    console.log(`会话ID: ${result.yaml.session_id}`);
    console.log(`日期: ${result.yaml.date}`);
    console.log(`摘要: ${result.yaml.summary}`);
    console.log(`关键词: ${Array.isArray(result.yaml.keywords) ? result.yaml.keywords.join(', ') : result.yaml.keywords}`);
    console.log('');
  });
}

// 执行
searchSessions(keyword, top);
```

**Step 4: 测试搜索功能**

Run: `node scripts/session-search.js hook --top 3`
Expected: 显示匹配 "hook" 的前 3 个会话

**Step 5: Commit**

```bash
git add scripts/session-search.js
git commit -m "feat(session-history): 实现 session-search.js 搜索脚本"
```

---

## Task 5: 创建 session-history Skill

**Files:**
- Create: `skills/session-history/SKILL.md`

**Step 1: 创建 Skill 目录**

```bash
mkdir -p skills/session-history
```

**Step 2: 创建 SKILL.md**

```markdown
---
description: 会话历史记录管理，支持加载、搜索和生成会话总结
triggers:
  - /load
  - /search
  - /summarize
---

# Session History - 会话历史记录

管理 Claude Code 会话的历史记录，帮助恢复上下文和查找历史修改。

## 命令

### /load [count]

加载最近 count 次会话总结（默认 5 次）。

**用法示例：**
- `/load` - 加载最近 5 次会话
- `/load 10` - 加载最近 10 次会话
- `/load 3 --headers-only` - 仅加载表头

**执行：**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-load.js <count>
```

### /search <keyword>

搜索会话历史，返回最匹配的 5 个会话表头。

**用法示例：**
- `/search hook` - 搜索包含 "hook" 的会话
- `/search 修复bug --top 10` - 搜索包含 "修复bug" 的会话，返回前 10 个

**执行：**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-search.js <keyword> --top <n>
```

### /summarize

手动生成或更新当前会话的总结。

**用法示例：**
- `/summarize` - 生成当前会话总结

**执行：**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/session-summarize.js ${SESSION_ID}
```

## 工作流程

1. **会话结束**：自动后台生成总结（异步）
2. **会话开始**：补充处理失败的总结
3. **需要恢复上下文**：使用 `/load` 加载最近会话
4. **查找历史修改**：使用 `/search` 搜索关键词

## 文件位置

- 总结文件：`.session-history/{session_id}.md`
- 待处理队列：`.session-history/pending.json`
- 原始数据：`~/.claude/projects/{project}/{session_id}.jsonl`
```

**Step 3: Commit**

```bash
git add skills/session-history/SKILL.md
git commit -m "feat(session-history): 创建 session-history Skill"
```

---

## Task 6: 配置 Hooks

**Files:**
- Modify: `hooks/hooks.json`

**Step 1: 读取现有配置**

先查看现有 hooks.json 内容，确保不覆盖现有配置。

**Step 2: 更新 hooks.json**

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
    }]
  },
  "Notification": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/notification-hook.sh"
    }]
  }]
}
```

**Step 3: 验证 JSON 格式**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('hooks/hooks.json')))"`
Expected: 输出解析后的 JSON 对象

**Step 4: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat(session-history): 配置 SessionEnd/SessionStart hooks"
```

---

## Task 7: 集成测试

**Step 1: 测试完整流程**

```bash
# 1. 手动触发总结
node scripts/session-summarize.js <某个session_id>

# 2. 检查生成的文件
ls -la .session-history/*.md

# 3. 测试加载
node scripts/session-load.js 5 --headers-only

# 4. 测试搜索
node scripts/session-search.js session
```

**Step 2: 验证 hook 触发**

在 Claude Code 中：
1. 结束当前会话，检查是否生成总结
2. 启动新会话，检查是否处理 pending 队列

**Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat(session-history): 完成会话历史功能实现"
```

---

## 验收清单

- [ ] `.session-history/` 目录创建完成
- [ ] `session-summarize.js` 能正确解析 jsonl 并生成总结
- [ ] `session-load.js` 能加载最近 x 次总结
- [ ] `session-search.js` 能搜索并返回匹配结果
- [ ] Skill 文档完整，命令说明清晰
- [ ] Hooks 配置正确，异步处理正常
- [ ] 所有脚本跨平台兼容（Windows Git Bash）
