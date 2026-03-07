#!/bin/bash
# 测试插件加载和功能

echo "=== 测试 CCScaffold 插件加载 ==="
echo ""

# 检查必要的目录和文件
echo "1. 检查插件结构："
echo "  - .claude-plugin/plugin.json: $(ls -la .claude-plugin/plugin.json)"
echo "  - commands/search.md: $(ls -la commands/search.md)"
echo "  - scripts/session-search.js: $(ls -la scripts/session-search.js)"
echo ""

# 检查插件配置
echo "2. 检查插件配置："
if grep -q "ccscaffold@ccscaffold-local.*true" ~/.claude/settings.json; then
    echo "  ✓ 插件已在用户级别启用"
else
    echo "  ✗ 插件未在用户级别启用"
fi

# 检查权限配置
echo "  - Node 权限配置：$(grep -o 'Node.*scripts/session.*' .claude/settings.json)"
echo ""

# 测试脚本执行
echo "3. 测试脚本执行："
echo "  - Node.js 版本：$(node --version)"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "如果命令仍然不可用，请尝试："
echo "1. 重启 Claude Code 会话"
echo "2. 使用直接命令：node scripts/session-search.js <keyword>"
echo "3. 检查 Claude Code 日志（如果有错误信息）"