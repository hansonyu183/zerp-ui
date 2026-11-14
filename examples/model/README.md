# 直接业务模型消费者

本例直接定义公开 `BusinessModel`，以 `modelMetadata` Symbol 保存元数据；App.vue 仅绑定 `BusinessApplication :model="model"`。Vue 提供响应式包装，Router 负责 URL 与模型导航同步。

聚合按有序投影显示概览和客户集合。查询与保存使用合成回调，输入直接更新模型值；回调记录以 `synthetic-call:` 输出，可由独立 tgz 验收记录。模型构造不调用任何业务接口。未使用旧模型工厂、编辑副本、冻结请求或前端持久化恢复日志。

运行及构建命令见根 package.json。纯类型示例仍独立保留在 `examples/model-contract`，不导入到本运行消费者。真实产品/API、正式发行和部署证据必须分别核对。
