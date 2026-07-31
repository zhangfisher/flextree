import { describe, test, expect } from "bun:test";
import { forEachNestTree, type NestTreeNode } from "../../src/utils/forEachNestTree";

describe("forEachNestTree", () => {
  describe("基础遍历", () => {
    test("遍历简单的根节点", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root"
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 2,
        level: 1
      })
    })

    test("遍历有多个子节点的树", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          { id: 2, name: "a" },
          { id: 3, name: "b" },
          { id: 4, name: "c" }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 8,
        level: 1,
        children: [
          { id: 2, name: "a", left: 2, right: 3, level: 2 },
          { id: 3, name: "b", left: 4, right: 5, level: 2 },
          { id: 4, name: "c", left: 6, right: 7, level: 2 }
        ]
      })
    })

    test("遍历嵌套的多层树", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          {
            id: 2,
            name: "parent",
            children: [
              { id: 3, name: "child1" },
              { id: 4, name: "child2" }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 8,
        level: 1,
        children: [
          {
            id: 2,
            name: "parent",
            left: 2,
            right: 7,
            level: 2,
            children: [
              { id: 3, name: "child1", left: 3, right: 4, level: 3 },
              { id: 4, name: "child2", left: 5, right: 6, level: 3 }
            ]
          }
        ]
      })
    })
  })

  describe("数组输入", () => {
    test("遍历节点数组", () => {
      const trees: NestTreeNode[] = [
        { id: 1, name: "first" },
        { id: 2, name: "second" }
      ]

      let count = 1
      forEachNestTree(trees, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(trees).toEqual([
        { id: 1, name: "first", left: 1, right: 2, level: 1 },
        { id: 2, name: "second", left: 3, right: 4, level: 1 }
      ])
    })
  })

  describe("自定义配置", () => {
    test("使用自定义子节点字段名", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        subNodes: [
          { id: 2, name: "child" }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      }, { childrenKey: "subNodes" })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 4,
        level: 1,
        subNodes: [
          { id: 2, name: "child", left: 2, right: 3, level: 2 }
        ]
      })
    })

    test("默认使用 children 字段", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          { id: 2, name: "child" }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      }, {})

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 4,
        level: 1,
        children: [
          { id: 2, name: "child", left: 2, right: 3, level: 2 }
        ]
      })
    })
  })

  describe("边界情况", () => {
    test("空子节点数组", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: []
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 2,
        level: 1,
        children: []
      })
    })

    test("没有子节点字段", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root"
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 2,
        level: 1
      })
    })

    test("深层嵌套结构", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "level1",
        children: [
          {
            id: 2,
            name: "level2",
            children: [
              {
                id: 3,
                name: "level3",
                children: [
                  { id: 4, name: "level4" }
                ]
              }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "level1",
        left: 1,
        right: 8,
        level: 1,
        children: [
          {
            id: 2,
            name: "level2",
            left: 2,
            right: 7,
            level: 2,
            children: [
              {
                id: 3,
                name: "level3",
                left: 3,
                right: 6,
                level: 3,
                children: [
                  { id: 4, name: "level4", left: 4, right: 5, level: 4 }
                ]
              }
            ]
          }
        ]
      })
    })
  })

  describe("实际应用场景", () => {
    test("完整的嵌套集模型构建", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          { id: 2, name: "a" },
          {
            id: 3,
            name: "b",
            children: [
              { id: 5, name: "b1" },
              { id: 6, name: "b2" }
            ]
          },
          { id: 4, name: "c" }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 12,
        level: 1,
        children: [
          { id: 2, name: "a", left: 2, right: 3, level: 2 },
          {
            id: 3,
            name: "b",
            left: 4,
            right: 9,
            level: 2,
            children: [
              { id: 5, name: "b1", left: 5, right: 6, level: 3 },
              { id: 6, name: "b2", left: 7, right: 8, level: 3 }
            ]
          },
          { id: 4, name: "c", left: 10, right: 11, level: 2 }
        ]
      })
    })

    test("复杂兄弟节点结构", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          { id: 2, name: "child1" },
          {
            id: 3,
            name: "child2",
            children: [
              { id: 5, name: "grandchild1" },
              { id: 6, name: "grandchild2" }
            ]
          },
          { id: 4, name: "child3" }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 12,
        level: 1,
        children: [
          { id: 2, name: "child1", left: 2, right: 3, level: 2 },
          {
            id: 3,
            name: "child2",
            left: 4,
            right: 9,
            level: 2,
            children: [
              { id: 5, name: "grandchild1", left: 5, right: 6, level: 3 },
              { id: 6, name: "grandchild2", left: 7, right: 8, level: 3 }
            ]
          },
          { id: 4, name: "child3", left: 10, right: 11, level: 2 }
        ]
      })
    })

    test("验证层级递增", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          {
            id: 2,
            name: "parent",
            children: [
              { id: 3, name: "child" }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 6,
        level: 1,
        children: [
          {
            id: 2,
            name: "parent",
            left: 2,
            right: 5,
            level: 2,
            children: [
              { id: 3, name: "child", left: 3, right: 4, level: 3 }
            ]
          }
        ]
      })
    })
  })

  describe("深层树结构（深度超过3）", () => {
    test("5层深度树结构", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "level1",
        children: [
          {
            id: 2,
            name: "level2",
            children: [
              {
                id: 3,
                name: "level3",
                children: [
                  {
                    id: 4,
                    name: "level4",
                    children: [
                      { id: 5, name: "level5" }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "level1",
        left: 1,
        right: 10,
        level: 1,
        children: [
          {
            id: 2,
            name: "level2",
            left: 2,
            right: 9,
            level: 2,
            children: [
              {
                id: 3,
                name: "level3",
                left: 3,
                right: 8,
                level: 3,
                children: [
                  {
                    id: 4,
                    name: "level4",
                    left: 4,
                    right: 7,
                    level: 4,
                    children: [
                      { id: 5, name: "level5", left: 5, right: 6, level: 5 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })
    })

    test("6层深度树结构", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "l1",
        children: [
          {
            id: 2,
            name: "l2",
            children: [
              {
                id: 3,
                name: "l3",
                children: [
                  {
                    id: 4,
                    name: "l4",
                    children: [
                      {
                        id: 5,
                        name: "l5",
                        children: [
                          { id: 6, name: "l6" }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "l1",
        left: 1,
        right: 12,
        level: 1,
        children: [
          {
            id: 2,
            name: "l2",
            left: 2,
            right: 11,
            level: 2,
            children: [
              {
                id: 3,
                name: "l3",
                left: 3,
                right: 10,
                level: 3,
                children: [
                  {
                    id: 4,
                    name: "l4",
                    left: 4,
                    right: 9,
                    level: 4,
                    children: [
                      {
                        id: 5,
                        name: "l5",
                        left: 5,
                        right: 8,
                        level: 5,
                        children: [
                          { id: 6, name: "l6", left: 6, right: 7, level: 6 }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })
    })

    test("7层深度树结构", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "deep1",
        children: [
          {
            id: 2,
            name: "deep2",
            children: [
              {
                id: 3,
                name: "deep3",
                children: [
                  {
                    id: 4,
                    name: "deep4",
                    children: [
                      {
                        id: 5,
                        name: "deep5",
                        children: [
                          {
                            id: 6,
                            name: "deep6",
                            children: [
                              { id: 7, name: "deep7" }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "deep1",
        left: 1,
        right: 14,
        level: 1,
        children: [
          {
            id: 2,
            name: "deep2",
            left: 2,
            right: 13,
            level: 2,
            children: [
              {
                id: 3,
                name: "deep3",
                left: 3,
                right: 12,
                level: 3,
                children: [
                  {
                    id: 4,
                    name: "deep4",
                    left: 4,
                    right: 11,
                    level: 4,
                    children: [
                      {
                        id: 5,
                        name: "deep5",
                        left: 5,
                        right: 10,
                        level: 5,
                        children: [
                          {
                            id: 6,
                            name: "deep6",
                            left: 6,
                            right: 9,
                            level: 6,
                            children: [
                              { id: 7, name: "deep7", left: 7, right: 8, level: 7 }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })
    })

    test("复杂深层结构（多个分支，深度5）", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          {
            id: 2,
            name: "branch1",
            children: [
              { id: 4, name: "leaf1" },
              {
                id: 5,
                name: "sub1",
                children: [
                  { id: 7, name: "deep1" }
                ]
              }
            ]
          },
          {
            id: 3,
            name: "branch2",
            children: [
              {
                id: 6,
                name: "sub2",
                children: [
                  { id: 8, name: "deep2" },
                  { id: 9, name: "deep3" }
                ]
              }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 18,
        level: 1,
        children: [
          {
            id: 2,
            name: "branch1",
            left: 2,
            right: 9,
            level: 2,
            children: [
              { id: 4, name: "leaf1", left: 3, right: 4, level: 3 },
              {
                id: 5,
                name: "sub1",
                left: 5,
                right: 8,
                level: 3,
                children: [
                  { id: 7, name: "deep1", left: 6, right: 7, level: 4 }
                ]
              }
            ]
          },
          {
            id: 3,
            name: "branch2",
            left: 10,
            right: 17,
            level: 2,
            children: [
              {
                id: 6,
                name: "sub2",
                left: 11,
                right: 16,
                level: 3,
                children: [
                  { id: 8, name: "deep2", left: 12, right: 13, level: 4 },
                  { id: 9, name: "deep3", left: 14, right: 15, level: 4 }
                ]
              }
            ]
          }
        ]
      })
    })

    test("验证深层结构的层级连续性", () => {
      const tree: NestTreeNode = {
        id: 1,
        name: "root",
        children: [
          {
            id: 2,
            name: "child",
            children: [
              {
                id: 3,
                name: "grandchild",
                children: [
                  {
                    id: 4,
                    name: "greatgrandchild",
                    children: [
                      { id: 5, name: "greatgreatgrandchild" }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      let count = 1
      forEachNestTree(tree, (node, level) => {
        node.level = level
        if (!node.left) {
          node.left = count++
        } else {
          node.right = count++
        }
      })

      // 对最终树结构进行相等断言
      expect(tree).toEqual({
        id: 1,
        name: "root",
        left: 1,
        right: 10,
        level: 1,
        children: [
          {
            id: 2,
            name: "child",
            left: 2,
            right: 9,
            level: 2,
            children: [
              {
                id: 3,
                name: "grandchild",
                left: 3,
                right: 8,
                level: 3,
                children: [
                  {
                    id: 4,
                    name: "greatgrandchild",
                    left: 4,
                    right: 7,
                    level: 4,
                    children: [
                      { id: 5, name: "greatgreatgrandchild", left: 5, right: 6, level: 5 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })
    })
  })
})
