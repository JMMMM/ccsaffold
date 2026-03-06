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

// 最小问题长度（过滤短选项如 A/B/C）
const MIN_QUESTION_LENGTH = 10;

// 解析命令行参数
const args = process.argv.slice(2);
const sessionId = args.find(arg => !arg.startsWith('--'));
const processPending = args.includes('--process-pending');

/**
 * 检查是否为有效的用户问题（非短选项）
 * @param {string} content - 用户输入内容
 * @returns {boolean} 是否有效
 */
function isValidQuestion(content) {
  if (!content || typeof content !== 'string') return false;

  // 过滤包含 command 标签的内容
  if (content.includes('<command-name>') || content.includes('<command-message>')) {
    return false;
  }

  // 过滤过短的输入（如 A/B/C 选项）
  if (content.trim().length < MIN_QUESTION_LENGTH) {
    return false;
  }

  // 过滤纯数字或单字符
  const trimmed = content.trim();
  if (/^[A-Za-z0-9]$/.test(trimmed)) {
    return false;
  }

  return true;
}

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

      // 提取用户问题（过滤短选项）
      if (record.type === 'user' && !record.isMeta) {
        const content = record.message?.content;
        if (isValidQuestion(content)) {
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

/**
 * 生成 YAML frontmatter
 * @param {Object} data - 会话数据
 * @returns {string} YAML 格式的 frontmatter
 */
function generateFrontmatter(data) {
  const { sessionId, userQuestions, modifiedFiles } = data;

  // 从用户问题提取关键词（取第一个有意义问题的前5个词）
  const keywords = [];
  const firstValidQuestion = userQuestions.find(q => q.length >= MIN_QUESTION_LENGTH);
  if (firstValidQuestion) {
    const words = firstValidQuestion.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
    keywords.push(...words.slice(0, 5).map(w => w.toLowerCase()));
  }

  // 生成简短摘要（取第一个有意义问题的前50字）
  const summary = firstValidQuestion
    ? firstValidQuestion.substring(0, 50) + (firstValidQuestion.length > 50 ? '...' : '')
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

/**
 * 处理单个会话，生成总结文件
 * @param {string} sessionId - 会话 ID
 */
async function processSession(sessionId) {
  // 查找 jsonl 文件
  const projectsDir = path.join(CLAUDE_DIR, 'projects');
  let jsonlPath = null;

  // 检查 projects 目录是否存在
  if (!fs.existsSync(projectsDir)) {
    console.error(`找不到 projects 目录: ${projectsDir}`);
    return false;
  }

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
  console.log(`jsonl 文件: ${jsonlPath}`);

  // 解析 jsonl
  const { userQuestions, llmResponses, modifiedFiles } = await parseJsonl(jsonlPath);

  console.log(`  - 用户问题数: ${userQuestions.length}`);
  console.log(`  - LLM 回答数: ${llmResponses.length}`);
  console.log(`  - 修改文件数: ${modifiedFiles.length}`);

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

/**
 * 处理待处理队列
 */
async function processPendingQueue() {
  if (!fs.existsSync(PENDING_FILE)) {
    console.log('没有待处理的会话 (pending.json 不存在)');
    return;
  }

  const pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));

  if (!pending.pending || pending.pending.length === 0) {
    console.log('没有待处理的会话 (队列为空)');
    return;
  }

  console.log(`发现 ${pending.pending.length} 个待处理会话`);
  const stillPending = [];

  for (const item of pending.pending) {
    console.log(`\n--- 处理会话: ${item.session_id} ---`);
    const success = await processSession(item.session_id);
    if (!success) {
      console.log(`会话 ${item.session_id} 处理失败，保留在队列中`);
      stillPending.push(item);
    }
  }

  // 更新 pending.json
  fs.writeFileSync(PENDING_FILE, JSON.stringify({ pending: stillPending }, null, 2));
  console.log(`\n处理完成，剩余待处理: ${stillPending.length}`);
}

/**
 * 添加会话到待处理队列
 */
function addToPending(sessionId) {
  // 确保目录存在
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  let pending = { pending: [] };
  if (fs.existsSync(PENDING_FILE)) {
    pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
  }

  // 检查是否已存在
  if (pending.pending.some(item => item.session_id === sessionId)) {
    console.log(`会话 ${sessionId} 已在待处理队列中`);
    return;
  }

  pending.pending.push({
    session_id: sessionId,
    timestamp: new Date().toISOString()
  });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
  console.log(`已添加会话 ${sessionId} 到待处理队列`);
}

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
    console.log('session-summarize.js - 从 jsonl 生成会话总结');
    console.log('');
    console.log('用法:');
    console.log('  node session-summarize.js <session_id>           # 处理单个会话');
    console.log('  node session-summarize.js --process-pending      # 处理待处理队列');
    console.log('  node session-summarize.js --add <session_id>     # 添加会话到待处理队列');
    process.exit(1);
  }
}

main().catch(console.error);
