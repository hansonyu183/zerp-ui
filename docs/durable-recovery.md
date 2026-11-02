# 耐久原请求与消费者存储

`OperationPersistence` 和 `WritePersistence` 已提供原请求恢复协议。库持有发送、未知结果锁、终态读取与完成生命周期；消费者持有存储事务、权威证据及其完整绑定。页面恢复只核实原请求，不重放创建、保存或办理。

本次补强保持公开入口 `AuthPage` / `AppPage` 和既有有限端口：

- operation 接受权威回执后，终态保存失败仍在当前会话保留该回执。重试先耐久保存同一终态，再执行只读刷新；不重新 execute/reconcile 已知终态。真正重载后若回执从未保存，只能从耐久原请求继续核实，不能承诺恢复不存在的回执。
- 当前会话已知原请求时，读取使用原 ID，并比较完整 request 与 batch association；同 ID/binding 但输入、并发事实、预览或关联变化仍拒绝。已接受终态不能被相反证据取代。
- 刷新与完成失败保留锁和可重试入口；终态后的重试只读，不再发送业务命令。撤权或身份失效清理画面、使旧回调失效；原 owner 的持久证据继续保留。

消费者存储必须在同一原子事务中检查及写入：`expectedId=null` 只允许空槽或已完成槽预留；更新必须指向完整相同原请求。request、binding、association 不可改变；终态、已刷新及已完成事实只能前进。未应用证据必须完成后端封存才能解锁。完成是按精确原 ID 的幂等操作；槽被新请求替换后，旧 ID 的终态仍可读取、重复完成，且不得改写新槽。

`examples/capabilities/adapters.ts` 展示合成浏览器实现：安全上下文 Web Locks 在同源独立页面间串行化 localStorage 的检查和写入；owner 的 scope/operator/resource 构成 operation 命名空间，CRUD 使用 scope/resource。写入异常不视为成功。该示例要求 Web Locks 可用，不以非原子实现降级。localStorage 是浏览器持久化示例，不保证设备断电、浏览器清理、配额或禁用存储后的恢复；公司所需耐久级别、清理保留期与备份由实际存储实现保证。

`/durable-recovery?run=<合成验证标识>` 使用同一 capabilities 消费者。`scripts/durable-recovery-smoke.mjs` 打开同一 BrowserContext 中的两个 Page，分别拥有独立 JavaScript 状态并共享同源存储：先直接竞争公开 Persistence 端口，证明只有 CAS 获胜者执行；再从两个 AppPage 同时确认已准备请求，证明只有一项业务发送、未知结果持续锁定、重载不重发、恢复只核实一次。另验证旧 ID 历史、槽替换后重复完成、终态回退拒绝与 owner 隔离。

合成 operation Adapter 的 binding 覆盖原 request ID、owner、action、identity、input、concurrency 和完整 preview。准备时另存模拟权威原请求；prepare 验收、业务发送、核实、封存、回执采用及恢复读取均与该独立记录比较。即使重载丢失内存原请求，修改客户端草稿记录或重算其 binding 也不能采用旧权威回执。这里的 localStorage 权威记录仅模拟后端；真实消费者必须使用其真实服务端协议，不能把可改写的本地记录当作公司权威来源。

该 fixture 的 `window.syntheticDurableRecovery` 只提供合成 Adapter 观察和有限存储探针，不属于包出口；未读取库内部 VM。运行命令以 package scripts 为准：定向单元检查使用 `pnpm exec vitest run tests/durable-recovery.spec.ts tests/voucher-operation.spec.ts tests/capabilities.spec.ts`，独立 tgz 安装使用 `pnpm check:capabilities`。

这些证据只证明本库与合成 Adapter/浏览器存储的组合，不代表公司生产存储、真实 OIT/ZERP API、历史数据转换或真实应用验收。
