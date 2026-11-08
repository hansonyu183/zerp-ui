# API 结构协议 v1

对应[#106](https://github.com/hansonyu183/zerp-ui/issues/106)，design-only。API根为/api，所有资源地址均是API地址，不是浏览器页面地址。

## 发现与资源身份

GET /api/openapi.json 返回当前获准的OpenAPI 3.1.1。未登录只提供账套选择、登录和会话恢复所需接口。作用域、业务模型和契约版本必须同时绑定响应；使用ETag/If-None-Match。缓存键包含服务origin、账套、操作员、安全代际、模型和契约版本，不能跨身份复用。

域索引返回资源id/name/href；它是业务资源集合，不含菜单顺序、group、section、icon、前端URL或页面类型。静态端点、动态资源索引与对应Schema共同构成完整能力集；索引参数允许值必须来自当前获权目录，不能由前端穷举探测。

operationId由规范路径和方法稳定生成。OpenAPI summary/title提供业务含义，不提供按钮位置或组件选择。基础设施、代理/Agent通道、Schema和操作回执属于协议固定保留结构，不作为业务导航叶子。

资源基础地址base采用/api/resources/{domain}/{resource}；当资源带动态标识时使用相应模板。稳定id按原业务身份编码，不改成列表序号。

## 可组合接口族

| 方法与路径 | 输入／输出 | 推导依据 |
| --- | --- | --- |
| GET base/records | Filter → Page<Record> | 可查询集合 |
| GET base/records/{id} | Record及当前业务资格 | 详情 |
| GET base/records/{id}/children | Page<同类Record> | 自关联树；不是递归Schema |
| GET base/fields/{field}/candidates | 关键词、依赖、page、resolveIds → Page<Reference> | 明确的候选关系 |
| GET base/schemas/{model} | 固定版本的最小Schema | record/filter/create/update或动作输入 |
| POST base/drafts | 动作、目标、来源 → Draft | 未提交业务草稿 |
| PUT base/drafts/{draftId}/value | 动态输入JSON、If-Match、Content-Schema、Schema-Version → Draft | 编辑及草稿计算 |
| POST base/actions/{action}/proposals | 草稿版本、原请求ID、基线 → Proposal | 预览，不提交 |
| POST base/operations | 原Proposal标识、摘要及operationId → Receipt | 事务提交 |
| GET base/operations/{operationId} | Receipt | 精确权威核对 |
| POST base/operations/{operationId}/confirmations | 同一原请求摘要、权威证据 → Receipt | 既有协议的精确核实，不是普通查询 |
| POST base/queries | 已验证参数 → 固定QueryResult引用 | 查询执行 |
| GET base/results/{queryId} | 固定结果、版本、合计及分页关系 | 固定报表 |
| GET base/results/{queryId}/records | 动态且版本固定的行Schema/数据绑定 | 报表行 |
| GET base/results/{queryId}/export | 原结果标识 → 文件 | 不重建查询快照 |
| GET base/versions、GET base/versions/{version} | 发布内容与历史 | 版本资源 |
| GET base/jobs/{id} | 状态、逐项结果、错误及可核对证据 | 异步作业 |

路径组合表达能力，不需另一个kind=page/form/tree字段。OIT专用规范可以为认证、Agent、不可变文件及权威恢复保留专用协议；不能为了路径整齐削弱事务和恢复要求。

## 草稿、预览与提交

Draft绑定resource、target、owner、action、值版本、Schema版本和业务基线。PUT草稿只改变草稿/计算结果，不执行最终业务写入；服务器按当前动作执行既有初始化/字段/引用计算，返回新版本及必要业务问题。

Proposal绑定完整原请求、权威基线、配置/发布摘要、预览内容和有效期。服务器规范化后的请求摘要是提交和后续重试的唯一依据；客户端不得在确认后再拼字段。

Receipt区分committed/not_committed/unknown/pending，保留逐项及后续effect证据。只有权威operation资源或指定精确核实协议可以改变未知锁。timeout/abort/普通GET记录/关闭消息均不证明未提交。成功后重读失败只重读。

operationId、目标和摘要相同的重复提交幂等；同ID不同目标/输入冲突。偏好关系写入使用desiredState，同目标可恢复，核对前禁止反向操作。批量冻结逐项清单，每项有独立标识/回执，未知项不能跳过。

## 查询、问题、文件、打印

QueryResult固定参数、执行ID、业务日期、Schema/发布版本、修订、完整合计、分页游标及过期时间；导出和下钻引用同一结果，不重建快照。过期返回410，权限变化返回403或409，均不得静默重新查询。

业务问题分为独立的确认、文本回答、单选/多选、引用选择和只读事实资源。API只给问题与约束；UI决定显示位置和控件。原脚本的open/menu/tree等界面指令在目标中拆成业务问题、资源关系或文件结果，不传字符串UI命令。

文件使用HTTP媒体类型、大小、摘要和Content-Disposition；上传和下载自身有明确授权。原JSON试运行输入、源码、模板文件是有界内容资源，不能作为任意Schema对象的兜底。

打印模板坐标、分页、表达式等属于被维护的业务内容，不是应用页面布局。打印输出、物理结果、printed/not-printed登记分离；发现、加载、恢复、回执轮询不得自动打开窗口或重复打印。Agent协议与浏览器会话分离，不因API可发现而公开机器凭证。

## 错误与HTTP约束

保留trace/requestId。400输入不合法；401认证失效；403授权拒绝；404目标不在可访问范围；409基线/版本/原请求冲突；410结果过期；413有界载荷超限；422业务前提不满足；429并发预算；503权威/模块不可用。未知提交不能仅由HTTP状态猜测。

Schema和描述URI仅同源、版本固定、无凭证查询串。请求有资源预算、取消信号及身份/账套代际校验。服务端在最终事务内重验身份、范围、权限、状态和基线。
