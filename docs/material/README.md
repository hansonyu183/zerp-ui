# Material 对照矩阵

正式规格与状态以 [#49](https://github.com/hansonyu183/zerp-ui/issues/49) 和子票为准；本表记录实现依据、产品适配与验收证据边界，不替代工单。实现基线为 Vuetify 4.1.5。所有消费者、Adapter、账户与记录均为合成数据，不构成真实 ZERP API/E2E 证据。

依据：[Blueprints](https://vuetifyjs.com/en/features/blueprints/)、[Buttons](https://vuetifyjs.com/en/components/buttons/)、[Tables](https://vuetifyjs.com/en/components/tables/)、[Alerts](https://vuetifyjs.com/en/components/alerts/)、[Typography](https://vuetifyjs.com/en/styles/text-and-typography/)、[Dialogs](https://vuetifyjs.com/en/components/dialogs/)、[Material accessibility](https://m1.material.io/usability/accessibility.html)。具体预设以安装包 `vuetify/lib/blueprints/md1.js`、`md2.js`、`md3.js` 与其组件运行行为为准。

## 入口与交互表面

| 公开入口 / 用户任务 | 内部表面 | Vuetify 能力 / 业务约束 | 定向证据与边界 |
| --- | --- | --- | --- |
| AppPage 导航、账户与主题 | AppPage、shell | VAppBar/VLayout/VNavigationDrawer/VMenu/VBtn；MD1/MD2/MD3 blueprint，明暗独立受控；RouterLink 保留真实链接 | shellInteractionSmoke：320px 控件实际命中、菜单 Escape/焦点归还、导航与修饰键、固定高度、遮罩边界 |
| AppPage 列表、报表结果 | DataList、RowActions | VTable/VCheckboxBtn/VBtn/VMenu/VList；服务端分页与 hasMore 保留；不额外分页/排序/计算合计 | materialShellSmoke：六主题、320/390px 勾选及行操作；既有选择/行操作/报表行为检查保护组与权威值 |
| AuthPage / AppPage 消息 | Feedback | VAlert/VBtn；error=alert，warning/status=status；固定反馈区域，长消息内部滚动 | materialShellSmoke：六主题显示/关闭几何稳定与计算对比度；feedback-smoke 共用几何比较 |
| AuthPage 认证 / AppPage 账户 | AuthPage、ControlledAccountForm | VTextField/VBtn 与受控字段；敏感值清理不变 | #50 补充各认证模式、账户及错误的安装包证据 |
| AppPage 字段、引用与局部行 | DynamicForm、ReferencePicker、DomainRows、VoucherEditor、DomainBlockHost | 有限字段与强类型 Adapter；十进制原字符串、历史引用、局部草稿权限不变 | #50 补充精确值、父依赖、只读/禁用及局部确认/取消证据 |
| AppPage 维护与配置 | CrudView、ConfigurationView | 字段/列表复用；恢复入口保留原请求锁 | #52 补充编辑、确认、未知与待刷新证据 |
| AppPage 报表与详情 | ReportView、DetailsPage、RecordDetails、FactFields | 结构化事实、分组续页、列显隐、下钻/返回与链接 | #52 补充完整页面运行证据，不以 VTable 引用推断通过 |
| AppPage 档案与单据 | DocumentView、VoucherSubmission、SubmissionRuntime、OperationPage、OperationRuntime | 正式/候选/历史、完整预览与同一原请求引擎 | #52 补充模态焦点/长内容/关闭与锁状态证据 |
| AppPage 流程与草稿协作 | WorkflowView、DraftCollaboration、BusinessInteractions、ReportInteractionPanel | 节点、原因、有限输入/菜单树/表格；异步迟到隔离 | #52 补充状态与高风险路径证据 |
| AppPage 处理、批量及打印 | TaskPage、BatchPage、PrintPreview、EditGuard | 有限动作、逐项原清单、离页保护；纸张毫米布局独立 | #52 补充批量未知锁、打印周边、离页模态证据 |
| AppPage 内容装配 | PageContentHost | 唯一页面主标题、有限内容定义，布局由库持有 | 类型与公开出口拒绝检查；#53 同一 tgz 最终复验 |

## 状态与主题

`materialShellSmoke` 从 AppPage 切换六个主题并实际操作代表性列表；不是检查主题数量或私有组件名。默认/selected 通过勾选与 `aria-checked`；disabled 由当前第一页“上一页”等既有分页检查；hover/pressed 与焦点的状态层由当前预设 Vuetify 持有，未将截图或 CSS 类名作为视觉合规证据。可见焦点、菜单 Escape/焦点归还由实际键盘检查验证。loading/error/empty/未知状态的完整页面装配按相关票记录，不推断所有页面已覆盖六主题笛卡尔组合。

| 代表表面 | MD1 light/dark | MD2 light/dark | MD3 light/dark | 测量 |
| --- | --- | --- | --- | --- |
| 顶栏、列表勾选、前三图标及更多 | materialShellSmoke | materialShellSmoke | materialShellSmoke | 320/390px 实际 48×48 边缘命中；无页面级横向溢出 |
| 列表正文 / 操作图标 / 菜单 | materialShellSmoke | materialShellSmoke | materialShellSmoke | 最终计算前景与祖先合成背景；正文/菜单 ≥4.5:1，图标 ≥3:1 |
| 错误反馈及关闭 | materialShellSmoke | materialShellSmoke | materialShellSmoke | ≥4.5:1；出现/关闭前后主要操作、顶栏和文档滚动位置相同 |
| 字段、主要提交、真实模态 | #50/#52 最终合并后补证 | #50/#52 最终合并后补证 | #50/#52 最终合并后补证 | 不依据依赖或默认值声明通过 |

## 产品适配

- ADR-0001 要求所有 overlay 限制在 Vuetify 实际登记的顶栏下方；这是产品布局适配，不称为官方默认全视口弹层。VMenu/VDialog/VTooltip/VOverlay 默认继承同一个 attach/contained 区域，焦点行为仍归 Vuetify。
- 所有独立按钮/行操作最小 48px；保留各 blueprint 的圆角、字段 variant、表面和状态层。没有以全局原生 button/input/select 规则覆盖 Vuetify。顶栏窄屏隐藏企业和账户文字，维持固定顺序及品牌首页。
- VTable 保留语义表格与列标题，宽表仅在自己的滚动区域溢出；不把记录改成客户端分页。行操作仍为前三项图标及更多菜单，查看/关联保留浏览器链接修饰键。
- 消息保留固定区域，VAlert 的长内容在区域内滚动，关闭只影响呈现；恢复入口和写入状态由原运行时持有。字段错误也预留固定区域，实际未知结果不得经 UI 关闭解锁。
- 公司提供的报表前景/背景属于消费者业务事实。库保留这些权威格式；任意外部自定义颜色组合的可读性不能由默认六主题测量自动担保。
- 品牌 primary/secondary 的前景使用当前 Vuetify 已有 WCAG getContrast 选择黑/白的较高值，不重写解析或颜色算法；默认暗色也以实测对比度校正。文字图标操作使用 on-surface，避免浅色品牌直接作正文。品牌颜色的最终实际对比度须在实际消费者选择的颜色下验收，默认主题通过不代表任意品牌颜色通过。

源码 SHA、命令退出码、tgz SHA-256 与远端交付证据见各工单验收评论。#53 的最终发布必须复验同一已测 tgz；历史工件、本地示例与下载工件证据分别记录。
