#!/usr/bin/env bash
#
# session-cloud.sh - 会话云端加密同步
#
# 用法:
#   ./session-cloud.sh push [message]    # 加密并推送
#   ./session-cloud.sh pull              # 拉取并解密
#

set -e

# 配置
HISTORY_DIR="$(pwd)/.session-history"
ALGORITHM="aes-256-gcm"
SALT_LENGTH=32
IV_LENGTH=12
AUTH_TAG_LENGTH=16

# 检测操作系统
detect_os() {
  case "$OSTYPE" in
    linux*)   echo "linux" ;;
    darwin*)  echo "macos" ;;
    msys*|cygwin*|win*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

OS="$(detect_os)"

# 获取密码（环境变量或交互输入）
get_password() {
  if [ -n "$SESSION_ENCRYPT_PASSWORD" ]; then
    echo "$SESSION_ENCRYPT_PASSWORD"
    return
  fi

  # 交互式输入密码
  if [ "$OS" = "macos" ]; then
    # macOS: 使用 read -s
    read -s -p "请输入加密密码: " password
    echo
    echo "$password"
  else
    # Linux: 使用 read -s
    read -s -p "请输入加密密码: " password
    echo
    echo "$password"
  fi
}

# 从密码派生密钥（使用 OpenSSL PBKDF2）
derive_key() {
  local password="$1"
  local salt="$2"
  echo -n "$password" | openssl pbkdf2 -pbkdf2 -iter 100000 -keylen 32 -sha256 -salt "$(echo -n "$salt" | xxd -r -p)" 2>/dev/null | xxd -p -c 256
}

# 加密文件
encrypt_file() {
  local input_file="$1"
  local output_file="$2"
  local password="$3"

  # 生成随机 salt 和 IV
  local salt iv
  salt="$(openssl rand -hex "$SALT_LENGTH")"
  iv="$(openssl rand -hex "$IV_LENGTH")"

  # 派生密钥
  local key
  key="$(derive_key "$password" "$salt")"

  # 加密
  local encrypted auth_tag
  encrypted=$(openssl enc -"$ALGORITHM" -e -K "$key" -iv "$(echo -n "$iv" | xxd -r -p)" -in "$input_file" 2>/dev/null | base64)
  auth_tag="$(echo "$encrypted" | openssl enc -"$ALGORITHM" -d -K "$key" -iv "$(echo -n "$iv" | xxd -r -p)" -pbkdf2 -iter 100000 2>/dev/null | tail -c "$AUTH_TAG_LENGTH" | xxd -p)"

  # 写入加密文件 [salt][iv][ciphertext][authTag]
  {
    echo -n "$salt"
    echo -n "$iv"
    echo -n "$encrypted"
  } > "$output_file"
}

# 解密文件
decrypt_file() {
  local input_file="$1"
  local output_file="$2"
  local password="$3"

  local data
  data="$(cat "$input_file")"

  # 提取 salt、iv、密文
  local salt iv ciphertext
  salt="${data:0:$((SALT_LENGTH * 2))}"
  iv="${data:$((SALT_LENGTH * 2)):$((IV_LENGTH * 2))}"
  ciphertext="${data:$((SALT_LENGTH * 2 + IV_LENGTH * 2))}"

  # 派生密钥
  local key
  key="$(derive_key "$password" "$salt")"

  # 解密
  echo "$ciphertext" | base64 -d | openssl enc -"$ALGORITHM" -d -K "$key" -iv "$(echo -n "$iv" | xxd -r -p)" -out "$output_file" 2>/dev/null
}

