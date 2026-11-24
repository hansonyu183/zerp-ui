# 合成示例站

示例站托管于 Cloudflare Pages 项目 `zerp-ui-demo`，正式分支为 `main`。2026-11-24 只读核对时，正式部署 `e41706c9-be85-4d14-98b7-4bcfd53faa2e` 对应源码 `992cf5dc771813e5b69e6f56f1d9ea2135b55327`，即 [ui-v0.14.0](https://github.com/hansonyu183/zerp-ui/tree/ui-v0.14.0) 的 `examples/shell`。正式域名根路径和 `/business/customers` 均显示旧版合成流程。后续核对以 Pages 正式部署元数据和在线资源为准。 [示例站](https://zerp-ui-demo.pages.dev)

下文描述新版 [`examples/model`](../examples/model/README.md) 的发布流程。示例数据、身份和回调均为合成，独立于 ZERP 和 oit-go 的业务服务。Pages 的 SPA 回退只负责加载应用壳。当前合成消费者刷新后需重新登录，登录进入有权默认入口，保留深链目标需要消费者另外处理。

## 发布与部署

1. 按[发行验证说明](../README.md#独立消费者与验证)核对该版本的源码 CI、正式 tgz、`SHA256SUMS` 和 `evidence.json`。
2. 下载正式原包并校验哈希。在发行对应的干净提交上，将该版本的 `evidence.json` 放入 `.scratch/release/<源码SHA>/`，再运行 `node scripts/check-release.mjs --tgz <下载包>`。复验使用同一 `examples/model` 源码分别执行模型与模板打印检查。
3. 从新生成的 `distribution-evidence.json` 中查找 `slices[]` 内 `name` 为 `model` 的记录，读取其 `consumer` 路径。部署该路径下经验证的 `dist/`。
4. 部署前记录 Pages 当前正式部署的 ID、URL、源码 SHA，以及本次目录逐文件 SHA-256。复用既有 Cloudflare 登录态或受控凭证，不把凭证写入仓库或日志。
5. 使用 `wrangler pages deploy <consumer>/dist --project-name zerp-ui-demo --branch main --commit-hash <源码SHA> --commit-message <版本说明> --commit-dirty=false`。不部署到 ZERP/oit-go 项目。
6. 独立核对 Pages 正式部署元数据以及在线 HTML、JS、CSS 和字体的字节哈希。验证深路径和刷新能加载认证壳，登录后从侧栏进入客户，检查默认收起导航、主题菜单和手机卡片。需要登录后保留深链目标时，单独验收消费者的路由恢复。将部署 ID、Release 链接和验证结果记入对应 GitHub Issue。

Cloudflare 默认凭证位于 `/Users/hansonyu/.secrets/cloudflare/`，部署进程通过环境变量读取；该目录及其内容不随工件分发。

## 回退与资源

保留变更前的正式部署标识。需要回退时，在 Cloudflare Pages 的部署历史中将该正式部署回退为生产版本，再独立核对正式域名及静态资源；旧 Release 和示例站部署历史不覆盖或删除。

验证启动的浏览器及临时预览服务必须在结束时显式关闭。正式示例站由 Pages 托管，不保留本机开发服务器、隧道或临时端口。
