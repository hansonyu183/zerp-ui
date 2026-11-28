# ZERP UI

`@zerp/ui` 是独立发布的 Vue/Vuetify 业务界面库。唯一公开组件 `App` 接收一个完整的响应式 `BusinessModel`。固定普通属性、集合、对象、有序成员及有限操作共同组织界面，正式规格见 [#152](https://github.com/hansonyu183/zerp-ui/issues/152) 和 [#159](https://github.com/hansonyu183/zerp-ui/issues/159)。

## 固定版本安装

当前发行版本为 [ui-v0.51.1](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.51.1)，采用静态 BusinessModel 协议，公开组件名为 `App`。下载 `zerp-ui-0.51.1.tgz` 与 `SHA256SUMS`，核对摘要后安装。

```sh
shasum -a 256 -c SHA256SUMS
pnpm add ./zerp-ui-0.51.1.tgz
```

0.43.x 及更早版本使用旧模型协议，升级须按静态模型迁移。自 0.51.0 起，`App` 在宿主 Vue 应用中初始化 Vuetify，库入口负责载入其基础样式。消费者只需导入库样式并挂载 `App`。可通过 `model.brand.primary` 和 `model.brand.secondary` 提供品牌色。默认主题为 MD3 浅色，消费者通过 `BusinessModel.theme.value/change` 持久化主题选择。Vue、Vue Router 与 Vuetify 的 peer 范围，以及 Node 与 pnpm 基线，见 `package.json`。

## 公开入口与迁移

按[静态模型迁移清单](https://github.com/hansonyu183/zerp-ui/blob/main/docs/interfaces/static-migration.md)调整组件导入、模型结构、路由及业务回调。

```vue
<script setup lang="ts">
import { App } from "@zerp/ui";
import "@zerp/ui/style.css";
import { model } from "./consumer";
</script>
<template><App :model="model" /></template>
```

`@zerp/ui/model` 仅导出构造模型所需的类型，原生 Node 加载时没有运行时值或 Vue/Vuetify/CSS 依赖。类型源为 `src/model/business-model.ts`。包根入口还导出默认主题值 `defaultThemeChoice`。完整静态对象在登录前构造；登录、退出、再次登录沿用同一根引用。

认证表单归 `authentication`，账户、工作台和业务成员归 `work`。`work.members` 包含业务栏目 `Category`、领域 `DomainGroup` 或直属 `ListCollection`。领域内的集合独立查询、授权和保存。普通资料与单据都使用 `ObjectNode`，单据以 `family: "voucher"` 与只读 `type` 区分。`RecordsNode` 所属明细随父对象保存。字段、列和其他固定属性见[静态模型接口](https://github.com/hansonyu183/zerp-ui/blob/main/docs/interfaces/README.md)。

输入直接更新字段值；`Operation` 提供 `disabled` 和 `run(input)`。同步操作返回 `void`，异步操作返回代表完成的 `Promise<void>`，UI 自动管理忙碌状态。业务回调处理 API、冲突、请求有效性和未知结果恢复。记录窗口直接编辑原响应式对象，业务方可监听变更。窗口保留最近读取或保存确认的业务值快照，用于同类记录切换时判断未保存变更。旧公开结构没有兼容入口。仍有效的流程、处理、批次、报表与输出分别使用固定能力属性；不是任意命令、页面模板或组件映射。

消费者在模型上更新节点的 `readable`、表单的 `readOnly` 和操作的 `disabled`。UI 响应这些值更新呈现，后端负责实际鉴权。`session` 只携带状态和 `owner`。退出时消费者清空会话业务数据和缓存并使旧回写失效，库清理旧忙碌状态及反馈。

侧栏和 /app 下的集合页路由从业务模型的栏目、分类、领域和集合派生，由 UI 库管理。业务方可通过组件引用调用 `App.openUrl(url)`。集合地址切页，带 `id` 的记录地址只开窗。参数和返回值见[从地址打开页面或记录](https://github.com/hansonyu183/zerp-ui/blob/main/docs/interfaces/README.md#从地址打开页面或记录)。工作台是可选的首页集合，固定展示 `information/vouchers/reports/masters` 四块，桌面一横三竖、手机纵排。未配置工作台时，首页进入第一个可见领域的首个获权集合。已配置但不可读时，首页显示空态。集合首次成为当前可读目标时调用可选 `load`，成功后返回同一集合复用结果。记录每次打开窗口或切入同类窗口时执行已声明的 `load(id)`。

引用只选值，支持普通/树形、单选/多选、历史值回显和不可新选候选；目录按需完整读取，筛选和分页在前端进行。日期、日期时间与精确十进制 `format` 只改变显示，不回写值。集合 `itemPrintTemple/printTemple` 使用有限 JSON 自动生成单条/当前页打印入口，不预取其他页、不打印 draft；无权值和秘密不输出。预览和打开系统打印窗口不等于实体打印成功。

## 独立消费者与验证

[运行消费者](https://github.com/hansonyu183/zerp-ui/blob/main/examples/model/README.md)直接定义合成业务模型，仅绑定 App。[类型示例](https://github.com/hansonyu183/zerp-ui/blob/main/examples/model-contract/README.md)仅参加编译。

命令以 package.json scripts 为准。`check:release` 在干净源码提交上运行相关类型、模型、UI、lint 和格式检查，只 pack 一次，将同一 tgz 物理安装到全新消费者，核对声明、原生 Node、样式/字体、唯一宿主及公开行为；逐命令退出码和摘要记录于 `.scratch/release/<SHA>/evidence.json`。正式发行的原包复验需要检出发行对应的干净提交，并将该版本的 `evidence.json` 放到上述证据路径，再运行 `node scripts/check-release.mjs --tgz <下载包>`。命令核对源码 SHA 和包摘要，直接使用下载的原包。

UI 规范与逐条部分覆盖边界分别见[规范](https://github.com/hansonyu183/zerp-ui/blob/main/docs/ui-preferences.md)和[验证覆盖](https://github.com/hansonyu183/zerp-ui/blob/main/docs/ui-preferences-coverage.md)。桌面、手机布局和工作台布局验收使用 `pnpm check:ui-preferences`。发行门禁在模型主场景检查代表性桌面、手机和工作台布局。附加 UI 场景跳过重复执行，只记录实际执行的检查。所有例子使用合成数据，真实 ZERP/OIT API/E2E、部署及产品接入各自验收。

## 脚本交互、导航与打印

脚本菜单和树项支持业务回调及集合关联，下载支持集合导出和独立文件。入口与资格见[脚本交互接口](https://github.com/hansonyu183/zerp-ui/blob/main/docs/interfaces/README.md#脚本菜单与树动作)。

引用字段可通过 `scopeKey` 表达候选目录业务依赖；变化会清除旧目录并按需重新读取，历史选值继续回显。消费者负责在 load 回写前核对依赖有效性，owner 隔离由宿主完成。

工作台 `targets` 使用原记录引用。集合目标生成页面链接；记录目标直接打开相应类型的窗口，保留当前页面、URL、筛选和分页。同种业务类型共用一个窗口，切换同类记录时，如有未保存变更，须确认是否继续。确认后离开的对象保留当前值，切回时由其读取回调写回。

栏目和折叠分类使用有序成员数组。每个可见领域在侧栏只显示一条链接，打开首个获权集合，切换集合 Tab 保持领域高亮。直属集合可用于路由直达及业务关联。权限裁剪隐藏无权领域和空分类、空栏目。

### 单据打印

在 `ListCollection` 上提供有限 JSON `itemPrintTemple` / `printTemple`，即可通过公开 App 使用单条或当前页打印。明细 `rowHeight`、`headerHeight` 为最小高度；文字按真实浏览器字体自动换行撑高并分页。`kind: "pageNumber"` 输出“第 X / Y 页”，明细后的 `record` 区域可放置只出现一次的合计及签字栏。

合成 A4 送货单见示例导航“打印示例”，模板和数据定义见 `examples/model/print-demo.ts`。使用 `pnpm check:print` 定向验收独立安装及真实 PDF。完整边界见[打印契约](https://github.com/hansonyu183/zerp-ui/blob/main/docs/printing/contract.md)。

合成示例站的[部署与回退手册](https://github.com/hansonyu183/zerp-ui/blob/main/docs/demo-site.md)记录发行原包的复验和部署来源。

## 本机运行数据

本机 `.scratch` 物理目录为 `/Volumes/ESSD/AgentData/zerp-ui/scratch`，通过项目根符号链接使用。ESSD 未挂载时停止相关命令，不建立本机替代目录。宿主维护记录见 `/Users/hansonyu/workspace/tools/colima-storage/README.md`。
