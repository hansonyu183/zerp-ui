# 最小 Schema 子集

对应 [#106](https://github.com/hansonyu183/zerp-ui/issues/106)，design-only。基础为 OpenAPI 3.1.1、JSON Schema 2020-12；不实现通用 Schema 引擎。

## 精确支持范围

| 支持项 | 用法 | 当前 OIT 证据 |
| --- | --- | --- |
| type | string/integer/number/boolean/object/array；可与null组合 | 身份、资料、单据、打印纸张尺寸 |
| title/description | 业务名称、约束解释；不携带组件或排版 | 资料中文字段、业务错误 |
| properties/required | 明确对象字段、必填 | 客户、产品单位、单据明细 |
| additionalProperties | false，或明确的非空值Schema | 属性值、按稳定行号组织的数量/单价映射 |
| items/minItems/maxItems/uniqueItems | 同构数组及边界 | 引用选行、组成员、产品单位 |
| minLength/maxLength/pattern | 字符长度、代码及精确字符串格式 | 标识、单号、源码、精确金额 |
| minimum/maximum/exclusiveMinimum | 数值范围 | 整数排序、页大小、严格大于零的打印尺寸 |
| enum | 同一基础类型的有限值 | 状态、操作、查询维度 |
| oneOf + const + title | 仅带中文名的标量枚举；不是对象联合 | 原状态码与中文状态名 |
| default/readOnly/writeOnly | 业务默认值、服务器值、秘密输入 | 草稿默认值、稳定标识、密码 |
| $ref | 本地组件或同源版本固定的Schema | 复用精确值、当前资源输入定义 |
| $id/$schema | 顶层Schema标识及方言 | 动态字段、结果集及草稿版本绑定 |
| format: date | 公历YYYY-MM-DD；校验日历有效性 | 单据日期，目标API负责与原8位日期转换 |
| format: uuid | 稳定请求标识 | operationId、queryId |
| format: password | 秘密输入，不回显 | 登录、改密 |
| format: binary | 仅文件媒体请求／响应，不能作为JSON表单值 | 附件、导入导出 |

不支持一般allOf/anyOf/oneOf、not、if/then/else、依赖表达式、tuple、patternProperties、任意format、远端Schema下载、递归表单、自定义vocabulary及UI关键字。数字不接受NaN/Infinity。JSON布尔值不能与Y/N字符串混用。

- 对象必须写明properties和additionalProperties。required名称必须存在。null不是缺失，不自动写入null/default。
- oneOf只能是不同值的标量const分支，不能有type/properties条件分支。无中文名的值直接使用enum。
- 数组items必须是一个非空Schema。对象数组必须有协议指定的稳定id；跨数组唯一性、业务和校验由后端验证。
- $ref不允许附带覆盖关键词；动态URI不得有未替换的模板参数。Schema版本固定后不可原地改写。
- readOnly/writeOnly是数据协议的读写事实，不是UI开关。读和写使用不同Schema；writeOnly值不能出现在读取响应、持久化日志或默认值中。
- GBK/CP936字节限制、金额业务范围、日历跨字段关系和权限继续由业务服务校验。不得将字节上限冒充Unicode字符maxLength，或用复杂Schema搬运业务规则。

## 固定数据组合

不增加关键字，固定少量可复用的数据组合：

- Decimal：type string，十进制pattern、长度约束。金额/数量保持精确字符串；显示精度与业务单位由对应业务数据提供。禁止转成JS浮点再提交。
- Month：YYYY-MM字符串pattern；DateRange：from/to两个date属性，顺序由服务器校验。
- Reference／ReferenceKey：读取为id、中文名称、资源身份，写入只交id。候选及可打开详情关系由API声明，不从字段名猜测；名称不可伪造写入。
- SourceText：有长度限制的源码/JSON文本。试运行原始JSON输入属于源码内容，由服务器解析；不是无Schema对象的通用Form兜底。
- Representation：不可变业务数据地址、Schema地址、版本及摘要。用于动态报表/草稿/脚本结果的类型绑定，不允许把未知对象直接塞入value。

## 动态 Schema 不是放宽子集

当前OIT的自定义报表、属性、单据控制项不能在设计时枚举全部未来字段。它们必须在运行时提供同一最小子集的**具体Schema**，由静态API声明绑定规则：

1. 先读取当前资源／动作上下文，取得同源不可变Schema URI、Schema版本及值版本。
2. 动态JSON请求／响应使用约定的Schema URI及版本绑定；OpenAPI不伪造一个万能object。
3. 数据与Schema同一身份、账套、基线、配置／发布版本。缺失、过期、越权或歧义时禁止开放编辑。
4. 表单只使用完整展开、已验证的当前输入Schema；属性的动态名称必须作为具体properties出现，不能作为任意附加字段提交。
5. 动作分支拆成不同端点或输入Schema。条件变化通过草稿计算返回新的Schema和值；客户端不运行条件脚本。
6. 任意脚本结果可作为带媒体类型的只读内容资源保全。只有提供具体Schema的结构化业务数据才能生成字段或表格。

OIT目标工件中的dynamic-bindings.json逐一登记这些接口、Schema来源、字段生成规则与边界；不是未设计接口的占位清单。
