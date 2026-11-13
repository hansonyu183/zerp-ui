# 单一模型消费者

运行命令见根 package.json 的 `dev:model`、`build:model`、`test:model`、`check:model`。App.vue 只挂载 `BusinessApplication` 并绑定 `consumer.ts` 的 model；标准 Vue、Vuetify 和 Router 宿主在 main.ts 初始化。

模型直接包含登录与账套引用、会话、账户及改密、客户与独立联系人、独立只读设置、普通嵌套字段与值数组、工作台入口与偏好、配置、通知和合成故障控制。消费者拥有合成业务存储、Router URL 映射和耐久 CAS 端口。工厂的 options 是响应式业务事实，操作存在性与 disabledReason 决定资格。navigation 端口对象在一次应用生命周期内保持稳定，以保留跨组件移除的内存原请求锁。

`ModelInput` 排除只读字段与独立节点。联系人操作用精确祖先元组表达上下文，父对象构造时检查层级配对；运行时冻结祖先身份、并发基线和输入。修改操作无需重复提供 UI Adapter；内部投影复用现有 CRUD、草稿计算、离页保护和原请求引擎。

“合成场景”可设置未知结果、权威核对结果及撤销编辑资格。未知后保留原请求；普通读取与关闭消息不会再次提交。刷新页面继续通过消费者的 pending/load/save/complete 端口恢复。只有加密存储端口可以接收带秘密修改的耐久原请求；登录秘密值不进入日志；改密通过固定 Operation 协议将原请求写入独立加密日志，AES-GCM 非导出密钥保存在 IndexedDB，CAS 由 Web Locks 保护。合成改密故意丢失响应，重载后核对同一原请求，不再次发送。

示例只使用合成数据。以 `zerp-model-demo-` 为前缀的浏览器本地数据用于模拟业务存储和耐久请求，可通过清除该站点存储重置。此示例与 tgz 检查提供库交互证据，不代表真实 ZERP API/E2E、正式发行或生产部署。旧公开装配入口已在 #125 移除，发行证据以该票为准。
