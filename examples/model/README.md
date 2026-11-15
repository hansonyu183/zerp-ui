# 可运行静态模型消费者

`consumer.ts` 在登录前直接定义完整响应式 BusinessModel，通过唯一公开 BusinessApplication 绑定。`families.ts` 提供合成的资料、单据、流程、处理、批次、脚本问题、结构化报表及有限文档输出。业务回调全部为本地合成行为，没有公司数据或真实 API。

普通用户使用登录名 viewer，其他合成登录名作为管理员；不校验真实密码。退出清理业务状态，下一次登录沿用同一根引用。消费者负责 owner 回写有效性，库隔离迟到 UI 反馈。此例用于包验收，不作为认证安全实现。

运行和构建命令从根 package.json 的 dev:model/build:model/check:package 读取。check:package 将同一个 tgz 物理安装到新目录，构建同一消费者并通过浏览器公开行为验收，不使用源码别名、私有 VM 或开发端接口。

只参加编译的完整静态对象另见 ../model-contract；其中声明的回调不可用作运行实现。真实 ZERP/OIT 集成、公司领域规则和正式发行不在本例范围内。
