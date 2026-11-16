# ZERP UI

`@zerp/ui` 是独立发布的 Vue/Vuetify 业务界面库。唯一公开组件 `BusinessApplication` 接收一个完整的响应式 `BusinessModel`。固定普通属性、集合、对象、有序成员及有限操作共同组织界面，正式规格见 [#152](https://github.com/hansonyu183/zerp-ui/issues/152) 和 [#159](https://github.com/hansonyu183/zerp-ui/issues/159)。

## 固定版本安装

当前版本为 [ui-v0.44.3](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.44.3)，采用静态 BusinessModel 协议；从该 Release 下载 `zerp-ui-0.44.3.tgz` 与 `SHA256SUMS`，核对摘要后安装：

```sh
shasum -a 256 -c SHA256SUMS
pnpm add ./zerp-ui-0.44.3.tgz
```

0.43.x 及更早版本使用旧模型协议，升级须按静态模型迁移。宿主初始化唯一一套 Vue、Vuetify 和 Router。peer 范围及 Node/pnpm 基线见 package.json。导入 `vuetify/styles`、`@zerp/ui/style.css`，通过 `createShellThemes()` 初始化 `createVuetify`。

## 公开入口与迁移

```vue
<script setup lang="ts">
import { BusinessApplication } from "@zerp/ui";
import { model } from "./consumer";
</script>
<template><BusinessApplication :model="model" /></template>
```

`@zerp/ui/model` 仅导出构造模型所需的类型，原生 Node 加载时没有运行时值或 Vue/Vuetify/CSS 依赖。唯一类型源为 `src/business-model.ts`，不再提供 `modelMetadata` Symbol。完整静态对象在登录前构造；登录、退出、再次登录沿用同一根引用。

0.44.0 为破坏性迁移：根 `members` 只包含独立 `Collection`，集合用 `columns` 提供空表列标题、`conditions` 表达查询条件，不再有 `element/list/query` 结构。普通资料与单据都使用 `ObjectNode`，单据以 `family: "voucher"` 与只读 `type` 区分。有序 `members` 决定表单顺序和分组，`label: null` 隐藏整个详情/编辑节点，但不撤销授权列、打印和计算的显式引用。`RecordsNode` 所属明细只修改本地模型，随父对象保存。

输入直接更新字段值；`Operation` 必须提供 `disabled` 与无参数异步 `run()`。业务回调处理 API、冲突、请求有效性和未知结果恢复。库不保存编辑基线、冻结请求或前端原请求日志，不拦截普通草稿离开。旧公开结构没有兼容入口。仍有效的流程、处理、批次、报表与输出分别使用固定能力属性；不是任意命令、页面模板或组件映射。

权限来自 `session.userPermissions`，归属当前 `owner`；普通用户的独立边界及操作默认拒绝，内部节点继承并只能收窄。管理员不能覆盖业务 `readOnly/disabled`。库保留完整模型结构并裁剪呈现，后端仍须实际鉴权。退出时消费者清空会话业务数据和缓存、使旧回写失效；库隔离旧忙碌状态及反馈。

全局导航只引用根集合，消费者通过 `href/visit/current` 同步 Router。选中详情与新增在所属集合覆盖式容器中呈现，保留列表、条件和分页。`current: null` 进入可选工作台，否则按导航顺序进入首个获权集合。工作台固定四块 `information/vouchers/reports/masters`，桌面一横三竖、手机纵排；统一 `load` 按 owner 首次进入执行，失败可重试。

引用只选值，支持普通/树形、单选/多选、历史值回显和不可新选候选；目录按需完整读取，筛选和分页在前端进行。日期、日期时间与精确十进制 `format` 只改变显示，不回写值。集合 `itemPrintTemple/printTemple` 使用有限 JSON 自动生成单条/当前页打印入口，不预取其他页、不打印 draft；无权值和秘密不输出。预览和打开系统打印窗口不等于实体打印成功。

## 独立消费者与验证

[运行消费者](examples/model/README.md) 直接定义合成业务模型，仅绑定 BusinessApplication；[类型示例](examples/model-contract/README.md) 仅参加编译，不执行声明的回调。迁移能力对应见 [迁移清单](docs/interfaces/static-migration.md)。

命令以 package.json scripts 为准。`check:release` 在干净源码提交上运行相关类型、模型、UI、lint 和格式检查，只 pack 一次，将同一 tgz 物理安装到全新消费者，核对声明、原生 Node、样式/字体、唯一宿主及公开行为；逐命令退出码和摘要记录于 `.scratch/release/<SHA>/evidence.json`。正式发行的原包复验可传 `--tgz <下载包>`，不重新打包替代原件。

UI 规范与逐条部分覆盖边界分别见 [规范](docs/ui-preferences.md) 和 [验证覆盖](docs/ui-preferences-coverage.md)。清单只证明映射完整，实际执行结果单独报告。所有例子使用合成数据；本库验收不代表真实 ZERP/OIT API/E2E、部署或产品接入。

## 本机运行数据

本机 `.scratch` 物理目录为 `/Volumes/ESSD/AgentData/zerp-ui/scratch`，通过项目根符号链接使用。ESSD 未挂载时停止相关命令，不建立本机替代目录。宿主维护记录见 `/Users/hansonyu/workspace/tools/colima-storage/README.md`。

菜单/树项可使用 `InteractionAction` 明确执行业务回调，其 `operation` 使用同一必需 `disabled` 语义。动作要求所属节点具备写入资格与固定 `interact` 操作授权（管理员仍受业务只读/禁用约束）；执行中防重复。关联和下载继续只接收 `CollectionTarget`，不会因动作回调改变导航或导出语义。异步回写有效性继续由消费者负责。

引用字段可通过 `scopeKey` 表达候选目录业务依赖；变化会清除旧目录并按需重新读取，历史选值继续回显。消费者负责在 load 回写前核对依赖有效性，owner 隔离由宿主完成。

工作台可通过 `targets` 的只读节点引用映射提供真实快捷链接，通过 `manageReports` 进入常用报表维护；记录目标的链接显式调用 `navigation.href(collection, record)`，普通点击交给 `visit(collection, record)`，修饰键和新标签沿原生链接处理。根 canonical 链接不根据 `selected` 猜目标，外页记录不因生成链接被塞入当前页或选中。

导航分组保留 `items: Collection[]`，可增加固定第二层 `sections: { key, label, items: Collection[] }[]`；两处只引用根级集合，权限裁剪后隐藏空分类及空组。`Collection.navigationLabel` 仅调整导航文案，省略时沿用 `label`，页面标题始终使用 `label`。分类名称与顺序由消费者定义，不支持递归导航树。

### 单据打印

在 Collection 上提供有限 JSON `itemPrintTemple` / `printTemple`，即可通过公开 BusinessApplication 使用单条或当前页打印。明细 `rowHeight`、`headerHeight` 为最小高度；文字按真实浏览器字体自动换行撑高并分页。`kind: "pageNumber"` 输出“第 X / Y 页”，明细后的 `record` 区域可放置只出现一次的合计及签字栏。

合成 A4 送货单见示例导航“打印示例”；模板和数据定义见 `examples/model/print-demo.ts`。使用 `pnpm check:print` 定向验收独立安装及真实 PDF。完整边界见 [打印契约](docs/printing/contract.md)；此能力通过系统打印窗口打印或另存 PDF，不自动登记实体打印结果。
