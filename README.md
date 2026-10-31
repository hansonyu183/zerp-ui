# ZERP UI

独立的 Vue/Vuetify 组件库 `@zerp/ui@0.7.0`，提供认证页、应用页、六类业务视图及公共表单/列表/引用交互，遵循[实施规格 #7](https://github.com/hansonyu183/zerp-ui/issues/7)、[组件层级更新 #16](https://github.com/hansonyu183/zerp-ui/issues/16)与[公共能力收敛 #32](https://github.com/hansonyu183/zerp-ui/issues/32)。仅通过 GitHub Release 分发，版本不可覆盖；0.x 破坏接口升 minor，修复升 patch。

## 公开组件层级

| 层级     | 组件                                                                                         | 职责                                                 |
| -------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 顶层页面 | `AuthPage`、`AppPage`                                                                        | 登录/注册/密码找回；登录后的导航、品牌、主题和主内容 |
| 业务视图 | `CrudView`、`ConfigurationView`、`ReportView`、`DocumentView`、`VoucherView`、`WorkflowView` | 查询、编辑、写入及核实等固定业务交互；可脱离外壳使用 |
| 复合交互 | `DynamicForm`、`ReferencePicker`、`DataList`、`RecordDetails`、`EditGuard`、`VoucherEditor`  | 可独立使用的表单、引用选择及响应式数据列表           |

`SubmissionRuntime` 和认证子表单仅供库内部复用；消费者的领域 `*Block` 不属于库组件。`define*`、Adapter 类型和主题函数属于非组件 API。`0.1.0` 的组件导入名在 `0.2.0` 中更改，见 [迁移说明](#从-010-迁移)。

## 固定版本安装

从 [ui-v0.7.0 Release](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.7.0) 下载 `zerp-ui-0.7.0.tgz` 和 `SHA256SUMS`，以该 Release 的源码 SHA、工件哈希及验收证据为准，在同一目录校验后安装：

```sh
shasum -a 256 -c SHA256SUMS
npm install --save-exact ./zerp-ui-0.7.0.tgz vue@3.5.40 vuetify@4.1.5 vue-router@5.2.0
```

将 tgz 放在消费者项目的固定路径并提交相应 lockfile；不要使用 latest、源码别名或 registry 同名包。构建及消费者验收基线为 Vue 3.5.40、Vuetify 4.1.5、Vue Router 5.2.0，peer 范围分别为 `~3.5.40`、`~4.1.5`、`~5.2.0`。宿主各提供唯一实例；MDI 字体是已声明的直接依赖，发布包自带所需 woff2 及字体许可证，无需 CDN。Node 26 是本库与独立消费者构建验收基线；消费的是编译后 ESM、声明和 CSS，不需要克隆 ZERP、编译库源码或安装自动导入插件。

## 开发与验证

使用 Node 26 和 packageManager 指定的 pnpm。先 `pnpm install --frozen-lockfile`、`pnpm build`，再运行 `pnpm dev`。示例经包公开入口加载编译产物；修改库后重新 build。其余可用命令见 package.json scripts。

`pnpm check:package` 与各 `check:<切片>` 命令先构建当前库和对应示例，再打包当前 dist，在本库 `.scratch/package-check-*/consumer` 新建独立 manifest/安装树，使用 npm 实际安装同一 tgz；不继承仓库别名或 workspace。检查声明推导、错误类型配对拒绝、生产构建、字体/CSS、私有出口拒绝、浏览器新增/修改及 20 个消费者示例。需要先安装 Playwright Chromium。各切片检查支持 `--tgz <绝对路径>` 复用指定工件。证据 JSON 记录源码基线 SHA、tgz SHA-256、安装目录与退出码。脚本在 finally 中关闭自己启动的浏览器和预览服务器，保留可复核安装工件；可删除该次 package-check 目录回收磁盘。

测试仅使用合成资料与模拟 Adapter，不连接 ZERP API、数据库或生产数据，也不代表真实 ZERP E2E。ZERP 源码、依赖与部署保持原状；真实接入由发布后的[独立工单](https://github.com/hansonyu183/zerp/issues/520)完成。

`pnpm check:release` 必须从干净 commit 运行：执行本库静态检查、完整组件测试、库及八个示例构建，只 pack 一次，再对同一个 tgz 执行八类独立安装/类型/浏览器验收。产物审计拒绝源码/额外文件、缺失声明引用及未声明模块依赖；安装树检查 Vue/Vuetify/Router 的宿主解析相同。CI 执行相同命令并上传证据。结果保留在 `.scratch/release/<SHA>/`；分发复验须在同一干净源码 commit 下保留 `.scratch/release/<SHA>/evidence.json`，再用 `pnpm check:release --tgz <下载工件绝对路径>` 对下载的同一包复验（不重复组件测试、不重新 pack），核对原证据的源码 SHA 和工件 SHA-256。脚本失败不会发布。发布使用验收包原文件，附源码 SHA、变更、SHA256SUMS 和 evidence.json；上传后下载、比对校验并运行分发 smoke。不要重建或覆盖已发布版本。

## 独立消费者

安装固定版本 tgz，并由宿主提供 Vue `~3.5.40`、Vuetify `~4.1.5`、Vue Router `~5.2.0` 唯一实例。入口仅为 `@zerp/ui` 与 `@zerp/ui/style.css`；模块及所有实际子路径依赖均 external。宿主创建 Vue/Vuetify，导入 `vuetify/styles` 与库 CSS；库不创建 Session、Router、API 客户端或存储键。

```ts
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { createRouter, createWebHistory } from "vue-router";
import { createShellThemes } from "@zerp/ui";
import "vuetify/styles";
import "@zerp/ui/style.css";
import App from "./App.vue";
// routes 由消费者提供；App 由宿主创建唯一 VApp 根。
const router = createRouter({ history: createWebHistory(), routes: [] });
createApp(App)
  .use(createVuetify({ theme: createShellThemes({ primary: "#295787" }) }))
  .use(router)
  .mount("#app");
```

完整的强类型定义、合成 Adapter 与可运行装配见 [0.7.0 独立示例](https://github.com/hansonyu183/zerp-ui/tree/ui-v0.7.0/examples)（源码工作树见 [examples](examples)），`examples/shell` 组合全部运行时；消费者可按需复制示例装配，而无需编译库源码。包包含 ESM、完整声明、限定作用域的 CSS、字体及字体授权。消费者无需编译库内 Vue/TS，也无需自动导入插件。所有示例均使用公开导出。

## 顶层页面

`AuthPage` 用受控 `mode` 与 `values` 呈现 `sign-in`、`register`、`recover`、`reset` 四种表单。`values` 包含 `identifier/password/confirmation`；`capabilities.register/recover` 控制登录页入口。组件发出 `update:values`、`update:mode`、`submit(AuthSubmit)` 与 `retry-brand`；提交时仅携带当前模式需要的值。账号为空、密码为空或确认密码不一致时不能提交。消费者持有输入与 `busy/error/notice`、映射品牌状态，并在模式切换、请求结束和会话恢复时清除密码。`recover` 仅发起申请；验证链接或验证码由消费者处理，验证后才将模式设为 `reset`。库不接收找回凭证，也不持有 API、Session 或跳转。

`AppPage` 提供登录后的品牌、导航、主题、账户意图与默认内容插槽，输出唯一页面主标题。六类业务视图不输出顶层标题；独立装配时由消费者提供标题。消费者拥有 Router、导航过滤、账户操作和主题持久化。`examples/shell` 用合成流程展示两个顶层页面的切换，不代表真实认证。

## 接口与责任

- `defineCrud<Draft, Filters, Row, Identity, Evidence>` 成对检查字段、列与 Adapter；`Fields<T>` 递归检查子项，decimal 只接十进制字符串，boolean、integer、单/多引用、多选枚举各自对应值类型。编译示例见 `tests/contracts.type-test.ts`。
- `CrudView` 接 definition、`scope` 与有限 permissions。`scope` 必须标识账号/会话代次及业务范围；账号或资源切换时更新它，使旧查询、详情及引用响应失效。Adapter 在同一会话中保持稳定身份，消费者不能通过重建 Adapter 清除未知状态。
- definition 不持有 VM、组件、模板或任意命令。有限字段支持 create/edit、静态 readonly、值相等条件及单一父引用依赖；详情可返回 typed readonlyFields。父引用改变时清空其从属选择；Adapter 接收该父引用，筛选资格仍归消费者。
- Adapter 持有公司 DTO/协议/认证与业务规则。query 返回真实 total 或 hasMore；identity 可包含修订/精确采用身份，库按原值携带。empty 获得已提交筛选与 scope。actions 是消费者提供的固定资格事实，执行仍由服务端重验。
- `DynamicForm` 只收所辖值、有限字段、scope、模式与 disabled，回传局部值、聚合 pending 和 `validation: FormValidationState<Draft>`；递归子项确认只写入父 Draft，取消父编辑丢弃整个子树。它不获得最终写入、刷新或解锁权限。integer 的未完成输入保留在输入层并阻止提交；decimal 保留原字符串至提交验证，不转浮点数。未改动 null、0 和 false 均原样保存。
- `ReferencePicker` 分离 search/resolve，支持分页、单选和多选；值保存消费者提供的精确身份与 snapshot。resolve 不改写历史 label/snapshot，停用、缺失和页外已选项始终保留，移除由用户显式操作。加载错误显示重试。选择资格和历史是否可提交由消费者/后端判断。
- `DataList` 以同一组行与固定动作呈现桌面表格和手机卡片，区分 total/hasMore。筛选输入显式查询后才提交，更多条件可以折叠；翻页使用已提交筛选。

`CrudView` 的 `blocks` 复用 `ConfigurationBlock<Draft>` 与 `configurationBlock<Draft>()`；同 key 区块替代普通字段，只获得所辖值、目录、模式及 disabled，并回传局部值和 pending。`CrudAction` 包含独立 `view`；详情 `writable=false`、typed `readonlyFields` 与当前权限共同限制写入。查看复用只读事实呈现，不运行新建校验；`viewLabel(row)` 和 `viewTitle` 只定制有限查看文案。

公开 `CrudViewHandle<Row>` 只有 `openRow(row, readOnly = true): Promise<boolean>` 和 `close(): Promise<boolean>`。外部打开同样检查资格、原 editor、写锁及代次。`queried(filters)` 仅通知成功采用的筛选副本；输入变化或失败查询不会更换已采用口径。`protection(EditProtection)` 和可选 `beforeClose(): Promise<boolean>` 的装配见下文编辑保护；未提供 beforeClose 时由内置 EditGuard 提供继续/放弃确认。

### 独立字段校验

`DynamicForm` 的 `validation` 事件携带 `{ valid, issues: [{ key, message }], pending }`。`valid` 表示当前模型字段校验，`pending` 表示未完成整数文本、引用读取或子编辑工作，两者独立；独立提交须同时满足 `valid && !pending`。`validateFields(fields, values, mode = "edit")` 返回 `{ valid, issues }`，与运行时复用同一个校验实现，不能单独识别尚未发进模型的输入文本。组件负责显示字段反馈；消费者通过公开状态控制提交，无需查询内部 DOM。

字段支持 required、integer min/max、安全整数、text/textarea/password minLength/maxLength，以及既有日期、日期范围、枚举和精确十进制字符串规则。readonly、当前模式不适用或隐藏字段沿现有规则跳过编辑校验；历史事实仍可查看。integer 分离本地未完成文本、最近发出值和父模型采用值：父值由 12 改为 20 或 null 立即同步显示，未完成负号保持 pending，不偷偷提交旧值；无需更换 scope 或重挂载。单/多枚举与引用按精确身份受控回显，0、false、null、空字符串不互换。

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

此表保留直接维护切片的行为来源；当前库同时提供下述配置、报表、资料档案、单据、流程和外壳。各切片的实施与交付记录见 GitHub Issues，真实应用接入另行验收。

## 配置运行时（#9）

`defineConfiguration<Draft, Filters, Row, Identity, Evidence>` 与 `ConfigurationView` 提供固定的查询、读取、编辑、保存生命周期。`adapter.get` 返回当前值与强类型 identity（包含消费者自己的 revision）；保存使用原 identity 和独立 Draft。`adapter.empty` 可选，存在时提供新增配置，新增和更新统一由 typed `save` 接收。`get.writable=false` 可将详情限制为只读。权限来自 `permissions.read/write/reconcile`，执行资格及并发校验仍由 Adapter/后端负责。

运行时拥有筛选快照、分页、编辑互斥、反馈及保存后列表刷新。默认成功关闭旧 Draft；`retainEditor=true` 时在终态确认后刷新列表并通过 `adapter.get` 权威重读，采用新值/identity 后建立新基线继续编辑。成功但刷新失败保持 `writeState="refresh"`，重试仅读取，不重发 save。未知请求以原 Attempt 保存；关闭、普通读取、作用域切换或卸载均不解除原作用域的未知锁。核实的 applied/not-applied 必须返回原 attemptId 和非空精确 Evidence；无核实能力不提供 reconcile，观察到相同当前值不能当作请求证据。此锁的生命周期和稳定 Adapter 身份要求同直接维护运行时。

`ConfigurationViewHandle<Row>` 提供 `newDraft()`、`openRow(row)`、`close()`（均为 `Promise<boolean>`）及只读 `refresh(): Promise<void>`。`initialRow` 的初次及后续采用走同一受保护入口。`beforeClose`、`protection`、成功查询后的 `queried` 与 CRUD 使用同一语义。`draft` 事件返回 `ConfigurationDraft<Draft, Identity> | null`：深只读类型、分离且深冻结的 values/identity 快照；宿主展示或保留快照不取得内部写入权。

继续编辑既有记录可用原 identity 重读；新建记录只能采用 `ConfigurationWriteResult<Identity>` 的 success.identity，或原未知请求的 `ConfigurationReconcileResult<Evidence, Identity>` applied.identity。不能从列表、顺序或草稿猜测新身份。启用 retainEditor 前必须保证协议返回新建权威 identity；已知成功却缺少身份会保持 refresh 锁并明确报错，普通读取不能补造身份，也不会重发 save 或降级成 unknown 核实。定义仅新增 `createLabel`、`saveLabel`、`savedMessage` 固定文案；关键写入状态仍由运行时呈现。

专用编辑区块在消费者装配：`configurationBlock<Draft>()({key, component, catalog})` 检查字段值与目录的组件类型，作为运行时 `blocks` 属性传入。每个字段只装配一个区块，替代该字段的普通表单；组件只接该字段的 `modelValue`、`catalog`、`mode: read|edit`、`disabled`，只发送 `update:modelValue` 与 `pending(boolean)`。值/目录为分离副本；多个区块及普通表单的 pending 聚合，旧编辑实例的事件失效。区块不接收整页 Draft、身份、保存、刷新或解锁函数。目录加载与公司规则由消费者负责，异步加载期间通过该区块 pending 表达；目录和区块装配在一次编辑期间保持稳定。

可运行示例见 `examples/configuration`，启动/构建/独立安装验证使用 package scripts 中的 `dev:configuration`、`build:configuration`、`check:configuration`。三个合成消费者分别展示嵌套映射与局部目录区块、期间状态布尔值、报表定义及递归参数；提供成功、修订冲突、未知后核实已应用/未应用/证据不足、刷新失败等情景。它们使用合成内存 Adapter，不模拟真实服务端权限或宣称真实 ZERP API/E2E 通过。

只读参考为原 ZERP 的 `configuration-page/ConfigurationPage.vue` 和 mapping/period/report-definition 定义：映射的嵌套配置、期间携带 revision 的状态变化、报表定义的参数编辑均归消费者；库不包含会计规则、报表 SQL 协议、Session、固定 API、任意动作执行器或试算。原页面中的观察式读取核实不满足本库精确请求证据契约，示例使用按原请求 ID 存储的合成回执。真实 ZERP 接入仍等待发布后专门工单。

## 报表运行时（#10、#23）

0.3.0 按 [#23](https://github.com/hansonyu183/zerp-ui/issues/23) 增强报表契约。`defineReport<P, R, ResultId, RowId, Target>` 使用 `kind: "parameter" | "fixed"` 判别。两种定义均提供 `resource/title/parameters/initialParameters/columns/rowKey/adapter`；`rowKey(row)` 必须是稳定且页内唯一的字符串或数字。组件接收 `definition`、含操作者/会话代次的 `scope`、`permissions.query/export`、可选 `pageSize`（默认 20）。作用域、资源、报表种类、资格或分页大小切换清除状态并使迟到响应失效。读取资格及服务端授权事实仍由消费者提供和重验。

参数支持有限的 text、integer、decimal、boolean、date、date-range、enum、multi-enum 和引用；字段键和值类型配对，不接受递归编辑、任意模板或命令。日期范围用 `[起日, 止日]`，可选范围以 null 表示不限制；日期、顺序和未完成输入会校验。十进制不转浮点数，null、0、false 原样传给 Adapter，引用复用 ReferencePicker。编辑输入不会触发查询；画面单独显示成功结果对应的已采用条件。

参数型：`adapter.query({scope, parameters, page, pageSize})` 返回 `Page<R>`，`total` 与 `hasMore` 二选一；分页及失败重试使用已提交条件。可选 `adapter.export({scope, parameters})` 按点击时的当前有效输入导出，保留仅导出资格，不要求先查询。query/export 可按资格能力省略。

固定结果型：`adapter.query({scope, parameters, page, pageSize, requestId, signal})` 返回 `ReportPage<R, RowId> & {id: ResultId, summary: ReportSummary<R>, context: string, columns?: readonly ReportColumn<R>[]}`。消费者提供不透明结果身份、权威全结果合计及口径、业务日期等上下文。`page({scope, resultId, page, pageSize, signal})`、可选 `export({scope, resultId, signal})` 及必需 `revalidate({scope, resultId, signal})` 显式使用同一身份。新查询成功才替换旧结果；普通查询/翻页失败保留旧页、条件和合计并提示上下文。查询时采用的列、单元格动作和汇总解释留在结果上，新定义不会重解释旧结果；消费者应采用不可变定义及动作函数，不在闭包中暗藏最后结果。库不计算业务合计、不指定 TTL/容量，也不生成 Excel。

`FixedReportAdapter<P, R, ResultId, RowId>` 的第四泛型与 defineReport 的 RowId 保持一致。query 可返回本次动态 columns；query/page 可返回 `presentation` 及绝对 Unix 毫秒 `expiresAt`，revalidate 的 valid 也可更新 expiresAt。采用的列、参数、结果身份、行身份函数、Adapter、单元格动作、权威合计与逐页展示快照均属于原结果。库不设 TTL；到期、撤权或身份失效会清除结果及已采用通知，并使旧分页/导出/重验回调失效。

`ReportView @parameters` 通知当前输入副本，`@adopted` 通知 `{ parameters, resultId } | null`；只有接受且合格的结果才有采用通知，失效、停用或待重验时发 null。参数型已采用结果对象中的 resultId 为 null。`describeParameters(parameters)` 可生成有限口径文本，收到输入副本。等待替换查询与旧结果分页忙态各自管理：仍有效旧结果可按原身份继续分页、导出或下钻；普通替换失败保留旧结果，待重验及失效结果不能读取。DataList 本身 loading 仍阻止动作/勾选/翻页，不应把替换查询 loading 误传为旧结果不可用。

`ReportPresentation<R, RowId>` 包含 rows 和 groups 两个数组。rows 每项是 `{ rowId, appearance?, cells? }`，cells 按已知列 key 提供样式；数字 1 与字符串 "1" 是不同身份。`ReportAppearance` 仅允许六位十六进制 foreground/background、布尔 bold/italic、left/center/right align，单元格显式 false 可清除行级强调。groups 每项提供稳定 id、label、非负整数 level、firstKey/lastKey、continuedBefore/continuedAfter 及权威 `summary: {caption, values}`；边界必须指向当前页内前后有序的行，同层不交叠，子组必须有上一层包含它的父组。续页事实只出现在对应页边界，并与父组续页匹配。库不累加业务小计；非法样式、重复事实、未知行列或错误分组被拒绝。DataList 显示错误并隐藏无效表格，ReportView 拒绝采用无效新结果并保留仍有效旧结果。没有任意 CSS、HTML、模板或 render 接口。

列按定义数组顺序展示，支持 text、integer、decimal、boolean、date 和 enum；`visible=false` 隐藏，`width` 在宽表中作为列宽及最小宽度。报表使用同一 `DataList` 的 `wide` 模式，窄屏也保留逐列对齐和横向滚动；普通列表继续使用响应式表格/卡片。null/undefined 显示“—”，空字符串显示“（空字符串）”，0 显示“0”，布尔显示“是/否”，未知枚举保留原值。严格 decimal 校验十进制字符串并保留精度及尾零；需审计的异常原文请明确映射到 text 列，不能伪装 decimal。

固定结果的可选 `cell(row, columnKey)` 只返回 `ReportCell<Target>` 的 `record`（href 链接）、`select`（选择关联记录）或 `detail`（查看明细）。每项含可辨识 label、类型化 target 和可选 disabled。`drill` 事件携带 `{scope, resource, resultId, rowId, cell}`，宿主负责业务读取、选择和路由。record 保留原生链接、键盘及修饰键语义；只有普通主键点击发出 drill，其他开页行为遵循 href。待重验和禁用时移除可用链接并禁用相关操作。

停止等待只中止本地接收并提示服务端未确认取消。固定查询可选 `cancel({scope, requestId})`，只有提供此端口才出现主动取消；`ReportCancellation.status` 限定 cancelled/completed/failed/cleanup-unconfirmed，分别反馈已取消、已完成未取消、执行失败及清理未确认；等待取消期间显示进行中。取消与查询的迟到响应均不能替换当前结果。AbortSignal 仅用于停止传输，不构成服务端取消证明。

返回恢复使用 `active` 或 Vue KeepAlive 激活/停用，以及 `snapshot` 事件和 `restore` 属性。宿主保管 `ReportSnapshot<P,R,ResultId,RowId,Target>`，包含输入、已采用条件、结果页、查询时定义和横纵滚动；此快照包含函数引用，供当前会话内存缓存，不是跨整页重载的序列化协议。宿主须按 scope/resource 隔离并在退出会话后丢弃。挂载时或显式恢复匹配的快照，先调用 revalidate；`valid` 才允许分页/导出/下钻，网络失败保留待重验画面和重试入口，expired/forbidden/identity-invalid 清除结果。参数型没有复用结果身份，返回时按已采用条件重读原页。新查询隔离旧查询响应；原合格结果仍可读取。结果、作用域/资源变化、停用和卸载各自隔离所属在途工作，恢复前隐藏待重验缓存。服务端在任一固定结果操作发现权威过期/撤权/身份失效时，抛出公开 `ReportUnavailable(reason, message)`，运行时立即清除不可用事实；普通异常保留仍有效结果。

两种导出均返回 `{content: Blob, filename: string}`；消费者拥有格式及完整数据协议，库负责互斥、下载、错误提示及 Blob URL 回收。`examples/report` 提供 BatchDTO→hasMore、LedgerDTO→total 和固定结果消费者；固定示例支持宽表、三类下钻、精确结果导出、失败保留、可控待决查询/取消、离开/返回、重验失效和会话切换。运行/构建/同一 tgz 的独立安装验证使用 `dev:report`、`build:report`、`check:report`。验收仅使用本库公开入口和合成 Adapter，不代表真实 ZERP/oit-go API、权限或 E2E。

迁移：原无判别的报表定义必须增加 `kind: "parameter"` 和 `rowKey`；旧签名不保留兼容分支。要取得固定结果语义，显式采用 `kind: "fixed"` 并实现 query/page/revalidate，导出改接 resultId，不能沿用参数型 export 或 Adapter 私有的“最后一次结果”。这是 0.3.0 的破坏接口；安装时采用本版本示例及迁移说明。

## 资料档案与附件（#11）

`defineDocument<Draft, Identity, State, Owner, Handle, Audit, Evidence>` 和 `DocumentView` 使用固定的正式资料、开放候选、精确历史、审计四个视图。`adapter.query({scope})` 返回 `DocumentArchive`，各 `DocumentSnapshot` 携带自己独立的 `values/identity/state/owner/attachments/eligible`。消费者将后端 current、submission、version、audit 协议映射为这份事实；Identity 必须含动作所需的精确身份/修订/提交件，State 为原状态，不做数字转换。历史由 Adapter 提供采用时快照，库不再 resolve 当前值覆盖它。此入口展示一个消费者选定的档案；档案列表、路由及具体请求路径仍归消费者。不同档案使用不同 resource 和稳定 Adapter，scope 包含账号/会话代次与数据范围。

提交的原 `DocumentAttempt` 记录 UUID、scope、resource、identity、state、Draft 和附件 Handle；`submit` 是固定方法，`approve/enable/disable` 按实际能力提供。呈现与执行须同时满足页面 `permissions.read/write`、快照的 `eligible` 和具体方法存在；历史不可编辑/审批。服务端仍须检查权限、精确修订和状态。候选不覆盖正式资料，提交后仅刷新一次，审批后由新事实决定正式资料/候选状态。明确失败保留 Draft；未知、成功后刷新失败分别锁定，普通读取只可能清除成功后的刷新锁。

局部区块复用已有 `configurationBlock<Draft>()` 和 `ConfigurationBlockProps<Value,Catalog>`，经 `blocks` 属性装配，不放进 definition。普通字段与区块按字段 key 互斥。详情只给该字段的分离副本、必要目录、read 模式和禁用状态；编辑只回传该字段值及 pending。表单与每个区块分别聚合 pending；关闭/切视图/作用域切换后旧事件无效。区块目录/装配在实例期间保持稳定，不传提交、刷新、解锁或整页对象。`examples/document` 提供独立合成客户定价和产品配方，展示十进制原字符串、消费者目录准备及 pending。

附件协议在 `adapter.attachments`：`validate(File)` 定义消费者限制，`stage(StageAttempt)` 返回成功 Handle、明确失败或未知，`read({scope,owner,handle})` 返回 Blob/filename。选文件仅本地准备，不立即上传；点击提交才逐个暂存，再以成功 Handle 发起业务提交。stage 请求记录独立 attemptId、稳定 fileId、精确 Owner 及原快照身份/状态。成功工件在明确失败后的再次提交、关闭/重开和重挂载时复用，不擅自重传或删除；关闭尚未暂存的普通 Draft 则丢弃本地输入。部分成功后其余失败不会丢弃成功工件。关闭保留成功工件时，再次编辑恢复原 Draft 与修订，由后端重新校验。附件列表区分本地准备、暂存成功和业务成功反馈，暂存不宣称业务已提交。读取使用所选快照的 Owner/Handle；切作用域或视图使迟到下载失效，下载 Blob URL 使用后回收。

可选 `reconcile(originalAttempt)` 返回 `DocumentReconciliation`，消费者须用原 request、精确 identity/revision/submission/state 与权威回执核实；当前值相同、普通查询成功或历史同类事件均不算证据。库只消费原 attemptId、非空 Evidence 和与原阶段匹配的结果；stage 的 applied 还须返回已核实 Handle，之后由用户继续提交，不自动发业务命令；not-applied 才允许重新发送。业务 applied 进入刷新，刷新失败只重读。无方法、无核实资格、证据不足或读取失败均保持未知。未知/在途锁以稳定 Adapter 身份和 resource/scope 在当前 JS 会话内保留，关闭/重挂载不解锁，不声称刷新浏览器后的持久恢复。作用域切换使迟到响应不再改变当前页面；原写入结果仍记录在原作用域，旧 stage 成功后不会继续发起下一笔写入。含成功工件/未知结果的恢复数据留在原会话内以便核实，消费者不得换 Adapter 来绕过锁。

运行、构建、tgz 安装验收分别使用 `dev:document`、`build:document`、`check:document`。安装脚本对示例和全新独立安装树运行相同浏览器流程：定价编辑、暂存未知/精确核实、提交未知/精确核实、附件下载、审批、历史/审计、启停、刷新失败只重读、配方目录与冲突/证据不足。声明检查拒绝错误字段、Identity、Owner 与任意命令；检查生产构建和 CSS/字体解析。所有内容均为合成内存 Adapter，不等同真实 ZERP API/E2E。

只读参考为 ZERP `bf0e6e8d81f025bba81612c0e37b1527b2889eee` 的 `version-archive.component.spec.ts`、`attachments/attachments.ts` 及 #2/#3 的已确认职责/接口决策。库不引入 ZERP DTO、资源后缀分派、ULID/base64、Session、API 路径或生产规则，真实接入留发布后专门工单。

## 单据运行时（#12）

`defineVoucher<Draft, Identity, Revision, Submission, State, Owner, Handle, Audit, Evidence>` 与 `VoucherView` 提供固定的列表、创建/克隆 Draft、局部录入、提交/审批、历史及审计交互。`VoucherIdentity` 分别保留消费者的 voucher、revision 和只读 Submission，快照另有 number/handler 展示；库不解析领域载荷或改变十进制字符串。`adapter.list` 返回带身份、编号和经办人的 total/hasMore 分页列表，`get` 返回 current/history/audit。`empty` 与 `clone` 是可选的同步本地准备方法，消费者负责分配新 voucher/提交身份、映射精确来源和决定附件是否继承；它们不得发起业务写入。只读系统类型省略这两个方法和写入资格即可，库不会为它增加创建动作。新建记录提交后在刷新列表中查看。

当前快照的 `eligible.edit/clone/approve` 和页面 `permissions.read/write/reconcile` 分别控制实际能力；服务端仍须重验资格、原身份、原修订和状态。克隆可以从只读或历史快照采用值，必须由 Adapter 返回新的身份，历史本身不可改。每次业务提交的原 attempt 保留分离输入和原 Submission，不从刷新后的当前值重建。成功只刷新，刷新失败不重放；未知仅用精确审计证据解除。`VoucherAttempt` 只允许 submit/approve，`VoucherStageAttempt` 单独记录 stage 身份，拒绝任意字符串命令和档案启停方法。

单据与资料档案共用私有提交/附件生命周期实现，没有第二套 stage、局部区块或核实路径。附件和 `blocks` 的有限值/目录/read|edit/pending 契约与上一切片一致；递归子项确定只更改父 Draft，取消父层丢弃下层确认值，关闭未暂存的 Draft 丢弃本地输入。成功暂存或未知的上下文跨关闭/卸载保留；`恢复 Draft` 恢复原来源、原身份与工件，不能借另一张单据覆盖它。多个区块 pending 按来源聚合，旧实例事件失效。列表/详情/下载/核实与写入的迟到响应受资源、scope 和资格约束，旧 stage 仅记录原作用域工件，不继续提交。

可选 `script: {definition, permissions}` 使用强类型 `ConfigurationDefinition` 装配独立脚本维护。脚本资源/Adapter 与单据分离，脚本保存保持自己的原 identity/revision/input/attempt 和精确核实；库不执行脚本。脚本 pending/unknown/刷新锁阻止单据写入，单据写入锁阻止脚本保存；普通读取或关闭脚本不能解除未知锁。脚本不通过领域区块取得最终提交或解锁权限。与单据有关的脚本定义和 Adapter 在会话内保持稳定，不应移除装配绕过锁。

`VoucherEditor` 是公开的表头＋明细编辑展示组件，也可独立使用。消费者用 `VoucherEditorDefinition<Header, Row, Child>` 提供表头字段、明细字段/列、稳定的行 key、新行值及可选的子条目列；`VoucherEditorValue` 只包含表头和明细。子条目列通过受限字段定义、空子项和文字摘要接入，“配方”是示例名称。组件只回传局部值与 pending：弹窗确定更新目标行，取消不回传；切 scope、实例或行集合时旧弹窗失效。将其放入 `VoucherView` 的专用 `blocks` 时，区块只映射所辖值，最终提交、刷新、审批和未知结果锁仍由单据运行时持有。数量和金额保持消费者提供的十进制字符串，库不计算合计或配方。

`examples/voucher` 是经公开包入口运行的普通录入、期初表头/明细/配方录入、只读系统和独立组件矩阵。消费者侧 `EntryBlock` 展示局部区块接入、目录准备、精确来源采用与十进制字符串；脚本有独立配置身份。合成审计按原 attempt/identity/revision/Submission 和输入匹配，包含已应用、明确未应用、未知、资格不足和刷新失败语义。示例不执行真实 ZERP API、不使用公司数据、不代表真实后端 E2E。

运行/构建/独立 tgz 安装验收使用 `dev:voucher`、`build:voucher`、`check:voucher`。验收覆盖公开声明配对及错误拒绝、两个消费者上下文的真实浏览器创建/克隆/专用录入/来源/递归取消、附件 stage/核实/下载、审批/历史/审计、独立脚本锁与错误恢复，并检查生产构建和 CSS/字体。只读参考为原 ZERP `frontend/src/target/components/document-page/DocumentPage.vue` 的本地 Draft、克隆新身份、专用期初来源、独立脚本保存及提交核实；应用 DTO、载荷全集、编辑器和真实 API 接入留给发布后工单。

### 办理协议与原请求恢复（#24、#25，0.3.0）

`VoucherView` 保持一个公开门面，定义通过 `protocol: "submission" | "operation"` 判别；不新增第七类运行时，不把办理映射为假 Submission。已有 `defineVoucher`/`VoucherDefinition` 定义现在必须增加 `protocol: "submission"`，保留原提交件、附件、审批和独立脚本语义。办理定义通过 `defineVoucherOperation<Model, Identity, Concurrency>` 创建，组件仅接收 `definition`、强类型 `intent`、`eligible` 和 `recoveryAllowed`；两种 props 不能混用，无旧签名 fallback。这是 0.3.0 的破坏契约，消费者须显式迁移。

`VoucherOperationModel` 按闭合动作配对 input、完整 preview、evidence；动作及中文表达由 `voucherOperationLabels` 固定：send 送审、withdraw 撤回、approve 审核、unapprove 反审核、complete 完成、uncomplete 反完成、void 作废、unvoid 反作废。Intent 带 `{action, owner:{scope,operator,resource}, identity, input}`；scope 须含会话代次。Request 增加消费者产生的稳定 requestId、并发/配置事实、完整有限区块预览和权威 binding；Journal 将原请求和回执按动作配对。公司 DTO、资格、业务逆转及基线计算仍由消费者拥有，字段和独立 VoucherEditor 只持有值与 pending。

Adapter 的 prepare/acceptsPreparation 提供并校验与原目标/完整输入配对的预览；取消仅丢本地准备。确认采用原快照，不采用之后编辑的新输入。库分别复制传给 Adapter/持久端口/验证函数的对象，防止回调原地改写运行时原请求。执行前后消费者后端仍须重验资格、完整目标、并发和业务规则；eligible 只表示当前 UI 资格，变为 false 时清除可见准备，不能解除已发送请求。

消费者的 persistence.load/save/remove 持有存储协议和严格解码；不要将不存在、损坏或读取失败混为同一个结果。save(journal, null) 必须耐久且原子保留空槽，后续 save(journal, requestId) 与 remove(owner, requestId) 必须比较原 ID、禁止改写原完整请求或回退终态。成功返回代表可靠落盘。保存失败（包括保存后响应丢失）禁止 execute，先恢复确认原槽；已知未知请求不能靠空存储读取解锁。同一浏览器内，一个 owner/resource 必须复用同一个稳定 persistence 对象和匹配协议/Adapter；库按该对象及 owner 元组共享互斥，跨标签/进程互斥则由消费者耐久原子协议与后端原请求栅栏保证。不要通过换端口对象绕过原请求归属。

execute/reconcile/seal 返回 unknown 或 Receipt；applied 是权威成功，not-applied 且 sealed=false 必须继续封存，sealed=true 才是可结束的未应用终态。库核对 owner/action/requestId/binding，消费者 accepts 必须校验真实权威证据与原完整 identity/input/concurrency/preview 的绑定；不能只看当前值、同类日志或同 ID。查询无记录返回 unknown；确认/封存协议必须对原请求完整载荷建立权威栅栏，阻止迟到执行。封存可能在竞争中返回 applied，不能把已应用回执改成未应用。

未知时普通读取、关闭页面、丢弃 Draft 或取消输入均不解锁，不分配新 ID。组件重挂载及整页重载恢复原 Journal，只核实或重读，不重放 execute；recoveryAllowed 不足、证据错误、核实异常继续锁定。scope/operator/resource/目标切换使旧画面接缝失效，迟到结果只能保存到原请求记录，不能刷新新画面；消费者 `refresh(settlement)` 也必须严格遵循 settlement.request 与 receipt 的原上下文。终态先耐久保存，再刷新；刷新失败只允许重读。读取成功后保存 refreshed 标记再比较清理，清理失败不会重发业务或重复已确认读取；如果标记保存结果未知，整页恢复可安全重读，仍不重放业务。只有终态/封存与读取清理完成后才能显式准备新请求。

operation 分支公开 `VoucherOperationHandle.prepare(): Promise<void>`，只使用当前强类型 intent 与资格进入同一准备、完整预览及显式确认流程；不暴露 execute/reconcile 或字符串命令。未发送准备在输入、目标或动作变化后失效；已经耐久保存的请求仍携带原 identity/input/owner/binding。权威终态刷新中采用新输入或身份不会丢失原回执或完成归属；刷新前切换目标仍阻止旧请求刷新另一目标。

`protection(EditProtection)` 中 dirty 表示未发送预览，localPending 表示未发送的异步准备；operation 本身不校验宿主编辑草稿，因此 invalid 为 false，外围表单应组合自己的 invalid/localPending。writeState 区分 pending（耐久保留/执行中）、unknown（无可接受终态）、seal（权威未应用待封存）、refresh（已应用或已封存待权威读取/完成）及 blocked（初始恢复或无法确立安全槽）。所有非 idle 状态都阻止普通离开。`confirmationLabel`、`reconcileLabel`、`sealLabel` 只改固定按钮文案；未知、未应用、已应用等关键状态始终保留。

办理在安全上下文中使用浏览器原生 Web Locks 串行化同源 scope/operator/resource 的恢复与终态刷新；缺少此能力时阻塞办理，不以不安全 fallback 继续。浏览器进程关闭会释放 Web Lock，耐久原请求仍由持久端口恢复。`load(owner, requestId?)` 无 ID 读取当前槽，有 ID 必须读取该精确原请求（包括已经结束的记录）。`remove` 是比较原 ID 后的逻辑完成：持久化 `completed: true` 的配对终态与 `refreshed: true`，供其它迟到恢复者验证，不能直接丢弃最后一份完成证据。已完成槽可被 save(..., null) 替换为新请求，但旧 ID 的完成凭据仍须可读；保留/归档策略由消费者决定。库不硬编码 TTL。该有限完成标记补齐 #24 原型未证明的双页面恢复协调，不引入新协议或通用状态机。

`examples/voucher/Operations.vue` 使用公开包入口装配办理，operation-adapter.ts 提供合成权威协议，operation-journal.ts 演示消费者 IndexedDB 严格事务与原子 compare-and-set；示例存储及回执仅是合成证据，不代表真实业务 API、授权或服务端并发验证。运行/构建/同一 tgz 的独立安装仍使用 `dev:voucher`、`build:voucher`、`check:voucher`，展开“独立单据办理示例”即可演示完整路径和整页恢复。#24 的临时控制器、原型 scripts 与专属测试已删除，设计证据仍在该工单和 Git 历史。正式发布继续走完整 release gate。

## 流程运行时（#13）

`defineWorkflow<InstanceIdentity, NodeIdentity, Revision, Target, Voucher, Audit, Evidence>` 与 `WorkflowView` 封装固定的实例查询/分页、节点与审计读取、节点动作互斥、反馈、写后刷新和精确核实。Adapter 的 `list/get/audit/act` 各自使用消费者身份，不依赖模型、Session、API 路径或路由注册表。页面传入稳定 definition/Adapter、包含账号和会话代次的 scope，以及 read/audit/reconcile、actions、targets 权限事实。后端返回的节点 `eligible` 与权限 actions 取交集；CREATE_CHILD 再取节点 targets 的 key 与权限 targets 的交集。最终授权和 revision 校验仍归后端。

六个动作固定为 OPEN_VOUCHER、CREATE_CHILD、APPROVE_CHILD、REJECT_CHILD、RETRY_CHILD、CANCEL_CHILD；不接受任意状态机、脚本或字符串命令。每次动作保留原 id、scope、resource、instance、node、revision、reason；创建携带强类型 target，打开携带强类型 voucher。节点 label/state 与审计列由消费者映射，库不推断领域状态。输入关键字仅显式查询时采用，分页与重试使用已提交值。失败详情清除旧节点入口，重试不重放动作。实例/作用域/资源/读资格切换使迟到响应失效。

`reconcile(originalAttempt)` 只能以本次请求的精确权威审计返回 applied/not-applied（原 attemptId 与非空 Evidence）或 unknown；消费者必须核对原身份、revision、动作及完整输入。历史同类动作、当前状态相同、无审计权限或证据不足均保持 unknown。普通读取、关闭、切实例和卸载不能解除未知锁；稳定 Adapter/resource/scope 的锁在当前 JS 会话内保留，不声称浏览器重载后的持久恢复。已成功但刷新失败进入只读重试，绝不重发业务动作。核实权限或实例变化使在途核实结果失效。

打开动作明确成功后通过有限的 `open-voucher(Voucher)` 事件交给消费者装配路由与单据正文；未知时不导航，核实成功后用户可以重新打开。库不接收任意页面插槽或整页控制器。`examples/workflow` 以 Vue Router 装配目标资源与已完成的 VoucherView，展示创建下级→打开目标单据→编辑/提交→返回流程→批准与审计；合成后端独立检查资格/revision，按完整原请求匹配审计，提供冲突、未知已应用/未应用/仅历史审计、刷新失败、空态和错误重试。全部为消费者侧合成数据，不代表真实授权或 ZERP API/E2E。

使用 package scripts 的 `dev:workflow`、`build:workflow`、`check:workflow`。tgz 验收在独立安装树检查声明配对、拒绝非法动作/目标/修订、生产构建及 CSS/字体，并对运行示例与独立安装消费者执行相同浏览器流程。只读行为参考为原 ZERP 的 `process-page/ProcessPage.vue`、`node-data.ts`；真实接入与旧实现删除留发布后工单。

## 外壳、品牌与主题（#14）

`AppPage` 提供顶栏、响应式 drawer、分组链接、页标题/页脚、品牌/导航状态及重试意图、账户菜单和受控主题。消费者提供 `Brand`、`LoadState`、已过滤的 `NavigationGroup[]`（Vue Router 目标及有限语义图标）、`ShellAccount` 和 `ThemeChoice`；账户仅输出 `profile`、`change-password`、`sign-out` 意图。主内容槽用于消费者 RouterView/页面装配，不改变六类 runtime 的契约。

宿主创建唯一 Vue/Vuetify/Router 与应用根；将 `createShellThemes({ primary, secondary })` 返回值传给 `createVuetify({ theme: ... })`，并导入 `vuetify/styles`、`@zerp/ui/style.css`。库不创建实例，不读取存储或发请求。默认 MD3 浅色，保留 MD1/2/3 明暗色和官方 blueprint defaults（随外壳受控主题局部切换），另保留 muted 色；仅允许主/辅助品牌色，不接收全量 Vuetify 配置。品牌标识只接受文字或图像资料。外壳及账户浮层样式使用库类，不向宿主注入 reset。

临时导航复用 Vuetify 的响应式 drawer、遮罩与焦点约束，并支持 Escape 关闭后归还焦点至本次打开按钮；桌面常驻导航不被 Escape 折叠。普通导航点击关闭临时 drawer，修饰键链接保留当前导航。窄屏顶栏分两行容纳品牌、主题及账户入口，账户完整身份保留可访问名称。正常宿主装配无需定位内部 class 或中文 aria-label 模拟点击。

`examples/shell` 是独立公司消费者，通过公开入口组合全部六类已完成 runtime 和各自强类型合成 Adapter。示例持有偏好存储、账户资料/改密/登出/演示登录及 pageshow/storage 恢复；这些内存演示不代表实际身份认证或真实 ZERP API/E2E。改密输入确认/取消和恢复时清空，实际密码策略、请求与会话协议由消费者实现。

使用 `dev:shell`、`build:shell`、`check:shell`。tgz 检查在独立安装树验证类型/非法配对、生产构建、CSS/字体，并在源示例和安装消费者执行六主题、各 runtime 装配、导航链接选中/新标签、错误重试、账户取消/退出/恢复和窄屏导航交互。原 ZERP 仅只读参考 themes.ts 和 App.vue 的官方主题/defaults 选取，本片不改变其账户、主题或部署。

## 公共详情与编辑保护（#26，0.3.0）

`VoucherEditor` 的 `mode: "read"` 复用表头、明细与所属行子项布局，表头和子项采用只读事实呈现，不挂载禁用表单或执行新建校验；编辑模式继续使用现有字段。打开未确认的明细或子项编辑时 `pending` 为 true，确认、取消或切换上下文后清理；这是局部未完成输入，不是业务写入状态。

剩余分组资料使用 `RecordDetails<T, Intent>`：接收 `value`、`groups: readonly DetailGroup<T, Intent>[]`、`scope` 与必填的记录/加载代次 `instance`。每组仅包含 key、label、`DetailFields<T, Intent>`；字段按属性类型配对 text/decimal/date/enum、integer、boolean、reference、texts 或 records。重复记录明确提供 rowKey、rowLabel 和子字段；原生展开控件保留所属记录名称。decimal 不转数值，缺失值显示 `—`、空字符串显示 `（空字符串）`、空列表显示 `（空列表）`，0 和 false 分别显示 `0` 和 `否`，异常历史字符串原样显示。引用采用传入的历史 id/label/snapshot，不查询当前名称、不解释 snapshot；可选 related 映射只通过强类型 `related(Intent)` 事件交给宿主。详情不接 API、Session 或 Router，也不推断历史回执。切 scope、instance 或值快照后旧展开内容和事件失效；若同一记录重新读取，宿主也应更新 instance。

`EditProtection` 是 `{ dirty, localPending, invalid, writeState }`。CRUD/配置的 dirty 比较当前 Draft 与最初业务值基线，只打开编辑为 false，改后还原为 false，权威重读采用后更新基线。localPending 独立记录未完成文本或区块异步工作，即使模型未变也须保护；invalid 表示当前编辑模型不满足字段规则。写入状态 `EditWriteState` 为 idle/pending/unknown/refresh/seal/blocked，不能将非 idle 全称作 unknown。

`EditGuard` 通过公开的 `EditGuardHandle.requestLeave(): Promise<boolean>` 提供有限离开接缝。必填 props 是 scope、instance、active、dirty、writeState，另有可选 localPending；默认插槽仅在 active 时呈现。无修改、无局部 pending 且 idle 直接返回 true；dirty 或 localPending 显示“继续编辑 / 放弃本地修改”，继续返回 false，放弃发出 discard 后返回 true。宿主在 discard 中只销毁本地 Draft，并重置局部编辑。invalid 本身不等于未保存内容，不作为独立离开锁；它用于阻止无效提交。所有非 idle 写入/恢复状态拒绝普通离开，即使 dirty 已是 false；guard 不保存、取消业务请求、核实或解锁。

CrudView/ConfigurationView 的 `beforeClose` 可调用宿主 guard.requestLeave，未提供时由内部 guard 保护。await 后运行时复核原编辑上下文，旧确认不能关闭新页面；写入锁优先，beforeClose 返回 true 也不能放弃已发送请求。外围路由可将 runtime protection 的 dirty/localPending/writeState 传给同一个 EditGuard，提交资格另合并 invalid。
scope、instance、active 或写入状态变化以及卸载，使待决确认返回 false；旧按钮不能影响新确认。身份失效或撤权时宿主直接清除 Draft、将 active 设为 false 或卸载页面，并按认证策略导航，优先于普通离开接缝。宿主持有 dirty 基线、路由守卫和 beforeunload；await 后须复核原上下文仍有效。组件不注册全局导航拦截、监听器或计时器，关闭确认恢复原触发焦点。默认插槽仅用于包裹受保护内容，不承担业务页面运行时或动态模板配置。

独立页面 [examples/details](examples/details) 仅经公开包入口装配 VoucherEditor、RecordDetails、EditGuard 与强类型合成 Adapter，演示查看→展开所属子项→编辑→继续/放弃→离开，以及身份清理、写入锁和宿主 beforeunload 的注册/撤销。使用 `dev:details`、`build:details`、`check:details`；后者对同一 tgz 的全新安装树和本库示例执行相同键盘、焦点、原值与保护行为，检查声明和生产构建。完整 release gate 也纳入此示例。全部仅为本库合成证据，不代表真实 ZERP/oit-go API/E2E。

迁移：只读 VoucherEditor 不再提供禁用 input 作为读取方式，应依赖可见事实或原值；调用方不得依赖其旧 DOM。0.7.0 独立编辑宿主将局部 pending 单独传给 localPending，将真实写入/恢复状态传给 writeState；既有 VoucherView 的锁仍由其运行时持有。详情与 EditGuard 最初引入于 0.3.0，本版保护迁移见下表；真实应用接入仍由独立工单完成。

## 从 0.6.0 或 0.6.1-oit.3 迁移至 0.7.0

本次按 [#32](https://github.com/hansonyu183/zerp-ui/issues/32) 收敛公共能力。保护通知和报表呈现等公开契约变化采用 minor 版本 0.7.0；一次更新 Adapter、事件与类型，不保留定制运行时、旧事件签名或动作别名。下表中的定制包是审计来源，不能视为正式发布基线。

| 能力               | 正式 0.6.0 / 定制 0.6.1-oit.3                            | 0.7.0 接入                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 整数与枚举受控回显 | 整数父模型采用可能残留旧输入；定制枚举 selected 修补     | 直接采用 modelValue；整数未完成文本仍 pending，不再换 scope/remount；枚举和引用保留精确值及历史项                                                                                   |
| 独立字段验证       | pending 不代表完整校验；宿主可能补写 DOM 约束            | 声明 required/min/max/minLength/maxLength 等有限字段约束，监听 validation；提交使用 valid && !pending；纯模型验证使用 validateFields                                                |
| 编辑保护           | 定制 `{ dirty, pending }` 将编辑存在、局部工作和写锁混用 | 监听 `EditProtection` 的 dirty/localPending/invalid/writeState；EditGuard 接 dirty/localPending/writeState，提交另检查 invalid；pending/unknown/refresh/seal/blocked 均不能普通离开 |
| CRUD 区块与查看    | 定制 blocks、view、只读资格及有限文案                    | 用真实 Draft 的 configurationBlock，配置独立 view、get.writable、typed readonlyFields、viewLabel/viewTitle；查看不做新建校验                                                        |
| CRUD 外部入口      | 定制匿名句柄、关闭及查询通知                             | 标注 `CrudViewHandle<Row>`，用 openRow(row, readOnly = true)/close；beforeClose 只请求本地离开，queried 只反映成功采用的筛选                                                        |
| 配置入口与草稿     | 定制 newDraft/openRow/refresh、initialRow、draft         | 标注 `ConfigurationViewHandle<Row>`；newDraft/openRow/close 均 await 布尔结果；draft 是深只读隔离快照，不直接写入；initialRow 使用同一保护                                          |
| 配置保存后继续     | 定制 retainEditor 与保存文案                             | retainEditor 经终态确认、列表刷新及 get 权威重读；创建 success/applied 必须给权威 identity，缺失保持 refresh；使用 createLabel/saveLabel/savedMessage                               |
| 固定报表定义       | 0.6.0 静态列；定制查询动态列/上下文                      | query 可给 columns/context/summary；`FixedReportAdapter<P,R,I,K>` 的 K 与 defineReport 行身份类型一致，采用结果持有原定义与身份                                                     |
| 报表呈现           | 定制字符串键映射、宽松样式/分组                          | 迁移为 `ReportPresentation<R,K>` 的精确 rowId 数组和 groups；只允许有限颜色/字形/对齐，明确组边界/层级/续页及权威小计；错误事实被拒绝，不静默过滤                                   |
| 报表条件与有效性   | 定制输入/采用通知与到期处理                              | 分别接 parameters 与 adopted；adopted=null 清除外围结果口径；query/page/revalidate 的 expiresAt 为权威绝对毫秒；恢复先重验并还原页和双轴滚动                                        |
| 新查询与旧结果     | 定制全局 loading 或失败后强制重验                        | 替换查询与有效旧结果读取分离；失败保留仍有效结果；分页/导出/下钻始终使用原结果，失效或待重验禁止读取                                                                                |
| 完成/反完成        | 定制 finish/finish_r                                     | 采用 ListAction complete/uncomplete，由消费者 Adapter 映射原生命令；保留三个直接动作和更多菜单，不改既有 check/uncheck 名称                                                         |
| 单据办理入口       | 定制匿名 prepare 与保护通知                              | 标注 VoucherOperationHandle，只调用无参数 prepare；完整预览及确认仍必经；已发送请求保留原 identity/input/owner/binding，权威刷新采用新值不丢原回执                                  |
| 单据操作文案       | 定制确认/核实/封存文案                                   | 使用 confirmationLabel/reconcileLabel/sealLabel，不改变动作 ID、资格或关键状态；operation.invalid=false，外层另组合草稿验证                                                         |
| 外壳               | 宿主 Escape/窄屏内部 DOM 补丁                            | 采用 AppPage 内建临时导航 Escape/焦点归还及窄屏布局；宿主仍持有导航、账户、主题偏好；移除应用补丁属于后续接入工作                                                                   |

已有 0.6.0 的 DocumentView、WorkflowView、VoucherEditor 和 submission 协议保持各自职责；不为使用本版而强行替换不匹配的应用页面。真实 oit-go/ZERP 依赖升级、Adapter 迁移、包装器收窄、打印接线、耐久记录解码及 DOM 补丁删除由发布后接入工单负责。本库的合成组件和同一 tgz 验收不代表这些应用已经升级或真实 API/E2E 已通过。

### 定制来源逐项归并审计

审计基线为正式源码 `c7973a07a53462714132a2e1b2b2a761e39e1c44`，定制源码为 `4b1f4b7932354806307f5b529b1b71c0fd795c93`；来源差异共 26 个文件（1262 行新增、120 行删除）。实际消费工件 `0.6.1-oit.3` 的 SHA-256 为 `ada75ce7cd9120b4ced6f9366aa8c53d9fb93df97253c7e39e5a5bf63f7362e0`。按公共职责重写并在本库验收，没有整体合并定制分支；以下覆盖全部来源文件，具体契约以上述各节及导出类型为准。

| 来源文件                          | 结论                   | 0.7.0 归属与排除项                                                                                                                |
| --------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/DynamicForm.vue`             | 吸收并改写             | 吸收单/多枚举 selected 语义；改为精确受控回显，补齐整数父值同步和独立 validation；排除依靠 falsy 转换或 remount 的修补            |
| `src/CrudView.vue`                | 改写                   | 吸收区块、查看、权限、打开/查询通知；改为真实业务值基线及统一保护，关闭/切换重新核对代次；排除 editor 存在即 dirty、关闭未知锁    |
| `src/ConfigurationView.vue`       | 改写                   | 吸收有限入口、初始采用、快照和保留编辑；采用冻结副本、权威身份/重读及同一保护，排除猜测新建身份                                   |
| `src/configuration.ts`            | 改写                   | 保留 typed block，公开 ConfigurationViewHandle、ConfigurationDraft 与带权威 identity 的结果；有限创建/保存/成功文案               |
| `src/DataList.vue`                | 改写                   | 吸收有限呈现、分组与权威小计；校验精确行列引用和层级，保留动作/勾选忙态；排除任意样式和无效事实静默过滤                           |
| `src/ReportView.vue`              | 改写                   | 吸收动态列、输入/采用事件、结果口径、到期和位置恢复；独立查询/结果代次，失败保留有效旧结果；排除全局 loading 封锁全部旧结果读取   |
| `src/report.ts`                   | 改写                   | 公开精确 RowId 呈现数组、ReportPage/Validity.expiresAt、第四 Adapter 泛型；明确合法样式、组边界与权威小计；排除字符串强制身份转换 |
| `src/RowActions.vue`              | 吸收语义，排除原生命名 | 完成/反完成归为 complete/uncomplete，保留图标、名称与更多菜单；不导出 finish/finish_r                                             |
| `src/VoucherOperationRuntime.vue` | 改写                   | 吸收准备入口与有限文案；细分保护，发送后保留原回执/刷新归属；排除输入采用导致已发送请求失效及所有非 idle 统称 unknown             |
| `src/VoucherView.vue`             | 改写                   | 同一门面转发 VoucherOperationHandle.prepare 与 EditProtection，不开放 execute、核实或私有 VM                                      |
| `src/voucher-operation.ts`        | 吸收并改写             | 有限 confirmationLabel/reconcileLabel/sealLabel；显式公开无参数 prepare 句柄；原请求持久化/精确证据协议不另起一套                 |
| `src/contracts.ts`                | 分项吸收并改写         | 吸收 CrudAction.view、typed readonlyFields/writable、查看文案和 CrudViewHandle；完成动作改为公共名称；共享字段约束仍严格配对      |
| `src/index.ts`                    | 按公共契约重建         | 仅导出上述有限组件、句柄、保护、校验和报表类型；不导出私有 session、VM、验证控制器或兼容别名                                      |
| `src/style.css`                   | 吸收并收窄             | 保留作用域内分组/小计及必要交互布局；增加本规格外壳窄屏布局，不接受消费者任意 CSS 作为报表事实                                    |
| `examples/direct/App.vue`         | 改写                   | 公开入口展示 typed CRUD 区块/句柄/保护、独立字段验证与 complete/uncomplete；合成数据，不引入应用 DTO                              |
| `examples/report/FixedReport.vue` | 改写                   | 合成动态列、有限呈现、权威小计/到期、采用上下文及有效旧结果交互，使用精确 RowId 类型                                              |
| `tests/forms.spec.ts`             | 改写并扩展             | 公共字段行为覆盖父采用、未完成输入、精确枚举/引用、validation 与历史事实；不依据内部 DOM 判断提交资格                             |
| `tests/direct.spec.ts`            | 改写并扩展             | 公共查看/编辑、只读资格及现有写入回归；相关保护/句柄/区块断言汇入公开 editors 测试，不测试私有 VM                                 |
| `tests/configuration.spec.ts`     | 改写并扩展             | 公共异步离开、快照、权威创建身份和只重读继续编辑；旧“未知仍可关闭”断言改为保持锁                                                  |
| `tests/report.spec.ts`            | 改写并扩展             | 公共动态结果、有限呈现负例、权威期限、恢复重验、旧结果读取及迟到事件隔离                                                          |
| `tests/row-actions.spec.ts`       | 改写并扩展             | 验证公共完成动作、三项与更多菜单、重排行身份和失效旧事件；排除原生命令别名                                                        |
| `tests/voucher-operation.spec.ts` | 改写并扩展             | 公开 prepare/完整确认、保护状态、有限文案和成功刷新输入/身份采用；保留耐久请求与精确证据回归                                      |
| `scripts/check-package.mjs`       | 改写并扩展             | 复用同一 tgz 独立安装、类型/资源/唯一依赖和浏览器流程，新增公共能力检查；无源码别名或应用依赖                                     |
| `package.json`                    | 替换                   | 统一正式目标 0.7.0；不发布 oit 后缀或新建第二套运行时依赖；既有 pnpm lockfile 无根包版本字段，无依赖变更                          |
| `README.md`                       | 替换                   | 统一真实公共接口、固定版本入口、迁移映射和本表；不将定制来源或本地验收称作正式发布                                                |
| `CHANGELOG.md`                    | 替换                   | 记录本次公共行为与破坏接口；历史发布记录保留，新版交付状态以 Release 证据为准                                                     |

本规格另补齐来源中没有的共享 `validateFields`、EditProtection/EditGuard 语义和 AppPage Escape/焦点/窄屏行为；复用既有 Vue/Vuetify、校验、事实展示和消费者验收设施，没有增加依赖、第二套表格或写入控制器。OitField/OitRows、公司 DTO/原生动作码、API/Session/Router、存储键/回执解码、打印规则和应用内部补丁均排除在库内实现之外。

## 从 0.1.0 迁移

`0.2.0` 不提供旧组件名或旧定义名的别名；消费者应一次性更新导入和模板标签。

| 0.1.0                                                              | 0.2.0                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| `ZerpShell`                                                        | `AppPage`                                                 |
| `DirectRuntime`、`defineDirect`、`DirectAction/Adapter/Definition` | `CrudView`、`defineCrud`、`CrudAction/Adapter/Definition` |
| `ConfigurationRuntime`、`ReportRuntime`、`VersionRuntime`          | `ConfigurationView`、`ReportView`、`DocumentView`         |
| `DocumentRuntime`、`WorkflowRuntime`                               | `VoucherView`、`WorkflowView`                             |
| `ListSurface`                                                      | `DataList`                                                |

`Version` 定义函数及类型更名为 `Document`；原 `Document` 定义函数及类型更名为 `Voucher`。流程动作和事件分别由 `OPEN_DOCUMENT`、`open-document` 改为 `OPEN_VOUCHER`、`open-voucher`，节点及动作载荷的 `document` 改为 `voucher`。`NavigationIcon` 的 `document` 改为 `voucher`。这里的 `Document` 指资料/档案，`Voucher` 指单据。

`AuthPage` 是新增的顶层组件。业务视图不再输出 `<h1>`；由 `AppPage` 或独立消费者提供页面标题。`DynamicForm`、`ReferencePicker`、各 `define*` 的领域契约及六类写入生命周期保持原有语义。

## 内容写入与受控导航（#27、#28，0.4.0）

0.4.0 在 operation 协议的八种状态动作外增加 `create`（创建）、`edit`（保存修改）、`delete`（删除）。仍通过同一个 `VoucherView`、强类型原输入和消费者的完整权威预览办理；`VoucherEditor` 只编辑本地表头/明细，不拥有写入或解锁。动作、目标或原输入变化使旧预览失效；已发送请求继续按原快照核实。

`adapter.refresh` 改接 `VoucherOperationSettlement<Model, Identity, Baseline>`，包含按动作配对的 `request` 与 `receipt`。消费者从 `request.identity/input` 读取原目标和完整输入，从已验证的 `receipt.evidence` 读取创建结果身份或删除事实，完成结果展示/读取与删除后清理。终态保存和整页恢复保留这些证据；刷新失败只重读，不再 execute。 operation 分支同时发出强类型 `settled(settlement)` 通知；消费者通过该通知幂等呈现终态结果或提供已封存原输入恢复。即使 journal 已标记 refreshed/completed，重挂载和整页恢复仍交付已验证终态，避免为找回新建身份重复 refresh；通知本身不执行写入、刷新或解锁。尚未应用的创建不得伪造新对象身份。不得继续使用 0.3.0 的 `refresh({ owner, identity })` 签名；升级至 0.4.0 时一次性迁移，不提供兼容分支。存储版本和已存在 journal 的解码/必要转换归消费者，同一个原请求的 binding、终态和完成事实不能被转换丢弃。

独立单据合成消费者演示内容创建、采用权威结果进行修改、删除及重载恢复。全部为合成数据，不连接真实 API；也不代表 OIT 专用单据、权限或业务规则已验证。

`AppPage` 新增可选 `selectedNavigationKey: string | null`。未传入时使用 RouterLink 的路由派生活跃态；传入时完全按宿主提供的条目 key 呈现唯一高亮和 `aria-current="page"`，null 或不存在的 key 不选中任何项。条目 key 应全局唯一。宿主负责 path/query、目录排序和授权，库保持 href、修饰键、新标签和手机导航行为。同一路径不同 query 的合成入口见外壳示例。

本节能力最初包含于 `ui-v0.4.0` 工件；当前安装入口与示例版本见本文开头。0.3.0 消费者须迁移 refresh 接口；不覆盖既有版本，也不提供旧签名兼容层。

## 列表行操作（0.5.0）

DataList 的 actions 按行返回 ListAction，基础动作包含 view、edit、enable、disable、delete；当前 ListAction 同时包含下述流程与完成动作。最多三个动作使用语义图标直接展示，其余放入“更多操作”菜单；调用者先按业务权限过滤并指定顺序。库提供名称提示、可访问名称及键盘菜单，loading/disabled 阻止派发动作，无可用动作时省略操作列。

查看动作可通过 viewHref(row) 提供现有详情地址，保留链接及修饰键语义；没有地址时派发 view 事件，由消费者打开同页详情或弹窗。修改动作仍由消费者执行原业务确认和提交。rowKey 应使用业务身份，原记录更换时旧菜单失效。

AppPage 的 NavigationGroup 可设置 ungrouped，直接展示其中的一级链接，不生成折叠子菜单。

## 列表流程与勾选（0.6.0）

ListAction 在 0.6.0 增加 send、withdraw、check、uncheck、void、unvoid，对应送审、反送审、审核、反审核、作废、反作废；0.7.0 增加 complete/uncomplete（完成/反完成），不导出 finish/finish_r 别名；仍最多三个直接图标，其余进入更多菜单。业务资格由消费者过滤。

DataList 通过 selectedKeys 及 update:selectedKeys 受控勾选记录，启用时必须提供稳定 rowKey。selectable 按行限制勾选，表头仅全选当前页的可选记录；loading/disabled 阻止变更。消费者负责翻页/筛选清理及批量请求，不由组件推断业务或提交。
