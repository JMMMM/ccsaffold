#!/bin/bash
# 测试 session-search 功能

echo "=== 测试会话搜索功能 ==="
echo ""

# 检查脚本是否存在
if [ ! -f "scripts/session-search.js" ]; then
    echo "错误: scripts/session-search.js 文件不存在"
    exit 1
fi

# 测试搜索功能
echo "1. 测试搜索 'hook' 关键词："
node scripts/session-search.js hook --top 3
echo ""

echo "2. 测试搜索 'git' 关键词："
node scripts/session-search.js git --top 3
echo ""

echo "3. 测试搜索 'plugin' 关键词："
node scripts/session-search.js plugin --top 3
echo ""

echo "=== 测试完成 ==="