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
  console.log('session-search.js - 搜索会话历史');
  console.log('');
  console.log('用法:');
  console.log('  node session-search.js <keyword> [--top 5]');
  console.log('');
  console.log('参数:');
  console.log('  keyword   搜索关键词');
  console.log('  --top N   显示前 N 个结果（默认 5）');
  console.log('');
  console.log('示例:');
  console.log('  node session-search.js hook --top 3');
  console.log('  node session-search.js "git commit"');
  process.exit(1);
}

/**
 * 提取 YAML frontmatter
 * @param {string} content - 文件内容
 * @returns {Object|null} YAML 数据
 */
function extractYaml(content) {
  // 处理 Windows 换行符
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const match = normalizedContent.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yamlText = match[1];
  const data = {};

  // 简单解析 YAML（不引入依赖）
  const lines = yamlText.split('\n');
  let currentKey = null;
  let currentArray = null;

  lines.forEach(line => {
    // 检查是否是数组项（以 "  - " 开头）
    if (line.startsWith('  - ')) {
      if (currentArray) {
        const value = line.substring(4).trim();
        // 移除引号
        if (value.startsWith('"') && value.endsWith('"')) {
          currentArray.push(value.slice(1, -1));
        } else {
          currentArray.push(value);
        }
      }
      return;
    }

    // 处理键值对
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // 解析内联数组
    if (value.startsWith('[')) {
      if (!value.endsWith(']')) {
        // 简单处理：取第一行
        value = [value.substring(1).replace(/"/g, '').trim()];
      } else {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
      }
      data[key] = value;
    }
    // 解析字符串
    else if (value.startsWith('"')) {
      // 处理带引号的字符串
      if (value.endsWith('"')) {
        data[key] = value.slice(1, -1);
      } else {
        data[key] = value.slice(1);
      }
    }
    // 解析多行数组
    else if (value === '') {
      currentKey = key;
      currentArray = [];
      data[key] = currentArray;
    }
    // 普通值
    else {
      data[key] = value;
      currentArray = null;
    }
  });

  return data;
}

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

  // 项目名匹配
  if (yaml.project && yaml.project.toLowerCase().includes(kw)) {
    score += 2;
  }

  return score;
}

/**
 * 搜索会话历史
 * @param {string} keyword - 搜索关键词
 * @param {number} top - 返回结果数量
 */
function searchSessions(keyword, top) {
  if (!fs.existsSync(HISTORY_DIR)) {
    console.log('没有找到会话历史目录');
    console.log('');
    console.log('提示: 会话历史目录位于 .session-history/');
    return;
  }

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(HISTORY_DIR, f));

  if (files.length === 0) {
    console.log('没有找到会话历史记录');
    return;
  }

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
    console.log('');
    console.log('提示: 尝试使用其他关键词搜索');
    return;
  }

  console.log(`找到 ${results.length} 个匹配，显示前 ${topResults.length} 个:\n`);

  topResults.forEach((result, index) => {
    console.log(`--- 匹配 ${index + 1} (得分: ${result.score}) ---`);
    console.log(`文件: ${result.file}`);
    console.log(`会话ID: ${result.yaml.session_id || '未知'}`);
    console.log(`日期: ${result.yaml.date || '未知'}`);
    console.log(`摘要: ${result.yaml.summary || '无摘要'}`);
    console.log(`关键词: ${Array.isArray(result.yaml.keywords) ? result.yaml.keywords.join(', ') : (result.yaml.keywords || '无')}`);
    console.log('');
  });

  // 显示提示
  console.log('---');
  console.log('提示: 使用 "node session-load.js --headers-only" 查看完整列表');
  console.log('      或直接打开 .session-history/ 目录查看详细内容');
}

// 执行搜索
searchSessions(keyword, top);
