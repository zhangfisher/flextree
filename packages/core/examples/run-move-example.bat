@echo off
REM FlexTree 移动节点示例运行脚本

echo 🚀 运行 FlexTree 移动节点示例...
echo.

cd /d "%~dp0"

REM 检查 Bun 是否安装
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Bun 运行时，请先安装 Bun
    echo 安装命令: powershell -c "irm bun.sh/install.ps1|iex"
    exit /b 1
)

REM 运行示例
bun run move-nodes-example.ts

echo.
echo 💾 提示: 生成的数据库文件将保存为 tree_example.db
echo 📊 您可以使用以下 SQLite 客户端工具查看数据库内容:
echo    - SQLite Browser ^(GUI^)
echo    - DB Browser for SQLite
echo    - 命令行: sqlite3 tree_example.db

pause
