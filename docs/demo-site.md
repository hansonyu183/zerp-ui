# 合成示例站

地址：[zerp-ui-demo.pages.dev](https://zerp-ui-demo.pages.dev)。托管于 Cloudflare Pages 项目 `zerp-ui-demo`，正式分支为 `main`，入口采用 `examples/shell`。全部数据、身份和 Adapter 都是合成示例；本站不连接 ZERP 或 oit-go 业务服务。

示例站提供直接维护、配置、报表、资料/档案、单据和流程页面，以及主题、明暗、账户和响应式交互。各路径可直接访问并刷新；Pages 使用 SPA 回退。

## 发布与部署

1. 按 README 的发行流程，完成精确源码的 CI、正式 tgz 与 SHA256SUMS/evidence.json 发布，保留历史工件。
2. 从正式 Release 下载原包、校验哈希，再运行 `node scripts/check-release.mjs --tgz <下载包>`。该命令不重新打包，并产生九类消费者的分发复验证据。
3. 从分发复验 `distribution-evidence.json` 的 `shell` 记录中读取独立安装消费者的 `consumer` 路径。将该路径的 `dist/` 作为唯一部署目录；不要混用另一个版本或未经验证的构建目录。
4. 部署前记录 Pages 当前正式部署的 ID、URL、源码 SHA，以及本次目录逐文件 SHA-256。复用既有 Cloudflare 登录态或受控凭证，不把凭证写入仓库或日志。
5. 使用 `wrangler pages deploy <consumer>/dist --project-name zerp-ui-demo --branch main --commit-hash <源码SHA> --commit-message <版本说明> --commit-dirty=false`。不部署到 ZERP/oit-go 项目。
6. 独立核对 Pages 正式部署元数据、在线 HTML/JS/CSS/字体的字节哈希，以及首页、六类页面直达与刷新、默认收起导航、主题菜单和手机卡片。记录部署 ID、Release 链接和验证结果至对应 GitHub Issue。

Cloudflare 默认凭证位于 `/Users/hansonyu/.secrets/cloudflare/`，部署进程通过环境变量读取；该目录及其内容不随工件分发。

## 回退与资源

保留变更前的正式部署标识。需要回退时，在 Cloudflare Pages 的部署历史中将该正式部署回退为生产版本，再独立核对正式域名及静态资源；旧 Release 和示例站部署历史不覆盖或删除。

验证启动的浏览器及临时预览服务必须在结束时显式关闭。正式示例站由 Pages 托管，不保留本机开发服务器、隧道或临时端口。
