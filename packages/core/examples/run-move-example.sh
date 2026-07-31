#!/bin/bash
# FlexTree 移动节点示例运行脚本

echo "🚀 运行 FlexTree 移动节点示例..."
echo ""

cd "$(dirname "$0")"

# 检查 Bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "❌ 错误: 未找到 Bun 运行时，请先安装 Bun"
    echo "安装命令: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# 运行示例
bun run move-nodes-example.ts

echo ""
echo "💾 提示: 生成的数据库文件将保存为 tree_example.db"
echo "📊 您可以使用以下 SQLite 客户端工具查看数据库内容:"
echo "   - SQLite Browser (GUI)"
echo "   - DB Browser for SQLite"
echo "   - 命令行: sqlite3 tree_example.db"
