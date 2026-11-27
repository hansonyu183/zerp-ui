# 静态模型类型示例

`static-application.type-example.ts` 是完整静态响应式对象的编译示例，直接从唯一公开入口 `@zerp/ui/model` 导入类型。包含客户领域下七个并列独立集合及直属单据集合；领域没有整体查询、授权或保存。其业务回调仅声明，不能导入运行应用或当作运行验收证据。`static-application.type-test.ts` 验证固定属性、值、层级和拒绝旧协议。

呈现边界见 [UI 结构](ui-structure.md)，实际可运行消费者见[模型示例](../model/README.md)。公开 model 与同一个 tgz 的物理独立安装是验收面。接口决定见 #152，统一迁移见 #159。目标临时声明副本已删除，类型源为 ../../src/model/business-model.ts。
