# ZERP UI

`@zerp/ui` 是独立发布的 Vue/Vuetify 业务界面库。唯一公开组件 `BusinessApplication` 直接接收响应式 `BusinessModel`，由模型结构、有序投影和固定操作组织界面。正式规格见 [#152](https://github.com/hansonyu183/zerp-ui/issues/152) 和 [#154](https://github.com/hansonyu183/zerp-ui/issues/154)。

## 固定版本安装

本源码版本为 **0.42.0**。正式交付状态、确切源码 SHA、CI 和工件摘要以 [#154 验收记录](https://github.com/hansonyu183/zerp-ui/issues/154) 为准；源码版本号不代表已经发行。

正式发行后，从 [ui-v0.42.0 Release](https://github.com/hansonyu183/zerp-ui/releases/tag/ui-v0.42.0) 下载 `zerp-ui-0.42.0.tgz` 和 `SHA256SUMS`，核对原文件后安装：

```sh
shasum -a 256 -c SHA256SUMS
pnpm add ./zerp-ui-0.42.0.tgz
```

宿主初始化唯一一套 Vue、Vuetify 和 Router；peer 范围及 Node/pnpm 基线见 package.json。导入 `vuetify/styles`、`@zerp/ui/style.css`，使用 `createShellThemes()` 初始化 `createVuetify`。图标字体随包分发。

## 公开入口与迁移

```vue
<script setup lang="ts">
import { BusinessApplication } from "@zerp/ui";
import { model } from "./consumer";
</script>
<template><BusinessApplication :model="model" /></template>
```

`@zerp/ui/model` 仅导出 `BusinessModel` 类型和 `modelMetadata` Symbol，可在原生 Node 导入，无 Vue、Vuetify、CSS 或浏览器依赖。业务成员名开放，节点类型和操作名封闭；消费者直接定义普通对象，通过 Vue 响应式包装使值和后端结果驱动界面。不再使用 `application`、`object`、字段工厂或业务族装配工厂。

从 0.41.0 迁移时，直接按 `BusinessModel` 定义字段的 `value` 及 Symbol 元数据，将业务回调放到节点 `operations`。对象 `form`、集合 `list` 是同一模型的有序投影；集合 `element` 提供空集合时的完整结构。聚合保持自己的内容顺序，不自动跳到首个集合，也不依据业务字段名猜测历史或页面类别。

编辑直接更新字段值。操作的 `run()` 读取和更新所属模型；消费者负责业务 API、冲突处理、请求有效性及未知结果恢复，库不保存编辑基线、冻结请求或前端原请求日志，不拦截普通草稿离开。不存在旧工厂或旧运行时的兼容入口。

API、DTO、业务规则、权限计算、Session、Router 和凭证归消费者。根级 `userPermissions` 归属当前 owner，未就绪不显示受保护工作区；完整模型保留，UI 根据节点授权裁剪字段、操作及导航。管理员不覆盖 `readOnly`、`disabledReason` 和业务事实。后端仍须验证实际授权。

全局导航仅来自 `navigationProjection` 的有序分组及节点引用。未投影的子集合保留在所属内容中，不成为额外主导航；消费者通过 `navigation.href`、`visit` 与 `current` 同步 Router。模型构造和导航遍历不执行业务查询。

## 独立消费者与验证

[运行消费者](examples/model/README.md) 直接定义合成模型，仅绑定 BusinessApplication；[纯类型示例](examples/model-contract/README.md) 保持独立，不作为运行应用导入。

运行、构建、定向测试及 tgz 独立安装命令从 package.json scripts 读取。正式发行在干净确切源码提交上运行 `check:release`，只 pack 一次，将同一 tgz 安装到全新消费者，核对公开类型、原生 Node 导入、声明、样式/字体、唯一宿主实例及实际交互。工件和逐命令退出码写入 `.scratch/release/<SHA>/evidence.json`。

正式发行下载原包后执行 `node scripts/check-release.mjs --tgz <下载包>`，核对与原先工件相同的 SHA-256 并重验消费者，不重新打包替代原件。合成消费者、对应 SHA CI、正式公开下载及产品实际接入分别报告。真实 oit-go 接入和整体验收属于 [#155](https://github.com/hansonyu183/zerp-ui/issues/155)，本库不修改原 ZERP、不写生产、不复制公司数据。

## 本机运行数据

本机 `.scratch` 的逻辑路径保持在项目根，物理目录为 `/Volumes/ESSD/AgentData/zerp-ui/scratch`。打包、发布检查及后续临时目录均沿该符号链接写入 ESSD；它不属于源代码，目录和链接均由 Git 忽略。ESSD 未挂载时先停止相关命令，不创建本机替代目录。宿主配置与维护记录见 `/Users/hansonyu/workspace/tools/colima-storage/README.md`。
