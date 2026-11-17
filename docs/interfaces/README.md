# 静态响应式业务模型接口

正式决定及实施状态维护于 [#152](https://github.com/hansonyu183/zerp-ui/issues/152)。本目录说明 2026-11-16 用户确认的接口、2026-11-17 的领域分组修订及 #159 的有限能力补齐；唯一声明源为 src/business-model.ts，经 @zerp/ui/model 导出。

- [完整类型](../../src/business-model.ts)：固定普通属性、字段、统一对象、所属明细、独立集合、领域分组、打印、权限、工作台及应用生命周期。
- [完整合成对象](../../examples/model-contract/static-application.type-example.ts)：直接定义客户、AA、AB、子明细、引用、格式、模板、工作台及完整匿名应用，附有普通用户权限映射。
- [类型验收](../../examples/model-contract/static-application.type-test.ts)：拒绝旧属性、错误值和错误操作层级，只参加编译。

model 入口仅导出类型，没有 Vue/Vuetify/CSS 运行时依赖。完整静态示例只参加编译，不作为可运行应用导入；可运行的合成消费者位于 examples/model。下述行为的验收以 #159 及关联工单的确切提交、公开入口与独立安装证据为准，类型编译本身不证明行为。

## 领域、对象与集合

`ObjectNode` 的 `family` 固定区分 `standard` 和 `voucher`；单据额外提供只读 `type` 和封闭单据操作。AA、AB 使用同一类型，不建立 VoucherNode 或 VoucherCollection 平行接口。`Collection` 不属于 BusinessNode，只承载独立业务边界；BusinessModel.members 接收 Collection 或 DomainGroup，属性键与成员 key 一致；DomainGroup.members 的属性键也与集合 key 一致。导航只引用根直属或领域内的原 Collection 对象。集合可提供既有有限 `NavigationIcon`：home、catalog、settings、report、voucher、workflow；宿主将该业务语义传给统一外壳，未知语义省略 icon 并保留文字，不接受任意图标名。

2026-11-17 用户确认新增 `DomainGroup = { kind: "domain", key, label, members: Record<string, Collection> }`。领域是固定一层的业务入口组织，不是 ObjectNode/BusinessNode，不包含字段、记录、业务值、操作、会话或授权。根直属集合和领域分组可并存；领域内集合以原引用参加 navigation、CollectionTarget、工作台链接与权限映射，不复制出第二份独立集合。集合 key 在所属 members 中稳定唯一，跨领域定位使用集合引用，不依赖全局 key 唯一。

```text
BusinessModel
└─ 客户领域（DomainGroup）
   ├─ 客户集合
   ├─ 账款设置集合
   ├─ 联系人集合
   ├─ 分类集合
   ├─ 分组集合
   ├─ 属性定义集合
   └─ 相关字典集合
```

分组只组织业务入口，不拥有整体保存；各集合独立持有 conditions、items、selected、draft、分页和 operations，独立查询、授权和保存。领域不产生 query/update、不批量读取子集合、不引入共同提交或权限继承。ObjectNode.members 继续只接受 BusinessNode，RecordsNode 仍随父保存；二者均不接收 DomainGroup 或 Collection。导航 groups/sections 仍显式决定菜单名称、顺序与层级，领域不增加递归导航树或第二套布局协议；可在一个导航组内列出该领域的集合，撤权后隐藏无权集合及空组。领域内容区按模型顺序用真正的 Material Tabs 呈现多个获权集合，单集合直接展示，零集合无空容器；默认首个可见集合，显式直达集合链接仍选中对应 Tab。切换保留各集合输入、条件和分页，已访问集合不因 Tab 往返重复查询；只挂载当前集合，不预读其他 Tab。Tab 使用对应集合的真实 href/visit，保留修饰键及键盘操作；领域自身不增加独立导航目标或保存操作。领域本身不能作为 current、href/visit、CollectionTarget 或权限 grant 的目标。

对象 `members` 数组决定字段和分组的顺序，同一对象内 `key` 唯一。`label: null` 隐藏整个节点的详情/编辑呈现，不隐藏它的业务值，也不阻止显式 columns 或打印路径引用；权限拒绝优先于任何显示投影。columns 的 key 直接引用记录成员，标题始终采用列自己的 label；不从首条记录推断空集合结构。数据行缺少声明的列成员是模型错误，应显示可定位的反馈，不静默猜测字段。

RecordsNode 只表达所属明细和工作台行；明细增删操作改变本地模型，随父对象保存，无独立查询/分页/提交。嵌套对象若只有分组含义则不提供独立 update。新增回调直接构造新记录及字段，不从 column 或已有记录克隆结构。源代码中的记录示例供回调实施时参考，不是恢复 element 的模型模板；每条新记录必须持有独立节点。

全局导航不能指向记录、明细、认证或账户对象；详情及编辑保留于集合 selected/draft。配置 workbench 时 current 为 null 表示工作台；未配置时，按导航投影顺序选择首个获权集合；无获权集合时显示空工作区。认证/强制改密状态优先于业务位置。导航 href/visit 的 Collection | null 参数中，null 专指首页；品牌链接使用 href(null)，普通点击通过 visit(null) 同步消费者路由，修饰键和新标签保留原生链接语义。

## 操作、权限与会话

操作不存在则没有入口，disabled 为 true 则可见但禁用且不得调用 run；缺少授权的操作按权限隐藏。UI 还须防止执行中的重复点击。原 disabledReason 已移除；需要解释业务阻塞或核实结果时由模型 messages 提供信息，不通过禁用布尔值推断文案。

登录前一次定义完整集合及认证结构并传入同一个响应式根对象。业务记录保持空且按需读取；完整结构的定义来源在源码，不要求登录前预载全部记录实例。登录/恢复时后端返回权限，由消费者映射为当前模型的节点引用写入 session。owner 与权限归属必须相等，匿名/恢复期间隐藏受保护内容。

权限只用于 UI 裁剪，不替代后端鉴权。普通用户的独立集合/工作台区块默认拒绝，边界内节点继承且只能收窄；操作缺省拒绝。Collection 的操作授权可覆盖其记录的对象操作；引用 load 按所属边界的 load 授权控制。自动打印入口分别采用 print/itemPrint 授权，并受数据读取权限约束，不能因模板存在获得授权。管理员不覆盖业务 readOnly 或 disabled。

登出由消费者注销后端会话、清空身份/权限、输入、记录、条件、分页、选择、消息和作用域缓存，并使迟到回写失效；UI 清理自己的 busy/反馈并返回认证。直接裁剪对象时，本次宿主保留完整静态结构，仅裁剪呈现；消费者清除旧会话业务数据。再次登录或增权须恢复新获权内容，根对象引用不变；清理不删除后端业务记录或历史审计/恢复证据。

工作台只加载一次当前 owner 的内容；load 在首次进入且至少有一块获权区块时执行，显式重试不受首次加载限制，换 owner 后重新加载。四块随权限分别裁剪，消费者 load 只回写当前获权业务事实。桌面重要信息在上方横跨，下方单据/报表/资料三等宽列；手机依次纵排。行 get 操作可以由业务回调导航至独立集合，不产生第二套导航目标。

## 引用与格式

普通引用是搜索下拉，树形引用是可展开的搜索下拉，均只负责单选或多选。静态候选直接提供，动态候选 load 按需完整读取；加载、缓存作用域和候选有效性归消费者。前端搜索/分页不重复请求，树搜索保留祖先路径；selectable 为 false 的候选可回显但不能新选。原值自带 label，候选缺失不自动清除历史值。不关联 Collection，不增加维护或跳转入口。

格式选项只作用于只读展示、列表和打印，编辑与 API 保留原值。date 是无时区 YYYY-MM-DD；datetime 是有时区 ISO 8601；未填用空字符串。省略 format 时使用本地语言，日期显示年月日，日期时间增加时分秒；显式提供的年月日/时分秒选项决定显示分量。timeZone 缺省采用本机时区，hour12 缺省遵循语言。decimal 缺省保留原精度、不分组、不附加单位；显式 maximumFractionDigits 可对展示按十进制四舍五入，不能经 Number 损失精度；显式最大小数位关系不合法时反馈格式错误，不修改 value。

## 打印 JSON

itemPrintTemple 自动产生记录行及选中详情的单条打印入口，只使用当前读取到且 printable 为 true 的正式记录，不打印 draft。printTemple 自动产生当前页集合打印入口，只使用 items，不查询其余页。缺省模板不显示入口；没有可打印记录时禁用。模板是可序列化的有限 JSON，没有执行表达式、函数、HTML 或 CSS 的扩展点。

ObjectNode.printable 是消费者提供的权威业务事实，覆盖当前对象及所属明细；输入、新增、待保存、提交中和未知结果为 false，只有有效读取、保存或核实权威结果后才能为 true。identity 保留记录身份，不证明直接修改的值已保存。当前页中任一获权记录不可打印时整页入口禁用并说明原因；预览及系统打印调用前再次重检。库不保存编辑基线或额外查询，消费者可从自己的权威业务数据派生此事实。

纸张、页边距、区域坐标和尺寸单位为毫米，字号为 pt。页眉/页脚每页重复，正文在其剩余高度内按 band 顺序布局。record band 相对当前单条记录绑定字段；records band 的空路径只在集合模板中表示 items，非空路径在单条模板中逐级查找对象 members 的 key，最终指向 RecordsNode。列路径相对每行记录。页眉/页脚字段只在单条模板中绑定当前记录；集合模板的页眉/页脚使用固定内容。

records 表格的 rowHeight 和 headerHeight 为最小高度；真实浏览器按相同字体与样式测量文字，默认自动换行撑高整行，按实际高度分页并重复表头。不跨页切开同一行或 record band；单行与表头合计超过整页可用高度时反馈具体明细位置并阻止打印。普通定尺寸文本框仍裁切到固定框。字段按节点格式输出，引用输出 label，布尔值输出“是/否”，空值输出空文本；对象、明细、附件、密码或 secret 不能作为普通 field 打印。没有读取权限的内容不得进入打印结果。

字段路径、尺寸、颜色、字体或位图无效时阻止打印并反馈，不跳过错误或显示原始对象。图片仅允许内嵌 PNG/JPEG/WebP/GIF；颜色和字体沿现有有限打印能力，颜色为六位十六进制。UI 负责绑定、分页、预览及用户明确点击后的原生打印调用；打开/关闭对话框不证明实体打印成功，也不自动更改业务打印次数。模板解释与有限文档生成属于库；正式发行及真实产品接入分别验收。

## 有限业务能力

对象只区分 standard/voucher。既有资料审批、流程、处理、批次、报表及输出通过固定的 document/workflow/processing/batch/report/output 能力表达，各自 operations 的键由类型封闭。它们不改变对象成员结构，不构成另一个宿主或任意命令配置。

OutputNode 保留已经生成的有限文档及显式实体结果确认；InteractionNode 复用有限问题、目录和网格。其关联目标以及报表下钻的 CollectionTarget 都指向独立集合，可选记录放入集合 selected。Collection.report 保留消费者提供的合计和结构事实。详细对应见[迁移清单](static-migration.md)。

pageNumber 元素沿用文本样式及区域坐标，分页完成后输出“第 X / Y 页”。明细后的 record band 可绑定消费者提供的合计字段并包含签字文案，只输出一次，空间不足时整体移到下一页。列支持有限文本样式，包括字体、字号、粗体、对齐、行距与换行；不执行公式或业务汇总。排版过程按当前 UI 作用域取消，关闭预览、修改数据或切换会话使旧排版失效。规格修订及验收见 #179。

## 验收边界

通过唯一公开 BusinessApplication/model 入口、同一候选 tgz 的物理独立安装、合成模型及模拟回调验证。仅对新精确格式与模板算法补必要的纯函数检查；不导出私有 VM。UI 条款逐项核对，实际命令与退出码、确切源码 SHA、tgz 摘要及缺口回写 GitHub #159 及实施票。

合成数据不证明真实 ZERP API/E2E；不连接生产写入、不复制公司数据、不实体打印。正式发行与真实产品接入为后续独立任务。

## 脚本菜单与树动作

menu/tree 项既可关联真实独立集合，也可明确提供 InteractionAction（kind=action，operation 为必需 disabled 与 run 的有限操作）。动作需要所属 InteractionNode 的写入资格和 interact 操作授权，执行中禁止重复；条目或操作被替换、所属节点移除、会话/模型切换后隔离迟到失败反馈。业务回调负责在实际回写前验证有效性。related/download 仍只使用 CollectionTarget，不接受动作，不劫持导航执行命令。规格见 #164。

引用字段的可选 scopeKey 只表示候选目录业务依赖/代际。变化时旧缓存和迟到目录失效，下一次需要时重新读取，保留历史选值；消费者仍须核对 load 结果的 owner/依赖有效性。owner 作用域由宿主提供，无须重复编码。见 #165。


## 独立脚本文件下载

download 的 target 可为真实 CollectionTarget（执行集合 export），或有限 InteractionDownload={kind:download, operation:Operation}（下载当前业务产生的独立文件）。后者使用固定 download 授权，缺省拒绝、无授权隐藏；节点可读即可，不要求业务可写，故只读详情仍可下载。Operation.disabled、条目 disabled、执行中去重及调用前资格重检均有效；文件内容和下载端口属于消费者，不在库内注册额外集合或导航命令。related 不接受下载端口，menu/tree 的写入动作仍使用 InteractionAction，二者不得混用。见 #167。

## 工作台与记录目标链接

#173：navigation.href(collection, record?) 和 visit(collection, record?) 通过有限可选记录参数表达完整链接。href(collection) 为独立集合 canonical，不根据 selected 猜记录，也不在呈现链接时改变选择。报表及有限交互目标、工作台快捷项都传递显式 record，修饰键/新标签使用原生真实 anchor。

Workbench.targets 是从快捷行到 CollectionTarget 的可选 ReadonlyMap，manageReports 提供“管理常用报表”入口。目标只保存已有业务节点引用；外页记录经当前公开有限 target 边归属到其独立集合，不预取、不填入当前页或 selected。实际成员归属优先，已属于另一个根的记录目标拒绝；权限仍沿当前 owner/集合/记录授权。移除目标边、撤权或切换身份后旧链接失效。未提供 targets 的行保留原有有限 get 操作语义。

2026-11-17 用户追加要求恢复此前 BTN 与并列集合 Tab 样式：公开入口沿用 Material 按钮主次层级，保存等主要操作使用主题色，删除等危险操作具有危险样式，普通操作与关闭可区分；保留紧凑密度与 MD1/2/3、明暗响应。领域 Tab 使用 VTabs/VTab，不以普通按钮模拟；正式验收回写 #152。
