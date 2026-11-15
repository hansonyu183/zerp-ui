# 静态模型呈现边界

根 members 为独立 Collection；ObjectNode.members 按数组顺序组织字段、分组和所属 RecordsNode。导航仅引用根集合，详情、新增和编辑留在集合内部。模型结构决定 Tab，不再提供 form/element/list 或 Symbol 元数据。

分组、表格/手机卡片、覆盖式编辑、工作台和主题均由库实现。完整要求以 ../../docs/ui-preferences.md 与 #159 为准。类型示例不证明呈现符合，定向公开入口和独立 tgz 的执行证据须单独记录。
