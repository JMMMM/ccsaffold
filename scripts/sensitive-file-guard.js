#!/usr/bin/env node
/**
 * Sensitive File Guard - PreToolUse Hook
 * 保护敏感文件不被 AI 读取或修改
 *
 * 支持的文件类型通过 config/sensitive-files.json 配置
 */

const fs = require('fs');
const path = require('path');

// 获取脚本所在目录
const SCRIPT_DIR = __dirname;
const PLUGIN_ROOT = path.dirname(SCRIPT_DIR);
const CONFIG_PATH = path.join(PLUGIN_ROOT, 'config', 'sensitive-files.json');

/**
 * 加载敏感文件配置
 */
function loadConfig() {
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    // 配置文件不存在或解析失败，使用默认配置
    return {
      protectedExtensions: ['.env', '.properties', '.yml', '.yaml', '.pem', '.key'],
      protectedPatterns: ['*credentials*.json', '*secret*.json'],
      blockMessage: '禁止访问敏感文件：{{file_path}}'
    };
  }
}

/**
 * 检查文件路径是否匹配敏感文件模式
 * @param {string} filePath - 文件路径
 * @param {object} config - 配置对象
 * @returns {boolean} - 是否为敏感文件
 */
function isSensitiveFile(filePath, config) {
  if (!filePath) return false;

  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = path.basename(normalizedPath);
  const ext = path.extname(fileName).toLowerCase();

  // 检查扩展名
  if (config.protectedExtensions.some(e => e.toLowerCase() === ext)) {
    return true;
  }

  // 检查通配符模式
  for (const pattern of config.protectedPatterns) {
    if (matchPattern(fileName, pattern) || matchPattern(normalizedPath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * 简单的通配符匹配
 * @param {string} str - 要匹配的字符串
 * @param {string} pattern - 通配符模式
 * @returns {boolean}
 */
function matchPattern(str, pattern) {
  // 将通配符模式转换为正则表达式
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
    .replace(/\*/g, '.*') // * 匹配任意字符
    .replace(/\?/g, '.'); // ? 匹配单个字符

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(str);
}

/**
 * 主函数
 */
async function main() {
  // 从 stdin 读取 JSON 输入
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    // 无输入，允许通过
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (error) {
    // JSON 解析失败，允许通过
    process.exit(0);
  }

  const { tool_name, tool_input } = data;

  // 只拦截 Read、Write、Edit 工具
  if (!['Read', 'Write', 'Edit'].includes(tool_name)) {
    process.exit(0);
  }

  // 获取文件路径
  const filePath = tool_input?.file_path;
  if (!filePath) {
    process.exit(0);
  }

  // 加载配置
  const config = loadConfig();

  // 检查是否为敏感文件
  if (isSensitiveFile(filePath, config)) {
    const message = config.blockMessage.replace('{{file_path}}', filePath);

    // 返回拒绝决定
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: message
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  }

  // 非敏感文件，允许通过
  process.exit(0);
}

main().catch(() => process.exit(0));
