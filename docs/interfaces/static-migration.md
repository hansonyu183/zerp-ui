# 静态模型迁移的能力对应

正式规格及状态见 [#159](https://github.com/hansonyu183/zerp-ui/issues/159)，接口权威见 [#152](https://github.com/hansonyu183/zerp-ui/issues/152)。本清单在替换运行路径前建立，用于核对能力没有静默丢失；它不是第二份实施状态。

| 原公开呈现路径/能力 | 唯一静态模型表达 | 保留的可观察行为 |
| --- | --- | --- |
| Symbol 应用元数据、任意根业务成员 | BusinessModel 固定属性，members 仅 Collection | 同一根引用，认证前构造、授权后按需读取 |
| 认证/账户对象级操作 | authentication.form/operations，account.profile/password/operations | 匿名、恢复、强制改密、账户入口不等待当前页查询 |
| 根对象聚合及 navigationProjection | navigation.groups/current 仅指向根 Collection | 权限裁剪、空组隐藏、正常链接、工作台/首个获权集合回退；href/visit(null) 通过消费者同步首页路由 |
| CollectionNode.element/list/query | Collection.columns/conditions/items/selected/draft | 空表标题、分页、覆盖式查看/编辑/新增、失败保留输入 |
| ObjectNode.form、对象命名属性 | ObjectNode.members 有序数组 | 直接更新模型，null label 隐藏整节点，零/单/多组 Material Tab |
| array element 模板及所属明细 | RecordsNode.columns/items/selected/create/remove | 本地增删、直接编辑、随父保存，不建立独立提交 |
| family 单据分支 | ObjectNode.family=voucher、只读 type、固定 VoucherOperations | AA/AB 同一运行路径，不按业务类型码猜测操作 |
| 版本资料、流程、处理及批次操作 | standard/voucher 对象上的固定 document/workflow/processing/batch 能力 | 原封闭操作集、授权、disabled、执行中去重、业务结果由消费者回写 |
| 报表参数、结果、合计、结构及下钻 | conditions、Collection.report、ObjectNode.report.operations、CollectionTarget | 保留消费者数值/分页/合计与局部选中；返回保留查询和滚动 |
| 普通字段、密码、秘密及附件 | FieldNode 固定联合 | 直接输入、秘密 keep/replace/clear、不暴露已有秘密 |
| 普通引用及树候选 | reference/treeReference、单多选值、静态 options/有限 load | 按需完整读取、前端过滤分页、历史值回显、禁用新选 |
| 日期、日期时间、精确十进制 | 各字段的强类型 format | 仅改变展示，保持日期/时区和十进制原值 |
| 脚本问题、目录、网格及关联入口 | InteractionNode 的有限 Interaction<CollectionTarget, InteractionAction> | 直接答案、确认/选择、菜单/树/网格；关联记录留在集合 selected |
| 已生成有限打印文档及实体结果核对 | OutputNode、对象 output 固定操作 | 预览/系统调用不确认实体打印；显式业务确认仍由回调负责 |
| 新自动打印入口 | itemPrintTemple/printTemple 有限 JSON | 单条正式记录/当前页，消费者 printable 确认当前值；无额外查询，授权过滤、绑定、分页、预览 |
| 对象式工作台及分散读取 | 根 workbench 固定四块 RecordsNode、统一 load | 桌面一横三竖、手机纵排；当前 owner 首次获权进入加载，失败重试 |
| disabledReason | 必需 Operation.disabled、统一 messages | 禁用置灰与调用前重检；阻塞/未知结果持续反馈，不恢复旧协议 |

有限能力补齐已回写 [#152](https://github.com/hansonyu183/zerp-ui/issues/152#issuecomment-6898112824) 和 [#159](https://github.com/hansonyu183/zerp-ui/issues/159#issuecomment-6898113213)。不扩展 standard/voucher 种类，不恢复旧公开模型或任意命令。`CollectionTarget` 只封装根集合及可选记录，没有对象级全局导航。

验证以 `@zerp/ui` 的 BusinessApplication、`@zerp/ui/model` 与同一 tgz 物理独立安装为面；模型/模板算法定向检查按 #159 的已确认边界执行。具体源码 SHA、命令、退出码、包摘要、UI 条款证据和未完成项回写相应 GitHub 工单。合成消费者及模拟回调不证明真实 ZERP API/E2E。

#164 补齐 menu/tree 的显式 InteractionAction：operation 仅在用户选择时执行，受固定 interact 权限、节点写入资格、业务禁用及执行中状态约束。related/download 不接受动作目标，CollectionTarget 继续只表达真实根集合与可选记录。

#167 补齐：脚本各独立文件以 download + InteractionDownload 映射消费者下载回调，不替换根集合 export；固定 download 授权可读且允许只读内容，维持原下载按钮。无需虚假命令集合或伪装菜单。
