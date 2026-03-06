# Session Cloud Sync 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 session-management 添加云端加密同步功能，支持通过 git 安全备份会话记录。

**Architecture:** 使用 AES-256-GCM 加密算法保护会话内容，通过 /push 和 /pull 命令实现手动同步。密码通过环境变量或交互输入获取，加密文件 (.enc) 提交到 git，明文文件 (.md) 仅保留在本地。

**Tech Stack:** Node.js (crypto 模块), Git

---

## Task 1: 创建加密/解密核心模块

**Files:**
- Create: `scripts/session-cloud.js`

**Step 1: 创建 session-cloud.js 文件骨架和加密函数**

```javascript
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
```

**Step 2: 验证脚本语法**

```bash
node --check E:/ccsaffold/scripts/session-cloud.js
```

**Step 3: 提交**

```bash
git add scripts/session-cloud.js
git commit -m "feat(session-cloud): 添加云端加密同步核心模块"
```

---

## Task 2: 创建 .gitignore 文件

**Files:**
- Create: `.session-history/.gitignore`

**Step 1: 创建 .gitignore**

```gitignore
# 明文文件（永不提交）
*.md

# 密钥文件
*.key

# 待处理队列
pending.json
```

**Step 2: 提交**

```bash
git add .session-history/.gitignore
git commit -m "feat(session-cloud): 添加 .gitignore 忽略明文文件"
```

---

## Task 3: 创建 /push 命令

**Files:**
- Create: `commands/push.md`

**Step 1: 创建 push.md**

```markdown
---
name: push
description: "加密会话记录并推送到云端。用法: /push [message]"
---

# 推送会话记录到云端

请执行以下命令来加密并推送会话记录：

```bash
node E:/ccsaffold/scripts/session-cloud.js push <message>
```

## 参数说明

- `message`: 可选，提交信息

## 环境变量

- `SESSION_ENCRYPT_PASSWORD`: 加密密码（可选，未设置时提示输入）

## 示例

- `/push` - 推送会话记录（使用默认提交信息）
- `/push 添加今天的会话` - 推送并指定提交信息
```

**Step 2: 提交**

```bash
git add commands/push.md
git commit -m "feat(session-cloud): 添加 /push 命令"
```

---

## Task 4: 创建 /pull 命令

**Files:**
- Create: `commands/pull.md`

**Step 1: 创建 pull.md**

```markdown
---
name: pull
description: "从云端拉取并解密会话记录。用法: /pull"
---

# 从云端拉取会话记录

请执行以下命令来拉取并解密会话记录：

```bash
node E:/ccsaffold/scripts/session-cloud.js pull
```

## 环境变量

- `SESSION_ENCRYPT_PASSWORD`: 加密密码（可选，未设置时提示输入）

## 示例

- `/pull` - 从云端拉取并解密会话记录
```

**Step 2: 提交**

```bash
git add commands/pull.md
git commit -m "feat(session-cloud): 添加 /pull 命令"
```

---

## Task 5: 更新 session-management 技能文档

**Files:**
- Modify: `skills/session-management/SKILL.md`

**Step 1: 读取当前 SKILL.md 内容**

**Step 2: 在命令部分添加云端同步说明**

在 `## 命令` 部分添加：

```markdown
### /push [message]

加密会话记录并推送到云端 Git 仓库。

**用法示例：**
- `/push` - 推送会话记录
- `/push 添加今天的会话` - 指定提交信息

**环境变量：**
- `SESSION_ENCRYPT_PASSWORD`: 加密密码（可选）

### /pull

从云端拉取并解密会话记录。

**用法示例：**
- `/pull` - 拉取会话记录

**环境变量：**
- `SESSION_ENCRYPT_PASSWORD`: 加密密码（可选）
```

**Step 3: 提交**

```bash
git add skills/session-management/SKILL.md
git commit -m "docs(session-management): 添加云端同步命令文档"
```

---

## Task 6: 测试加密/解密功能

**Files:**
- None (测试现有功能)

**Step 1: 设置测试密码**

```bash
export SESSION_ENCRYPT_PASSWORD="test-password-123"
```

**Step 2: 测试 push 命令**

```bash
node E:/ccsaffold/scripts/session-cloud.js push "测试推送"
```

**Step 3: 验证生成了 .enc 文件**

```bash
ls .session-history/*.enc
```

**Step 4: 删除一个 .md 文件模拟拉取场景**

```bash
rm .session-history/01c359b7-e1ab-438b-b2e1-a959a8b5ff14.md
```

**Step 5: 测试 pull 命令**

```bash
node E:/ccsaffold/scripts/session-cloud.js pull
```

**Step 6: 验证 .md 文件已恢复**

```bash
cat .session-history/01c359b7-e1ab-438b-b2e1-a959a8b5ff14.md
```

---

## 任务摘要

| Task | 描述 | 文件 |
|------|------|------|
| 1 | 创建加密/解密核心模块 | `scripts/session-cloud.js` |
| 2 | 创建 .gitignore | `.session-history/.gitignore` |
| 3 | 创建 /push 命令 | `commands/push.md` |
| 4 | 创建 /pull 命令 | `commands/pull.md` |
| 5 | 更新技能文档 | `skills/session-management/SKILL.md` |
| 6 | 测试功能 | - |
