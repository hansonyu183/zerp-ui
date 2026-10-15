# ZERP UI

独立的 Vue/Vuetify 组件库 `@zerp/ui`。本片实现[公共交互与直接维护运行时 #8](https://github.com/hansonyu183/zerp-ui/issues/8)，遵循[实施规格 #7](https://github.com/hansonyu183/zerp-ui/issues/7)。版本 `0.0.0` 为本地验收包；完整七片通过后才发布 `0.1.0`，本片不发布 Release。

## 开发与验证

使用 Node 26 和 packageManager 指定的 pnpm。先 `pnpm install --frozen-lockfile`、`pnpm build`，再运行 `pnpm dev`。示例经包公开入口加载编译产物；修改库后重新 build。其余可用命令见 package.json scripts。

`pnpm check:package` 打包当前 dist，在本库 `.scratch/package-check-*/consumer` 新建独立 manifest/安装树，使用 npm 实际安装同一 tgz；不继承仓库别名或 workspace。检查声明推导、错误类型配对拒绝、生产构建、字体/CSS、私有出口拒绝、浏览器新增/修改及 20 个消费者示例。需要先安装 Playwright Chromium。证据 JSON 记录源码基线 SHA、tgz SHA-256、安装目录与退出码。脚本在 finally 中关闭自己启动的浏览器和预览服务器，保留可复核安装工件；可删除该次 package-check 目录回收磁盘。

测试仅使用合成资料与模拟 Adapter，不连接 ZERP API、数据库或生产数据，也不代表真实 ZERP E2E。ZERP 源码、依赖与部署保持原状；真实接入由发布后的[独立工单](https://github.com/hansonyu183/zerp/issues/520)完成。

## 独立消费者

安装本片验证生成的 tgz，并由宿主提供 Vue `~3.5.40`、Vuetify `~4.1.5`、Vue Router `~5.2.0` 唯一实例。入口仅为 `@zerp/ui` 与 `@zerp/ui/style.css`；模块及所有实际子路径依赖均 external。宿主创建 Vue/Vuetify，导入 `vuetify/styles` 与库 CSS；库不创建 Session、Router、API 客户端或存储键。

```ts
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import "vuetify/styles";
import "@zerp/ui/style.css";
import App from "./App.vue";
createApp(App).use(createVuetify()).mount("#app");
```

完整的强类型定义、合成 Adapter 与可运行装配见 `examples/direct`。包包含 ESM、完整声明、限定作用域的 CSS、字体及字体授权。消费者无需编译库内 Vue/TS，也无需自动导入插件。所有示例均使用公开导出。

## 接口与责任

- `defineDirect<Draft, Filters, Row, Identity, Evidence>` 成对检查字段、列与 Adapter；`Fields<T>` 递归检查子项，decimal 只接十进制字符串，boolean、integer、单/多引用、多选枚举各自对应值类型。编译示例见 `tests/contracts.type-test.ts`。
- `DirectRuntime` 接 definition、`scope` 与有限 permissions。`scope` 必须标识账号/会话代次及业务范围；账号或资源切换时更新它，使旧查询、详情及引用响应失效。Adapter 在同一会话中保持稳定身份，消费者不能通过重建 Adapter 清除未知状态。
- definition 不持有 VM、组件、模板或任意命令。有限字段支持 create/edit、静态 readonly、值相等条件及单一父引用依赖；详情可返回 typed readonlyFields。父引用改变时清空其从属选择；Adapter 接收该父引用，筛选资格仍归消费者。
- Adapter 持有公司 DTO/协议/认证与业务规则。query 返回真实 total 或 hasMore；identity 可包含修订/精确采用身份，库按原值携带。empty 获得已提交筛选与 scope。actions 是消费者提供的固定资格事实，执行仍由服务端重验。
- `DynamicForm` 只收所辖值、有限字段、scope、模式与 disabled，回传局部值和聚合 pending；递归子项确认只写入父 Draft，取消父编辑丢弃整个子树。它不获得最终写入、刷新或解锁权限。integer 的未完成输入保留在输入层并阻止提交；decimal 保留原字符串至提交验证，不转浮点数。未改动 null、0 和 false 均原样保存。
- `ReferencePicker` 分离 search/resolve，支持分页、单选和多选；值保存消费者提供的精确身份与 snapshot。resolve 不改写历史 label/snapshot，停用、缺失和页外已选项始终保留，移除由用户显式操作。加载错误显示重试。选择资格和历史是否可提交由消费者/后端判断。
- `ListSurface` 以同一组行与固定动作呈现桌面表格和手机卡片，区分 total/hasMore。筛选输入显式查询后才提交，更多条件可以折叠；翻页使用已提交筛选。

## 写入结果与核实

运行时创建带 UUID 的 Attempt，保存原 scope、resource、operation、输入与 identity。create/save/setEnabled/delete 必须返回 success、failure 或 unknown；抛出异常按 unknown 处理。只有确定未写入时才能返回 failure。输入与结果应为可 structuredClone 的普通数据；Adapter 不修改宿主事实来代替返回值。

写入期间互斥；成功后只刷新一次，刷新失败锁定写入，重试只执行查询。未知锁存于库内部、按稳定 Adapter/资源/scope 隔离；关闭编辑、普通查询、卸载再挂载和切换会话均不能解除原作用域的锁。迟到写入即使已离开页面，也在原作用域记录结果。

可选 reconcile 收到原 Attempt；仅当消费者凭精确证据返回 applied/not-applied、匹配的 attemptId 及 Evidence，才可解除未知锁。applied 先刷新，not-applied 允许用户重试；unknown、缺权限、异常、身份不符或证据缺失继续锁定。当前资料查询只是观察，不是本次请求执行证据；没有核实能力时不要提供 reconcile。此锁保存在运行中的 JS 实例内，跨整页重载的持久化及服务端幂等由消费者安排。

## 只读行为基线与合成矩阵

基线：原 ZERP `bf0e6e8d81f025bba81612c0e37b1527b2889eee` 的 `frontend/src/target/components/direct-page/definition.ts`、`DirectPage.vue`、`definitions/*.ts` 及 direct-maintenance/reference-picker 单测。只读提取交互差异，示例不复制业务规则或 API/Session。这里覆盖交互类型，业务页面的完整 DTO 与权威规则仍在原应用。

| 原资源                  | 合成消费者验证的差异                                  |
| ----------------------- | ----------------------------------------------------- |
| acc/book                | 无启停动作、币种/月份、详情只读字段                   |
| acc/subject             | 账簿筛选/父引用依赖、编辑内启用、多选维度；无独立启停 |
| aux/department          | 上级引用、树形关联保留、启停/删除                     |
| aux/product-category    | 上级引用、启停/删除                                   |
| aux/dictionary-type     | 普通编辑、启停/删除                                   |
| aux/dictionary-item     | 所属类型筛选/引用、整数排序、启停/删除                |
| aux/income-expense-type | 上级引用与启停/删除                                   |
| app/user                | 编码只读、创建密码、角色资格/停用已选回显             |
| app/role                | 权限多选、局部递归规则 Draft                          |
| aux/employee-category   | 普通编辑、启停                                        |
| aux/position            | 普通编辑、启停                                        |
| aux/measurement-unit    | 可空高精度换算系数、启停                              |
| aux/payment-method      | 普通编辑、启停                                        |
| aux/asset-category      | 普通编辑、启停                                        |
| aux/tax-information     | 普通编辑、启停；唯一性留给 Adapter                    |
| aux/operating-entity    | 普通编辑、启停；证件规则留给 Adapter                  |
| aux/employee            | 关联资料选择、启停/删除                               |
| aux/warehouse           | 关联资料选择、启停/删除                               |
| aux/fund-account        | 关联资料选择、启停/删除                               |
| aux/vehicle             | 内/外承运条件切换及引用；精确快照由消费者提供         |

首片只提供上述公共能力与直接维护运行时。后续配置、报表、版本/附件、单据、流程、外壳及完整发布按 [#9–#15](https://github.com/hansonyu183/zerp-ui/issues/9) 的原生阻塞顺序推进。

## 配置运行时（#9）

`defineConfiguration<Draft, Filters, Row, Identity, Evidence>` 与 `ConfigurationRuntime` 提供固定的查询、读取、编辑、保存生命周期。`adapter.get` 返回当前值与强类型 identity（包含消费者自己的 revision）；保存使用原 identity 和独立 Draft。`adapter.empty` 可选，存在时提供新增配置，新增和更新统一由 typed `save` 接收。`get.writable=false` 可将详情限制为只读。权限来自 `permissions.read/write/reconcile`，执行资格及并发校验仍由 Adapter/后端负责。

运行时拥有筛选快照、分页、编辑互斥、反馈及保存后一次列表刷新。成功关闭旧 Draft，下一次编辑重新读取当前 revision。成功但刷新失败锁定写入，重试仅读取。未知请求以原 Attempt 保存；关闭、普通读取、作用域切换或卸载均不解除原作用域的未知锁。核实的 applied/not-applied 必须返回原 attemptId 和非空精确 Evidence；无核实能力不提供 reconcile，观察到相同当前值不能当作请求证据。此锁的生命周期和稳定 Adapter 身份要求同直接维护运行时。

专用编辑区块在消费者装配：`configurationBlock<Draft>()({key, component, catalog})` 检查字段值与目录的组件类型，作为运行时 `blocks` 属性传入。每个字段只装配一个区块，替代该字段的普通表单；组件只接该字段的 `modelValue`、`catalog`、`mode: read|edit`、`disabled`，只发送 `update:modelValue` 与 `pending(boolean)`。值/目录为分离副本；多个区块及普通表单的 pending 聚合，旧编辑实例的事件失效。区块不接收整页 Draft、身份、保存、刷新或解锁函数。目录加载与公司规则由消费者负责，异步加载期间通过该区块 pending 表达；目录和区块装配在一次编辑期间保持稳定。

可运行示例见 `examples/configuration`，启动/构建/独立安装验证使用 package scripts 中的 `dev:configuration`、`build:configuration`、`check:configuration`。三个合成消费者分别展示嵌套映射与局部目录区块、期间状态布尔值、报表定义及递归参数；提供成功、修订冲突、未知后核实已应用/未应用/证据不足、刷新失败等情景。它们使用合成内存 Adapter，不模拟真实服务端权限或宣称真实 ZERP API/E2E 通过。

只读参考为原 ZERP 的 `configuration-page/ConfigurationPage.vue` 和 mapping/period/report-definition 定义：映射的嵌套配置、期间携带 revision 的状态变化、报表定义的参数编辑均归消费者；库不包含会计规则、报表 SQL 协议、Session、固定 API、任意动作执行器或试算。原页面中的观察式读取核实不满足本库精确请求证据契约，示例使用按原请求 ID 存储的合成回执。真实 ZERP 接入仍等待发布后专门工单。
