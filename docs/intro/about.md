# 关于

 `FlexTree`是一款基于`左右值`算法的树存储管理组件，适用于`Node.js`环境。提供了高效的树结构存储和访问，支持多种树操作，如增删改查、遍历、移动、查询等。

**功能特点：**

- 基于左右值算法，高效的树结构存储和访问
- 简单易用的API，支持多种树操作
- 强大易用的多种树操作，如增删改查、遍历、移动、查询等
- 采用`TypeScript`开发，提供完整友好的类型定义
- 支持任意数据库存储，如`SQLite`、`MySQL`、`PostgreSQL`等
- `95%`的测试覆盖率，保证代码质量
- 适用`Node.js`环境



<LiteTree>
- A公司
    行政中心
        总裁办              //   {color:red}important
        人力资源部
        财务部              //+
        行政部              //+
        法务部
        审计部              //-
        信息中心            //-
    + 市场中心
        市场部
        销售部
        客服部
        品牌部
        市场策划部
        市场营销部
    研发中心
        移动研发部(java,python,go)    //!
        平台研发部
        测试部              //*
        运维部              //*
        产品部
        设计部
</LiteTree>