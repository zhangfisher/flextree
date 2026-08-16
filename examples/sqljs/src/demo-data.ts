/**
 * 演示数据：大型企业组织架构树（中文）
 *
 * 层级：集团 → 事业部 → 部门 → 中心/组 → 岗位人员
 * 单树模式以「某科技集团」为根；多根模式取各事业部为顶层。
 */
export interface OrgInput {
  name: string;
  kind: "dept" | "person";
  headcount?: number;
  children?: OrgInput[];
}

export const ORG_TREE: OrgInput = {
  name: "某科技集团",
  kind: "dept",
  children: [
    {
      name: "技术研发事业部",
      kind: "dept",
      children: [
        {
          name: "平台研发部",
          kind: "dept",
          children: [
            {
              name: "前端架构组",
              kind: "dept",
              children: [
                { name: "张伟 · 前端架构师", kind: "person" },
                { name: "李娜 · 高级前端工程师", kind: "person" },
                { name: "王强 · 前端工程师", kind: "person" },
              ],
            },
            {
              name: "后端架构组",
              kind: "dept",
              children: [
                { name: "刘洋 · 后端架构师", kind: "person" },
                { name: "陈静 · 高级后端工程师", kind: "person" },
                { name: "赵磊 · 后端工程师", kind: "person" },
                { name: "孙丽 · 后端工程师", kind: "person" },
              ],
            },
            {
              name: "测试质量中心",
              kind: "dept",
              children: [
                { name: "周敏 · 测试经理", kind: "person" },
                { name: "吴涛 · 自动化测试工程师", kind: "person" },
                { name: "郑爽 · 测试工程师", kind: "person" },
              ],
            },
          ],
        },
        {
          name: "AI 创新实验室",
          kind: "dept",
          children: [
            { name: "冯远 · 算法研究员", kind: "person" },
            { name: "韩雪 · 算法工程师", kind: "person" },
            { name: "杨帆 · 数据工程师", kind: "person" },
          ],
        },
        {
          name: "运维保障部",
          kind: "dept",
          children: [
            { name: "朱军 · SRE 工程师", kind: "person" },
            { name: "林芳 · DevOps 工程师", kind: "person" },
            { name: "高翔 · 网络安全工程师", kind: "person" },
          ],
        },
      ],
    },
    {
      name: "产品与设计事业部",
      kind: "dept",
      children: [
        {
          name: "产品设计部",
          kind: "dept",
          children: [
            {
              name: "用户体验组",
              kind: "dept",
              children: [
                { name: "许晴 · UX 设计总监", kind: "person" },
                { name: "何军 · 交互设计师", kind: "person" },
                { name: "苏菲 · 视觉设计师", kind: "person" },
              ],
            },
            {
              name: "产品规划组",
              kind: "dept",
              children: [
                { name: "曹阳 · 产品总监", kind: "person" },
                { name: "彭飞 · 高级产品经理", kind: "person" },
                { name: "董洁 · 产品经理", kind: "person" },
              ],
            },
          ],
        },
        {
          name: "品牌市场部",
          kind: "dept",
          children: [
            { name: "袁华 · 品牌总监", kind: "person" },
            { name: "邓丽 · 内容运营经理", kind: "person" },
            { name: "任重 · 市场专员", kind: "person" },
          ],
        },
      ],
    },
    {
      name: "商业化管理委员会",
      kind: "dept",
      children: [
        {
          name: "销售管理部",
          kind: "dept",
          children: [
            {
              name: "华东销售大区",
              kind: "dept",
              children: [
                { name: "姜文 · 大区销售总监", kind: "person" },
                { name: "谢婷 · 客户经理", kind: "person" },
                { name: "罗凯 · 客户经理", kind: "person" },
              ],
            },
            {
              name: "华南销售大区",
              kind: "dept",
              children: [
                { name: "梁波 · 大区销售总监", kind: "person" },
                { name: "宋佳 · 客户经理", kind: "person" },
              ],
            },
          ],
        },
        {
          name: "客户成功部",
          kind: "dept",
          children: [
            { name: "唐悦 · 客户成功经理", kind: "person" },
            { name: "韩磊 · 技术支持工程师", kind: "person" },
          ],
        },
        {
          name: "法务合规部",
          kind: "dept",
          children: [{ name: "冯军 · 法务总监", kind: "person" }],
        },
      ],
    },
    {
      name: "职能支持中心",
      kind: "dept",
      children: [
        {
          name: "人力资源部",
          kind: "dept",
          children: [
            { name: "蒋欣 · HR 总监", kind: "person" },
            { name: "沈梦 · 招聘经理", kind: "person" },
            { name: "侯亮 · HRBP", kind: "person" },
          ],
        },
        {
          name: "财务部",
          kind: "dept",
          children: [
            { name: "曹颖 · 财务总监", kind: "person" },
            { name: "廖凡 · 高级会计", kind: "person" },
          ],
        },
        {
          name: "行政部",
          kind: "dept",
          children: [
            { name: "王芳 · 行政主管", kind: "person" },
            { name: "李强 · 前台", kind: "person" },
          ],
        },
      ],
    },
  ],
};
