#!/usr/bin/env node
/**
 * session-summarize.js
 * 提取会话内容，输出 JSON 到 stdout
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
const HISTORY_DIR = path.join(process.env.CLAUDE_PROJECT_ROOT || process.cwd(), '.session-history');
const MIN_QUESTION_LENGTH = 10;

const args = process.argv.slice(2);
const sessionId = args.find(arg => !arg.startsWith('--'));

// 获取东八区时间（北京时间）
function getBeijingTime() {
  const now = new Date();
  const offset = 8 * 60 * 60 * 1000; // UTC+8
  const beijingTime = new Date(now.getTime() + offset);
  return beijingTime.toISOString().replace('Z', '').replace(/\.\d{3}Z?$/, '+08:00');
}

function extractTextFromContent(content) {
  if (!content) return null;
  if (typeof content === 'string') {
    if (content.includes('<command-args>')) {
      const match = content.match(/<command-args>([\s\S]*?)<\/command-args>/);
      if (match && match[1]) return match[1].trim();
    }
    return content;
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        if (block.text.includes('<command-args>')) {
          const match = block.text.match(/<command-args>([\s\S]*?)<\/command-args>/);
          if (match && match[1]) return match[1].trim();
        }
        return block.text;
      }
    }
  }
  return null;
}

function isValidQuestion(content) {
  if (!content || typeof content !== 'string') return false;
  if (content.includes('# Brainstorming') || content.includes('## Overview')) return false;
  if (content.trim().length < MIN_QUESTION_LENGTH) return false;
  if (/^[A-Za-z0-9]$/.test(content.trim())) return false;
  return true;
}

async function parseJsonl(jsonlPath) {
  const userQuestions = [];
  const llmResponses = [];
  const modifiedFiles = [];

  const fileStream = fs.createReadStream(jsonlPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (record.type === 'user' && !record.isMeta) {
          const content = extractTextFromContent(record.message?.content);
          if (isValidQuestion(content)) userQuestions.push(content);
        }
        if (record.type === 'assistant' && record.message?.content) {
          const content = record.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text') llmResponses.push(block.text);
              if (block.type === 'tool_use' && (block.name === 'Edit' || block.name === 'Write')) {
                modifiedFiles.push({ path: block.input?.file_path, action: block.name.toLowerCase() });
              }
            }
          }
        }
      } catch (e) {}
    }
  } finally {
    rl.close();
    fileStream.destroy();
  }
  return { userQuestions, llmResponses, modifiedFiles };
}

function findJsonlPath(sessionId) {
  var projectsDir = path.join(CLAUDE_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  var dirs = fs.readdirSync(projectsDir);
  for (var i = 0; i < dirs.length; i++) {
    var candidate = path.join(projectsDir, dirs[i], sessionId + '.jsonl');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function generatePrompt(userQuestions, llmResponses, modifiedFiles) {
  const questionsText = userQuestions.slice(0, 5).map((q, i) => (i + 1) + '. ' + q).join('\n');
  const responsesText = llmResponses.slice(0, 3).map(r => r.substring(0, 500)).join('\n\n---\n\n');
  const filesText = modifiedFiles.slice(0, 10).map(f => '- ' + f.path + ' (' + f.action + ')').join('\n');

  var prompt = '分析此 Claude Code 会话并生成 JSON 总结。\n\n';
  prompt += '## 用户问题\n' + (questionsText || '无问题') + '\n\n';
  prompt += '## AI 响应 (前3条)\n' + (responsesText || '无响应') + '\n\n';
  prompt += '## 修改的文件\n' + (filesText || '无文件修改') + '\n\n';
  prompt += '重要：仅返回原始 JSON 对象。无 markdown 格式，无代码块，无解释。\n\n';
  prompt += 'JSON 格式：\n';
  prompt += '{"description": "一句话中文描述：修复了[问题]通过[方案]", "completion_status": "completed"}\n\n';
  prompt += '要求：\n';
  prompt += '- description: 最多120字符，用中文描述用户问题和修复方案\n';
  prompt += '- completion_status: "completed" 或 "in_progress"\n\n';
  prompt += '你的响应（仅 JSON，无其他内容）：';
  return prompt;
}

async function processSession(sessionId) {
  var jsonlPath = findJsonlPath(sessionId);
  if (!jsonlPath) {
    // 输出错误到 stdout（JSON 格式），而不是 stderr
    console.log(JSON.stringify({
      session_id: sessionId,
      date: getBeijingTime(),
      project: path.basename(process.cwd()),
      history_dir: HISTORY_DIR,
      prompt: '',
      error: 'jsonl not found',
      user_questions: [],
      llm_responses: [],
      modified_files: []
    }));
    process.exit(0);
  }

  var parsed = await parseJsonl(jsonlPath);

  // 输出完整数据到 stdout
  const data = {
    session_id: sessionId,
    date: getBeijingTime(),
    project: path.basename(process.cwd()),
    history_dir: HISTORY_DIR,
    prompt: generatePrompt(parsed.userQuestions, parsed.llmResponses, parsed.modifiedFiles),
    user_questions: parsed.userQuestions,
    llm_responses: parsed.llmResponses,
    modified_files: parsed.modifiedFiles
  };

  console.log(JSON.stringify(data));
}

async function main() {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

  if (sessionId) {
    await processSession(sessionId);
  } else {
    console.error('Usage: node session-summarize.js <session_id>');
    process.exit(1);
  }

  process.exit(0);
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
