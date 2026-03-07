---
name: push
description: "加密会话记录并推送到云端。用法: /push [message]"
---

# 推送会话记录到云端

请执行以下命令来加密并推送会话记录：

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/session-cloud.sh push <message>
```

## 参数说明

- `message`: 可选，提交信息

## 安全扫描功能

推送前会自动对 git status 中的变化文件进行安全扫描，检测以下类型的敏感信息：

1. **个人身份信息**：真实姓名、身份证号、护照号
2. **联系方式**：手机号码、邮箱地址、住址
3. **凭证信息**：API密钥、密码、访问令牌、SSH密钥
4. **金融信息**：银行卡号、信用卡号
5. **其他隐私信息**：工作单位、个人证书

### 扫描流程

1. 自动检测 git status 中的变化文件
2. 使用 `claude -p glm-4.5-air` 命令扫描文件内容
3. 如果发现风险，显示详细信息并询问是否修复
4. 用户可选择自动修复（替换为占位符）或取消推送

### 配置加密密码

创建 `.env` 文件（已在 .gitignore 中排除）：

```bash
SESSION_ENCRYPT_PASSWORD=your_encryption_password
```

或参考 `.env.example` 文件。

## 示例

- `/push` - 推送会话记录（使用默认提交信息）
- `/push 添加今天的会话` - 推送并指定提交信息

## 注意事项

- 安全扫描使用本地 `claude -p` 命令，需要已安装 claude CLI 工具
- 使用 GLM-4.5-air 模型进行扫描
- 发现敏感信息时，可选择自动修复或手动处理
