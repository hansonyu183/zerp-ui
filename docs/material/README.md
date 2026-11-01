# Material 对照矩阵

正式规格与状态以 [#49](https://github.com/hansonyu183/zerp-ui/issues/49) 及 [#53](https://github.com/hansonyu183/zerp-ui/issues/53) 为准。本表映射库拥有的表面、状态、实现依据和实际验证入口，不维护第二套工单状态。实现基线保持 Vue 3.5.40、Vuetify 4.1.5、Router 5.2.0；没有升级依赖或扩大公开接口。消费者、Adapter、账户、资格、回执、附件和存储均为合成资料，不构成真实 ZERP API/E2E 或生产接入证据。

依据：[Blueprints](https://vuetifyjs.com/en/features/blueprints/)、[Text fields](https://vuetifyjs.com/en/components/text-fields/)、[Buttons](https://vuetifyjs.com/en/components/buttons/)、[Tables](https://vuetifyjs.com/en/components/tables/)、[Alerts](https://vuetifyjs.com/en/components/alerts/)、[Typography](https://vuetifyjs.com/en/styles/text-and-typography/)、[Dialogs](https://vuetifyjs.com/en/components/dialogs/)、[Material accessibility](https://m1.material.io/usability/accessibility.html)。具体默认值按已安装的 `vuetify/lib/blueprints/md1.js`、`md2.js`、`md3.js` 及运行行为核对；不是仅凭 blueprint 名称判定符合。

## 完整页面和控件映射

所有运行验证从公开 AuthPage/AppPage 发起。下表的脚本在现有独立 tgz 消费者内运行；单元文件用于定向业务回归，不能替代安装包浏览器证据。确切 SHA、命令退出码及同一 tgz 哈希以工单验收评论和 release gate 的 `evidence.json` 为准。

| 用户任务 / 库内表面                                              | Material 实现与保留的契约                                                                                                                       | 可观察证据入口                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| AuthPage 登录、注册、找回、重设                                  | VTextField、VBtn、VCard；账号与密码 autocomplete、受控同步、确认错误关联及模式切换敏感值清理                                                    | `auth.spec.ts`；`shellSmoke` 完整认证往返及反馈关闭                                                                           |
| AppPage 固定顶栏、导航、主题、账户；PageContentHost              | VAppBar/VLayout/VNavigationDrawer/VMenu/VList/VBtn；唯一主标题、固定排列、实际高度与 RouterLink                                                 | `shellInteractionSmoke`、`shellSmoke`：菜单键盘、焦点归还、普通/修饰键/新标签导航、账户资料与改密、320/390px                  |
| ControlledAccountForm                                            | VBtn 与共用字段；最终提交和真实基线仍由账户运行时持有                                                                                           | `page-content.spec.ts`；`directSmoke` 的 IndependentForm；六主题字段/提交矩阵                                                 |
| DynamicForm 文本、密码、多行、精确十进制、整数                   | VTextField/VTextarea；十进制保持原字符串和尾零，整数保留负号等中间输入；0/false/null/空值不归一化                                               | `forms.spec.ts`、`page-content.spec.ts`；`directSmoke`、六主题字段错误/焦点及精确提交                                         |
| DynamicForm 布尔、单/多枚举、日期/范围、局部 rows                | VCheckbox/VSelect/VTextField；选项资格、历史值、受控回显、模式/只读、递归确认取消；日期不做 Date/时区转换                                       | `forms.spec.ts`、`page-content.spec.ts`、`matrix.spec.ts`；direct/configuration/document/voucher 消费者                       |
| ReferencePicker                                                  | VTextField/VList/VBtn/VProgressLinear；服务端搜索、页次/hasMore、精确 resolve、停用/历史已选、移除、父依赖与 scope 隔离                         | `forms.spec.ts`；direct/voucher 消费者采用引用快照及父依赖操作                                                                |
| DataList、RowActions                                             | VTable/VCheckboxBtn/VBtn/VMenu/VList；稳定行身份、受控当前页选择、前三图标/更多；服务端结果无额外排序、分页或汇总                               | `materialShellSmoke` 六主题实际选择、菜单及命中；direct/report 消费者行意图和普通/修饰键链接                                  |
| CrudView、ConfigurationView                                      | VCard、VBtn、VDialog；查询、新建、查看、编辑具名内联 region；危险确认为真模态；耐久预留、未知核实、封存、待刷新和只重读不变                     | direct/configuration 消费者；`capabilities.spec.ts` 耐久原请求和撤权隔离；六主题真实 dirty modal                              |
| ReportView                                                       | 共用字段/列表、VBtn、VList；固定与参数结果、列选择、层级分组/续组、权威合计、已知/未知总数、下钻/返回、导出/停止等待                            | `report.spec.ts`；report 消费者按原格式、权威身份与页次实际操作                                                               |
| DocumentView、VoucherSubmission、SubmissionRuntime               | 共用 VCard、字段/领域区块、VBtn/VFileInput；正式、开放候选、历史、审计、附件及审批按原来源呈现                                                  | document/voucher 消费者：历史、候选、冲突、附件下载、成功/未知/刷新失败                                                       |
| VoucherEditor、DomainBlockHost、DomainRows                       | VTable、共用字段、VCard/VDialog、VBtn；表头、明细、所属行子项和递归局部草稿；局部确定不等于最终保存                                             | `voucher-editor.spec.ts`、`page-content.spec.ts`；voucher/details 消费者局部新增/取消/确认、只读检查、宽表滚动                |
| DetailsPage、RecordDetails、FactFields                           | VCard、语义 dl/dt/dd、VExpansionPanels/VBtn；分组、递归记录、精确原值、历史引用意图；不以 JSON 代替正常事实                                     | `details.spec.ts`；`detailsSmoke` 递归展开、历史原值、关联、编辑保护、子项内 VSelect 浮层归属                                 |
| OperationPage、OperationRuntime                                  | VCard/VBtn/VTable；完整办理预览是可滚动内联 region；显式确认、取消、停止等待与原请求恢复相互区分                                                | `voucher-operation.spec.ts`；`voucherOperationSmoke`、capabilities 消费者：迟到、unknown、封存、权威重读、旧弹层失效          |
| WorkflowView                                                     | 共用列表、VSelect/VTextField/VBtn/VTable；节点、原因、有限动作及审计不变                                                                        | `workflow.spec.ts`；workflow 消费者查询失败/空/重试、目标资格、未知恢复、会话切换                                             |
| DraftCollaboration、BusinessInteractions、ReportInteractionPanel | VProgressLinear、VCheckbox/VTextField、持久 VList 两层菜单/树、VTable、VBtn；输入保留 change 提交时机；回答与原问题、已采用结果及 instance 配对 | `capabilities.spec.ts`：必填回答、失败/重试、迟到计算和旧提示失效；capabilities 消费者实际确认与固定消息占位                  |
| TaskPage                                                         | VSelect/VFileInput/VBtn、共用字段/诊断表/预览；有限动作、导入草稿、下载；文件字段保留一个完整触发面，移除冗余小图标                             | `capabilities.spec.ts`；`capabilitiesSmoke` 本地资源解析、下载、处理准备/确认；320/390px 文件字段边缘实际打开原生选择器后取消 |
| BatchPage                                                        | VCard/VList/VBtn、同一 Operation 引擎；原清单、当前项、结果、显式继续/停止；未知项不可跳过                                                      | `capabilities.spec.ts`；capabilities 消费者重载恢复、逐项继续/停止                                                            |
| PrintPreview                                                     | VCard/VBtn/VProgressLinear；预览周边操作统一；有限 PrintDocument 的毫米坐标、纸张、分页、文字/位图/线矩形不变                                   | capabilities 消费者：授权打开打印窗口、显式物理结果、重载不自动打印；原 iframe 工件检查                                       |
| Feedback、EditGuard                                              | VAlert/VBtn 与固定预留区；error=alert，warning/status=status；VDialog 管理真实离页确认；关闭消息不改变业务写入状态                              | `assertStableFeedback`、六主题反馈/模态；details/capabilities 消费者迟到清理、未知离页限制、焦点/Tab/Escape                   |

## 共用状态和六主题矩阵

`materialShellSmoke` 在实际安装包消费者中遍历 MD1/MD2/MD3 的 light/dark。共享控件集中验收，页面消费者验证装配与高风险路径；没有将每页乘以全部主题重复运行，也没有以安装 Vuetify 推断未执行的状态通过。

| 状态 / 表面                       | 六主题检查                                                                                                                              | 其它代表性状态与证据边界                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 默认正文、表面、字阶              | 列表正文、字段正文/浮动标签、错误文字、内联 Card 错误、真实模态正文的实际计算前景与合成背景 ≥4.5:1                                      | h1 唯一性由 shell 消费者检查；标题/区块标题/标签/辅助文字采用 Vuetify h5/h6/subtitle/body/caption 字阶及中文字体回退。不是逐字截图复刻                                          |
| hover / pressed                   | 对实际主要提交悬停并 pointerdown，确认状态层确实绘制、其存在时文字仍 ≥4.5:1；松开指针到按钮外避免额外提交                               | 状态层及动效来自当前 blueprint；不以私有类名存在作为证明，不建立截图基线                                                                                                        |
| focus / error                     | 从完整表单输入与受控回显，检查焦点保留、aria-invalid、aria-describedby 与原错误文本；测量实际绘制的焦点/错误边界 ≥3:1、标签/说明 ≥4.5:1 | 说明出现/清除前后字段、提交及文档滚动位置保持；测量等待独立 viewport/drawer 过渡结束后开始                                                                                      |
| selected                          | 列表勾选、当前预设 aria-checked、菜单选择；浅色品牌再测布尔已选图标 ≥3:1                                                                | 选择仅更新原受控选择和原 typed intent，不进行客户端资格判断                                                                                                                     |
| disabled / readonly / pending     | 非法十进制及未完成整数禁止提交；只读历史/撤权、写入 unknown 禁用范围在各页面消费者验证                                                  | 禁用文本不套普通文字对比阈值；readonly 历史不强制转换成可提交新值。loading 与迟到隔离由 report/voucher/capabilities 的真实合成异步路径验证，未声称每个 loading 状态均运行六主题 |
| loading / failure / retry / empty | VProgressLinear 的生命周期继续由原运行时持有                                                                                            | 默认 MD3 消费者覆盖查询空/失败/重试、异步草稿计算与失败、附件/导入读取、恢复失败；`capabilities.spec.ts` 从 AppPage 验证具名“业务计算中”状态与继续提交条件                      |
| 主要/次要/危险操作                | 主要填充提交、普通操作、模态次要/危险确认分别测量 ≥4.5:1；保留不同强调                                                                  | 六主题同时复用一个浅品牌案例（primary=#FFFF00、secondary=#FFFFFF）检查填充前景、普通操作、字段焦点和已选控件；不把品牌色直接当作正文色                                          |
| 320/390px 触控                    | 顶栏四项、行图标/更多、选择、主要提交、离页确认取消/放弃实际 ≥48×48，边缘命中对应控件且无页面横向溢出                                   | capabilities 消费者另验完整文件字段实际触发；宽表在自己的滚动区域内；桌面保持既有密度                                                                                           |
| 菜单、真实模态和长内容            | 六主题 dirty modal：初始焦点、Tab/Shift+Tab 范围、Escape、恢复触发器、放弃动作、遮罩/内容均在顶栏下方                                   | details/voucher 消费者覆盖子项读/写、嵌套选项目录、局部取消、完整原值、长预览及旧 scope 清理；普通详情/编辑/办理预览具名 region，不冒充模态                                     |
| 持久反馈及恢复                    | 六主题错误反馈显示/关闭前后顶栏、主要操作与 scroll 不变，消息文字 ≥4.5:1                                                                | details/capabilities 另验业务消息新增/移除/关闭及未知、封存、重读恢复入口；长消息区域内部滚动，关闭不解锁                                                                       |

`zoomReflowSmoke` 另以一个 MD3 light 页面验证 200% 桌面浏览器缩放的等价重排：通过 Chromium CDP 同时将 CSS viewport 减半、DPR 加倍，断言浏览器实际报告的尺寸与 DPR；保持相同物理窗口预算。这不是只改窄屏宽度，也不把触屏 pinch zoom 当作桌面重排。检查精确表单提交、真实 dirty modal 的按钮命中、顶栏避让、Escape/焦点恢复、放弃后状态及页面无横向溢出，最后清除该会话的仿真指标。没有操作浏览器菜单或建立设备矩阵。

计算样式检查保留 RGBA alpha、祖先不透明度及 Vuetify 字段/按钮/列表/Alert 的实际状态层；在这些已知表面合成前景与背景。没有对任意消费方图片、渐变、外部 CSS 或自定义报表前景/背景作全局可读性担保。长文本及复杂报表的完整语义与可滚动性由对应消费者验证，不把小样本对比度外推到所有外部数据。

## 产品适配与发现后的修正

- ADR-0001 要求所有 overlay 限制在 Vuetify 实际登记的顶栏下方；这是产品布局适配，不称为官方默认全视口弹层。VMenu/VDialog/VTooltip/VOverlay 继承同一个 attach/contained 区域，焦点实现仍归 Vuetify。
- 实测发现 VDialog 的内部 defaults root 会重置页面默认值，导致 MD1 离页按钮只有 36px，并可能丢失嵌套目录的 attach。三个真实模态宿主在创建时捕获已有 `injectDefaults()`，在 VDialog 内容内通过原生 VDefaultsProvider 重新提供同一个响应式 defaults；保留完整 blueprint、48px 和嵌套浮层区域，不复制弹层或焦点框架。
- 实测默认暗色错误文字 #CF6679 在 Card surface #212121 上为 4.470:1；采用暗色语义错误色 #EF9A9A，并由现有 Vuetify getContrast 选择 error 的黑/白前景。浅色仍保留对应预设的 error；危险填充确认也使用显式 on-error。
- 主要提交显式 primary，危险确认显式 error；普通按钮使用 on-surface，避免 MD3 默认 primary 变成浅品牌上的不可读文字。布尔/选择控件同样使用 on-surface，实测浅品牌的白色 secondary 原先形成 1:1 已选图标，现由共用 defaults 修正。品牌 primary/secondary 本身保持消费者提供的原值。
- 保留 MD1/MD2/MD3 各自字段 variant、圆角、表面和状态层。48px 是控件实际有效区域，不用不可点击留白替代；没有全局 button/input/select 皮肤覆盖 Vuetify。
- 日期使用 Material VTextField 的 date 输入，保存 YYYY-MM-DD 原字符串；日期选择器、文件选择器、浏览器原生打印对话框属于浏览器/系统 UI。没有为主题替换而引入 Date/时区转换或自建基础交互。
- VTable 保留语义 table/caption/th 与权威结果。dl/dt/dd、链接、文本、图片和打印图文是有意保留的语义内容；示例 aside 中的 JSON 是合成 Adapter 诊断，不是库内正常业务事实呈现。

## 验证和分发记录

实施片的本地结果分别记录于 [#50](https://github.com/hansonyu183/zerp-ui/issues/50)、[#51](https://github.com/hansonyu183/zerp-ui/issues/51)、[#52](https://github.com/hansonyu183/zerp-ui/issues/52)、[#55](https://github.com/hansonyu183/zerp-ui/issues/55)、[#56](https://github.com/hansonyu183/zerp-ui/issues/56)、[#57](https://github.com/hansonyu183/zerp-ui/issues/57)；这些旧 SHA 的定向结果不冒充最终版本的同包验收。

0.10.0 的候选代码补齐六主题字段、模态、浅品牌及指针状态矩阵。最终必须在审查修正后的干净提交上执行既有 `check:release`，只 pack 一次，在全部九类全新消费者验证类型、拒绝出口、生产构建、CSS/字体、唯一宿主 Vue/Vuetify/Router 和公开页面行为。release gate 报告给出源码 SHA、每条命令/退出码及工件 SHA-256；审查、CI、正式上传及下载字节核对/复验分别记录于 #53 和 Release 工件，不能用本地构建成功替代。此文不预先宣称这些后续阶段已经通过。

所有独占浏览器、预览/开发服务器在 finally 显式关闭；未使用截图、生产凭证、公司资料或真实写入。下载复验须使用原已测 tgz，历史 Release 不覆盖。
