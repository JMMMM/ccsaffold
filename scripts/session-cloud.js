#!/usr/bin/env node
/**
 * session-cloud.js - 会话云端加密同步
 *
 * 用法:
 *   node session-cloud.js push [message]    # 加密并推送
 *   node session-cloud.js pull              # 拉取并解密
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const readline = require('readline');

// 配置
const HISTORY_DIR = path.join(process.cwd(), '.session-history');
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

/**
 * 从密码派生密钥
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * 加密文本内容
 * @returns {Buffer} [salt][iv][ciphertext][authTag]
 */
function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, encrypted, authTag]);
}

/**
 * 解密内容
 * @param {Buffer} data [salt][iv][ciphertext][authTag]
 * @returns {string} 明文
 */
function decrypt(data, password) {
  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(-AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH, -AUTH_TAG_LENGTH);

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * 获取密码（环境变量或交互输入）
 */
async function getPassword() {
  if (process.env.SESSION_ENCRYPT_PASSWORD) {
    return process.env.SESSION_ENCRYPT_PASSWORD;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    // Windows 兼容：使用 stderr 避免密码显示
    process.stderr.write('请输入加密密码: ');
    process.stdin.setRawMode(true);
    let password = '';

    process.stdin.on('data', (char) => {
      const c = char.toString('utf8');
      switch (c) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.setRawMode(false);
          rl.close();
          process.stderr.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        default:
          password += c;
          break;
      }
    });
  });
}

/**
 * 扫描 .md 文件并加密
 */
async function pushToCloud(message) {
  const password = await getPassword();
  if (!password) {
    console.error('错误: 未提供密码');
    process.exit(1);
  }

  // 扫描 .md 文件
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('没有需要同步的会话文件');
    return;
  }

  console.log(`加密 ${files.length} 个会话文件...`);

  let encryptedCount = 0;
  for (const file of files) {
    const mdPath = path.join(HISTORY_DIR, file);
    const encPath = path.join(HISTORY_DIR, file.replace('.md', '.enc'));

    try {
      const plaintext = fs.readFileSync(mdPath, 'utf8');
      const encrypted = encrypt(plaintext, password);
      fs.writeFileSync(encPath, encrypted);
      encryptedCount++;
    } catch (err) {
      console.error(`加密 ${file} 失败: ${err.message}`);
    }
  }

  console.log(`成功加密 ${encryptedCount} 个文件`);

  // Git 操作
  try {
    execSync('git add *.enc', { cwd: HISTORY_DIR, stdio: 'inherit' });
    const commitMsg = message || '备份会话记录';
    execSync(`git commit -m "${commitMsg}"`, { cwd: HISTORY_DIR, stdio: 'inherit' });
    execSync('git push', { cwd: HISTORY_DIR, stdio: 'inherit' });
    console.log('推送成功！');
  } catch (err) {
    if (err.message.includes('nothing to commit')) {
      console.log('没有需要同步的更新');
    } else {
      console.error('Git 操作失败:', err.message);
    }
  }
}

/**
 * 从云端拉取并解密
 */
async function pullFromCloud() {
  const password = await getPassword();
  if (!password) {
    console.error('错误: 未提供密码');
    process.exit(1);
  }

  // Git 拉取
  try {
    execSync('git pull', { cwd: HISTORY_DIR, stdio: 'inherit' });
  } catch (err) {
    console.error('Git pull 失败:', err.message);
    // 继续尝试解密本地文件
  }

  // 扫描 .enc 文件并解密
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.enc'));
  if (files.length === 0) {
    console.log('没有加密的会话文件');
    return;
  }

  console.log(`解密 ${files.length} 个会话文件...`);

  let decryptedCount = 0;
  let failedCount = 0;
  for (const file of files) {
    const encPath = path.join(HISTORY_DIR, file);
    const mdPath = path.join(HISTORY_DIR, file.replace('.enc', '.md'));

    // 如果 .md 已存在，跳过
    if (fs.existsSync(mdPath)) {
      continue;
    }

    try {
      const encrypted = fs.readFileSync(encPath);
      const plaintext = decrypt(encrypted, password);
      fs.writeFileSync(mdPath, plaintext, 'utf8');
      decryptedCount++;
    } catch (err) {
      console.error(`解密 ${file} 失败: 请检查密码是否正确`);
      failedCount++;
    }
  }

  console.log(`解密完成！新增 ${decryptedCount} 个会话，失败 ${failedCount} 个`);
}

// 主入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!fs.existsSync(HISTORY_DIR)) {
    console.error('错误: .session-history 目录不存在');
    process.exit(1);
  }

  switch (command) {
    case 'push':
      const message = args.slice(1).join(' ') || undefined;
      await pushToCloud(message);
      break;
    case 'pull':
      await pullFromCloud();
      break;
    default:
      console.log('session-cloud.js - 会话云端同步');
      console.log('');
      console.log('用法:');
      console.log('  node session-cloud.js push [message]    # 加密并推送');
      console.log('  node session-cloud.js pull              # 拉取并解密');
      console.log('');
      console.log('环境变量:');
      console.log('  SESSION_ENCRYPT_PASSWORD  加密密码（可选，未设置时提示输入）');
      process.exit(1);
  }
}

main().catch(console.error);
