# 合成原请求与批次转换边界

正式要求：[父规格 #58](https://github.com/hansonyu183/zerp-ui/issues/58)、[#62](https://github.com/hansonyu183/zerp-ui/issues/62)。本说明描述消费者承担的证据核对；不定义公共兼容协议，不是 OIT 或其他生产转换器。

`examples/capabilities/legacy-conversion.ts` 只识别示例的有限 `synthetic-single-v1` / `synthetic-batch-v1` 工件。示例入口为 `/migration-single` 和 `/migration-batch`，通过公开 `AppPage`、`defineTaskPage`、`defineBatchPage` 与同一安装包运行。全部资料、原请求与权威账本均为合成数据。

转换前必须保留原始工件。示例将原始 JSON 原文留存在独立 `:source` 键；拒绝不会建立运行时记录或补发命令。接受时，原件和转换后的批次、原请求记录在同一 Web Lock 下作为一个 localStorage 工件写入。这个原子性仅适用于本合成消费者的同源浏览器存储。

| 事实            | 可确定映射                                               | 必须由消费者核实 / 不足时拒绝                                                    |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 逐项清单        | 原批次 ID、固定顺序、稳定且不重复的 entry key、标签      | 不得生成新批次 ID 后套用旧回执；不能遗漏已发项                                   |
| 所有权与输入    | 原 scope/operator/resource、identity、action、完整 input | 与当前恢复 owner、权威原请求逐项一致                                             |
| 已发原请求      | 原 requestId、binding、concurrency、完整 preview/input   | 与合成权威账本中的完整原请求一致；不能重新 prepare 补齐                          |
| 批次关联        | 原 batchId + entryKey                                    | 每个已发请求的原关联必须一致；不得猜测或重新归属                                 |
| 已应用 / 未应用 | 原始精确回执及读取/完成标记                              | applied 必须有匹配权威回执；not-applied 必须已有幂等封存证据。状态字符串不是证据 |
| 未知            | 同一完整原请求和关联，保留未决 journal                   | 只能有当前索引上的一个活动未知项；早于索引的项必须已结算                         |
| 从未发送        | 原始清单中明确的未发事实                                 | 不得携带 original、receipt 或 association；已发未知不能改成 skipped              |

示例混合批次包含 applied、sealed not-applied、unknown、never-sent 四项。前两项的原回执与已有读取/完成标记被保留；unknown 以原 requestId 在 OperationPersistence 中占用活动槽；批次索引指向该项。加载与重载均不 prepare/execute，未知期间不能继续或停止。核实并耐久保存终态后仍停在当前项，必须显式点击“继续下一项”。“停止剩余操作”仅将尚未发送的尾项标记 skipped，不能取消已发送请求或回退前项证据。完成批次重载只展示完成清单。

单据样例保留已发送的原 ID、owner、identity、input、binding、concurrency 和 preview；恢复仅核实这个原请求。它使用 TaskPage 的有限 process 动作展示原协议迁移，不宣称已完成真实 Voucher/OIT 接入。

拒绝样例覆盖复制 batchId、错误 entryKey、修改输入/owner、缺失完整原请求或 binding、只有 applied 状态以及把已发未知叫作 skipped。库另对恢复批次作有限保护：索引不能跨过前面的未决项；skipped/completed 必须为布尔 true，skipped 与 settlement 不能共存；已知批次重试读取为 null 时保持锁定。完整权威绑定、耐久 CAS、幂等封存和真实历史可转换性仍归消费者核实。

验证入口为 `tests/batch-recovery.spec.ts` 和现有 `check:capabilities`，后者运行 `scripts/batch-recovery-smoke.mjs`，在 tgz 独立安装消费者中检查原 ID/关联、unknown 锁、显式继续、仅停止未发项、原件保留与完成后重载零执行。这些证据只覆盖合成 Adapter 与存储，不等同于真实 API/E2E 或生产历史数据验收。
