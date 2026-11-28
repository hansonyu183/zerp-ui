# 静态模型迁移的能力对应

正式规格及状态见 [#159](https://github.com/hansonyu183/zerp-ui/issues/159)，接口权威见 [#152](https://github.com/hansonyu183/zerp-ui/issues/152)。本清单在替换运行路径前建立，用于核对能力没有静默丢失；它不是第二份实施状态。

## 从 0.50.0 升级至 0.51.0

1. 字段和明细直接更新原响应式对象。保存和明细增删回调接收原节点，可用 Vue 监听值变化处理业务联动与打印资格。
2. 正式记录每次打开或切入同类窗口时调用已声明的 `load(id)`。读取回调在完成前写回当前对象，窗口据此建立未保存比较快照。
3. 确认切换后，离开的对象保留当前值。切回时由其 `load(id)` 写回。

## Vuetify 初始化迁移

宿主在挂载 `App` 前导入 `@zerp/ui/style.css`，移除原先的 `app.use(createVuetify(...))` 和 `vuetify/styles` 导入。原有品牌色从 `createShellThemes({ primary, secondary })` 移入 `model.brand` 的同名属性。

## 能力对应

| 原公开呈现路径/能力               | 唯一静态模型表达                                                                                           | 保留的可观察行为                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Symbol 应用元数据、任意根业务成员 | BusinessModel 固定属性，`work.members` 为栏目、领域或独立集合的有序数组。领域 members 为独立集合的有序数组 | 同一根引用，认证前构造、授权后按需读取                                                   |
| 认证/账户对象级操作               | `authentication.form/operations`，`work.account.profile/password/operations`                               | 匿名、恢复、强制改密、账户入口不等待当前页查询                                           |
| 根对象聚合及 navigationProjection | 静态栏目、领域、集合生成库内页面路由                                                                       | 权限裁剪、正常链接、工作台首页、前进后退和 404                                           |
| CollectionNode.element/list/query | ListCollection 的有序列、条件、当前页及可选分页 load                                                       | 空表标题、按页读取、失败保留已有结果                                                     |
| ObjectNode.form、对象命名属性     | ObjectNode.members 有序数组，businessType 表达记录业务类型                                                 | 字段及权限直接呈现；工作区每种类型一个窗口，切换同类记录时对比读后快照并确认未保存变更         |
| array element 模板及所属明细      | RecordsNode.items/selected/operations，字段、标题及顺序由每行 ObjectNode.members 提供                      | 桌面和手机沿用获权字段及顺序，本地增删随父保存                                           |
| family 单据分支                   | ObjectNode.family=voucher、只读 type、固定 VoucherOperations                                               | AA/AB 同一运行路径，不按业务类型码猜测操作                                               |
| 版本资料、流程、处理及批次操作    | standard/voucher 对象上的固定 document/workflow/processing/batch 能力                                      | 原封闭操作集、授权、disabled、执行中去重、业务结果由消费者回写                           |
| 报表参数、结果、合计、结构及下钻  | conditions、Collection.report、ObjectNode.report.operations、CollectionTarget                              | 保留消费者数值/分页/合计与局部选中；返回保留查询和滚动                                   |
| 普通字段、密码、秘密及附件        | FieldNode 固定联合                                                                                         | 直接输入、秘密 keep/replace/clear、不暴露已有秘密                                        |
| 普通引用及树候选                  | reference/treeReference、单多选值、静态 options/有限 load                                                  | 按需完整读取、前端过滤分页、历史值回显、禁用新选                                         |
| 日期、日期时间、精确十进制        | 各字段的强类型 format                                                                                      | 仅改变展示，保持日期/时区和十进制原值                                                    |
| 脚本问题、目录、网格及关联入口    | InteractionNode 的有限 Interaction<CollectionTarget, InteractionAction, InteractionDownload>               | 直接答案、确认/选择、菜单/树/网格；通过显式记录目标打开窗口并保持页面                    |
| 已生成有限打印文档及实体结果核对  | OutputNode、对象 output 固定操作                                                                           | 预览/系统调用不确认实体打印；显式业务确认仍由回调负责                                    |
| 新自动打印入口                    | itemPrintTemple/printTemple 有限 JSON                                                                      | 单条正式记录/当前页，消费者 printable 确认当前值；无额外查询，授权过滤、绑定、分页、预览 |
| 对象式工作台及分散读取            | 首页集合 workbench 固定四块 RecordsNode、统一 load                                                         | 桌面一横三竖、手机纵排；当前 owner 首次获权进入加载，失败重试                            |
| disabledReason                    | 必需 Operation.disabled、统一 messages                                                                     | 操作按钮按可用性显隐，调用前重检；持续反馈阻塞及未知结果                                 |

有限能力补齐已回写 [#152](https://github.com/hansonyu183/zerp-ui/issues/152#issuecomment-6898112824) 和 [#159](https://github.com/hansonyu183/zerp-ui/issues/159#issuecomment-6898113213)。不扩展 standard/voucher 种类，不恢复旧公开模型或任意命令。`CollectionTarget` 只封装独立集合及可选记录，没有对象级全局导航。

验证以 `@zerp/ui` 的 App、`@zerp/ui/model` 与同一 tgz 物理独立安装为面；模型/模板算法定向检查按 #159 的已确认边界执行。具体源码 SHA、命令、退出码、包摘要、UI 条款证据和未完成项回写相应 GitHub 工单。合成消费者及模拟回调不证明真实 ZERP API/E2E。

[#164](https://github.com/hansonyu183/zerp-ui/issues/164) 补齐 `menu` 和 `tree` 的显式 `InteractionAction`。0.49.0 起的动作资格见[脚本菜单与树动作](README.md#脚本菜单与树动作)。

[#167](https://github.com/hansonyu183/zerp-ui/issues/167) 补齐脚本独立文件下载，使用 `download` 和 `InteractionDownload` 映射消费者回调。0.49.0 起的下载资格见[独立脚本文件下载](README.md#独立脚本文件下载)。
