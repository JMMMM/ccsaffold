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
const HISTORY_DIR = path.join(process.env.CLAUDE_PROJECT_ROOT || process.cwd(), '.session-history');
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
    .filter(f => f.endsWith('.md') && f !== 'pending.json')
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