# 获取 git status 中变化的文件（仅在 .session-history 目录内）
get_changed_files() {
  local changed_files=()

  # 直接检查 .session-history 目录下最近修改的文本文件
  for file in "$HISTORY_DIR"/*.{md,txt,json,js,ts,sh}; do
    # 检查文件是否存在（glob 可能不匹配任何文件）
    [ -f "$file" ] || continue

    # 获取文件名（不带路径）
    local filename
    filename="$(basename "$file")"

    # 只检查根目录下的文件（不包含子目录）
    case "$filename" in
      *.md|*.txt|*.json|*.js|*.ts|*.sh)
        changed_files+=("$filename")
        ;;
    esac
  done

  printf '%s\n' "${changed_files[@]}"
}

# 调用 claude -p 扫描文件内容
scan_file() {
  local file_path="$1"
  local full_path="$HISTORY_DIR/$file_path"

  local content prompt result

  content="$(cat "$full_path")"

  prompt="请扫描以下文件内容，检测是否包含个人敏感信息。

文件路径: $file_path
文件内容:
\`\`\`
$content
\`\`\`

请检查以下类型的敏感信息：
1. 个人身份信息：真实姓名、身份证号、护照号
2. 联系方式：手机号码、邮箱地址、住址
3. 凭证信息：API密钥、密码、访问令牌、SSH密钥
4. 金融信息：银行卡号、信用卡号
5. 其他隐私信息：工作单位、个人证书

请以 JSON 格式返回扫描结果：
{
  \"has_risk\": true/false,
  \"risk_details\": [\"风险1\", \"风险2\"],
  \"sensitive_items\": [
    {\"type\": \"风险类型\", \"content\": \"敏感内容片段\", \"suggestion\": \"建议替换为xxx\"}
  ]
}

如果未发现敏感信息，返回: {\"has_risk\": false, \"risk_details\": [], \"sensitive_items\": []}

只返回JSON结果，不要有其他内容。"

  # 调用 claude -p
  result="$(claude -p glm-4.5-air "$prompt" 2>/dev/null)" || {
    echo "扫描失败: $file_path" >&2
    return 1
  }

  echo "$result"
}

# 修复文件中的敏感信息
fix_file() {
  local file_path="$1"
  local sensitive_items="$2"
  local full_path="$HISTORY_DIR/$file_path"

  local content
  content="$(cat "$full_path")"

  local modified=false

  # 解析 JSON 并替换
  while IFS= read -r item; do
    local s_type s_content s_suggestion
    s_type="$(echo "$item" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)"
    s_content="$(echo "$item" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)"
    s_suggestion="$(echo "$item" | grep -o '"suggestion":"[^"]*"' | cut -d'"' -f4)"

    if [ -n "$s_content" ] && [ -n "$s_suggestion" ]; then
      # 替换敏感内容（简单字符串替换）
      content="${content//$s_content/$s_suggestion}"
      modified=true
    fi
  done < <(echo "$sensitive_items" | jq -c '.[]' 2>/dev/null)

  if [ "$modified" = true ]; then
    echo "$content" > "$full_path"
    return 0
  fi

  return 1
}

# 安全扫描流程
security_scan() {
  local changed_files
  changed_files=($(get_changed_files))

  if [ ${#changed_files[@]} -eq 0 ]; then
    return 0  # 没有变化文件，直接通过
  fi

  echo ""
  echo "检测到 ${#changed_files[@]} 个变化文件，开始安全扫描..."
  echo "使用 claude -p glm-4.5-air 模型进行扫描"
  echo ""

  local has_risks=false
  local files_with_risks=()

  # 扫描所有变化文件
  for file_path in "${changed_files[@]}"; do
    echo "扫描: $file_path"

    local result
    result="$(scan_file "$file_path")" || continue

    # 检查是否安装了 jq
    if ! command -v jq &>/dev/null; then
      echo "警告: 未安装 jq 工具，跳过 JSON 解析"
      continue
    fi

    local has_risk risk_details
    has_risk="$(echo "$result" | jq -r '.has_risk' 2>/dev/null)"

    if [ "$has_risk" = "true" ]; then
      has_risks=true
      files_with_risks+=("$file_path|$result")

      risk_details="$(echo "$result" | jq -r '.risk_details[]' 2>/dev/null)"
      echo "⚠️  发现风险: $file_path"
      echo "$risk_details" | while IFS= read -r detail; do
        echo "   - $detail"
      done
    fi
  done

  if [ "$has_risks" = false ]; then
    echo "安全扫描通过，未发现敏感信息"
    return 0
  fi

  # 发现风险，询问用户
  echo ""
  echo "⚠️  安全扫描发现以下文件包含潜在敏感信息："

  for item in "${files_with_risks[@]}"; do
    local file_path result
    file_path="${item%%|*}"
    result="${item#*|}"

    echo ""
    echo "文件: $file_path"

    echo "$result" | jq -r '.sensitive_items[]? | "  类型: \(.type)\n  内容: \(.content[0:100])\(...)\n  建议: \(.suggestion)"' 2>/dev/null || true
  done

  echo ""
  read -p "是否自动修复这些敏感信息？: " answer
  answer="${answer,,}"  # 转小写

  if [ "$answer" = "y" ] || [ "$answer" = "yes" ]; then
    echo ""
    echo "开始修复..."

    for item in "${files_with_risks[@]}"; do
      local file_path result
      file_path="${item%%|*}"
      result="${item#*|}"

      local sensitive_items
      sensitive_items="$(echo "$result" | jq '.sensitive_items' 2>/dev/null)"

      if fix_file "$file_path" "$sensitive_items"; then
        echo "✓ 已修复: $file_path"
      else
        echo "✗ 修复失败: $file_path"
      fi
    done

    echo ""
    echo "修复完成，重新执行推送..."
    return 2  # 返回 2 表示需要重试
  else
    echo ""
    echo "用户取消修复，推送已中止"
    return 1
  fi
}

# 推送到云端
push_to_cloud() {
  local message="$1"

  local password
  password="$(get_password)"

  if [ -z "$password" ]; then
    echo "错误: 未提供密码" >&2
    exit 1
  fi

  # 检查目录是否存在
  if [ ! -d "$HISTORY_DIR" ]; then
    echo "错误: .session-history 目录不存在" >&2
    exit 1
  fi

  cd "$HISTORY_DIR" || exit 1

  # 扫描 .md 文件
  local files
  files=($(ls *.md 2>/dev/null)) || true

  if [ ${#files[@]} -eq 0 ]; then
    echo "没有需要同步的会话文件"
    return
  fi

  echo "加密 ${#files[@]} 个会话文件..."

  local encrypted_count=0
  for file in "${files[@]}"; do
    local md_file="$file"
    local enc_file="${file%.md}.enc"

    if encrypt_file "$md_file" "$enc_file" "$password"; then
      ((encrypted_count++))
    else
      echo "加密 $file 失败" >&2
    fi
  done

  echo "成功加密 $encrypted_count 个文件"

  cd - >/dev/null || exit 1

  # 安全扫描
  security_scan
  local scan_result=$?

  if [ $scan_result -eq 1 ]; then
    exit 1
  elif [ $scan_result -eq 2 ]; then
    # 重新执行推送
    push_to_cloud "$message"
    return
  fi

  # Git 操作
  cd "$HISTORY_DIR" || exit 1

  git add *.enc 2>/dev/null || true
  local commit_msg="${message:-备份会话记录}"
  git commit -m "$commit_msg" 2>/dev/null || {
    if git status | grep -q "nothing to commit"; then
      echo "没有需要同步的更新"
    else
      echo "Git 操作失败" >&2
    fi
    cd - >/dev/null || exit 1
    return
  }

  git push
  echo "推送成功！"

  cd - >/dev/null || exit 1
}

# 从云端拉取
pull_from_cloud() {
  local password
  password="$(get_password)"

  if [ -z "$password" ]; then
    echo "错误: 未提供密码" >&2
    exit 1
  fi

  if [ ! -d "$HISTORY_DIR" ]; then
    echo "错误: .session-history 目录不存在" >&2
    exit 1
  fi

  cd "$HISTORY_DIR" || exit 1

  # Git 拉取
  git pull 2>/dev/null || echo "Git pull 失败，继续解密本地文件"

  # 扫描 .enc 文件并解密
  local files
  files=($(ls *.enc 2>/dev/null)) || true

  if [ ${#files[@]} -eq 0 ]; then
    echo "没有加密的会话文件"
    cd - >/dev/null || exit 1
    return
  fi

  echo "解密 ${#files[@]} 个会话文件..."

  local decrypted_count=0
  local failed_count=0

  for file in "${files[@]}"; do
    local enc_file="$file"
    local md_file="${file%.enc}.md"

    # 如果 .md 已存在，跳过
    if [ -f "$md_file" ]; then
      continue
    fi

    if decrypt_file "$enc_file" "$md_file" "$password"; then
      ((decrypted_count++))
    else
      echo "解密 $file 失败: 请检查密码是否正确" >&2
      ((failed_count++))
    fi
  done

  echo "解密完成！新增 $decrypted_count 个会话，失败 $failed_count 个"

  cd - >/dev/null || exit 1
}

# 显示帮助
show_help() {
  echo "session-cloud.sh - 会话云端同步"
  echo ""
  echo "用法:"
  echo "  ./session-cloud.sh push [message]    # 加密并推送"
  echo "  ./session-cloud.sh pull              # 拉取并解密"
  echo ""
  echo "环境变量:"
  echo "  SESSION_ENCRYPT_PASSWORD  加密密码（可选，未设置时提示输入）"
}

# 主入口
main() {
  local command="$1"
  shift || true

  case "$command" in
    push)
      push_to_cloud "$*"
      ;;
    pull)
      pull_from_cloud
      ;;
    *)
      show_help
      exit 1
      ;;
  esac
}

main "$@"
