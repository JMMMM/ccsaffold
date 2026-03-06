# Session Cloud Sync 设计文档

## 概述

为 session-management 功能添加云端加密同步能力，支持通过 git 将会话总结安全地备份到云端。

## 需求

- **场景**：个人备份，多设备间同步会话记录
- **加密**：强加密（AES-256-GCM），密码保护
- **同步**：手动 `/push` 和 `/pull` 命令
- **密码**：环境变量优先，回退到交互式输入

## 架构设计

### 整体流程

```
/push 流程:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐
│ 获取密码  │ -> │ 加密.md  │ -> │ git add  │ -> │ push  │
│          │    │ 生成.enc │    │  commit  │    │       │
└──────────┘    └──────────┘    └──────────┘    └───────┘

/pull 流程:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐
│ 获取密码  │ -> │ git pull │ -> │ 解密.enc │ -> │ 生成  │
│          │    │          │    │ 还原.md   │    │ .md   │
└──────────┘    └──────────┘    └──────────┘    └───────┘
```

### 密码获取流程

```
检查 SESSION_ENCRYPT_PASSWORD 环境变量
       │
  ┌────┴────┐
  │         │
已设置    未设置
  │         │
  ▼         ▼
直接使用   提示输入密码
```

## 加密方案

### 算法选择

- **加密算法**：AES-256-GCM
- **密钥派生**：PBKDF2（迭代 100,000 次）
- **加盐**：每个文件独立随机盐（32 bytes）
- **IV**：每次加密随机生成（12 bytes）

### 加密文件格式

```
[32 bytes salt][12 bytes IV][ciphertext][16 bytes auth tag]
```

## 目录结构

```
.session-history/
├── pending.json           # 待处理队列（不提交）
├── .gitignore             # 忽略明文文件
├── {id}.md               # 本地明文（不提交）
├── {id}.enc              # 加密版本（提交）
└── cloud/                # 可选：独立仓库目录
    └── .git/
```

### .gitignore 内容

```gitignore
# 明文文件（永不提交）
*.md

# 密钥文件
*.key

# 待处理队列
pending.json
```

## 命令设计

### /push [message]

加密所有 .md 文件并推送到云端。

**流程**：
1. 获取密码（环境变量或交互输入）
2. 扫描所有 .md 文件
3. 对每个 .md 生成对应的 .enc 文件
4. 执行 `git add *.enc`
5. 执行 `git commit -m "message"`
6. 执行 `git push`

**输出示例**：
```
请输入加密密码: ****
加密 3 个会话文件...
[main abc1234] 备份会话记录
 3 files changed, 5 insertions(+)
推送成功！
```

### /pull

从云端拉取并解密会话记录。

**流程**：
1. 获取密码
2. 执行 `git pull`
3. 扫描所有 .enc 文件
4. 对每个 .enc 解密生成 .md 文件
5. 报告新增/更新的会话数量

**输出示例**：
```
请输入加密密码: ****
Already up to date.
解密 5 个会话文件...
同步完成！发现 2 个新会话。
```

## 环境变量

### SESSION_ENCRYPT_PASSWORD

加密密码，设置后无需每次输入。

**配置方式**：

```bash
# Windows PowerShell（临时）
$env:SESSION_ENCRYPT_PASSWORD = "your-password"

# Windows CMD（临时）
set SESSION_ENCRYPT_PASSWORD=your-password

# bash/zsh（临时）
export SESSION_ENCRYPT_PASSWORD="your-password"

# bash/zsh（长期，添加到 ~/.bashrc）
export SESSION_ENCRYPT_PASSWORD="your-password"
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 密码错误 | 提示"解密失败，请检查密码"，跳过该文件继续处理其他 |
| git 冲突 | 提示冲突文件，建议手动解决后重试 |
| 网络错误 | 提示网络问题，本地加密文件仍保留 |
| 无新变化 | 提示"没有需要同步的更新" |
| 环境变量未设置 | 回退到交互式密码输入 |

## 安全考虑

1. **密码不持久化** - 仅在内存中使用，命令结束后由 GC 回收
2. **独立盐值** - 每个文件使用独立的随机盐，防止彩虹表攻击
3. **认证加密** - GCM 模式提供完整性验证，防止篡改
4. **明文隔离** - `.md` 文件添加到 `.gitignore`，永不提交

## 文件清单

| 文件 | 用途 |
|------|------|
| `scripts/session-cloud.js` | 核心脚本：加密、解密、git 操作 |
| `commands/push.md` | /push 命令定义 |
| `commands/pull.md` | /pull 命令定义 |
| `.session-history/.gitignore` | 忽略明文文件 |
| `skills/session-management/SKILL.md` | 更新文档 |

## 依赖

- Node.js 内置 `crypto` 模块（无需额外安装）
- Git（用户已安装）

## 使用示例

```bash
# 设置密码环境变量（可选）
export SESSION_ENCRYPT_PASSWORD="my-secret-password"

# 推送会话记录到云端
/push "添加今天的会话记录"

# 从云端拉取会话记录
/pull
```
