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
对一类业务内容的字段、值结构及对象、集合和引用关系的统一描述。术语与边界见 [#108](https://github.com/hansonyu183/zerp-ui/issues/108)。

**列表/表单投影（List/Form Projection）**：
从业务类型中有序选取供列表或表单使用的字段，不另行定义同一字段的业务含义。术语与边界见 [#108](https://github.com/hansonyu183/zerp-ui/issues/108)。

## 统一业务模型

**响应式业务模型**：
同时表达业务对象层级、当前数据及可用业务操作的模型；其变化驱动统一界面的内容与交互。目标决定见 [#122](https://github.com/hansonyu183/zerp-ui/issues/122)。

**业务操作**：
业务对象在当前身份及状态下支持的固定行为，包含其执行与必要结果核对约定；与页面上的具体按钮区分。目标决定见 [#122](https://github.com/hansonyu183/zerp-ui/issues/122)。

**写入边界**：
一次业务提交共同保存、取消及核对的内容范围；所属关系本身不表示多个对象共同提交。目标决定见 [#122](https://github.com/hansonyu183/zerp-ui/issues/122)。
