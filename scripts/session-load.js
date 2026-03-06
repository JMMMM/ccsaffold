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

/**
 * 提取 YAML frontmatter
 * @param {string} content - 文件内容
 * @returns {Object} YAML 数据
 */
function extractYaml(content) {
  // 处理 Windows 换行符
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const match = normalizedContent.match(/^---\n([\s\S]*?)\n---/);
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
