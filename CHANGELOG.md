# Changelog

## 0.4.0

- 单据内容写入（#27）：operation 增加创建、保存修改、删除，刷新接收成对原请求与权威终态回执；输入变化使预览失效，保留原请求持久化/封存/重载恢复。刷新签名为破坏接口，升级时按 README 迁移。
- 受控导航（#28）：AppPage 增加 selectedNavigationKey，支持同路径不同 query 的唯一当前项及无障碍语义；库内独立示例与 tgz 验收覆盖新增能力。

## 0.3.0

- 新增公开 VoucherEditor 表头/明细/子项编辑展示；生命周期及最终写入仍由宿主运行时持有（#18）。

- 公共详情与编辑保护（[#26](https://github.com/hansonyu183/zerp-ui/issues/26)）：VoucherEditor read 改用事实展示；新增有限强类型 RecordDetails 和受控 EditGuard 离开接缝，保留历史原值、引用快照、所属子项及身份清理。局部未确认明细计入 pending；放弃仅销毁本地 Draft，写入 pending/unknown 不解锁。
- 新增公开入口合成页面与同一 tgz 安装/类型/构建/浏览器验收，纳入 release gate。只读 DOM 改变属于本版破坏接口，不代表真实 ZERP/oit-go API/E2E。

- 单据办理（[#25](https://github.com/hansonyu183/zerp-ui/issues/25)）：VoucherView 以 submission/operation 明确判别，提供有限办理动作、完整预览、可靠保存原请求、精确核实/封存、跨重载恢复及刷新清理；旧提交件定义必须增加 protocol，在本版发布，不保留兼容分支。
- 将 #24 原型替换为公开入口和单据消费者示例，删除临时运行路径；验收仅使用合成 Adapter 和同一 tgz 独立安装，不代表真实 ZERP/oit-go API/E2E。

- 报表增强（[#23](https://github.com/hansonyu183/zerp-ui/issues/23)）：定义明确区分 parameter/fixed 并要求稳定 rowKey；共享 DataList 宽表、权威合计、有限类型化下钻、固定结果分页/完整导出、取消反馈和返回重验恢复。原报表定义须迁移；本版发布，不保留旧契约兼容分支。
- 合成报表示例和同一 tgz 独立安装覆盖新接口；不代表真实 ZERP/oit-go API/E2E 验收。

## 0.2.1

- 补充 Document（资料/档案）与 Voucher（单据）术语表，修正原 ZERP 只读参考路径。
- 独立类型检查先构建当前库，单片安装检查先构建当前库及对应示例，避免旧构建产物造成误报；成功日志改为简短摘要，完整证据仍写入 JSON。
- 公开组件与运行时行为保持 0.2.0 契约；本补丁仍仅使用合成 Adapter 验证。

## 0.2.0

- 公开组件分为顶层页面、业务视图和复合交互。新增受控 `AuthPage`，覆盖登录、注册、找回申请和设置新密码；认证、验证、Session 与跳转仍由消费者负责。
- `ZerpShell` 更名为 `AppPage`；六类公开运行时更名为 `CrudView`、`ConfigurationView`、`ReportView`、`DocumentView`、`VoucherView`、`WorkflowView`；`ListSurface` 更名为 `DataList`。直接维护的定义函数与类型同步使用 `Crud` 名称，旧导出不保留别名。
- 资料/档案统一使用 `Document`，单据统一使用 `Voucher`；对应定义函数、类型、流程打开动作/事件和导航图标同步更名。
- 页面主标题由 `AppPage` 或独立消费者提供，业务视图不重复输出。独立示例和 tgz 消费者覆盖新接口及合成认证流程。
- 迁移对照见 README。只修改独立组件库，未接入真实 ZERP API、Session 或生产数据。

## 0.1.0

首个完整独立版本，按 [#7](https://github.com/hansonyu183/zerp-ui/issues/7) 与 [#15](https://github.com/hansonyu183/zerp-ui/issues/15) 通过 GitHub Release 分发。

- 公共交互和直接维护（#8）：有限字段、列表/筛选、引用搜索与已选保留、递归 Draft、20 个合成消费者差异矩阵。
- 配置（#9）：精确修订、有限局部区块与聚合 pending。
- 报表（#10）：显式参数提交、total/hasMore、原值列和 Blob 导出。
- 版本档案（#11）：正式/候选/精确历史/审计、附件本地准备→暂存→业务提交。
- 单据（#12）：创建/克隆、专用录入、独立脚本、提交/审批和共享附件生命周期。
- 流程（#13）：六个固定节点动作、目标资格、消费者路由与单据协作。
- 外壳（#14）：分组导航、品牌/导航重试、账户意图、MD1/2/3 明暗预设与官方 defaults。
- 所有写入运行时保留原请求身份与未知锁，只接受本次请求的精确证据核实；普通读取或关闭不能解锁，成功后刷新失败只重读。
- 完整 ESM、声明、CSS/woff2/字体许可证、安装说明与七类同一 tgz 独立验收；Vue/Vuetify/Router 由宿主唯一提供。

所有示例与验收使用合成数据和模拟 Adapter。真实 ZERP 接入、旧实现删除及真实 API/E2E 属于发布后的独立工作；本版本不修改或部署原 ZERP，不迁移生产数据。源码 SHA、工件 SHA-256 与实际命令结果附在 Release 证据中。
