# UI 规范验证覆盖

由 `docs/ui-preferences.coverage.json` 与原规范生成；修改清单后运行 `pnpm check:ui-preferences:inventory --write`。本文件不维护第二套规范或正式实施状态，工单见 [#159](https://github.com/hansonyu183/zerp-ui/issues/159)。

共 53 条：36 条有自动断言映射（均为部分覆盖），17 条尚无自动断言。映射存在不代表本次执行通过，也不代表整条符合；执行结果以本次命令退出码、Vitest 报告及 tgz evidence.json 为准。

验证策略：流程条款由任务审查；消费者专属条款由真实消费者验收；文案及常规 UI 语义审查由 Agent 按现有要求判断，不逐项询问用户；仅业务含义不明或需改变已确认要求时，在完成其余开发后按 UI-GOV-06 留一份交付清单。本库检查使用合成模型，不是实际 OIT/ZERP API/E2E。定向检查不是数学证明或全状态穷举。

[UI 细节判断与交付清单](ui-preferences-quantification.md) 明确常规取舍由 Agent 处理，历史量化提议未成为强制标准。浏览器既有 1–2 CSS px 的测量容差用于子像素/同排判断，不授权内容位移或成为新的间距标准。既有 390/1440px 视口只是样本，不定义响应断点。

## 条款映射

| 编号 | 现有证据 | 未完成 / 验收边界 |
| --- | --- | --- |
| UI-GOV-01 | 无自动断言 | 流程验收：任务开始时记录受影响编号及当前工单/父规格。 |
| UI-GOV-02 | 无自动断言 | 人工审查：迁移逐路径保留呈现；测试通过不代替全部条款证据。 |
| UI-GOV-03 | 无自动断言 | 流程验收：用户修订与规范同任务同步，来源可追溯。 |
| UI-GOV-04 | 无自动断言 | 由 Agent 审查用户决定的时序及冲突；仅业务含义不明或需改变已确认要求的未决项按 UI-GOV-06 在开发交付时集中列出。 |
| UI-GOV-05 | 无自动断言 | 流程审查：按共用组件实际复用关系记录受影响页面族/容器/状态、相关桌面/手机路径、已检/未覆盖范围及源码/安装、合成/真实证据面；清单通过不等于任务已遵守，不固定全量检查数量。 |
| UI-GOV-06 | 无自动断言 | 流程审查由 Agent 执行：常规文案/UI自主判断；仅将业务含义不明或要求变更在开发交付后合并为一份清单，不逐项询问用户。 |
| UI-THEME-01 | 无自动断言 | 布局所有权及消费者不补模板仍需架构审查；未穷举业务族。 |
| UI-THEME-02 | [package-theme](#package-theme)、[package-workbench](#package-workbench) | 认证外壳、工作台、领域Tabs和查询按钮覆盖主题响应；尚未逐控件穷举完整Material语言。 |
| UI-THEME-03 | [unit-theme](#unit-theme)、[package-theme](#package-theme) | 主题菜单位于明暗左侧的几何顺序尚无断言；真实消费者持久化另验收。 |
| UI-THEME-04 | [unit-buttons](#unit-buttons)、[package-theme](#package-theme)、[package-auth-alignment](#package-auth-alignment) | 覆盖公开业务按钮层级、代表性主题响应及登录按钮宽度；各认证状态、业务族和弹层的按钮呈现尚未逐路径穷举。 |
| UI-THEME-05 | [package-layout](#package-layout) | 覆盖表格12px及手机编辑输入16px；正文、菜单、导航、反馈及认证品牌字号与其他标题尚未逐类验证。 |
| UI-THEME-06 | [package-layout](#package-layout)、[package-auth-alignment](#package-auth-alignment)、[package-mobile-detail-close](#package-mobile-detail-close)、[package-related-navigation](#package-related-navigation) | 覆盖代表性桌面动作、48px 顶栏、手机登录按钮及认证卡片留白、详情关闭和关联链接；全部控件尺寸未穷举。 |
| UI-SHELL-01 | [package-layout](#package-layout)、[package-application-alignment](#package-application-alignment) | 只测编辑弹层和顶栏；滚动、菜单、抽屉遮罩、消息及其他弹层边界待补。 |
| UI-SHELL-02 | 无自动断言 | 未断言所有顶栏子项顺序、品牌内容和首页跳转。 |
| UI-SHELL-03 | 无自动断言 | 未定向检查慢业务读取时账户可达、窄屏文字收起与账户全部入口。 |
| UI-SHELL-04 | [package-related-navigation](#package-related-navigation) | 核对代表性关联目的集合的可见标题；所有导航目标和业务名称重复仍需按路径审查。 |
| UI-SHELL-05 | [package-feedback](#package-feedback)、[package-full](#package-full)、[package-reference-feedback](#package-reference-feedback)、[package-field-alignment](#package-field-alignment)、[package-query-states](#package-query-states)、[package-save-qualification](#package-save-qualification) | 覆盖代表性保存、查询失败和长引用错误的布局、去重、正文可操作及重试；所有字段和反馈组合未穷举。 |
| UI-SHELL-06 | [unit-feedback](#unit-feedback)、[unit-overlay](#unit-overlay)、[package-readonly-reference-feedback](#package-readonly-reference-feedback)、[package-query-states](#package-query-states)、[package-save-qualification](#package-save-qualification) | 覆盖代表性只读引用、保存阻塞原因及查询重试；所有核实操作和业务族状态组合未穷举。 |
| UI-DESKTOP-01 | [package-layout](#package-layout) | 仅代表表格存在/字号；字段完整性与超宽策略未穷举，尽量避免横滚处理方式由 Agent 按现有要求判断，见Q3。 |
| UI-DESKTOP-02 | [unit-actions](#unit-actions)、[package-layout](#package-layout) | 第二操作列有断言；排序必须在相关表头且不占筛选栏尚无定向证据。 |
| UI-DESKTOP-03 | [package-reference-feedback](#package-reference-feedback) | 表格内编辑简洁模式及字段校验前后行高尚无公开浏览器断言。 |
| UI-MOBILE-01 | [package-layout](#package-layout)、[unit-actions](#unit-actions)、[package-application-alignment](#package-application-alignment) | 仅代表卡片字段和无横溢；合计、完整身份、选择、适用明细尚未全部验证。 |
| UI-MOBILE-02 | 无自动断言 | 流式短字段同排、长值换行、名称和值同行尚无几何断言；样本由 Agent 按现有要求选择，见Q3。 |
| UI-MOBILE-03 | 无自动断言 | 首行左右对齐/缺省稳定、全选文字/数量/半选/禁用尚无直接宿主定向证据。 |
| UI-ACTION-01 | [unit-actions](#unit-actions)、[unit-mobile-action-overflow](#unit-mobile-action-overflow) | 操作可用性、手机详情主操作与更多入口有代表性证据；图标语义及各类宽度和流程组合未穷举。 |
| UI-ACTION-02 | [unit-actions](#unit-actions)、[package-layout](#package-layout) | 手机短文字已验，桌面图标及hover/focus hint尚未完整验证。 |
| UI-ACTION-03 | [unit-actions](#unit-actions)、[unit-review](#unit-review)、[package-readonly-reference-feedback](#package-readonly-reference-feedback)、[package-save-qualification](#package-save-qualification)、[package-auth-alignment](#package-auth-alignment)、[unit-available-operations](#unit-available-operations) | 覆盖代表性撤权与禁用、编辑及运行中互斥、登录操作和手动会话恢复入口移除。合成消费者验证保存资格即时更新；业务族及状态组合未穷举。 |
| UI-ACTION-04 | 无自动断言 | 新增各入口、标题与成功提示的一致性，以及其他动作文案尚无统一断言。 |
| UI-FORM-01 | [unit-model](#unit-model)、[unit-review](#unit-review)、[package-mobile-readonly-values](#package-mobile-readonly-values) | 直接编辑、复杂结构和手机只读长值有代表用例；查看、新增与编辑的完整字段顺序组合未穷举。 |
| UI-FORM-02 | [unit-overlay](#unit-overlay)、[package-layout](#package-layout)、[package-application-alignment](#package-application-alignment)、[package-mobile-detail-close](#package-mobile-detail-close) | 手机长详情的焦点、筛选、页码和非零滚动均有代表用例；所有新增及复杂弹层路径未穷举。 |
| UI-FORM-03 | [package-layout](#package-layout)、[package-auth-alignment](#package-auth-alignment)、[package-field-alignment](#package-field-alignment)、[package-application-alignment](#package-application-alignment)、[package-mobile-readonly-values](#package-mobile-readonly-values) | 全部合成业务导航入口及账户/工作台的代表性桌面手机布局、认证和引用控件边界有映射；共用布局归属经代码审查，真实消费者和全部字段值/尺寸/隐藏状态组合未穷举。 |
| UI-FORM-04 | [unit-tabs](#unit-tabs)、[package-layout](#package-layout)、[unit-review](#unit-review)、[unit-domain-tabs](#unit-domain-tabs)、[package-domain-tabs](#package-domain-tabs) | 领域Tab顺序、按需读取、单集合、键盘/真实链接、撤权和输入/分页保持有映射；手机宽度有代表性检查，完整七集合和全部窄屏滚动组合及真实消费者另验收。 |
| UI-FORM-05 | [unit-tabs](#unit-tabs)、[unit-review](#unit-review)、[unit-reactivity](#unit-reactivity)、[unit-ordered-navigation](#unit-ordered-navigation)、[unit-owned-detail-members](#unit-owned-detail-members)、[package-owned-detail-members](#package-owned-detail-members)、[unit-readable-columns](#unit-readable-columns) | 逐行权限差异、空值和零值、空态及结构错误反馈有公开源码入口断言。独立安装的桌面及手机检查覆盖标题和顺序，真实消费者及其它字段组合另验收。 |
| UI-FORM-06 | [unit-model](#unit-model)、[unit-tabs](#unit-tabs)、[unit-review](#unit-review)、[package-tab-input](#package-tab-input)、[package-full](#package-full)、[unit-domain](#unit-domain)、[unit-domain-tabs](#unit-domain-tabs)、[package-domain-tabs](#package-domain-tabs) | 领域Tab顺序、按需读取、单集合、键盘/真实链接、撤权和输入/分页保持有映射；手机宽度有代表性检查，完整七集合和全部窄屏滚动组合及真实消费者另验收。 |
| UI-FORM-07 | [unit-reactivity](#unit-reactivity)、[unit-domain](#unit-domain)、[unit-domain-tabs](#unit-domain-tabs)、[package-domain-tabs](#package-domain-tabs) | 领域Tab顺序、按需读取、单集合、键盘/真实链接、撤权和输入/分页保持有映射；手机宽度有代表性检查，完整七集合和全部窄屏滚动组合及真实消费者另验收。 |
| UI-FORM-08 | [unit-model](#unit-model)、[unit-reactivity](#unit-reactivity)、[unit-overlay](#unit-overlay) | 直接模型值及未知结果限制有证据；不恢复冻结请求/普通离开确认仍需架构审查。 |
| UI-NAV-01 | [unit-shell](#unit-shell) | 仅默认收起及修饰键；直属入口、无标题/无切换提示尚未完整断言。 |
| UI-NAV-02 | [unit-shell](#unit-shell) | 修饰键有证据；图标语义、未知文本、手机选择关闭抽屉、桌面收起及新标签待补。 |
| UI-NAV-03 | [unit-model](#unit-model)、[unit-reactivity](#unit-reactivity)、[package-full](#package-full)、[unit-domain](#unit-domain)、[package-domain-tabs](#package-domain-tabs) | 公开源码覆盖领域单链接、切换高亮、授权裁剪、旧链接失效和工作台首页入口；真实 OIT 菜单、Router 和权限另验。 |
| UI-NAV-04 | [package-related-navigation](#package-related-navigation) | 合成手机详情检查有序关联入口及真实导航目标；其它消费者的页面和目录路径需逐项审查。 |
| UI-NAV-05 | [package-full](#package-full) | 新普通引用按需完整目录及本地分页/过滤有包场景；树形和多选另由字段测试覆盖，真实作用域缓存归消费者。 |
| UI-NAV-06 | [unit-model](#unit-model)、[package-full](#package-full) | 构造无业务查询和工作台按需读取有包映射；慢页面账户可达有源码定向映射。 |
| UI-WORK-01 | [unit-shell](#unit-shell)、[package-workbench](#package-workbench) | 固定4角色桌面/手机几何和主题有代表证据；空角色/全部业务状态仍需定向验收。 |
| UI-WORK-02 | 无自动断言 | 由 Agent 结合业务语境审查简短业务中文与同名一致性，不引入任意字数上限；常规文案不要求用户确认，见Q5。 |
| UI-WORK-03 | 无自动断言 | 由 Agent 审查内部实现文案、业务影响与下一步、单位/不可逆提示；只有业务含义不明或需改变已确认要求时按 UI-GOV-06 留交付清单。 |
| UI-WORK-04 | [unit-review](#unit-review)、[package-full](#package-full) | 新根集合局部详情下钻使用包场景验证条件/页码/滚动保持；结果有效性归消费者。 |
| UI-PRINT-01 | [package-print-template](#package-print-template) | 仅覆盖合成 A4 单据与浏览器 PDF；跨平台字体度量、真实消费者权限与业务汇总、实体打印设备另验收。 XLSX 设计输入与自动转换为标准 JSON 尚待实现及验收。 |
| UI-SCOPE-01 | 无自动断言 | 真实消费者验收：OIT分类、类型码/首字母排序、停用类型/历史直达/独立配置。本库不得硬编码。 |
| UI-SCOPE-02 | [unit-domain](#unit-domain)、[unit-domain-tabs](#unit-domain-tabs)、[package-domain-tabs](#package-domain-tabs) | 领域Tab顺序、按需读取、单集合、键盘/真实链接、撤权和输入/分页保持有映射；手机宽度有代表性检查，完整七集合和全部窄屏滚动组合及真实消费者另验收。 |
| UI-SCOPE-03 | [unit-actions](#unit-actions) | 合成流程动作直接可达有代表证据；真实ZERP放行意见契约由消费者验收，不泛化免确认。 |
| UI-BOUND-01 | 无自动断言 | 人工规范审查：不恢复失效要求；不擅自固定品牌色/字体族。 |
| UI-BOUND-02 | [unit-model](#unit-model) | 统一公开契约、静态模型、同根登录/退出和迟到隔离有新源码/包映射；真实产品尚未迁移。 |
| UI-BOUND-03 | 无自动断言 | 新增约束，尚无行为断言；待消费者修复后验证无网络建立完整结构、响应不能改结构、API不交付装配字段结构及实际业务路径。库合成测试不代替OIT实际消费者验收。 |

## 断言入口

### package-layout

[scripts/direct-presentation-smoke.mjs](../scripts/direct-presentation-smoke.mjs) · tgz/browser

定位：`export async function directPresentationSmoke`。代表性客户页：业务区留白、四列筛选/三列编辑、第二操作列、12px表格、32/48px动作、16px手机输入、手机查询与新增同排、手机记录卡片的 Material 细边框、弹层标题与正文对齐、弹层边界/焦点、手机无溢出。

### package-workbench

[scripts/direct-presentation-smoke.mjs](../scripts/direct-presentation-smoke.mjs) · tgz/browser

定位：`export async function workbenchPresentationSmoke`。工作台四卡片桌面1+3、手机纵排，验证刷新按钮与卡片间距、卡片细边框、三主题暗色及恢复浅色。

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

### unit-ordered-navigation

[tests/static-navigation.spec.ts](../tests/static-navigation.spec.ts) · source/public-entry

定位：`uses array order for root links and domain tabs`。数字形态的根和集合键仍按声明顺序生成侧栏和领域 Tab，并选择首个可读入口。

### unit-owned-detail-members

[tests/business-editor-direct.spec.ts](../tests/business-editor-direct.spec.ts) · source/public-entry

定位：`shares ordered readable detail members`。桌面和手机的空态、行成员标题及顺序、空值和零值、跨行字段权限以及行结构错误反馈。

### package-owned-detail-members

[scripts/ui-preferences-smoke.mjs](../scripts/ui-preferences-smoke.mjs) · tgz/browser

定位：`owned-detail-table-and-cards-use-the-same-member-order-and-labels`。独立安装消费者在 1440/390px 的明细标题及顺序一致。

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

### unit-domain

[tests/static-navigation.spec.ts](../tests/static-navigation.spec.ts) · source/public-entry

定位：`keeps domain collections independently authorized, queried and saved`。每个领域单侧栏链接，切换集合保持高亮；域内独立授权、按需查询、独立保存；移除领域后旧链接失效。

### unit-domain-tabs

[tests/static-navigation.spec.ts](../tests/static-navigation.spec.ts) · source/public-entry

定位：`uses Material domain tabs with real links`。领域多个获权集合用真实 Material Tabs；真实链接/修饰键/空格键、单集合隐藏Tab、撤权重检，以及输入/分页保持且返回不重复查询。

### package-domain-tabs

[scripts/ui-preferences-smoke.mjs](../scripts/ui-preferences-smoke.mjs) · tgz/browser

定位：`material-domain-tabs-keyboard-links-and-input`。公开独立安装消费者的领域Tab、真实href、方向键/Enter激活、查询输入保持。

### unit-buttons

[tests/business-shell-preferences.spec.ts](../tests/business-shell-preferences.spec.ts) · source/public-entry

定位：`restores Material primary, ordinary and destructive action hierarchy`。查询柔和主题色、保存实心主题色、删除危险色、关闭文字按钮，保留操作语义。

### package-auth-alignment

[scripts/auth-alignment-smoke.mjs](../scripts/auth-alignment-smoke.mjs) · tgz/browser

定位：`authentication-reference-text-password-alignment`。390/1440px 的公开认证页面覆盖卡片留白、品牌与字段左对齐、引用与文本和密码框的左右边界、全宽登录按钮及手动恢复入口移除。手机同时验证登录按钮的触控高度。

### package-field-alignment

[scripts/field-alignment-smoke.mjs](../scripts/field-alignment-smoke.mjs) · tgz/browser

定位：`export async function fieldAlignmentSmoke`。筛选、编辑/只读、所属明细表格与手机卡片的可见字段匹配所属容器；错误按钮位于控件内且不遮挡下拉箭头。

### package-readonly-reference-feedback

[scripts/field-alignment-smoke.mjs](../scripts/field-alignment-smoke.mjs) · tgz/browser

定位：`readonly-reference-feedback-reachable`。普通只读身份的引用保持禁用、控件边界对齐，错误原因入口仍可正常点击查看。

### package-application-alignment

[scripts/application-alignment-smoke.mjs](../scripts/application-alignment-smoke.mjs) · tgz/browser

定位：`application-pages-and-components-alignment`。逐个访问全部合成业务入口及其详情/Tab、账户/改密、工作台、密钥修改和打印预览；390/1440px验证字段、操作区、Tab、表格、菜单及iframe边界，无文档横向溢出，弹窗位于顶栏下方。

### package-query-states

[scripts/business-interaction-smoke.mjs](../scripts/business-interaction-smoke.mjs) · tgz/browser

定位：`query-loading-single-feedback-retry-pagination-and-success-empty`。已有结果的查询显示读取中、一次失败反馈与未更新标识，原条件重试恢复分页，成功空结果隐藏分页。

### package-save-qualification

[scripts/business-interaction-smoke.mjs](../scripts/business-interaction-smoke.mjs) · tgz/browser

定位：`mobile-save-qualification-and-unobstructed-specific-feedback`。手机编辑的保存随资格隐藏及恢复；模型失败文案只出现一次，字段不位移且可正常触达。

### unit-available-operations

[tests/business-list-preferences.spec.ts](../tests/business-list-preferences.spec.ts) · source/public-entry

定位：`updates row operations when eligibility or permission changes`。业务操作资格及撤权即时反馈，调用前重检及执行互斥。

### unit-mobile-action-overflow

[tests/business-editor-direct.spec.ts](../tests/business-editor-direct.spec.ts) · source/public-entry

定位：`keeps the primary record action in reach on phones`。手机详情最常用操作直达，次要操作收纳并可执行。

### package-mobile-detail-close

[scripts/mobile-detail-smoke.mjs](../scripts/mobile-detail-smoke.mjs) · tgz/browser

定位：`scrolled-mobile-record-close-and-context`。长详情独立滚动、标题区关闭、键盘关闭、焦点及列表上下文恢复。

### package-mobile-readonly-values

[scripts/mobile-detail-smoke.mjs](../scripts/mobile-detail-smoke.mjs) · tgz/browser

定位：`mobile-readonly-full-values-and-desktop-single-line`。手机只读文本完整换行，桌面短文本保留单行呈现。

### package-related-navigation

[scripts/mobile-detail-smoke.mjs](../scripts/mobile-detail-smoke.mjs) · tgz/browser

定位：`mobile-related-link-wrap-and-collection-heading`。手机关联入口的同行及换行、可点击尺寸、真实链接和目标集合标题。

### unit-readable-columns

[tests/business-list-preferences.spec.ts](../tests/business-list-preferences.spec.ts) · source/public-entry

定位：`excludes unreadable fields from explicit columns and detail`。字段读取资格恢复后，同步恢复列表列及已打开的详情字段。

## 执行与维护

- `pnpm check:ui-preferences:inventory` 只校验编号完整性、逐条原文摘要、覆盖引用及生成文档同步；不能证明行为。`--write` 更新此生成文件。
- `pnpm test:ui-preferences` 运行直接公开入口的相关源码定向用例。它们不是独立安装证据。
- `pnpm check:ui-preferences` 先校验清单并运行定向用例，再构建、打包、物理独立安装并运行 UI 定向浏览器场景。记录在 `.scratch/package-check-*/evidence.json` 的 `scenarios.installed.assertions`；不重跑全部业务场景。
- `package-full` 为既有完整包场景入口，本片定向命令不执行它。正式发行门禁运行新静态模型完整场景，并执行本片新增主题/反馈浏览器断言；CI校验清单。历史通过记录不当作本轮重新执行结果。
- 新增要求分配新编号；复合要求可用编号加语义后缀记录断言，禁止只验证一个子项就宣称整条通过。删除编号不得复用。新条款须有映射，即便暂时只能记录缺口。原文变更须先重审覆盖，再显式更新该行 requirementSha256（仅编号后的原文，UTF-8），防止旧断言悄悄沿用。
