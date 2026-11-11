# ZERP UI

`@zerp/ui` 是独立发布的 Vue/Vuetify 完整页面库。正式规格与交付记录在本仓库 GitHub Issues；当前页面边界见 [#40](https://github.com/hansonyu183/zerp-ui/issues/40)，继承 #7/#22/#32 未冲突的生命周期和原请求保证。

页面设计、实现与审查遵循[个人 UI 要求](docs/ui-preferences.md)，其中汇总固定顶栏、稳定反馈、Material 主题、语义图标及业务文案要求，并注明跨项目来源和职责边界。

[在线合成示例](https://zerp-ui-demo.pages.dev)提供六类业务页面、主题和手机交互；部署及验证流程见[示例站说明](docs/demo-site.md)。

## 公开入口

只有 `AuthPage` 与 `AppPage` 两个公开 Vue 组件。消费者提供强类型页面定义、字段、分组、顺序、数据与 Adapter；库决定完整页面、领域区块、顶栏、弹层、反馈和响应式布局。不接收主内容插槽、消费者组件、模板、render 或 CSS 布局配置，不提供内部组件子路径、别名或兼容包装器。

公司 DTO、业务规则、API 路径、请求、凭证、Session、Router、导航过滤和页面选择由消费者持有。库不会创建公司 API 客户端、Session store 或路由注册平台。原 ZERP/oit-go 保持只读，真实应用接入由发布后的独立工单负责。

0.13.0 的完整变更见 [CHANGELOG](CHANGELOG.md#0130)：手机端列表改为卡片、导航分组默认收起，配置定义移除 `createLabel`，新增文案统一由库负责。

导航内容关系固定为四级：“导航 → 顶级业务组（NavigationGroup）→ 语义分组（section）→ 叶子入口（item）”。消费者API应返回同一分组身份、中文名称和叶子链接，宿主只作强类型字段映射；库不扫描HTTP路径，也不从端点层数推断菜单。

导航项可提供 `section: { key, caption }` 声明语义分组：同一 key 汇入同一可折叠二级组，caption 由消费者提供业务名称；组顺序按首次出现，组内保留原顺序。相同 key 必须提供相同 caption，不同 key 即使名称相同仍是独立组。显式组不受 12 项阈值影响，也不按名称再次拆分；没有 section 的项直接列出。`ungrouped` 始终直列。

未提供任何 section 时，导航组超过 12 项才按显示名称的共同词头自动归组；过长列表按首尾名称分段，每段最多 12 项。归组不读取资源标识或路由，不增加后端请求；叶子名称、链接保持原值。业务码分组必须由消费者显式提供 section，不能依赖显示名称推断类型码。

```ts
const navigation: NavigationGroup[] = [
  {
    key: "vouchers",
    caption: "单据",
    items: [
      {
        key: "AB",
        caption: "AB 采购收货",
        to: "/vou?type=AB",
        section: { key: "A", caption: "采购" },
      },
      {
        key: "AC",
        caption: "AC 采购发票",
        to: "/vou?type=AC",
        section: { key: "A", caption: "采购" },
      },
    ],
  },
];
```

## 固定版本安装

0.10.0 全面统一 Material 字段、列表、事实、业务交互和弹层；保留 MD1/MD2/MD3 明暗预设与现有精确值、历史引用、局部草稿及原请求恢复协议。公开入口仍为 AuthPage/AppPage；呈现 DOM 改变按 0.x 规则提升 minor。实现与行为证据映射见 [Material 对照矩阵](docs/material/README.md)，历史工件保持不可变。

0.10.1 修复必填布尔值 `false` 的原生表单提交，保留 `null` 校验及无障碍必填提示。

0.11.0 补齐有限打印事实、复杂草稿组合及耐久恢复边界；打印默认行高和毫米描边行为变化，按 0.x 规则提升 minor。完整迁移与消费者责任见 [#58 能力矩阵](https://github.com/hansonyu183/zerp-ui/blob/ui-v0.11.2/docs/capability-gaps.md)。

0.11.1 修复合成迁移消费者在转换后恢复时漏核对完整权威原请求的问题；损坏记录保持锁定和重试入口。库运行时及公开 API 不变，历史 0.11.0 工件不覆盖。

0.11.2 修复 Chromium 实际 PDF 的 90/270° 多行文字与页脚错位；以明确毫米平移旋转及固定容器隔离分页。公开 API 不变，新增三页实际 PDF 坐标、页脚可见性和二维码解码回归；历史工件不覆盖。

0.12.0 整合异步行草稿、整单候选原子采用、逐行权限与动态字段，并补回只读资料详情的获权删除；完整页面与 Material 所有权保持。

0.15.0 统一紧凑筛选与业务表单布局、引用选择浮层和不占位的字段校验。消费者仍只声明内容与 Adapter；不提供列数、栅格或 CSS 配置。

从 [ui-v0.26.2 Release](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.26.2) 下载 `zerp-ui-0.26.2.tgz` 与 `SHA256SUMS`，校验后安装原文件：

```sh
shasum -a 256 -c SHA256SUMS
pnpm add ./zerp-ui-0.26.2.tgz
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

`AuthPage` 同样独立持有完整视口与卡片布局。消费者直接挂载认证页，不在外层添加限宽容器、顶部边距或另一层卡片；短屏采用自然滚动，消息和品牌状态保持固定占位。手机端只保留一层卡片内边距，避免逐层挤压字段宽度。

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

发行 gate 只 pack 一次，同一 tgz 在 direct/configuration/report/document/voucher/workflow/shell/details/capabilities 九类全新安装消费者内验证类型、公开出口/私有子路径拒绝、生产构建、CSS/字体、唯一宿主依赖和浏览器交互。记录源码 SHA、tgz SHA-256、实际命令及退出码，正式 Release 上传原已测工件；下载后再校验并复验同一工件。浏览器及临时预览服务在 finally 中关闭，不做截图工程。

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

`DraftCollaboration<D, T>` 可用于 CRUD、配置、operation 编辑器与处理页面。change 接收隔离草稿、scope、initialize/change/answer/action、有限回答及取消信号，返回新草稿及 Interaction。库负责 pending、错误重试、取消与迟到隔离；错误或必填回答缺失时不能提交。消费者必须把需要提交的回答和计算事实映射进返回草稿，后端仍须在最终写入时重验。计算端口只能执行读取和草稿计算，不执行最终业务命令。报表页面还可提供带 instance 的 interactions，将已采用结果产生的提示与有限意图呈现在原报表旁；结果/提示变化使旧事件失效，最终业务写入转入处理页面。Interaction 支持消息、确认、输入、菜单/两层树、只读表格、关联及下载的局部意图；不运行消费者脚本、HTML、组件或模板。

`CrudDefinition.persistence` 与 `ConfigurationDefinition.persistence` 接收 `WritePersistence`。load(owner, requestId?) 无 ID 读取当前槽，有 ID 必须读取该精确原 WriteJournal（包括槽替换后的已完成记录）；save(journal, expectedId) 必须是耐久原子 CAS：null 仅预留空/已完成槽，非空比较精确原 ID，并禁止改变原 Attempt 或回退终态。complete 必须幂等并保留 completed/refreshed/outcome 与原请求证据，旧 ID 的完成记录不能因开始新请求而丢失。配置还保存 retain/权威 identity。存储解码、版本转换、终态权威性及跨标签原子性归消费者；不能将当前值相同当作本次已应用。

库先预留原请求再调用业务 Adapter，写入前存储失败阻止执行。重载仅加载原请求、核实或重读，不重放 create/save。核实仍通过原 reconcile 的精确 attemptId/evidence，失败恢复或记录损坏持续锁定；普通查询不解除未知锁。端口必须保留已确认终态，终态保存/读取/完成失败可安全重试，不允许重新提交。未提供端口时只保留原 JS 会话的内存锁，不宣称具备跨重载恢复。

`defineBatchPage` 接收稳定 key、标签和逐项完整 intent，以及单项 OperationDefinition 与独立 BatchPersistence。先耐久保存原始批次清单，再逐项完整预览、确认、核实和封存；用户显式继续下一项。未知项不能跳过，停止仅标记尚未发送的项。整页重载恢复原清单及当前项；completed 批次仍保留结果。批次存储同样必须原子 CAS，不得改变已预留清单或回退结果；各项必须使用同一 owner，具体身份在每项 intent 中提供。原请求 Journal/Settlement 中的 association 由库写入批次 ID 与条目 key，持久端口必须原样保留且不可改写；同身份/输入的历史回执不能完成新批次。

处理页面可接 `printing: { document, state }`。PrintDocument 提供毫米纸张、固定分页、文字、内嵌 PNG/JPEG/WebP/GIF 位图、线和矩形；文字/颜色/字体均受有限约束，不接任意 HTML/CSS。条码二维码由消费者生成安全位图，表达式、业务分页/小计与权限仍归后端。有限旋转、水印、字体、毫米线宽、换行裁切及迁移边界见 [打印契约](https://github.com/hansonyu183/zerp-ui/blob/ui-v0.11.2/docs/printing/contract.md)。只有消费者提供已授权的 opened 状态才允许用户点击“打开打印窗口”；加载、重载及回执恢复不会自动再次打印。print/printed/not-printed 的业务登记经同一原请求协议，物理输出结果由用户明确确认，不根据浏览器对话框关闭推断。

[examples/capabilities](examples/capabilities) 是可运行的合成消费者，展示处理/发布/试运行入口、异步计算与必填确认、资源读取/下载、批量继续/停止、CRUD 重载核实及固定打印预览。合成权威与存储仅用于演示，不是业务服务实现。运行、构建及同一 tgz 独立安装命令见 package.json。

### 从 0.8.1 一次性迁移

- `defineVoucherOperation` → `defineOperation`；`voucherOperationLabels` → `operationLabels`。
- 所有 `VoucherOperation*` 协议类型 → `Operation*`；`VoucherOperationPage` → `OperationPageDefinition`，`defineVoucherOperationPage` → `defineOperationPage`。
- 现有单据动作、输入、回执和持久化端口的语义保持；存储转换必须保留原 binding、终态及完成事实，不以版本升级清空原请求。
- 新处理/打印/批量通过相应页面定义接入；只公开 AuthPage/AppPage，旧独立 View、消费者组件区块及私有子路径仍不可用。
- 原 ZERP/oit-go 未升级或部署。本库合成验收不代表这些应用已可直接替换依赖，也不代表真实 API/E2E。

### 单据明细草稿（0.12.0，#67）

`VoucherEditorDefinition` 通过完整页面的 editor 或 voucher 领域区块使用：`rowFields` 可为字段数组或接收隔离当前行的同步函数；`rowOperations` 限定新增、编辑、删除。简单行使用可异步的 `emptyRow` 与 `transformRow`；整单计算使用互斥的 `rowDraft.prepare/change`，返回表头和全部明细的候选。候选在明确确认前只作局部展示，取消丢弃全部候选；异步等待阻止确认，错误保留先前值，资源/身份/权限变化使迟到响应失效。最终写入和未知结果锁仍归页面运行时。

合成完整页面示例见 `examples/voucher/ActiveRowFields.vue`。该示例通过公开完整页面消费上述能力，不提供独立内部组件出口。

### 报表条件启用

`ReportParameters<P>` 的参数可声明 `enabledBy: { key, label, readonly? }`，key 指向 P 中的布尔属性；空模型的动态报表在运行时核对。不要同时把该启用属性声明成独立参数，也不能指向参数自身。示例：`{ key: "minimum", type: "decimal", label: "金额", enabledBy: { key: "useMinimum", label: "使用金额" } }`。

值为 false 时禁用输入并跳过该参数值校验，不删除已输入值；查询仍传递完整参数 DTO，由消费者解释筛选语义。必选条件设置 `readonly: true` 并提供初始 true。布局、折行和提示呈现由库决定。

### 关联详情与办理（0.16.0）

`defineReportPage` 可声明 `related: { page, onClose }`，其中 page 由 `defineDetailsPage` 或 `defineTaskPage` 创建。库在报表上方显示模态，保持筛选、分页和结果挂载；消费者仅在 `onClose` 回调清除关联页。关闭与离页沿用关联页的未保存、局部未完成及写入未知保护，不能借关闭解除锁定。权限/身份失效清理失效内容。该入口不接受任意组件或布局配置，也不允许递归报表。

资料与配置的查看、编辑使用相同模态；移动端记录卡片按字段内容流式换行。Router 仍归消费者；从报表查看关联资料时应提供详情事实，而不是导航到另一个资料列表。

## 消息与查询信息

页面消息以浮层呈现，不预留空白提示区；编辑与引用弹窗内的消息留在弹窗中。长消息可滚动，核实和重试入口持续可达，关闭提示不改变写入状态。报表通过“查询信息”查看已采用条件和必要上下文。

### 资料分组（0.19.0）

`domainBlocks<D>().fields({ key, label, fields, groups })` 的 `groups` 只声明内容归属：

```ts
groups: [
  { key: "basic", label: "基本资料", fields: ["name", "code"] },
  { key: "contact", label: "联系信息", fields: ["phone", "address"] },
];
```

字段键受区块值类型约束；动态目录沿用 `Fields<object>` 的动态键边界。组内保留原字段顺序，同一字段只出现一次（首先声明的分组优先）；未归组字段进入“其他”，空组省略。多组采用 Tab，单组直接展示；不传分组时展示全部字段。切换记录或资源后选择首组，Tab 不触发 Adapter。独立详情的 `groups` 采用相同呈现。

常规事实根据容器宽度在 600/900px 切为两/三列，手机一列；标签在值上方。`textarea`、列表和重复记录占整行，长文本保留换行且不溢出。不提供消费者列数或 CSS 配置。0.18.0 工件验证与获授权的 oit-go 接入分别记录于 #87；合成验证与真实应用验收分别报告。

新建和编辑复用同一 `groups`（`FieldGroup<T>`）定义；`defineCrud`、`defineConfiguration` 也可在字段旁声明 `groups`。切换 Tab 保留完整草稿和未完成输入，所有组共同校验和保存；标签提示待完善项，子项确认或取消前暂不能切组。0.18.0 的 `readGroups` / `ReadFieldGroup` 直接迁移为 `groups` / `FieldGroup`。

### 领域区块分组（0.22.0）

配置、资料维护、资料提交和处理页面的多个领域区块按原有标签、顺序统一为Tab；单区块直接展示，零区块不生成空容器。所有组保持挂载、共用原草稿和保存，隐藏组仍校验并提示待完善；局部输入pending时不能切组。切换记录或作用域回到首组，Tab不调用Adapter，也不改变未知写入状态。普通字段不声明分组或使用空分组时仍直接展示。

## 工作台（0.23.0）

`defineWorkbenchPage` 通过 `AppPage` 同屏呈现常用单据、常用报表、常用资料、重要信息。提供 `title`、`instance`、稳定 `adapter` 与可选 `manageReportsTo`；`adapter.load({ scope, signal })` 返回 `WorkbenchSnapshot`。前三个区段各提供 `{ items, description? }`，入口为 `{ key, name, to, icon? }`；信息为 `{ key, text }[]`。库保留输入顺序，每区默认12项并负责展开收起、加载和重试。

`defineWorkbenchPreferencesPage<K>` 接收 `title`、`instance` 与稳定 Adapter。`load({ scope, signal })` 返回 `{ id, key: K, name, added }[]`，其中 id 是跨分类唯一且稳定的UI标识；`setAdded({ scope, signal, key, added })` 必须幂等设置目标偏好，不能实现为toggle或业务命令。库负责名称搜索、每页50项、添加移除和互斥；抛错后保留原目标，可核对权威状态或重试同一目标。成功后读取失败只能重读。候选缺失不证明未应用；匹配原目标的权威读取才可核对完成。此有限偏好协议不替代业务写入原请求保证。

Adapter 必须按捕获的身份/账套执行请求，遵守 signal 并拒绝失效响应。实例、作用域、active或Adapter切换会清理页面并隔离旧响应。统计口径、权限过滤、排序、偏好持久化与Router由消费者负责。本页不开放模板、组件或布局配置。完整合成示例见 `examples/workbench`，相关命令见 package.json。

### 工作台 Material 与布局（0.24.0）

工作台使用主题化 Vuetify 卡片、列表入口与操作区。重要信息在上方横跨整行，桌面下方单据、报表、资料三等宽列；手机保持重要信息在前，其余按顺序纵向排列。卡片及按钮不固定圆角、描边或颜色，沿用当前 MD1/MD2/MD3 Blueprint 与明暗主题默认值；链接保留键盘、修饰键与新标签行为。工厂与 Adapter API 不变。

## 业务类型与模块

`@zerp/ui/model` 提供不加载 Vue、Vuetify、CSS 或浏览器环境的业务类型、值/输入推导及路径、投影工具。前后端从此入口共享通用模型；具体业务定义、输入规则、HTTP 和持久化仍由消费者持有。

`defineBusinessPage` 从 `definition.model` 的有序 `list.fields`、`form.fields` 生成列、嵌套字段及对象分组，复用 CRUD、草稿联动与原请求恢复。`rowValue` 指明业务值在列表记录中的属性；`reference(field, path)` 提供引用 Adapter，数据保留原始 ID，树浏览通过独立的 `ancestor` 事实传递，不与级联依赖 `parent` 混用。秘密字段采用保留（`undefined`）、修改（新字符串）、清除（`null`），读取采用时不回显旧秘密。

`defineModulePage({ model, collections })` 按获权模型的集合属性及投影顺序生成模块 Tab，普通集合访问时才加载并保持已访问状态；未决原请求通过持久化端口发现后加载所属运行时，`collections` 只映射对应完整页面定义。`related` 将所辖对象/集合路径映射到独立页面工厂；库内嵌关联资源，各自保留草稿、保存、未知锁与恢复，并汇总离开保护。消费者应按资源身份保持 Adapter、持久化端口及页面定义稳定；刷新快照不应重建所属页面。创建前没有所属身份时，关联工厂返回 `undefined`。

跨独立资源的业务联锁由消费者提供权威事实；库不会因联系人结果未知而自动禁止账款设置写入。业务页面在权威重读后保留详情及所属资源，避免父保存丢失子草稿。普通对象与独立资源按同一表单投影共用一组 Tab，`section`/`onSection` 同步所属分组，`onRecord` 通知已采用的记录身份；消费者负责将这些事实映射到 Router。可选 `initialize` 读取创建初值和前置身份，`prepare` 在保留原请求前冻结消费者前置身份；返回不代表业务写入。`rebase` 只重读并按业务规则合并本地输入，返回新基线。最终 create/save/delete 仍经过原 Adapter。`disabledActions` 提供已有资格但当前不能执行的动作及原因；`failure.field` 按稳定字段路径定位分组及输入，并保留草稿。创建成功及原请求核实为已应用时，Adapter 可返回权威 `identity`，以持久采用最终身份，避免刷新失败或重载后重发创建。

[业务模块独立示例](examples/business)使用合成模型与 Adapter，覆盖嵌套列、五个模块 Tab、独立所属资源、树形引用、秘密值及原请求核实，不代表真实 OIT API 或生产验收。
