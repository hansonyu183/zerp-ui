# ZERP UI 术语

本库使用以下术语区分资料与单据；术语决定见 [#16](https://github.com/hansonyu183/zerp-ui/issues/16)。

## 业务资料

**资料/档案（Document）**：
供业务维护和引用的资料，可保留正式内容、候选内容与历史。
_Avoid_: 将 Version/版本档案用作这类资料的统称。

**单据（Voucher）**：
记录一次业务办理的单据，可具有编号、经办人、审批与历史。
_Avoid_: 将 Document/资料用作单据的统称。

## 页面内容

**领域区块（Domain Block）**：
业务页面中表达一组相关业务内容的局部区域，例如单据表头、明细或金额汇总。术语与边界见 [#40](https://github.com/hansonyu183/zerp-ui/issues/40)。

**业务类型（Business Type）**：
在早期页面装配中，对一类业务内容的字段、值结构及关系的统一描述。在静态模型的记录窗口中，`ObjectNode.businessType` 标识共用一个窗口的记录类型，单据的 `type` 另表示单据种类。见 [#108](https://github.com/hansonyu183/zerp-ui/issues/108) 与[记录窗口接口](docs/interfaces/README.md#集合路由与记录窗口)。

**列表/表单投影（List/Form Projection）**：
早期页面装配从业务类型中有序选取供列表或表单使用的字段。静态模型的独立列表由 `ListCollection.columns` 声明列，对象表单及所属明细依据有序 `members` 呈现。见 [#108](https://github.com/hansonyu183/zerp-ui/issues/108) 与[静态模型接口](docs/interfaces/README.md#领域对象与集合)。

## 统一业务模型

**响应式业务模型**：
同时表达业务对象层级、当前数据及可用业务操作的模型；其变化驱动统一界面的内容与交互。目标决定见 [#122](https://github.com/hansonyu183/zerp-ui/issues/122)。

**业务操作**：
业务对象在当前身份及状态下支持的固定行为，包含其执行与必要结果核对约定；与页面上的具体按钮区分。目标决定见 [#122](https://github.com/hansonyu183/zerp-ui/issues/122)。

**写入边界**：
一次业务提交共同保存、取消及核对的内容范围；所属关系本身不表示多个对象共同提交。目标决定见 [#122](https://github.com/hansonyu183/zerp-ui/issues/122)。

**领域分组（Domain Group）**：
将相关的独立业务集合组织在同一领域入口下的分组；不拥有整体保存，各集合仍独立查询、授权和保存。区别于业务对象内的字段分组及随父保存的所属明细。术语与边界见 [#152](https://github.com/hansonyu183/zerp-ui/issues/152)。
