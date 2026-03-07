#!/usr/bin/env node
/**
 * session-search.js - AI 智能搜索会话历史
 *
 * 用法:
 *   node session-search.js <query> [--top 5]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HISTORY_DIR = path.join(process.env.CLAUDE_PROJECT_ROOT || process.cwd(), '.session-history');

// 解析参数
const args = process.argv.slice(2);
const topIndex = args.indexOf('--top');
const top = topIndex !== -1 ? parseInt(args[topIndex + 1]) || 5 : 5;
const query = args.find(arg => !arg.startsWith('--') && arg !== '--top' && args[args.indexOf(arg) - 1] !== '--top');

if (!query) {
  console.log('session-search.js - AI 智能搜索会话历史');
  console.log('');
  console.log('用法:');
  console.log('  node session-search.js <query> [--top 5]');
  console.log('');
  console.log('参数:');
  console.log('  query     搜索查询（自然语言）');
  console.log('  --top N   显示前 N 个结果（默认 5）');
  console.log('');
  console.log('示例:');
  console.log('  node session-search.js "修改了hooks配置"');
  console.log('  node session-search.js hook --top 10');
  process.exit(1);
}

/**
 * 提取 YAML frontmatter
 */
function extractYaml(content) {
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const match = normalizedContent.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yamlText = match[1];
  const data = {};

  const lines = yamlText.split('\n');
  let currentArray = null;

  lines.forEach(line => {
    if (line.startsWith('  - ')) {
      if (currentArray) {
        const value = line.substring(4).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          currentArray.push(value.slice(1, -1));
        } else {
          currentArray.push(value);
        }
      }
      return;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    if (value.startsWith('[')) {
      if (!value.endsWith(']')) {
        value = [value.substring(1).replace(/"/g, '').trim()];
      } else {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
      }
      data[key] = value;
      currentArray = null;
    } else if (value.startsWith('"')) {
      if (value.endsWith('"')) {
        data[key] = value.slice(1, -1);
      } else {
        data[key] = value.slice(1);
      }
      currentArray = null;
    } else if (value === '') {
      currentArray = [];
      data[key] = currentArray;
    } else {
      data[key] = value;
      currentArray = null;
    }
  });

  return data;
}

/**
 * 收集所有会话的 description
 */
function collectDescriptions() {
  if (!fs.existsSync(HISTORY_DIR)) {
    return [];
  }

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(HISTORY_DIR, f));

  const sessions = [];

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const yaml = extractYaml(content);

    if (yaml && yaml.description) {
      sessions.push({
        file: path.basename(filePath),
        path: filePath,
        session_id: yaml.session_id || 'unknown',
        date: yaml.date || 'unknown',
        project: yaml.project || 'unknown',
        description: yaml.description,
        completion_status: yaml.completion_status || 'completed'
      });
    }
  });

  // 按日期排序（最新的在前）
  sessions.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });

  return sessions;
}

/**
 * 使用 AI 进行智能搜索
 */
function searchWithAI(query, sessions, top) {
  // 构建提示词
  const descriptionsList = sessions.map((s, i) =>
    `[${i + 1}] [${s.session_id}] ${s.description}
     Project: ${s.project}, Date: ${s.date}`
  ).join('\n');

  const prompt = `You are a search assistant. Given a user query and a list of session descriptions, find the most relevant sessions.

## User Query
${query}

## Session Descriptions
${descriptionsList}

## Instructions
1. Analyze the user query to understand what they are looking for
2. Compare the query with each session description
3. Return a JSON array of the top ${top} most relevant session numbers (1-indexed from the list above)
4. Each result should include: index (1-based) and a brief reason why it matches

Return JSON in this format:
{"results": [{"index": 1, "reason": "brief explanation"}]}

Return only valid JSON. Do not include any other text.`;

  // 保存提示词到临时文件
  const tmpFile = path.join(HISTORY_DIR, '.search-prompt-' + Date.now() + '.txt');
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  // 调用 claude 进行 AI 分析
  const cmd = `claude -p --model GLM-4.5-Air --dangerously-skip-permissions --no-session-persistence --output-format json --tools "" --setting-sources user --disable-slash-commands @"${tmpFile}"`;

  try {
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 60000 });
    fs.unlinkSync(tmpFile);

    // 解析结果
    const result = JSON.parse(output);
    if (result.results && Array.isArray(result.results)) {
      return result.results.map(r => {
        const idx = r.index - 1;
        if (idx >= 0 && idx < sessions.length) {
          return {
            ...sessions[idx],
            reason: r.reason
          };
        }
        return null;
      }).filter(Boolean);
    }
  } catch (e) {
    console.error('AI search failed:', e.message);
    try { fs.unlinkSync(tmpFile); } catch (err) {}
    return [];
  }

  return [];
}

/**
 * 简单关键词匹配得分
 */
function calculateSimpleScore(session, query) {
  const words = query.toLowerCase().split(/\s+/);
  let score = 0;
  const desc = (session.description || '').toLowerCase();

  words.forEach(word => {
    if (word.length > 1 && desc.includes(word)) score += 1;
  });

  return score;
}

/**
 * 显示结果
 */
function displayResults(results) {
  console.log(`找到 ${results.length} 个匹配的会话:`);
  console.log('');

  results.forEach((result, index) => {
    console.log(`--- 匹配 ${index + 1} ---`);
    console.log(`会话ID: ${result.session_id}`);
    console.log(`日期: ${result.date}`);
    console.log(`项目: ${result.project}`);
    console.log(`描述: ${result.description}`);
    if (result.reason) {
      console.log(`匹配原因: ${result.reason}`);
    }
    console.log(`文件: ${result.file}`);
    console.log('');
  });
}

/**
 * 主函数
 */
function main() {
  const sessions = collectDescriptions();

  if (sessions.length === 0) {
    console.log('没有找到会话历史记录');
    console.log('');
    console.log('提示: 会话历史目录位于 .session-history/');
    return;
  }

  console.log(`正在搜索: "${query}"`);
  console.log(`分析 ${sessions.length} 个会话记录...`);
  console.log('');

  // 尝试使用 AI 搜索
  const results = searchWithAI(query, sessions, top);

  if (results.length === 0) {
    console.log('AI 搜索未返回结果，使用关键词匹配...');

    // 使用简单关键词匹配作为后备方案
    const fallbackResults = sessions.map((s, i) => {
      const score = calculateSimpleScore(s, query);
      return { ...s, score, index: i };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, top);

    if (fallbackResults.length > 0) {
      displayResults(fallbackResults);
    } else {
      console.log('未找到匹配的会话记录');
      console.log('');
      console.log('提示: 尝试使用其他关键词搜索');
    }
  } else {
    displayResults(results);
  }
}

main();
