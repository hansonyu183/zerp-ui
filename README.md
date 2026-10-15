# ZERP UI

独立的 Vue/Vuetify 组件库项目，包名 `@zerp/ui`。目标是以深模块、小接口提供公共复合交互、六类通用页面运行时和外壳/主题。

当前已完成项目初始化和规格/工单迁移，组件库实现及可安装版本尚未交付。

## 开发边界

先在本仓库独立完成组件库、运行示例和安装包验收，再发布 `0.1.0`。ZERP 在组件库完成前保持现状；原应用只作行为参考，实际页面、依赖、构建和旧实现清理属于发布后的独立接入工作。

示例使用合成数据和类型化 Adapter，不携带公司规则、原应用私有模型、API/Session 或生产数据。公开包入口与独立 tgz 消费是验收面。

## 正式工作项

- [实施规格](https://github.com/hansonyu183/zerp-ui/issues/7)
- [已完成的决策地图](https://github.com/hansonyu183/zerp-ui/issues/1)

- [[ZERP UI 1/8] 独立公共交互与直接维护运行时](https://github.com/hansonyu183/zerp-ui/issues/8)
- [[ZERP UI 2/8] 独立配置运行时](https://github.com/hansonyu183/zerp-ui/issues/9)
- [[ZERP UI 3/8] 独立报表运行时](https://github.com/hansonyu183/zerp-ui/issues/10)
- [[ZERP UI 4/8] 独立版本档案与附件交互](https://github.com/hansonyu183/zerp-ui/issues/11)
- [[ZERP UI 5/8] 独立单据运行时](https://github.com/hansonyu183/zerp-ui/issues/12)
- [[ZERP UI 6/8] 独立流程运行时](https://github.com/hansonyu183/zerp-ui/issues/13)
- [[ZERP UI 7/8] 独立外壳、品牌与主题](https://github.com/hansonyu183/zerp-ui/issues/14)
- [[ZERP UI 8/8] 独立安装验收与0.1.0发布](https://github.com/hansonyu183/zerp-ui/issues/15)

前七票依次独立交付，最后一票进行完整工件验收和 GitHub Release。原议题采用 GitHub 原生转移，历史评论保留；旧的“在 ZERP 内建包并同步切换”安排以当前独立仓库规格为准。

## 技术与交付

- Vue、Vuetify、Vue Router 由消费者提供唯一实例，库交付 ESM、声明、CSS/字体和安装说明。
- 支持不同后端协议，六类运行时保持固定交互契约；不提供任意业务状态机或全量配置平台。
- 最终分发渠道为本仓库 GitHub Release；目前没有可用安装包或发布版本。
- 具体构建和验证命令随实现加入 package scripts，此初始化不放置空包或虚假的通过记录。

ZERP 后续接入由[独立接入工单](https://github.com/hansonyu183/zerp/issues/520)跟踪，原生阻塞于本库首发完成。

Agent 规则见 [AGENTS.md](AGENTS.md)，正式规格与进度仅维护在 GitHub Issues。
