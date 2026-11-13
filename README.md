# ZERP UI

`@zerp/ui` 是独立发布的 Vue/Vuetify 业务界面库。单一响应式业务模型表达结构、数据与固定业务操作，库持有布局、草稿、写入和原请求恢复。正式规格与交付证据见 [#122](https://github.com/hansonyu183/zerp-ui/issues/122) 和 [#125](https://github.com/hansonyu183/zerp-ui/issues/125)。

## 固定版本安装

本源码为 **0.39.0**，冻结固定办理的脚本回答，并随已采用固定查询呈现业务交互；正式交付状态、确切 SHA 和工件摘要以 [#140](https://github.com/hansonyu183/zerp-ui/issues/140) 的验收记录为准。历史发行保持，后续 OIT 接入使用 #140 正式交付并核对摘要的固定包。

从 [ui-v0.39.0 Release](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.39.0) 下载 `zerp-ui-0.39.0.tgz` 和 `SHA256SUMS`，核对原文件后安装：

```sh
shasum -a 256 -c SHA256SUMS
pnpm add ./zerp-ui-0.39.0.tgz
```

宿主仅初始化一套 Vue、Vuetify、Router；peer 范围和 Node/pnpm 基线见 package.json。导入 `vuetify/styles`、`@zerp/ui/style.css`，使用 `createShellThemes()` 初始化宿主唯一的 `createVuetify`。图标字体随包分发。

## 公开入口与迁移

唯一公开组件是 `BusinessApplication`，只绑定 model：

```vue
<script setup lang="ts">
import { BusinessApplication } from "@zerp/ui";
import { model } from "./consumer";
</script>
<template><BusinessApplication :model="model" /></template>
```

`@zerp/ui/model` 提供 `application`、`object`、`collection`、`array`、`reference`、字段及 `messages` 工厂，以及 `operation`、`documentOperations`、`voucherOperations`、`workflowOperations`、`batchOperations`。这个子入口可在原生 Node 加载，无 Vue、Vuetify、CSS 或浏览器依赖。字段名直接作为对象成员；例如 `object("客户", { name: text("名称") })`，无需 properties 包装。

从 0.31.1 迁移时，将字段、数据、资格、业务回调及所需耐久端口放到同一模型，通过对象成员表达所属层级，通过 reference 表达关联。移除消费者的页面/资源/关系/权限注册表、重复 Adapter 树和通用业务模板。旧 `AuthPage`、`AppPage`、`define…Page`、旧定义工厂、投影函数及 applicationNavigation 已移除，无别名、转发或 fallback。原有纯业务事实、版本、证据及强类型业务端口仍可供模型回调使用；私有源码和声明子路径不开放。

API、DTO、业务规则、权限计算、Session、Router、存储加密和证据解码仍归消费者。模型的 navigation 端口在应用生命周期内保持稳定，由消费者 Router 注册库的离页保护。操作存在性、disabledReason 和 readOnly 表达权威资格；响应式更新不会自动执行写入。库统一处理消息及持续恢复入口，关闭通知、普通查询或恢复权限不会解除未知结果锁。

`changePassword` 使用 `operation("changePassword", input, protocol)`，提供强类型 prepare/run/reconcile/seal/refresh、精确证据及加密耐久 CAS 端口，复用既有原请求引擎；0.32.0 的成功/失败简写已删除。强制改密也提供同一确认、未知锁和恢复入口。秘密值不会进入办理预览或错误通知；业务 API、证据和加密实现仍由消费者提供。值数组可直接包含标量或引用，库内编辑投影不会改变回调收到的原始数组形状；数组只读通过工厂第四参数 `{ readOnly: true }` 表达。

## 独立消费者与验证

| 消费者                                              | 覆盖能力                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [model](examples/model/README.md)                   | 登录、账套、会话、账户/改密、客户及独立所属资源、值数组、配置/工作台偏好、消息和原请求恢复        |
| [model-business](examples/model-business/README.md) | 查询/导出/下钻办理、正式/候选/历史与附件、单据明细/子明细、流程、精确业务办理、批量、有限分页打印 |

两个 App.vue 均只绑定一个 model；宿主仅初始化 Vue/Vuetify/Router。运行、构建、定向测试及安装验证命令从 package.json scripts 读取。旧装配样本仅保留在 tests/fixtures，供私有深模块回归，不是消费者入口或包 API。

正式发行在干净确切源码提交上运行 `check:release`：类型、lint、格式、完整单元测试、全部示例构建，只 pack 一次，再让每个全新独立消费者安装同一 tgz，核对公开类型、声明、样式/字体、唯一宿主实例并实际操作。工件和逐命令退出码位于 `.scratch/release/<SHA>/evidence.json`。从正式发行下载原包后运行 `node scripts/check-release.mjs --tgz <下载包>`，逐字节核对原先工件摘要并再次验证消费者；不会重新打包冒充同一工件。

示例仅用合成数据和模型回调。浏览器本地存储模拟耐久业务事实；物理打印计数、真实 oit-go/ZERP API/E2E 和生产部署均不在这些库证据内。模型正式发行后，oit-go 接入由在 #125 交付后启动、现阻塞于 #140 的 [#126](https://github.com/hansonyu183/zerp-ui/issues/126) 承担；不提前修改消费者。暂停的纯 API 驱动方案 #106 不恢复。在线示例站可能仍使用历史发行，状态见 [示例站说明](docs/demo-site.md)。

## 本机运行数据

本机 `.scratch` 的逻辑路径保持在项目根，物理目录为 `/Volumes/ESSD/AgentData/zerp-ui/scratch`。打包、发布检查及后续临时目录均沿该符号链接写入 ESSD；它不属于源代码，目录和链接均由 Git 忽略。ESSD 未挂载时先停止相关命令，不创建本机替代目录。宿主配置与维护记录见 `/Users/hansonyu/workspace/tools/colima-storage/README.md`。

模型写入的 `request.answers` 是库接受并随原请求冻结的确认/输入答案；消费者将其映射到业务 API 正文，不把答案塞入 `concurrency`。核对使用原请求中的同一答案，迟到计算不能更新其它记录的答案。

Router 的 `navigation.current` 使用实际模型节点和业务身份。指向集合内独立子节点时，库定位并保留所属父记录；记录查看链接保留真实 href，可刷新及在新标签打开。消费者在 `guard` 的 Router 回调中把下一目标 `{ node, identity }` 传给 `check`，使库区分同一父记录内的区块切换与真正离开；无法解析的目的地传 `null`，执行完整离开保护。

列表 `list` 与表单 `form` 分别选择同一模型的内容。例如 `form: ["values"]` 可仅编辑业务字段，`list: ["id", ["values", "name"], "values.name"]` 则按顺序显示编号、嵌套名称及字面含点键；秘密字段和独立子集合不进入父列表。未指定列表时显示本层普通字段。投影不改变业务值和写入边界。

固定 `operation` 的 `intent.answers`、`request.answers` 与普通写入一致，由库冻结已接受的问题回答；消费者将其绑定到同一业务原请求。模型批次使用 `ModelBatchEntry`，每项 `intent.answers` 必须明确提供，运行时不会为缺失回答补默认值。

固定 `ModelQuery` 的 query/page 结果可返回强类型 `interactions`。提示、问题、菜单/树、关联和下载只随有效结果采用；局部 `calculate` 目标收到本查询的参数和回答，可返回参数及新的有限交互，不执行最终业务写入。失败或迟到的查询不替换现有交互，结果失效后旧目标不可用。
