# #24 可丢弃办理契约演示

设计决定、方案比较和后续验收矩阵以 [#24](https://github.com/hansonyu183/zerp-ui/issues/24) 评论为准；父规格 #22 不在本票修改。

使用 `pnpm dev:operation-prototype` 运行，`pnpm check:operation-prototype` 构建并验证真实浏览器整页重载。入口 `OperationPrototype.vue` 与 `contract.ts` 是拟议公共消费接缝；尚未从 `@zerp/ui` 导出、打入 dist 或发布。最终选择扩展 VoucherView 的 operation 协议；此独立原型不是第七类正式运行时。

选择办理动作和合成情景，准备并核对全部预览后取消或确认；未知时普通读取、卸载、重挂载及整页刷新不会产生新请求。切换操作者演示隔离；错误证据保持锁定；未应用先封存；写入成功后刷新失败只能重读。终态和读取完成后需显式准备新请求。日志仅展示合成 Adapter 接收的请求标识，不暴露私有 VM。

存储由合成消费者提供，sessionStorage 键均以 `PROTOTYPE-24` 开头；当前标签关闭即清除。手工清理仅可在演示结束后删除这些键。它不是业务存储协议：单标签同步写用于观察 reserve/update/remove 顺序，不证明跨标签、跨进程原子性、生产持久性或授权。真实消费者必须提供耐久且原子比较更新、严格解码、权威证据验证和服务端封存协议。本演示的 JSON 内容绑定及模拟回执只用于合成验证，不是加密或服务端信任方案。

后续正式实施时，将契约与行为测试迁入公开包入口；用正式 VoucherView 分支替换此控制器，并删除本目录临时控制器、原型 scripts 与专用 smoke。保留 Git 历史和 #24 的确切 SHA 作为设计证据。现有 SubmissionRuntime 和库导出保持原状，本票不生成或发布 tgz。
