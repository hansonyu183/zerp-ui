# UI 规范验证覆盖

由 `docs/ui-preferences.coverage.json` 与原规范生成；修改清单后运行 `pnpm check:ui-preferences:inventory --write`。本文件不维护第二套规范或正式实施状态，工单见 [#159](https://github.com/hansonyu183/zerp-ui/issues/159)。

共 52 条：32 条有自动断言映射（均为部分覆盖），20 条尚无自动断言。映射存在不代表本次执行通过，也不代表整条符合；执行结果以本次命令退出码、Vitest 报告及 tgz evidence.json 为准。

验证策略：流程条款由任务审查；消费者专属条款由真实消费者验收；文案及常规 UI 语义审查由 Agent 按现有要求判断，不逐项询问用户；仅业务含义不明或需改变已确认要求时，在完成其余开发后按 UI-GOV-06 留一份交付清单。本库检查使用合成模型，不是实际 OIT/ZERP API/E2E。定向检查不是数学证明或全状态穷举。

[UI 细节判断与交付清单](ui-preferences-quantification.md) 明确常规取舍由 Agent 处理，历史量化提议未成为强制标准。浏览器既有 1–2 CSS px 的测量容差用于子像素/同排判断，不授权内容位移或成为新的间距标准。既有 390/1440px 视口只是样本，不定义响应断点。

## 条款映射

| 编号 | 现有证据 | 未完成 / 验收边界 |
| --- | --- | --- |
| UI-GOV-01 | 无自动断言 | 流程验收：任务开始时记录受影响编号及当前工单/父规格。 |
| UI-GOV-02 | 无自动断言 | 人工审查：迁移逐路径保留呈现；测试通过不代替全部条款证据。 |
| UI-GOV-03 | 无自动断言 | 流程验收：用户修订与规范同任务同步，来源可追溯。 |
| UI-GOV-04 | 无自动断言 | 由 Agent 审查用户决定的时序及冲突；仅业务含义不明或需改变已确认要求的未决项按 UI-GOV-06 在开发交付时集中列出。 |
| UI-GOV-05 | 无自动断言 | 流程验收：逐条交付证据、缺口及授权内修复；本清单不自动判定任务已遵守。 |
| UI-GOV-06 | 无自动断言 | 流程审查由 Agent 执行：常规文案/UI自主判断；仅将业务含义不明或要求变更在开发交付后合并为一份清单，不逐项询问用户。 |
| UI-THEME-01 | 无自动断言 | 布局所有权及消费者不补模板仍需架构审查；未穷举业务族。 |
| UI-THEME-02 | [package-theme](#package-theme)、[package-workbench](#package-workbench) | 只覆盖认证外壳及工作台主题响应，未逐控件验证完整Material语言。 |
| UI-THEME-03 | [unit-theme](#unit-theme)、[package-theme](#package-theme) | 主题菜单位于明暗左侧的几何顺序尚无断言；真实消费者持久化另验收。 |
| UI-THEME-04 | 无自动断言 | 公共样式归属及主要/普通/危险层级需审查；常规语义样式由 Agent 判断，见Q4。 |
| UI-THEME-05 | [package-layout](#package-layout) | 仅表格12px及手机编辑输入16px；正文/菜单/导航/反馈和18/16/14px标题尚未逐类验证。 |
| UI-THEME-06 | [package-layout](#package-layout) | 仅代表性动作和48px顶栏；compact输入、全控件触控区域未遍历；常规间距由 Agent 判断，见Q2。 |
| UI-SHELL-01 | [package-layout](#package-layout) | 只测编辑弹层和顶栏；滚动、菜单、抽屉遮罩、消息及其他弹层边界待补。 |
| UI-SHELL-02 | 无自动断言 | 未断言所有顶栏子项顺序、品牌内容和首页跳转。 |
| UI-SHELL-03 | 无自动断言 | 未定向检查慢业务读取时账户可达、窄屏文字收起与账户全部入口。 |
| UI-SHELL-04 | 无自动断言 | 主标题几何及业务名重复需检查；语义重复待人工审查。 |
| UI-SHELL-05 | [package-feedback](#package-feedback)、[package-full](#package-full)、[package-reference-feedback](#package-reference-feedback) | 已覆盖成功/失败消息及长引用读取错误在表单/所属明细行的几何和重试；其他消息更新、警告/状态、其他字段校验路径尚未穷举。 |
| UI-SHELL-06 | [unit-feedback](#unit-feedback)、[unit-overlay](#unit-overlay) | 保存失败与反馈关闭不改模型事实；未知结果核实和消费者禁用需新宿主定向测试覆盖，不能用普通刷新替代核实。 |
| UI-DESKTOP-01 | [package-layout](#package-layout) | 仅代表表格存在/字号；字段完整性与超宽策略未穷举，尽量避免横滚处理方式由 Agent 按现有要求判断，见Q3。 |
| UI-DESKTOP-02 | [unit-actions](#unit-actions)、[package-layout](#package-layout) | 第二操作列有断言；排序必须在相关表头且不占筛选栏尚无定向证据。 |
| UI-DESKTOP-03 | [package-reference-feedback](#package-reference-feedback) | 表格内编辑简洁模式及字段校验前后行高尚无公开浏览器断言。 |
| UI-MOBILE-01 | [package-layout](#package-layout)、[unit-actions](#unit-actions) | 仅代表卡片字段和无横溢；合计、完整身份、选择、适用明细尚未全部验证。 |
| UI-MOBILE-02 | 无自动断言 | 流式短字段同排、长值换行、名称和值同行尚无几何断言；样本由 Agent 按现有要求选择，见Q3。 |
| UI-MOBILE-03 | 无自动断言 | 首行左右对齐/缺省稳定、全选文字/数量/半选/禁用尚无直接宿主定向证据。 |
| UI-ACTION-01 | [unit-actions](#unit-actions) | 可用动作与更多入口有证据；普通动作3项上限、图标语义及手机收纳边界待补；流程特例不泛化。 |
| UI-ACTION-02 | [unit-actions](#unit-actions)、[package-layout](#package-layout) | 手机短文字已验，桌面图标及hover/focus hint尚未完整验证。 |
| UI-ACTION-03 | [unit-actions](#unit-actions)、[unit-review](#unit-review) | 覆盖代表权限撤销/禁用和独立处理输入；所有业务族及状态组合未穷举。 |
| UI-ACTION-04 | 无自动断言 | 新增各入口、标题与成功提示的一致性，以及其他动作文案尚无统一断言。 |
| UI-FORM-01 | [unit-model](#unit-model)、[unit-review](#unit-review) | 直接编辑、复杂结构有代表用例；查看/新增/编辑完整字段顺序同构尚未逐路径断言。 |
| UI-FORM-02 | [unit-overlay](#unit-overlay)、[package-layout](#package-layout) | 列表持续挂载、编辑覆盖、关闭焦点有证据；新增/查看及非零列表滚动的浏览器往返尚待补。 |
| UI-FORM-03 | [package-layout](#package-layout) | 代表场景筛选4列/编辑3列已验；容器窄宽/短表单/长文本/子表整行未覆盖；Q1/Q2由 Agent 按现有要求判断。 |
| UI-FORM-04 | [unit-tabs](#unit-tabs)、[package-layout](#package-layout)、[unit-review](#unit-review) | 零单多组、键盘和面板关联已有；窄屏Tab滚动、浮动标签不重叠尚无完整几何证据。 |
| UI-FORM-05 | [unit-tabs](#unit-tabs)、[unit-review](#unit-review)、[unit-reactivity](#unit-reactivity) | 新模型数组顺序、空label详情隐藏及显式列保留有源码映射；动态结构全组合尚未穷举。 |
| UI-FORM-06 | [unit-model](#unit-model)、[unit-tabs](#unit-tabs)、[unit-review](#unit-review)、[package-tab-input](#package-tab-input)、[package-full](#package-full) | 新集合覆盖式详情、分组切换与明细随父保存有映射；全部业务族和异步组合尚未穷举。 |
| UI-FORM-07 | [unit-reactivity](#unit-reactivity) | 根级独立集合及所属分组采用新契约；真实消费者业务名称和目录层级另行验收。 |
| UI-FORM-08 | [unit-model](#unit-model)、[unit-reactivity](#unit-reactivity)、[unit-overlay](#unit-overlay) | 直接模型值及未知结果限制有证据；不恢复冻结请求/普通离开确认仍需架构审查。 |
| UI-NAV-01 | [unit-shell](#unit-shell) | 仅默认收起及修饰键；直属入口、无标题/无切换提示尚未完整断言。 |
| UI-NAV-02 | [unit-shell](#unit-shell) | 修饰键有证据；图标语义、未知文本、手机选择关闭抽屉、桌面收起及新标签待补。 |
| UI-NAV-03 | [unit-model](#unit-model)、[unit-reactivity](#unit-reactivity)、[package-full](#package-full) | 新根集合导航、工作台与无权裁剪由新宿主场景映射；真实消费者Router和权限计算另行验收。 |
| UI-NAV-04 | 无自动断言 | 重复导航/目录与实际入口需逐路径审查，不以旧私有组件测试作为新入口符合证据。 |
| UI-NAV-05 | [package-full](#package-full) | 新普通引用按需完整目录及本地分页/过滤有包场景；树形和多选另由字段测试覆盖，真实作用域缓存归消费者。 |
| UI-NAV-06 | [unit-model](#unit-model)、[package-full](#package-full) | 构造无业务查询和工作台按需读取有包映射；慢页面账户可达有源码定向映射。 |
| UI-WORK-01 | [unit-shell](#unit-shell)、[package-workbench](#package-workbench) | 固定4角色桌面/手机几何和主题有代表证据；空角色/全部业务状态仍需定向验收。 |
| UI-WORK-02 | 无自动断言 | 由 Agent 结合业务语境审查简短业务中文与同名一致性，不引入任意字数上限；常规文案不要求用户确认，见Q5。 |
| UI-WORK-03 | 无自动断言 | 由 Agent 审查内部实现文案、业务影响与下一步、单位/不可逆提示；只有业务含义不明或需改变已确认要求时按 UI-GOV-06 留交付清单。 |
| UI-WORK-04 | [unit-review](#unit-review)、[package-full](#package-full) | 新根集合局部详情下钻使用包场景验证条件/页码/滚动保持；结果有效性归消费者。 |
| UI-PRINT-01 | [package-print-template](#package-print-template) | 仅覆盖合成 A4 单据与浏览器 PDF；跨平台字体度量、真实消费者权限与业务汇总、实体打印设备另验收。 |
| UI-SCOPE-01 | 无自动断言 | 真实消费者验收：OIT分类、类型码/首字母排序、停用类型/历史直达/独立配置。本库不得硬编码。 |
| UI-SCOPE-02 | 无自动断言 | 新目标按完整静态集合和权限表达 KY/K1 差异，旧聚合字典 Tab 决定已被取代；真实消费者尚未迁移验收。 |
| UI-SCOPE-03 | [unit-actions](#unit-actions) | 合成流程动作直接可达有代表证据；真实ZERP放行意见契约由消费者验收，不泛化免确认。 |
| UI-BOUND-01 | 无自动断言 | 人工规范审查：不恢复失效要求；不擅自固定品牌色/字体族。 |
| UI-BOUND-02 | [unit-model](#unit-model) | 统一公开契约、静态模型、同根登录/退出和迟到隔离有新源码/包映射；真实产品尚未迁移。 |

## 断言入口

### package-layout

[scripts/direct-presentation-smoke.mjs](../scripts/direct-presentation-smoke.mjs) · tgz/browser

定位：`export async function directPresentationSmoke`。代表性客户页：四列筛选/三列编辑、第二操作列、12px表格、32/48px动作、16px手机输入、弹层边界/焦点、手机无溢出。

### package-workbench

[scripts/direct-presentation-smoke.mjs](../scripts/direct-presentation-smoke.mjs) · tgz/browser

定位：`export async function workbenchPresentationSmoke`。工作台四卡片桌面1+3、手机纵排，三主题暗色及恢复浅色。

### package-theme

[scripts/ui-preferences-smoke.mjs](../scripts/ui-preferences-smoke.mjs) · tgz/browser

定位：`default-and-independent-theme-transitions`。认证与业务外壳默认MD3浅色，业务外壳全部主题/明暗组合独立切换。

### package-feedback

[scripts/ui-preferences-smoke.mjs](../scripts/ui-preferences-smoke.mjs) · tgz/browser

定位：`success-error-appearance-and-dismissal-preserve-field-and-row-geometry`。成功/失败消息出现与关闭前后字段或表格行四维几何稳定。

### package-tab-input

[scripts/ui-preferences-smoke.mjs](../scripts/ui-preferences-smoke.mjs) · tgz/browser

定位：`query-input-retained-across-collections`。客户查询输入跨根集合往返保持。

### package-full

[scripts/direct-model-smoke.mjs](../scripts/direct-model-smoke.mjs) · tgz/browser

定位：`export async function directModelSmoke`。新静态模型消费者：引用一次加载及分页/过滤、单据明细跨Tab、权限、固定业务能力、报表下钻返回位置。

### unit-theme

[tests/business-shell-preferences.spec.ts](../tests/business-shell-preferences.spec.ts) · source/public-entry

定位：`defaults to MD3 light`。默认MD3浅色，切明暗后切MD2仍保持暗色。

### unit-feedback

[tests/business-application-direct.spec.ts](../tests/business-application-direct.spec.ts) · source/public-entry

定位：`retains failed-save input`。保存失败保持输入与覆盖式编辑。

### unit-tabs

[tests/business-editor-direct.spec.ts](../tests/business-editor-direct.spec.ts) · source/public-entry

定位：`uses ordered Material groups`。有序多组、首组默认激活、切换保留输入及隐藏空标签分组。

### unit-overlay

[tests/business-list-preferences.spec.ts](../tests/business-list-preferences.spec.ts) · source/public-entry

定位：`opens detail over retained conditions`。第二操作列、覆盖式编辑、保留条件和页码。

### unit-actions

[tests/business-list-preferences.spec.ts](../tests/business-list-preferences.spec.ts) · source/public-entry

定位：`puts row actions in the second column`。第二操作列及打开编辑不自动写入。

### unit-shell

[tests/business-shell-preferences.spec.ts](../tests/business-shell-preferences.spec.ts) · source/public-entry

定位：`keeps the account menu reachable`。页面读取等待时账户仍可达。

### unit-review

[tests/business-review-preferences.spec.ts](../tests/business-review-preferences.spec.ts) · source/public-entry

定位：`narrows field reads and writes`。普通用户只读、增权恢复、管理员尊重业务只读及owner失配。

### unit-model

[tests/business-application-direct.spec.ts](../tests/business-application-direct.spec.ts) · source/public-entry

定位：`edits the same model`。直接输入、失败保持、disabled与并发保护、退出同根引用及迟到错误隔离。

### unit-reactivity

[tests/business-model-reactivity.spec.ts](../tests/business-model-reactivity.spec.ts) · source/public-entry

定位：`keeps query, page and new-record input`。有序成员/列/权限响应式和跨导航输入保持。

### package-reference-feedback

[scripts/ui-preferences-smoke.mjs](../scripts/ui-preferences-smoke.mjs) · tgz/browser

定位：`long-reference-load-error-preserves-form-and-owned-row-geometry`。长引用读取错误通过字段浮层呈现，表单和所属明细行四维几何稳定；可访问错误描述、限定滚动及重试恢复。

### package-print-template

[scripts/template-print-smoke.mjs](../scripts/template-print-smoke.mjs) · 公开 tgz 独立安装和构建示例的合成单据及真实浏览器 PDF

定位：`export async function templatePrintSmoke`。动态行高、文字未裁切、纸张尺寸/页数、页码、重复表头、35条明细各一次、末尾汇总签字及测量容器回收。

## 执行与维护

- `pnpm check:ui-preferences:inventory` 只校验编号完整性、逐条原文摘要、覆盖引用及生成文档同步；不能证明行为。`--write` 更新此生成文件。
- `pnpm test:ui-preferences` 运行直接公开入口的相关源码定向用例。它们不是独立安装证据。
- `pnpm check:ui-preferences` 先校验清单并运行定向用例，再构建、打包、物理独立安装并运行 UI 定向浏览器场景。记录在 `.scratch/package-check-*/evidence.json` 的 `scenarios.installed.assertions`；不重跑全部业务场景。
- `package-full` 为既有完整包场景入口，本片定向命令不执行它。正式发行门禁运行新静态模型完整场景，并执行本片新增主题/反馈浏览器断言；CI校验清单。历史通过记录不当作本轮重新执行结果。
- 新增要求分配新编号；复合要求可用编号加语义后缀记录断言，禁止只验证一个子项就宣称整条通过。删除编号不得复用。新条款须有映射，即便暂时只能记录缺口。原文变更须先重审覆盖，再显式更新该行 requirementSha256（仅编号后的原文，UTF-8），防止旧断言悄悄沿用。
