# 单一模型契约示例

这是下一版契约的独立 TypeScript 示例，没有接入当前宿主。`model.ts` 使用合成后端，不发网络请求。先构建本库，再读取此示例；类型和元数据 Symbol 均从公开 `@zerp/ui/model` 入口导入，不访问私有源码。

`exampleModel` 是完整应用对象，直接以库导出的 `BusinessModel` 标注。该类型已从示例提取至库源码，并由公开 `@zerp/ui/model` 入口导出；示例内部的节点别名均从该类型推导，不维护另一套结构。私有联合类型封闭节点种类及各层级操作，根级业务成员使用开放字典，不把示例业务名称锁进契约。`modelMetadata` 是构造模型字面量所需的唯一元数据 Symbol，不是第二份模型或配置接口。

```ts
import { modelMetadata, type BusinessModel } from "@zerp/ui/model";

type Node = BusinessModel[string];
type ApplicationMetadata = BusinessModel[typeof modelMetadata];
```

UI 入口目标：

```vue
<script setup lang="ts">
import type { BusinessModel } from "@zerp/ui/model";
defineProps<{ model: BusinessModel }>();
</script>
```

消费者目标：

```vue
<script setup lang="ts">
import { BusinessApplication } from "@zerp/ui";
import { exampleModel } from "./model";
</script>

<template>
  <BusinessApplication :model="exampleModel" />
</template>
```

## UI 固定投影

| 模型内容                                          | 库内呈现                             |
| ------------------------------------------------- | ------------------------------------ |
| navigationProjection                              | 全局导航；本例只投影“往来资料”聚合   |
| 普通对象及 form                                   | 按模型顺序组织字段和子对象／集合 Tab |
| 集合 query、page、pageSize、items、total          | 查询表单、分页、列表                 |
| 集合 selected、draft                              | 当前记录与新增记录；切换不清空模型   |
| text、decimal、boolean 的 value                   | 对应输入控件，直接双向绑定           |
| 集合 operations.query / create / export           | 查询／新增／导出                     |
| 对象 operations.get / update / delete / reconcile | 读取／保存／删除／核实结果           |
| operation.disabledReason                          | 操作禁用原因；不因管理员身份覆盖     |
| userPermissions                                   | 裁剪节点和操作，不修改完整源模型     |
| messages                                          | 统一消息区域                         |

权限事实仅用于 UI 的可见、可编辑和操作可用性裁剪，不承担后端授权。后续宿主仍按独立业务边界授权、边界内字段继承并只能收窄、操作缺省拒绝；`userPermissions: null` 表示授权尚未就绪。本例使用管理员快照以展示完整模型。`history` 不参与任何特殊判断：从 `form` 移除就不参与聚合展示，改名或重排直接反映到 UI。

模型构造、遍历、导航和 Tab 切换不执行业务回调。查询、读取、保存、删除仅由用户操作触发；“新增”只生成模型中的新记录，“保存”调用对应后端。显式重新查询或读取会采用后端结果；单纯切换不重新查询。保存失败保留输入，不自动回滚或重发。

记录按稳定业务 ID 复用同一个响应式节点，后端结果直接更新原字段的 `value`；重新查询、过滤和翻页只改变当前列表成员及顺序，已有记录和字段节点不会重建。示例中的身份索引只引用这些节点，不复制字段值。新增记录保存取得 ID 后也沿用原节点；删除成功后移除列表和身份索引中的记录、清除对应选中项，并让指向被删记录的导航返回集合。

模型中不保存前端基线、冻结原请求、恢复日志或第二份草稿。查询和分页是集合自身的数据；UI 仅保留当前 Tab、当前调用忙碌状态等展示状态。数据冲突、请求有效性及结果核实由消费者的后端接驳负责；UI 不据普通查询推断写入结果。

这是聚合、普通对象及集合维护的完整示例，不冒称已覆盖认证、引用、值数组、单据、流程或批次。后续正式契约须将这些能力纳入同一模型类型，不能增加第二个 UI 接口。本片仅实现类型及示例，不代表当前 `BusinessApplication` 已接受此契约，也不代表宿主修复或正式发行完成。
