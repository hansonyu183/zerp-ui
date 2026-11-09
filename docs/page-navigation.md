# 页内导航与记录关联

`AppPage.pageNavigation` 呈现当前业务页的有限链接组，与主导航 `navigation` 分离。每组包含 `key/caption/kind/items`，kind为tabs或menu；tabs由消费者提供selectedKey以区分同路径的查询参数切换。库负责按钮、菜单、窄屏横向滚动和键盘交互，消费者继续持有路由及业务资格。

`defineCrudPage`的rowLinks(row)返回有限的 `{key,label,href}` 链接，仅在列表的记录操作中呈现；详情和编辑组件不再重复呈现导航。用于进入所属记录的关联业务，不把关系表提升为主导航。加载、禁用及编辑中不得利用链接绕开当前页面保护；Router离页守卫仍由消费者调用AppPage.requestLeave。

链接应带完整身份/账套归属与实体编号。修改键、当前页码或查询结果不能把既有关联菜单重绑到另一条记录。UI只呈现消费者已经授权的链接，不能替代服务端权限与输入校验。

0.26.0-next.1是本地候选版本，未声明正式发布。
