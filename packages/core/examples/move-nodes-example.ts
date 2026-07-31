/**
 * FlexTree 移动节点示例
 *
 * 本示例演示如何使用 FlexTreeManager 和 flextree-bun-sqlite-adapter
 * 使用真实 SQLite 数据库文件（非内存数据库）进行节点移动操作
 */

import { Database } from "bun:sqlite";
import { FlexTreeManager, FlexNodeRelPosition } from "../src";
import BunSqliteAdapter from "flextree-bun-sqlite-adapter";

// 自定义节点类型，包含 id 和 name 字段
interface CustomNode {
  id: number;
  name: string;
  level: number;
  leftValue: number;
  rightValue: number;
}

/**
 * 创建真实数据库文件并初始化表结构
 * @param dbPath 数据库文件路径
 */
async function createDatabase(dbPath: string): Promise<Database> {
  // 删除已存在的数据库文件
  try {
    const file = Bun.file(dbPath);
    if (file.exists()) {
      // 使用简单的命令删除文件
      const process = Bun.spawn(["rm", "-f", dbPath]);
      await process.exited;
    }
  } catch (e) {
    // 文件不存在或删除失败，继续执行
    console.log("注意：无法删除旧数据库文件，将尝试覆盖");
  }

  // 创建新的数据库连接（SQLite 会自动创建文件）
  const db = new Database(dbPath);

  // 创建表结构
  db.exec(`
    CREATE TABLE IF NOT EXISTS tree_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      leftValue INTEGER NOT NULL,
      rightValue INTEGER NOT NULL
    )
  `);

  return db;
}

/**
 * 初始化树结构数据
 * 创建以下结构：
 * - Root
 *   - A
 *     - A1, A2, A3, A4, A5
 *   - B
 *     - B1, B2, B3, B4, B5
 *   - C
 *     - C1, C2, C3, C4, C5
 *   - D
 *     - D1, D2, D3, D4, D5
 */
async function initializeTreeData(manager: FlexTreeManager): Promise<void> {
  console.log("🌱 开始初始化树结构数据...");

  await manager.write(async (tree) => {
    // 创建根节点 Root
    await tree.createRoot({ name: "Root" });
    const rootNode = await tree.getRoot();
    console.log(`✅ 创建根节点: Root (id: ${rootNode.id})`);

    // 创建一级子节点 A, B, C, D
    const firstLevelNodes = ["A", "B", "C", "D"];
    const createdFirstLevel: any[] = [];

    for (const nodeName of firstLevelNodes) {
      await tree.addNodes([{ name: nodeName }], rootNode, FlexNodeRelPosition.LastChild);
      // 获取刚创建的节点
      const node = await tree.findNode({ name: nodeName });
      console.log(`  ✅ 创建一级节点: ${nodeName} (id: ${node.id})`);
      createdFirstLevel.push(node);
    }

    // 为每个一级节点创建 5 个二级子节点
    for (const parentNode of createdFirstLevel) {
      const parentName = parentNode.name;
      const secondLevelNodes = [];

      for (let i = 1; i <= 5; i++) {
        const nodeName = `${parentName}${i}`;
        secondLevelNodes.push({ name: nodeName });
      }

      await tree.addNodes(secondLevelNodes, parentNode.id, FlexNodeRelPosition.LastChild);

      // 获取刚创建的二级节点
      const createdNodes = [];
      for (let i = 1; i <= 5; i++) {
        const nodeName = `${parentName}${i}`;
        const node = await tree.findNode({ name: nodeName });
        createdNodes.push(node);
      }

      console.log(
        `    ✅ 为 ${parentName} 创建二级节点: ${createdNodes.map((n: any) => n.name).join(", ")}`,
      );
    }
  });

  console.log("🎉 树结构初始化完成！\n");
}

/**
 * 显示当前树结构
 */
