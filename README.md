# ZERP UI

`@zerp/ui` 是独立发布的 Vue/Vuetify 完整页面库。正式规格与交付记录在本仓库 GitHub Issues；当前页面边界见 [#40](https://github.com/hansonyu183/zerp-ui/issues/40)，继承 #7/#22/#32 未冲突的生命周期和原请求保证。

## 公开入口

只有 `AuthPage` 与 `AppPage` 两个公开 Vue 组件。消费者提供强类型页面定义、字段、分组、顺序、数据与 Adapter；库决定完整页面、领域区块、顶栏、弹层、反馈和响应式布局。不接收主内容插槽、消费者组件、模板、render 或 CSS 布局配置，不提供内部组件子路径、别名或兼容包装器。

公司 DTO、业务规则、API 路径、请求、凭证、Session、Router、导航过滤和页面选择由消费者持有。库不会创建公司 API 客户端、Session store 或路由注册平台。原 ZERP/oit-go 保持只读，真实应用接入由发布后的独立工单负责。

## 固定版本安装

0.9.0 补齐耐久恢复、异步草稿协作、有限业务交互、批量办理、处理及打印输出页面；包含 0.8.1 的页面切换修复。历史工件保持不可变。

从 [ui-v0.9.0 Release](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.9.0) 下载 `zerp-ui-0.9.0.tgz` 与 `SHA256SUMS`，校验后安装原文件：

```sh
shasum -a 256 -c SHA256SUMS
pnpm add ./zerp-ui-0.9.0.tgz
```

宿主仅保留一套 Vue、Vuetify、Router。当前验证基线为 Vue 3.5.40、Vuetify 4.1.5、Vue Router 5.2.0；peer 范围见 package.json。导入 `vuetify/styles` 和 `@zerp/ui/style.css`，将 `createShellThemes()` 传给宿主唯一的 `createVuetify`。图标字体随包分发，无公司私有依赖。

## 完整页面

先用原有 `defineCrud`、`defineConfiguration`、`defineReport`、`defineDocument`、`defineVoucher`、`defineOperation` 或 `defineWorkflow` 定义领域契约，再用对应页面工厂封装。工厂保留字段/值、行/身份、动作/输入/证据的类型配对；返回的 `PageDefinition` 不能携带任意组件或布局回调。

| 页面工厂                  | 承接能力                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| `defineCrudPage`          | 查询、分页、查看、编辑、创建、启停/删除、局部区块、受控勾选与有限列表意图  |
| `defineConfigurationPage` | 新建、打开、保存、权威身份与重读、保留编辑及只读草稿事实                   |
| `defineReportPage`        | 参数型或固定结果报表、分页、分组、权威合计、导出、下钻、取消与返回恢复     |
| `defineDocumentPage`      | 资料/档案正式内容、开放候选、精确历史、附件暂存/读取及审批                 |
| `defineVoucherPage`       | submission 单据列表、表头/明细/子项、创建/克隆、附件、审批和独立脚本配置   |
| `defineOperationPage`     | operation 单据编辑、完整预览、办理、耐久原请求、核实/封存/刷新与原内容恢复 |
| `defineWorkflowPage`      | 节点动作、审计及打开单据的强类型意图                                       |
| `defineDetailsPage`       | 分组事实、历史引用、关联跳转与可选本地单据内容编辑                         |
| `defineAccountPage`       | `profile` / `change-password` 受控账户表单、校验、提交与取消               |

```vue
<script setup lang="ts">
import { AppPage, defineCrudPage } from "@zerp/ui";
import {
  customerDefinition,
  sessionScope,
  navigation,
  brand,
} from "./consumer";

// 稳定定义与 Adapter 归消费者；权限等事实可通过 getter 更新。
const page = defineCrudPage(() => ({
  definition: customerDefinition,
  permissions: { query: true, create: true, write: true },
}));
</script>
<template>
  <AppPage
    :page="page"
    :scope="sessionScope"
    :brand="brand"
    :brand-state="{ kind: 'ready' }"
    :navigation="navigation"
    :navigation-state="{ kind: 'ready' }"
    footer="消费者页脚"
  />
</template>
```

`brand` 包括 `home`（消费者 Router 目标）、`productName`、`enterpriseName` 和文本或图像 `mark`。工厂可接对象、Ref 或 getter；权限与业务事实变化不会因重新定义整个页面而销毁草稿。定义、Adapter、operation 持久化端口应保持稳定，真正切换资源或记录时使用新的对应事实。

## 库内领域区块

`domainBlocks<D>()` 只提供三种有限区块，负责局部排版和输入，不拥有最终写入、刷新或解除未知锁的能力：

- `fields({ key, label, fields })`：编辑 `D[key]` 对象内的强类型字段；目录用 enum/reference 等字段事实提供。
- `rows({ key, label, fields, empty, get, set })`：库内局部行编辑、确认与取消；映射函数只接收所辖值与局部行。
- `voucher({ key, label, editor, get, set })`：库内单据表头、明细及所属行子项；复用 `VoucherEditorDefinition` 数据契约。

```ts
const blocks = [
  domainBlocks<Customer>().fields({
    key: "settings",
    label: "客户设置",
    fields: [{ key: "enabled", label: "启用", type: "boolean" }],
  }),
];
const page = defineCrudPage({ definition, permissions, blocks });
```

字段保留十进制字符串、0/false/null、未完成整数、递归子项、本地确认/取消、精确引用与历史采用快照。`validateFields` 仍可作为强类型纯校验工具使用。缺少区块时扩充本库，不恢复消费者模板接口。

## 写入、恢复与离页保护

六类生命周期仍使用各自 Adapter；处理/批量页面复用同一个 Operation 原请求引擎，不增加第二套通用写入控制器。明确成功、明确失败与结果未知保持区别。普通查询、关闭消息、取消等待、丢弃本地输入或卸载重挂均不证明业务未应用，不能解除原请求锁；终态后的刷新失败只能重读，不能重发业务命令。

AppPage 持有草稿及确认 UI，`@protection` 提供有限 `EditProtection` 事实，唯一公开句柄为 `AppPageHandle.requestLeave(): Promise<boolean>`。消费者在 Router 守卫中等待它再导航，并根据 dirty/localPending/writeState 事实装配浏览器 beforeunload；消费者负责清理自己的监听器。同页定义中的资源、记录切换同样受保护。`active=false` 或会话作用域变化使旧画面及确认回调失效，身份失效的敏感内容清理优先。

```ts
router.beforeEach(async () => (await appPage.value?.requestLeave()) ?? true);
```

列表的 `selection` 由 `rowKey`、`selectedKeys` 和 `onChange` 提供；`listActions` 只接受既有有限非 CRUD 动作，`onListAction` 发出导航/准备意图。实际 CRUD 写入继续经过原 Adapter，单据办理通过选择对应完整单据页面完成，未知锁期间不能借列表意图绕过互斥。

operation 页面内部组合编辑与办理。`editor.toIntent(value, base)` 只映射业务输入，必须保留库给出的当前/恢复动作、身份及 owner；`restore(request)` 解释原内容；`adopt(settlement)` 返回采用权威结果后的 `{ value, intent }`。库持有原请求的恢复与采用按钮。稳定 Adapter、持久化、精确 binding、回执、未应用封存、终态刷新与完成证据协议继续有效，不用普通读取代替权威核实。

详情页可选 editor 只修改本地内容，最终领域写入仍通过对应业务页面。账户页的字段、值、业务校验、submit、busy/error/notice 和验证凭据由消费者持有。普通 `onChange` 回显不代表保存；在权威保存成功后推进 `instance` 以采用新基线，作用域变化清理旧表单。注册、找回和重设仍通过 AuthPage 的受控认证协议进行，不固定消费者认证请求。

## 固定顶栏、弹层与反馈

固定顺序为导航开关、品牌首页区、间隔、主题预设菜单、独立明暗切换、头像与账户菜单。账户菜单固定为“名称与头像”“更改密码”“退出登录”；消费者只接收有限账户意图，不提供增删/排序接口。窄屏收起企业名及账户文字，保留可访问名称。唯一 h1 在主内容区。

Vuetify 布局登记的实际顶栏高度用于内容避让；菜单、抽屉遮罩、离页确认和单据子项弹层均位于顶栏下方。页面滚动不带走顶栏。品牌/导航加载失败、键盘菜单、正常链接修饰键和新标签、临时导航 Escape 与焦点归还均由库统一处理。

消息和字段校验采用固定预留区域，出现、更新和关闭不增加或移除文档流占位；长消息在预留区内滚动。关闭反馈只改变呈现。未知、封存及刷新失败的持续状态和核实/重读入口独立保留，不依赖自动消失的通知。

主题仅开放 MD1/MD2/MD3 与明暗模式，以及有限品牌颜色。`createShellThemes` / `defaultThemeChoice` 继续公开；偏好持久化归消费者。

## 从 0.7.0 一次性迁移至 0.8.0

本版本按 0.x 破坏变更提升 minor。没有旧出口别名、兼容分支或 fallback；历史 Release 保持不可变。

| 旧装配                                                        | 新装配                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 独立 `CrudView` / `ConfigurationView`                         | 对应页面工厂与 AppPage；初始记录通过 `initialRow`，关闭/创建/重读使用库内动作 |
| 独立 `ReportView`                                             | `defineReportPage`；保留 snapshot/restore/parameters/adopted/drill 语义回调   |
| 独立 `DocumentView` / `WorkflowView`                          | 对应页面工厂，Adapter 与精确领域身份不变                                      |
| `VoucherView` submission                                      | `defineVoucherPage`；库内组合单据区块与脚本配置                               |
| `VoucherView` operation + 外挂 `VoucherEditor`                | `defineOperationPage` 的有限 editor 定义、原输入与权威结果映射                |
| 独立 `DynamicForm` / `ReferencePicker` / `DataList`           | 业务页面 fields/blocks/selection/listActions，由库装配                        |
| 独立 `RecordDetails` + 本地编辑器                             | `defineDetailsPage` 的分组事实及可选 editor                                   |
| 外部 `EditGuard`、各 View / prepare 句柄                      | AppPage 内部保护与唯一 `requestLeave` 句柄，宿主继续装配 Router/beforeunload  |
| `configurationBlock({ component, catalog })` / 自定义领域组件 | `domainBlocks().fields/rows/voucher`；目录进入有限字段事实                    |
| AppPage 默认主内容插槽、pageTitle                             | 必填 `page` / `scope`；主标题来自被正式采用的页面定义                         |
| 消费者账户表单模板                                            | `defineAccountPage`，保留提交/校验/会话所有权                                 |
| 可配置 `account.actions`                                      | 固定三项账户意图；`account` 只提供 label 与可选 avatar                        |
| 品牌对象无首页                                                | 增加 `brand.home` Router 目标；主题预设入口改为菜单                           |
| 私有源码/声明子路径导入                                       | 删除；仅使用包根和 `@zerp/ui/style.css`                                       |

更早版本先按各历史 Release 的迁移记录理解领域契约，再采用此完整页面边界。0.7.0 对定制来源的逐文件归并证据保留在 [#38](https://github.com/hansonyu183/zerp-ui/issues/38)，不将历史独立组件示例当作当前 API。

## 开发与验证

Node/pnpm 版本与实际命令以 package.json 的 engines/packageManager/scripts 为准。各 examples 子目录是独立运行的合成消费者；通过公开 AuthPage/AppPage 操作，不编译库私有源码。使用当前切片命令定向验证，正式发行运行既定 `check:release`。

发行 gate 只 pack 一次，同一 tgz 在 direct/configuration/report/document/voucher/workflow/shell/details 九类全新安装消费者内验证类型、公开出口/私有子路径拒绝、生产构建、CSS/字体、唯一宿主依赖和浏览器交互。记录源码 SHA、tgz SHA-256、实际命令及退出码，正式 Release 上传原已测工件；下载后再校验并复验同一工件。浏览器及临时预览服务在 finally 中关闭，不做截图工程。

全部数据、资格、业务 Adapter、回执和持久化记录均为合成；这些证据不代表真实 ZERP/oit-go API/E2E 或生产验收。

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

## 0.9.0 完整业务交互（#47）

`defineTaskPage<D, M, Identity, Baseline>` 提供字段、有限区块、动作选择、完整预览、确认及原请求恢复。动作固定为 process（处理）、publish（发布）、restore（启用历史版本）、validate、run、stop、import、preview、print、printed、not-printed；每个 Model 只需声明实际支持的动作。每个动作分别配对 input、preview、evidence，不提供任意字符串命令。`toIntent` 是纯输入映射，必须保留原 owner/identity 和当前选定动作；异步请求不能藏在映射器中。`adopt` 返回可显式采用的权威结果，不把未提交草稿自动当作已保存。

源码及模板属性沿 textarea、fields/rows/voucher 区块表达。消费者可用字段提供版本选择、历史目录及参数，用 diagnostics 提供有限消息/只读表格；业务版本规则、验证/试运行/发布、计算及权威证据归消费者。`importResource.read` 只解析本地资源到草稿，不执行最终导入；真正写入仍须选择 import 并完整确认。downloads 只提供读取/下载，不获得业务写入能力。

`DraftCollaboration<D, T>` 可用于 CRUD、配置、operation 编辑器与处理页面。change 接收隔离草稿、scope、initialize/change/answer/action、有限回答及取消信号，返回新草稿及 Interaction。库负责 pending、错误重试、取消与迟到隔离；错误或必填回答缺失时不能提交。消费者必须把需要提交的回答和计算事实映射进返回草稿，后端仍须在最终写入时重验。计算端口只能执行读取和草稿计算，不执行最终业务命令。Interaction 支持消息、确认、输入、菜单/两层树、只读表格、关联及下载的局部意图；不运行消费者脚本、HTML、组件或模板。

`CrudDefinition.persistence` 与 `ConfigurationDefinition.persistence` 接收 `WritePersistence`。load 返回原 WriteJournal；save(journal, expectedId) 必须是耐久原子 CAS：null 仅预留空/已完成槽，非空比较精确原 ID，并禁止改变原 Attempt 或回退终态。complete 必须保留 completed/refreshed/outcome 与原请求证据。配置还保存 retain/权威 identity。存储解码、版本转换、终态权威性及跨标签原子性归消费者；不能将当前值相同当作本次已应用。

库先预留原请求再调用业务 Adapter，写入前存储失败阻止执行。重载仅加载原请求、核实或重读，不重放 create/save。核实仍通过原 reconcile 的精确 attemptId/evidence，失败恢复或记录损坏持续锁定；普通查询不解除未知锁。端口必须保留已确认终态，终态保存/读取/完成失败可安全重试，不允许重新提交。未提供端口时只保留原 JS 会话的内存锁，不宣称具备跨重载恢复。

`defineBatchPage` 接收稳定 key、标签和逐项完整 intent，以及单项 OperationDefinition 与独立 BatchPersistence。先耐久保存原始批次清单，再逐项完整预览、确认、核实和封存；用户显式继续下一项。未知项不能跳过，停止仅标记尚未发送的项。整页重载恢复原清单及当前项；completed 批次仍保留结果。批次存储同样必须原子 CAS，不得改变已预留清单或回退结果；各项必须使用同一 owner，具体身份在每项 intent 中提供。

处理页面可接 `printing: { document, state }`。PrintDocument 提供毫米纸张、固定分页、文字、内嵌 PNG/JPEG/WebP/GIF 位图、线和矩形；文字/颜色/字体均受有限约束，不接任意 HTML/CSS。条码二维码由消费者生成安全位图，表达式、业务分页/小计与权限仍归后端。只有消费者提供已授权的 opened 状态才允许用户点击“打开打印窗口”；加载、重载及回执恢复不会自动再次打印。print/printed/not-printed 的业务登记经同一原请求协议，物理输出结果由用户明确确认，不根据浏览器对话框关闭推断。

[examples/capabilities](examples/capabilities) 是可运行的合成消费者，展示处理/发布/试运行入口、异步计算与必填确认、资源读取/下载、批量继续/停止、CRUD 重载核实及固定打印预览。合成权威与存储仅用于演示，不是业务服务实现。运行、构建及同一 tgz 独立安装命令见 package.json。

### 从 0.8.1 一次性迁移

- `defineVoucherOperation` → `defineOperation`；`voucherOperationLabels` → `operationLabels`。
- 所有 `VoucherOperation*` 协议类型 → `Operation*`；`VoucherOperationPage` → `OperationPageDefinition`，`defineVoucherOperationPage` → `defineOperationPage`。
- 现有单据动作、输入、回执和持久化端口的语义保持；存储转换必须保留原 binding、终态及完成事实，不以版本升级清空原请求。
- 新处理/打印/批量通过相应页面定义接入；只公开 AuthPage/AppPage，旧独立 View、消费者组件区块及私有子路径仍不可用。
- 原 ZERP/oit-go 未升级或部署。本库合成验收不代表这些应用已可直接替换依赖，也不代表真实 API/E2E。
