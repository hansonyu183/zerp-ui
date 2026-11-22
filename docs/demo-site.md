# 合成示例站

地址：[zerp-ui-demo.pages.dev](https://zerp-ui-demo.pages.dev)。托管于 Cloudflare Pages 项目 `zerp-ui-demo`，正式分支为 `main`，当前在线版本须按 Pages 元数据核对；当前发布流程以 [`examples/model`](../examples/model/README.md) 为源码入口。全部数据、身份和 Adapter 都是合成示例；本站不连接 ZERP 或 oit-go 业务服务。

示例站提供直接维护、配置、报表、资料/档案、单据和流程页面，以及主题、明暗、账户和响应式交互。各路径可直接访问并刷新；Pages 使用 SPA 回退。

## 发布与部署

1. 按[发行验证说明](../README.md#独立消费者与验证)核对该版本的源码 CI、正式 tgz、`SHA256SUMS` 和 `evidence.json`。
2. 下载正式原包并校验哈希。在发行对应的干净提交上，将该版本的 `evidence.json` 放入 `.scratch/release/<源码SHA>/`，再运行 `node scripts/check-release.mjs --tgz <下载包>`。复验使用同一 `examples/model` 源码分别执行模型与模板打印检查。
3. 从新生成的 `distribution-evidence.json` 中查找 `slices[]` 内 `name` 为 `model` 的记录，读取其 `consumer` 路径。部署该路径下经验证的 `dist/`。
4. 部署前记录 Pages 当前正式部署的 ID、URL、源码 SHA，以及本次目录逐文件 SHA-256。复用既有 Cloudflare 登录态或受控凭证，不把凭证写入仓库或日志。
5. 使用 `wrangler pages deploy <consumer>/dist --project-name zerp-ui-demo --branch main --commit-hash <源码SHA> --commit-message <版本说明> --commit-dirty=false`。不部署到 ZERP/oit-go 项目。
6. 独立核对 Pages 正式部署元数据、在线 HTML/JS/CSS/字体的字节哈希，以及登录、模型客户入口直达与刷新、默认收起导航、主题菜单和手机卡片。记录部署 ID、Release 链接和验证结果至对应 GitHub Issue。

Cloudflare 默认凭证位于 `/Users/hansonyu/.secrets/cloudflare/`，部署进程通过环境变量读取；该目录及其内容不随工件分发。

## 回退与资源

保留变更前的正式部署标识。需要回退时，在 Cloudflare Pages 的部署历史中将该正式部署回退为生产版本，再独立核对正式域名及静态资源；旧 Release 和示例站部署历史不覆盖或删除。

验证启动的浏览器及临时预览服务必须在结束时显式关闭。正式示例站由 Pages 托管，不保留本机开发服务器、隧道或临时端口。