async function displayTreeStructure(manager: FlexTreeManager): Promise<void> {
  console.log("📊 当前树结构:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const tree = manager.getTree();
  await tree.load(); // 需要加载树到内存
  const treeData = tree.toJson({
    fields: ["id", "name", "level"],
    includeKeyFields: true,
  });

  function printNode(node: any, indent: string = "") {
    console.log(`${indent}├─ [ID:${node.id}] ${node.name} (Level: ${node.level})`);
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => printNode(child, indent + "│  "));
    }
  }

  if (treeData.children) {
    treeData.children.forEach((node: any) => printNode(node, ""));
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

/**
 * 演示节点移动操作
 * 将 A1 节点移动到 A3 节点的下一个兄弟节点位置
 */
async function demonstrateMoveOperation(manager: FlexTreeManager): Promise<void> {
  console.log("🔄 演示节点移动操作");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("操作说明：将节点 A1 移动到 A3 的 NextSibling 位置");
  console.log("预期结果：A 节点的子节点顺序变为 A3, A4, A1, A2, A5");
  console.log("说明：NextSibling 表示将 A1 移动到 A3 的下一个兄弟节点位置，即 A3 后面");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 获取 A1 和 A3 节点
  const a1Node = await manager.findNode({ name: "A1" });

  const a3Node = await manager.findNode({ name: "A3" });

  if (!a1Node || !a3Node) {
    throw new Error("无法找到 A1 或 A3 节点！");
  }

  console.log(
    `📍 找到源节点: A1 (ID: ${a1Node.id}, 左值: ${a1Node.leftValue}, 右值: ${a1Node.rightValue})`,
  );
  console.log(
    `📍 找到目标节点: A3 (ID: ${a3Node.id}, 左值: ${a3Node.leftValue}, 右值: ${a3Node.rightValue})\n`,
  );

  // 显示移动前的树结构
  console.log("🌳 移动前的树结构（A 节点的子节点）:");
  const aNodeBefore = await manager.findNode({ name: "A" });

  if (aNodeBefore) {
    const childrenBefore = await manager.getChildren(aNodeBefore.id);
    console.log(`  ${childrenBefore.map((n: any) => n.name).join(", ")}\n`);
  }

  // 执行移动操作
  console.log("🚀 开始执行移动操作...");
  await manager.write(async (tree) => {
    await tree.moveNode(a1Node.id!, a3Node.id!, FlexNodeRelPosition.NextSibling);
  });
  console.log("✅ 节点移动完成！\n");

  // 显示移动后的树结构
  console.log("🌳 移动后的树结构（A 节点的子节点）:");
  const aNodeAfter = await manager.findNode({ name: "A" });

  if (aNodeAfter) {
    const childrenAfter = await manager.getChildren(aNodeAfter.id);
    console.log(`  ${childrenAfter.map((n: any) => n.name).join(", ")}\n`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

/**
 * 验证树结构的完整性
 */
async function verifyTreeIntegrity(manager: FlexTreeManager): Promise<void> {
  console.log("\n🔍 验证树结构完整性:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    await manager.verify();
    console.log("✅ 树结构验证通过！所有节点的左右值关系正确。");
  } catch (error: any) {
    console.log("❌ 树结构验证失败！");
    console.log(`错误信息: ${error.message}`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

/**
 * 主函数
 */
async function main() {
  const dbPath = "tree_example.db";

  try {
    console.log("🚀 FlexTree 移动节点示例启动\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`数据库文件路径: ${dbPath}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 创建数据库
    const db = await createDatabase(dbPath);

    // 创建适配器，传入真实数据库连接（不使用内存数据库）
    const adapter = new BunSqliteAdapter(db);

    // 创建树管理器
    const manager = new FlexTreeManager("tree_table", {
      adapter,
    });

    // 初始化树数据
    await initializeTreeData(manager);

    // 显示初始树结构
    console.log("🌲 初始树结构:");
    await displayTreeStructure(manager);

    // 演示移动操作
    await demonstrateMoveOperation(manager);

    // 显示移动后的完整树结构
    console.log("🌲 移动后的完整树结构:");
    await displayTreeStructure(manager);

    // 验证树结构完整性
    await verifyTreeIntegrity(manager);

    console.log("🎉 示例执行完成！");
    console.log(`💾 数据库文件已保存至: ${dbPath}`);
    console.log("📝 您可以使用 SQLite 客户端工具查看数据库内容\n");
  } catch (error) {
    console.error("❌ 发生错误:", error);
    process.exit(1);
  }
}

// 运行示例
main();
