# 有限业务处理页面复用原请求协议

正式规格见 [#47](https://github.com/hansonyu183/zerp-ui/issues/47)，承接 [#40](https://github.com/hansonyu183/zerp-ui/issues/40)。

完整页面入口收窄后，消费者无法通过模板补齐成本处理、发布试运行、批量和打印输出。把这些操作伪装成保存或审核会混淆原请求语义；开放任意命令或组件又会失去布局与恢复的统一所有权。

库提供有限的 TaskPage 和 BatchPage 内容定义，仍只通过 AuthPage/AppPage 呈现。TaskPage 的 process/publish/restore/validate/run/stop/import/preview/print/printed/not-printed 是固定交互动作，业务输入、资格、执行及权威证据通过强类型 Adapter 提供。扩展固定动作须修改库，不能由消费者注册字符串命令。

这项决定修订 #40 的六类页面范围限制，不修改 ADR-0001 的布局所有权。新增页面复用同一个 Operation 原请求引擎，保留耐久原请求、预览确认、精确回执、封存、只重读及完成记录。批量保留原始逐项清单；每项分别提交，未知项不能跳过以继续执行。

CRUD/配置在各自生命周期内增加可选持久化端口；并不强迫普通资料伪装为单据。异步草稿计算只有局部值及交互权限，无最终写入或解锁权限。打印预览只接受有限分页图文事实，输出表达式、分页计算、条码生成和实际打印计数归消费者。

代价是消费者必须按新协议迁移，不能直接嵌入现有业务模板。0.9.0 将原 VoucherOperation 协议统一命名为 Operation；不保留旧类型别名、导入转发或运行时兼容层。
