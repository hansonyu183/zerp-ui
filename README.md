# ZERP UI

独立的 Vue/Vuetify 组件库 `@zerp/ui@0.2.1`，提供认证页、应用页、六类业务视图及公共表单/列表/引用交互，遵循[实施规格 #7](https://github.com/hansonyu183/zerp-ui/issues/7)与[组件层级更新 #16](https://github.com/hansonyu183/zerp-ui/issues/16)。仅通过 GitHub Release 分发，版本不可覆盖；0.x 破坏接口升 minor，修复升 patch。

## 公开组件层级

| 层级     | 组件                                                                                         | 职责                                                 |
| -------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 顶层页面 | `AuthPage`、`AppPage`                                                                        | 登录/注册/密码找回；登录后的导航、品牌、主题和主内容 |
| 业务视图 | `CrudView`、`ConfigurationView`、`ReportView`、`DocumentView`、`VoucherView`、`WorkflowView` | 查询、编辑、写入及核实等固定业务交互；可脱离外壳使用 |
| 复合交互 | `DynamicForm`、`ReferencePicker`、`DataList`                                                 | 可独立使用的表单、引用选择及响应式数据列表           |

`SubmissionRuntime` 和认证子表单仅供库内部复用；消费者的领域 `*Block` 不属于库组件。`define*`、Adapter 类型和主题函数属于非组件 API。`0.1.0` 的组件导入名在 `0.2.0` 中更改，见 [迁移说明](#从-010-迁移)。

## 固定版本安装

从 [ui-v0.2.1 Release](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.2.1) 下载 `zerp-ui-0.2.1.tgz` 和 `SHA256SUMS`，在同一目录校验后安装：

```sh
shasum -a 256 -c SHA256SUMS
npm install --save-exact ./zerp-ui-0.2.1.tgz vue@3.5.40 vuetify@4.1.5 vue-router@5.2.0
```

将 tgz 放在消费者项目的固定路径并提交相应 lockfile；不要使用 latest、源码别名或 registry 同名包。首发基线为 Vue 3.5.40、Vuetify 4.1.5、Vue Router 5.2.0，peer 范围分别为 `~3.5.40`、`~4.1.5`、`~5.2.0`。宿主各提供唯一实例；MDI 字体是已声明的直接依赖，发布包自带所需 woff2 及字体许可证，无需 CDN。Node 26 是本库与独立消费者构建验收基线；消费的是编译后 ESM、声明和 CSS，不需要克隆 ZERP、编译库源码或安装自动导入插件。

## 开发与验证

使用 Node 26 和 packageManager 指定的 pnpm。先 `pnpm install --frozen-lockfile`、`pnpm build`，再运行 `pnpm dev`。示例经包公开入口加载编译产物；修改库后重新 build。其余可用命令见 package.json scripts。

`pnpm check:package` 与各 `check:<切片>` 命令先构建当前库和对应示例，再打包当前 dist，在本库 `.scratch/package-check-*/consumer` 新建独立 manifest/安装树，使用 npm 实际安装同一 tgz；不继承仓库别名或 workspace。检查声明推导、错误类型配对拒绝、生产构建、字体/CSS、私有出口拒绝、浏览器新增/修改及 20 个消费者示例。需要先安装 Playwright Chromium。各切片检查支持 `--tgz <绝对路径>` 复用指定工件。证据 JSON 记录源码基线 SHA、tgz SHA-256、安装目录与退出码。脚本在 finally 中关闭自己启动的浏览器和预览服务器，保留可复核安装工件；可删除该次 package-check 目录回收磁盘。

测试仅使用合成资料与模拟 Adapter，不连接 ZERP API、数据库或生产数据，也不代表真实 ZERP E2E。ZERP 源码、依赖与部署保持原状；真实接入由发布后的[独立工单](https://github.com/hansonyu183/zerp/issues/520)完成。

`pnpm check:release` 必须从干净 commit 运行：执行本库静态检查、完整组件测试、库及七个示例构建，只 pack 一次，再对同一个 tgz 执行七类独立安装/类型/浏览器验收。产物审计拒绝源码/额外文件、缺失声明引用及未声明模块依赖；安装树检查 Vue/Vuetify/Router 的宿主解析相同。CI 执行相同命令并上传证据。结果保留在 `.scratch/release/<SHA>/`；用 `pnpm check:release --tgz <下载工件绝对路径>` 对分发包再次执行全部安装 smoke（不重复组件测试、不重新 pack）。脚本失败不会发布。发布使用验收包原文件，附源码 SHA、变更、SHA256SUMS 和 evidence.json；上传后下载、比对校验并运行分发 smoke。不要重建或覆盖已发布版本。

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

完整的强类型定义、合成 Adapter 与可运行装配见 [独立示例](https://github.com/hansonyu183/zerp-ui/tree/ui-v0.2.1/examples)，`examples/shell` 组合全部运行时；消费者可按需复制示例装配，而无需编译库源码。包包含 ESM、完整声明、限定作用域的 CSS、字体及字体授权。消费者无需编译库内 Vue/TS，也无需自动导入插件。所有示例均使用公开导出。

## 顶层页面

`AuthPage` 用受控 `mode` 与 `values` 呈现 `sign-in`、`register`、`recover`、`reset` 四种表单。`values` 包含 `identifier/password/confirmation`；`capabilities.register/recover` 控制登录页入口。组件发出 `update:values`、`update:mode`、`submit(AuthSubmit)` 与 `retry-brand`；提交时仅携带当前模式需要的值。账号为空、密码为空或确认密码不一致时不能提交。消费者持有输入与 `busy/error/notice`、映射品牌状态，并在模式切换、请求结束和会话恢复时清除密码。`recover` 仅发起申请；验证链接或验证码由消费者处理，验证后才将模式设为 `reset`。库不接收找回凭证，也不持有 API、Session 或跳转。

`AppPage` 提供登录后的品牌、导航、主题、账户意图与默认内容插槽，输出唯一页面主标题。六类业务视图不输出顶层标题；独立装配时由消费者提供标题。消费者拥有 Router、导航过滤、账户操作和主题持久化。`examples/shell` 用合成流程展示两个顶层页面的切换，不代表真实认证。

## 接口与责任

- `defineCrud<Draft, Filters, Row, Identity, Evidence>` 成对检查字段、列与 Adapter；`Fields<T>` 递归检查子项，decimal 只接十进制字符串，boolean、integer、单/多引用、多选枚举各自对应值类型。编译示例见 `tests/contracts.type-test.ts`。
- `CrudView` 接 definition、`scope` 与有限 permissions。`scope` 必须标识账号/会话代次及业务范围；账号或资源切换时更新它，使旧查询、详情及引用响应失效。Adapter 在同一会话中保持稳定身份，消费者不能通过重建 Adapter 清除未知状态。
- definition 不持有 VM、组件、模板或任意命令。有限字段支持 create/edit、静态 readonly、值相等条件及单一父引用依赖；详情可返回 typed readonlyFields。父引用改变时清空其从属选择；Adapter 接收该父引用，筛选资格仍归消费者。
- Adapter 持有公司 DTO/协议/认证与业务规则。query 返回真实 total 或 hasMore；identity 可包含修订/精确采用身份，库按原值携带。empty 获得已提交筛选与 scope。actions 是消费者提供的固定资格事实，执行仍由服务端重验。
- `DynamicForm` 只收所辖值、有限字段、scope、模式与 disabled，回传局部值和聚合 pending；递归子项确认只写入父 Draft，取消父编辑丢弃整个子树。它不获得最终写入、刷新或解锁权限。integer 的未完成输入保留在输入层并阻止提交；decimal 保留原字符串至提交验证，不转浮点数。未改动 null、0 和 false 均原样保存。
- `ReferencePicker` 分离 search/resolve，支持分页、单选和多选；值保存消费者提供的精确身份与 snapshot。resolve 不改写历史 label/snapshot，停用、缺失和页外已选项始终保留，移除由用户显式操作。加载错误显示重试。选择资格和历史是否可提交由消费者/后端判断。
- `DataList` 以同一组行与固定动作呈现桌面表格和手机卡片，区分 total/hasMore。筛选输入显式查询后才提交，更多条件可以折叠；翻页使用已提交筛选。

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

首片只提供上述公共能力与直接维护运行时。后续配置、报表、资料档案/附件、单据、流程、外壳及完整发布按 [#9–#15](https://github.com/hansonyu183/zerp-ui/issues/9) 的原生阻塞顺序推进。

## 配置运行时（#9）

`defineConfiguration<Draft, Filters, Row, Identity, Evidence>` 与 `ConfigurationView` 提供固定的查询、读取、编辑、保存生命周期。`adapter.get` 返回当前值与强类型 identity（包含消费者自己的 revision）；保存使用原 identity 和独立 Draft。`adapter.empty` 可选，存在时提供新增配置，新增和更新统一由 typed `save` 接收。`get.writable=false` 可将详情限制为只读。权限来自 `permissions.read/write/reconcile`，执行资格及并发校验仍由 Adapter/后端负责。

运行时拥有筛选快照、分页、编辑互斥、反馈及保存后一次列表刷新。成功关闭旧 Draft，下一次编辑重新读取当前 revision。成功但刷新失败锁定写入，重试仅读取。未知请求以原 Attempt 保存；关闭、普通读取、作用域切换或卸载均不解除原作用域的未知锁。核实的 applied/not-applied 必须返回原 attemptId 和非空精确 Evidence；无核实能力不提供 reconcile，观察到相同当前值不能当作请求证据。此锁的生命周期和稳定 Adapter 身份要求同直接维护运行时。

专用编辑区块在消费者装配：`configurationBlock<Draft>()({key, component, catalog})` 检查字段值与目录的组件类型，作为运行时 `blocks` 属性传入。每个字段只装配一个区块，替代该字段的普通表单；组件只接该字段的 `modelValue`、`catalog`、`mode: read|edit`、`disabled`，只发送 `update:modelValue` 与 `pending(boolean)`。值/目录为分离副本；多个区块及普通表单的 pending 聚合，旧编辑实例的事件失效。区块不接收整页 Draft、身份、保存、刷新或解锁函数。目录加载与公司规则由消费者负责，异步加载期间通过该区块 pending 表达；目录和区块装配在一次编辑期间保持稳定。

可运行示例见 `examples/configuration`，启动/构建/独立安装验证使用 package scripts 中的 `dev:configuration`、`build:configuration`、`check:configuration`。三个合成消费者分别展示嵌套映射与局部目录区块、期间状态布尔值、报表定义及递归参数；提供成功、修订冲突、未知后核实已应用/未应用/证据不足、刷新失败等情景。它们使用合成内存 Adapter，不模拟真实服务端权限或宣称真实 ZERP API/E2E 通过。

只读参考为原 ZERP 的 `configuration-page/ConfigurationPage.vue` 和 mapping/period/report-definition 定义：映射的嵌套配置、期间携带 revision 的状态变化、报表定义的参数编辑均归消费者；库不包含会计规则、报表 SQL 协议、Session、固定 API、任意动作执行器或试算。原页面中的观察式读取核实不满足本库精确请求证据契约，示例使用按原请求 ID 存储的合成回执。真实 ZERP 接入仍等待发布后专门工单。

## 报表运行时（#10）

`defineReport<Parameters, Row>` 与 `ReportView` 提供独立的参数→查询→分页/导出交互，不使用 CRUD 的 Draft、保存或写入核实。消费者提供 `resource/title/parameters/initialParameters/columns/adapter`，运行时接收 `definition`、含账号/会话代次的 `scope`、`permissions.query/export` 和可选 `pageSize`（默认 20）。资源、作用域、资格或分页大小切换清空本页状态，使迟到查询和导出失效；定义与 Adapter 在使用期间保持稳定。

参数支持有限的 text、integer、decimal、boolean、date、date-range、enum、multi-enum 和引用；字段键和值类型成对检查，不接受递归编辑、任意模板或命令。日期范围为 `[起日, 止日]` 字符串数组，提交时校验真实日期和顺序；可选范围以 null 表示不限制，清空两端恢复 null，必填范围和只填一端仍报错；枚举由消费者提供中文 label。未完成数字输入保留在输入层，decimal 不转浮点数，未改动的 null、0、false 原样传给 Adapter。引用沿用公共 ReferencePicker 的搜索/resolve 与作用域隔离。只传需要的参数，不依赖报表目录或公司 DTO。

`adapter.query({scope, parameters, page, pageSize})` 返回 `Page<Row>`：真实 `total` 或 `hasMore` 二选一。查询必须显式提交，输入编辑不触发请求，翻页和失败重试使用已提交快照；新查询允许替换在途旧查询，旧响应不覆盖当前结果。加载、空态、查询失败分别呈现，失败不会显示为空数据。参数校验失败保留输入；结果类型不符显示稳定列错误，重试仅重新查询。

列支持 text、integer、decimal、boolean、date 和带中文 options 的 enum，`visible=false` 隐藏，`width` 原样交给表格列宽。十进制列只能匹配字符串 DTO，显示原值（含尾零），不转换为浮点数。结果中 null 显示为“—”；布尔显示“是/否”，未知枚举保留原值以避免丢失解释。列及原值类型在展示前检查。表格/移动卡片复用同一个 DataList，无报表专属复制实现。

`adapter.export({scope, parameters})` 可选，返回 `{content: Blob, filename: string}`。导出**点击时的当前有效参数输入**，不借用上次查询条件或当前页；因此仅导出资格也无需先查询。消费者负责后端导出协议、格式和列内容，库持有导出互斥、下载、反馈、失败后的重新导出，以及资源/会话切换后不触发旧下载。Blob URL 在触发下载后回收。query/export 均可按实际能力省略；库只结合已提供的方法与资格事实显示按钮，不推导后端授权，服务端仍须重验权限。

`examples/report` 展示 BatchDTO→hasMore、LedgerDTO→total 两种不同协议映射，以及查询/仅查询/仅导出/无资格、失败重试和空态。全部为消费者侧合成内存数据；日期范围与金额下限演示原值传递，示例不据此模拟业务筛选。运行 `dev:report`；构建与 tgz 独立安装验证分别使用 `build:report`、`check:report`。安装验证包括公开声明与错误配对拒绝、生产构建、CSS/字体解析、真实浏览器参数提交/快照翻页/下载及资格分支。

只读交互参考：原 ZERP `frontend/src/target/components/report-page/{ReportPage.vue,report-data.ts}` 的参数与已应用参数分离、日期范围、原十进制字符串、可见列/宽度及查询/导出资格。后端错误码解释和下载格式属于消费者；库不包含 ZERP API 路径、Session 或报表目录。本片不代表真实 ZERP API/E2E 验收。

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

`examples/voucher` 是经公开包入口运行的普通录入、期初递归录入和只读系统矩阵。消费者侧 `EntryBlock` 展示专用值、目录准备、精确来源采用与十进制字符串；脚本有独立配置身份。合成审计按原 attempt/identity/revision/Submission 和输入匹配，包含已应用、明确未应用、未知、资格不足和刷新失败语义。示例不执行真实 ZERP API、不使用公司数据、不代表真实后端 E2E。

运行/构建/独立 tgz 安装验收使用 `dev:voucher`、`build:voucher`、`check:voucher`。验收覆盖公开声明配对及错误拒绝、两个消费者上下文的真实浏览器创建/克隆/专用录入/来源/递归取消、附件 stage/核实/下载、审批/历史/审计、独立脚本锁与错误恢复，并检查生产构建和 CSS/字体。只读参考为原 ZERP `frontend/src/target/components/document-page/DocumentPage.vue` 的本地 Draft、克隆新身份、专用期初来源、独立脚本保存及提交核实；应用 DTO、载荷全集、编辑器和真实 API 接入留给发布后工单。

## 流程运行时（#13）

`defineWorkflow<InstanceIdentity, NodeIdentity, Revision, Target, Voucher, Audit, Evidence>` 与 `WorkflowView` 封装固定的实例查询/分页、节点与审计读取、节点动作互斥、反馈、写后刷新和精确核实。Adapter 的 `list/get/audit/act` 各自使用消费者身份，不依赖模型、Session、API 路径或路由注册表。页面传入稳定 definition/Adapter、包含账号和会话代次的 scope，以及 read/audit/reconcile、actions、targets 权限事实。后端返回的节点 `eligible` 与权限 actions 取交集；CREATE_CHILD 再取节点 targets 的 key 与权限 targets 的交集。最终授权和 revision 校验仍归后端。

六个动作固定为 OPEN_VOUCHER、CREATE_CHILD、APPROVE_CHILD、REJECT_CHILD、RETRY_CHILD、CANCEL_CHILD；不接受任意状态机、脚本或字符串命令。每次动作保留原 id、scope、resource、instance、node、revision、reason；创建携带强类型 target，打开携带强类型 voucher。节点 label/state 与审计列由消费者映射，库不推断领域状态。输入关键字仅显式查询时采用，分页与重试使用已提交值。失败详情清除旧节点入口，重试不重放动作。实例/作用域/资源/读资格切换使迟到响应失效。

`reconcile(originalAttempt)` 只能以本次请求的精确权威审计返回 applied/not-applied（原 attemptId 与非空 Evidence）或 unknown；消费者必须核对原身份、revision、动作及完整输入。历史同类动作、当前状态相同、无审计权限或证据不足均保持 unknown。普通读取、关闭、切实例和卸载不能解除未知锁；稳定 Adapter/resource/scope 的锁在当前 JS 会话内保留，不声称浏览器重载后的持久恢复。已成功但刷新失败进入只读重试，绝不重发业务动作。核实权限或实例变化使在途核实结果失效。

打开动作明确成功后通过有限的 `open-voucher(Voucher)` 事件交给消费者装配路由与单据正文；未知时不导航，核实成功后用户可以重新打开。库不接收任意页面插槽或整页控制器。`examples/workflow` 以 Vue Router 装配目标资源与已完成的 VoucherView，展示创建下级→打开目标单据→编辑/提交→返回流程→批准与审计；合成后端独立检查资格/revision，按完整原请求匹配审计，提供冲突、未知已应用/未应用/仅历史审计、刷新失败、空态和错误重试。全部为消费者侧合成数据，不代表真实授权或 ZERP API/E2E。

使用 package scripts 的 `dev:workflow`、`build:workflow`、`check:workflow`。tgz 验收在独立安装树检查声明配对、拒绝非法动作/目标/修订、生产构建及 CSS/字体，并对运行示例与独立安装消费者执行相同浏览器流程。只读行为参考为原 ZERP 的 `process-page/ProcessPage.vue`、`node-data.ts`；真实接入与旧实现删除留发布后工单。

## 外壳、品牌与主题（#14）

`AppPage` 提供顶栏、响应式 drawer、分组链接、页标题/页脚、品牌/导航状态及重试意图、账户菜单和受控主题。消费者提供 `Brand`、`LoadState`、已过滤的 `NavigationGroup[]`（Vue Router 目标及有限语义图标）、`ShellAccount` 和 `ThemeChoice`；账户仅输出 `profile`、`change-password`、`sign-out` 意图。主内容槽用于消费者 RouterView/页面装配，不改变六类 runtime 的契约。

宿主创建唯一 Vue/Vuetify/Router 与应用根；将 `createShellThemes({ primary, secondary })` 返回值传给 `createVuetify({ theme: ... })`，并导入 `vuetify/styles`、`@zerp/ui/style.css`。库不创建实例，不读取存储或发请求。默认 MD3 浅色，保留 MD1/2/3 明暗色和官方 blueprint defaults（随外壳受控主题局部切换），另保留 muted 色；仅允许主/辅助品牌色，不接收全量 Vuetify 配置。品牌标识只接受文字或图像资料。外壳及账户浮层样式使用库类，不向宿主注入 reset。

`examples/shell` 是独立公司消费者，通过公开入口组合全部六类已完成 runtime 和各自强类型合成 Adapter。示例持有偏好存储、账户资料/改密/登出/演示登录及 pageshow/storage 恢复；这些内存演示不代表实际身份认证或真实 ZERP API/E2E。改密输入确认/取消和恢复时清空，实际密码策略、请求与会话协议由消费者实现。

使用 `dev:shell`、`build:shell`、`check:shell`。tgz 检查在独立安装树验证类型/非法配对、生产构建、CSS/字体，并在源示例和安装消费者执行六主题、各 runtime 装配、导航链接选中/新标签、错误重试、账户取消/退出/恢复和窄屏导航交互。原 ZERP 仅只读参考 themes.ts 和 App.vue 的官方主题/defaults 选取，本片不改变其账户、主题或部署。

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
