import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  cp,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const workflowMode = process.argv.includes("--workflow");
const documentMode = process.argv.includes("--document");
const versionMode = process.argv.includes("--version");
const reportMode = process.argv.includes("--report");
const configuration = process.argv.includes("--configuration");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commands = [];
const run = (cmd, args, cwd = root) => {
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
  commands.push({ command: [cmd, ...args], cwd, exitCode: 0 });
};
await mkdir(join(root, ".scratch"), { recursive: true });
const dir = await mkdtemp(join(root, ".scratch/package-check-"));
run("pnpm", ["pack", "--pack-destination", dir]);
const tgz = join(dir, "zerp-ui-0.0.0.tgz");
const consumer = join(dir, "consumer");
await mkdir(consumer);
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const dev = Object.fromEntries(
  ["vite", "@vitejs/plugin-vue", "typescript", "vue-tsc", "@types/node"].map(
    (key) => [key, pkg.devDependencies[key]],
  ),
);
await writeFile(
  join(consumer, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      dependencies: {
        "@zerp/ui": `file:${tgz}`,
        vue: "3.5.40",
        vuetify: "4.1.5",
        "vue-router": "5.2.0",
      },
      devDependencies: dev,
    },
    null,
    2,
  ),
);
await cp(
  join(
    root,
    workflowMode
      ? "examples/workflow"
      : documentMode
        ? "examples/document"
        : versionMode
          ? "examples/version"
          : reportMode
            ? "examples/report"
            : configuration
              ? "examples/configuration"
              : "examples/direct",
  ),
  consumer,
  {
    recursive: true,
    filter: (p) => !p.includes("/dist"),
  },
);
await writeFile(
  join(consumer, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        lib: ["ES2022", "DOM"],
        types: ["vite/client"],
      },
      include: ["*.ts", "*.vue"],
    },
    null,
    2,
  ),
);
const fixture = await readFile(
  join(
    root,
    workflowMode
      ? "tests/workflow.type-test.ts"
      : documentMode
        ? "tests/document.type-test.ts"
        : versionMode
          ? "tests/version.type-test.ts"
          : reportMode
            ? "tests/report.type-test.ts"
            : configuration
              ? "tests/configuration.type-test.ts"
              : "tests/contracts.type-test.ts",
  ),
  "utf8",
);
await writeFile(
  join(consumer, "contracts.type-test.ts"),
  fixture.replace("../src/index", "@zerp/ui"),
);
run(
  "npm",
  ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
  consumer,
);
const require = createRequire(join(consumer, "package.json"));
for (const name of ["vue", "vuetify", "vue-router", "@zerp/ui/style.css"])
  assert.ok(
    require.resolve(name).startsWith(join(consumer, "node_modules")),
    `${name} escaped independent install tree`,
  );
assert.throws(() => require.resolve("@zerp/ui/src/write-lock"), {
  code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
});
const cssPath = require.resolve("@zerp/ui/style.css"),
  css = await readFile(cssPath, "utf8");
for (const [, url] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  assert.ok(!url.startsWith("data:"));
  await stat(resolve(dirname(cssPath), url));
}
run(join(consumer, "node_modules/.bin/vue-tsc"), ["--noEmit"], consumer);
run(join(consumer, "node_modules/.bin/vite"), ["build"], consumer);
const { preview } = await import(pathToFileURL(require.resolve("vite")));
let server, browser;
try {
  server = await preview({
    root: consumer,
    configFile: join(consumer, "vite.config.ts"),
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${address.port}`);
  if (workflowMode || documentMode || versionMode || reportMode) {
    const smoke = workflowMode
      ? workflowSmoke
      : documentMode
        ? documentSmoke
        : versionMode
          ? versionSmoke
          : reportSmoke;
    await smoke(page);
    const exampleRoot = join(
      root,
      workflowMode
        ? "examples/workflow"
        : documentMode
          ? "examples/document"
          : versionMode
            ? "examples/version"
            : "examples/report",
    );
    const exampleServer = await preview({
      root: exampleRoot,
      configFile: join(exampleRoot, "vite.config.ts"),
      preview: { host: "127.0.0.1", port: 0, strictPort: false },
    });
    try {
      const localAddress = exampleServer.httpServer.address();
      assert.ok(localAddress && typeof localAddress !== "string");
      const examplePage = await browser.newPage();
      examplePage.on("pageerror", (e) => errors.push(e.message));
      await examplePage.goto(`http://127.0.0.1:${localAddress.port}`);
      await smoke(examplePage);
      await examplePage.close();
    } finally {
      await new Promise((yes, no) =>
        exampleServer.httpServer.close((e) => (e ? no(e) : yes())),
      );
    }
  } else if (configuration) {
    await configurationSmoke(page);
  } else {
    await page
      .getByRole("heading", { name: "合成示例 · 账簿", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "新增", exact: true }).click();
    await page
      .getByRole("textbox", { name: "名称", exact: true })
      .fill("离仓安装新增");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .getByRole("cell", { name: "离仓安装新增", exact: true })
      .waitFor();
    await page
      .getByRole("row")
      .filter({
        has: page.getByRole("cell", { name: "离仓安装新增", exact: true }),
      })
      .getByRole("button", { name: "编辑", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "名称", exact: true })
      .fill("离仓安装修改");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page
      .getByRole("cell", { name: "离仓安装修改", exact: true })
      .waitFor();
    for (const option of await page
      .locator("select")
      .first()
      .locator("option")
      .all()) {
      const value = await option.getAttribute("value");
      await page.locator("select").first().selectOption(value);
      await page.getByRole("heading").filter({ hasText: "合成示例" }).waitFor();
      await page.getByRole("button", { name: "新增", exact: true }).click();
      await page.getByRole("textbox", { name: "名称", exact: true }).waitFor();
      await page.getByRole("button", { name: "取消编辑", exact: true }).click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page
        .locator("thead")
        .evaluate((el) => getComputedStyle(el).display),
      "none",
    );
  }
  assert.deepEqual(errors, []);
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const report = {
    sourceBase: sha,
    commands,
    sha256: createHash("sha256")
      .update(await readFile(tgz))
      .digest("hex"),
    tgz,
    consumer,
    checks: [
      "independent install",
      "type inference and rejected pairs",
      "production build",
      "CSS/font resolution",
      "public exports",
      ...(workflowMode
        ? [
            "workflow node/target eligibility, exact audit reconciliation, document/runtime consumer routing and refresh-only retry in both contexts",
          ]
        : documentMode
          ? [
              "document create/clone/edit, recursive drafts, source adoption, attachments, independent script identity, approvals/history and exact reconciliation in both consumer contexts",
            ]
          : versionMode
            ? [
                "version official/candidate/history/audit, local blocks, stage/read/submit/approve, exact reconciliation and refresh-only retry in both consumer contexts",
              ]
            : reportMode
              ? [
                  "report parameters/query/paging/export, total/hasMore, eligibility, failures and two DTO examples",
                ]
              : configuration
                ? [
                    "configuration read/edit/save, conflict, exact reconciliation, refresh-only retry, three examples",
                  ]
                : [
                    "browser create/edit and 20 examples",
                    "mobile card surface",
                  ]),
    ],
    exitCode: 0,
  };
  await writeFile(join(dir, "evidence.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (server)
    await new Promise((yes, no) =>
      server.httpServer.close((e) => (e ? no(e) : yes())),
    );
}

async function configurationSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const scenario = (value) => page.getByLabel("写入情景").selectOption(value);
  const edit = async () => {
    await button("编辑").click();
    await page.getByRole("dialog", { name: "编辑配置" }).waitFor();
  };
  const save = () => button("保存").click();
  await page
    .getByRole("heading", { name: "合成配置 · 映射", exact: true })
    .waitFor();
  await edit();
  await page
    .getByRole("textbox", { name: "名称", exact: true })
    .fill("离仓配置");
  await page.getByLabel("映射目标").selectOption("目标乙");
  await save();
  await page.getByRole("cell", { name: "离仓配置", exact: true }).waitFor();
  await edit();
  assert.equal(await page.getByLabel("映射目标").inputValue(), "目标乙");
  await scenario("conflict");
  await save();
  await page.getByRole("alert").filter({ hasText: "修订冲突" }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "名称", exact: true }).inputValue(),
    "离仓配置",
  );
  await scenario("unknown-applied");
  await save();
  await button("关闭编辑").click();
  await button("重试读取").click();
  assert.ok(await button("编辑").isDisabled());
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已核实保存成功" })
    .waitFor();
  await edit();
  await scenario("unknown-not-applied");
  await save();
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已确认本次请求未应用" })
    .waitFor();
  assert.ok(await button("保存").isEnabled());
  await scenario("refresh-failure");
  await save();
  await page.getByRole("alert").filter({ hasText: "合成刷新失败" }).waitFor();
  assert.ok(await button("编辑").isDisabled());
  await button("重试读取").click();
  await edit();
  await scenario("unknown-no-evidence");
  await save();
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "证据不足" }).waitFor();
  await button("关闭编辑").click();
  assert.ok(await button("编辑").isDisabled());
  for (const value of ["period", "report"]) {
    await page.getByLabel("配置示例").selectOption(value);
    await scenario("success");
    await edit();
    if (value === "period")
      await page.getByLabel("锁定", { exact: true }).check();
    else
      await page
        .getByRole("textbox", { name: "名称", exact: true })
        .fill("报表保存");
    await save();
    await page.getByRole("status").filter({ hasText: "配置已保存" }).waitFor();
  }
  await page.getByLabel("配置示例").selectOption("mapping");
  assert.ok(await button("编辑").isDisabled());
}

async function reportSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page
    .getByRole("heading", { name: "合成报表 · 分批", exact: true })
    .waitFor();
  await page.getByLabel("日期范围起", { exact: true }).fill("2026-10-02");
  await button("查询").click();
  await page
    .getByRole("cell", { name: "9007199254740993.0100", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("columnheader", { name: "隐藏列", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.getByText("共 3 条", { exact: false }).count(), 0);
  await page
    .getByRole("textbox", { name: "关键字", exact: true })
    .fill("合成甲");
  await button("下一页").click();
  await page.getByRole("cell", { name: "合成丙", exact: true }).waitFor();
  const download = page.waitForEvent("download");
  await button("导出").click();
  assert.equal((await download).suggestedFilename(), "synthetic-batch.csv");
  await page.getByLabel("报表示例").selectOption("ledger");
  await button("查询").click();
  await page.getByText("共 3 条", { exact: false }).waitFor();
  await page.getByLabel("读取情景").selectOption("failure");
  await button("查询").click();
  await page.getByRole("alert").filter({ hasText: "合成查询失败" }).waitFor();
  await page.getByLabel("读取情景").selectOption("empty");
  await button("重试查询").click();
  await page.getByText("暂无数据", { exact: true }).waitFor();
  await page.getByLabel("操作资格").selectOption("export");
  assert.equal(await button("查询").count(), 0);
  await page.getByLabel("读取情景").selectOption("success");
  const exportOnly = page.waitForEvent("download");
  await button("导出").click();
  assert.equal((await exportOnly).suggestedFilename(), "synthetic-ledger.csv");
  await page.getByLabel("操作资格").selectOption("query");
  assert.equal(await button("导出").count(), 0);
  await button("查询").click();
  await page.getByRole("cell", { name: "合成甲", exact: true }).waitFor();
}

async function versionSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const scenario = (value) => page.getByLabel("写入情景").selectOption(value);
  const name = () => page.getByRole("textbox", { name: "名称", exact: true });
  const expectValue = async (field, value) =>
    assert.equal(await field.inputValue(), value);
  await page
    .getByRole("heading", { name: "合成版本 · 定价", exact: true })
    .waitFor();
  await expectValue(page.getByLabel("定价金额"), "9007199254740993.0100");
  await button("历史 v1").click();
  await expectValue(name(), "合成历史快照");
  assert.equal(await button("编辑版本").count(), 0);
  await button("正式资料").click();
  await button("编辑版本").click();
  await name().fill("新候选定价");
  await page.getByLabel("定价客户").selectOption("客户乙");
  await page.getByLabel("本地附件").setInputFiles({
    name: "synthetic.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("synthetic only"),
  });
  await page
    .getByText("synthetic.txt：本地准备，待暂存", { exact: true })
    .waitFor();
  await scenario("stage-unknown");
  await button("提交版本").click();
  await page
    .getByRole("status")
    .filter({ hasText: "附件暂存结果未知" })
    .waitFor();
  await button("关闭编辑").click();
  await button("重试读取").click();
  assert.ok(await button("编辑版本").isDisabled());
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "尚未业务提交" }).waitFor();
  await scenario("business-unknown");
  await button("编辑版本").click();
  await button("提交版本").click();
  await page
    .getByRole("status")
    .filter({ hasText: "业务写入结果未知" })
    .waitFor();
  await button("关闭编辑").click();
  await button("重试读取").click();
  assert.ok(await button("编辑版本").isDisabled());
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已核实业务写入成功" })
    .waitFor();
  await expectValue(name(), "合成定价");
  await button("开放候选").click();
  await expectValue(name(), "新候选定价");
  await expectValue(page.getByLabel("定价客户"), "客户乙");
  const download = page.waitForEvent("download");
  await button("读取附件 synthetic.txt").click();
  assert.equal((await download).suggestedFilename(), "synthetic.txt");
  await scenario("success");
  await button("审批通过").click();
  await page.getByText("暂无开放候选", { exact: true }).waitFor();
  await button("正式资料").click();
  await expectValue(name(), "新候选定价");
  await button("历史 v1").click();
  await expectValue(name(), "合成历史快照");
  await button("审计").click();
  await page.getByRole("cell").filter({ hasText: "审批" }).waitFor();
  await button("正式资料").click();
  await button("停用版本").click();
  await button("启用版本").waitFor();
  await button("启用版本").click();
  await button("编辑版本").click();
  await scenario("refresh-failure");
  await button("提交版本").click();
  await page.getByRole("alert").filter({ hasText: "合成刷新失败" }).waitFor();
  assert.ok(await button("编辑版本").isDisabled());
  await button("重试读取").click();
  await page.getByLabel("版本示例").selectOption("formula");
  await page
    .getByRole("heading", { name: "合成版本 · 配方", exact: true })
    .waitFor();
  await expectValue(page.getByLabel("配方用量"), "0.0100");
  await button("编辑版本").click();
  await page.getByLabel("配方原料").selectOption("b");
  await page.getByLabel("配方用量").fill("1.2300");
  await scenario("conflict");
  await button("提交版本").click();
  await page.getByRole("alert").filter({ hasText: "合成修订冲突" }).waitFor();
  await scenario("no-evidence");
  await button("提交版本").click();
  await button("关闭编辑").click();
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "证据不足" }).waitFor();
  assert.ok(await button("编辑版本").isDisabled());
}

async function documentSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const scenario = (value) => page.getByLabel("写入情景").selectOption(value);
  const value = () => page.getByRole("textbox", { name: "名称", exact: true });
  const expectValue = async (field, expected) =>
    assert.equal(await field.inputValue(), expected);
  await page
    .getByRole("heading", { name: "合成单据 · ordinary", exact: true })
    .waitFor();
  await button("创建 Draft").click();
  await value().fill("合成新单据");
  await expectValue(page.getByLabel("精确金额"), "9007199254740993.0100");
  await button("合成来源甲").click();
  await page.getByText(/source-r7/).waitFor();
  await button("准备录入目录").click();
  assert.ok(await button("提交单据").isDisabled());
  await page.getByLabel("本地附件").setInputFiles({
    name: "doc.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("synthetic"),
  });
  await scenario("stage-unknown");
  await button("提交单据").click();
  await page
    .getByRole("status")
    .filter({ hasText: "附件暂存结果未知" })
    .waitFor();
  await button("关闭编辑").click();
  await button("重试读取").first().click();
  assert.ok(await button("创建 Draft").isDisabled());
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "尚未业务提交" }).waitFor();
  await button("恢复 Draft").click();
  await scenario("unknown-applied");
  await button("提交单据").click();
  await page
    .getByRole("status")
    .filter({ hasText: "业务写入结果未知" })
    .waitFor();
  await button("关闭编辑").click();
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已核实业务写入成功" })
    .waitFor();
  await button("查看 SYN-2").click();
  await expectValue(value(), "合成新单据");
  const download = page.waitForEvent("download");
  await button("读取附件 doc.txt").click();
  assert.equal((await download).suggestedFilename(), "doc.txt");
  await scenario("success");
  await button("审批通过").click();
  await button("审批通过").waitFor({ state: "detached" });
  await button("克隆 Draft").click();
  await value().fill("克隆值");
  await button("提交单据").click();
  await button("查看 SYN-3").click();
  await expectValue(value(), "克隆值");
  await button("历史 SYN-ordinary · 合成经办人").click();
  await expectValue(value(), "合成录入");
  assert.equal(await button("编辑单据").count(), 0);
  await button("审计").click();
  await page.getByRole("cell").filter({ hasText: "审批" }).waitFor();
  await button("当前单据").click();
  await button("编辑单据").click();
  await scenario("refresh-failure");
  await button("提交单据").click();
  await page.getByRole("alert").filter({ hasText: "合成刷新失败" }).waitFor();
  await button("重试读取").first().click();
  // Script writes keep a separate configuration identity and gate document submission.
  const script = page
    .getByRole("heading", { name: "合成独立脚本", exact: true })
    .locator("..");
  await script.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("脚本正文").fill("return 'updated';");
  await scenario("unknown-applied");
  await button("保存").click();
  await button("关闭编辑").click();
  assert.ok(await button("创建 Draft").isDisabled());
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已核实保存成功" })
    .waitFor();
  await scenario("success");
  await page.getByLabel("单据示例").selectOption("opening");
  await button("创建 Draft").click();
  await button("新增期初行").click();
  await page.getByLabel("行名称").fill("取消行");
  await button("新增子项").click();
  await page.getByLabel("子项金额").fill("0.0100");
  await button("确定子项").first().click();
  await button("取消子项").click();
  assert.equal(await page.getByText("取消行", { exact: true }).count(), 0);
  await button("新增期初行").click();
  await page.getByLabel("行名称").fill("保留行");
  await button("确定子项").click();
  await button("提交单据").click();
  await button("查看 SYN-2").click();
  await page.getByText(/保留行/).waitFor();
  await page.getByLabel("单据示例").selectOption("system");
  await button("查看 SYN-system").click();
  assert.equal(await button("创建 Draft").count(), 0);
  assert.equal(await button("编辑单据").count(), 0);
  assert.equal(await button("克隆 Draft").count(), 0);
  await page.getByLabel("单据示例").selectOption("opening");
  await button("查看 SYN-opening").click();
  await button("编辑单据").click();
  await scenario("unknown-not-applied");
  await button("提交单据").click();
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已确认本次请求未应用" })
    .waitFor();
  await scenario("conflict");
  await button("提交单据").click();
  await page.getByRole("alert").filter({ hasText: "合成修订冲突" }).waitFor();
  await scenario("no-evidence");
  await button("提交单据").click();
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "证据不足" }).waitFor();
  await button("关闭编辑").click();
  assert.ok(await button("创建 Draft").isDisabled());
}

async function workflowSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const scenario = (value) => page.getByLabel("写入情景").selectOption(value);
  await page
    .getByRole("heading", { name: "合成流程运行时", exact: true })
    .waitFor();
  await page.getByLabel("读取情景").selectOption("failure");
  await button("重试读取").click();
  await page.getByRole("alert").filter({ hasText: "合成查询失败" }).waitFor();
  await page.getByLabel("读取情景").selectOption("empty");
  await button("重试读取").click();
  await page.getByText("暂无数据", { exact: true }).waitFor();
  await page.getByLabel("读取情景").selectOption("success");
  await button("重试读取").click();
  await button("查看 流程一").click();
  assert.equal(await page.getByText("未授权目标", { exact: true }).count(), 0);
  await page.getByLabel("根节点创建目标").selectOption("receipt");
  await scenario("unknown");
  await button("创建下级").click();
  await page
    .getByRole("status")
    .filter({ hasText: "节点动作结果未知" })
    .waitFor();
  await button("关闭实例").click();
  await button("重试读取").click();
  await button("查看 流程二").click();
  assert.ok(await button("创建下级").isDisabled());
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已核实节点动作成功" })
    .waitFor();
  await button("查看 流程一").click();
  await page.getByRole("heading", { name: "下级节点", exact: true }).waitFor();
  await scenario("success");
  await page
    .getByRole("region", { name: "下级节点", exact: true })
    .getByRole("button", { name: "打开单据", exact: true })
    .click();
  await page
    .getByText("消费者路由目标：流程一-child", { exact: true })
    .waitFor();
  await button("查看 流程一-child").click();
  await button("编辑单据").click();
  await page
    .getByRole("textbox", { name: "名称", exact: true })
    .fill("流程目标单据修改");
  assert.equal(
    await page.getByLabel("精确金额").inputValue(),
    "9007199254740993.0100",
  );
  await button("提交单据").click();
  await button("查看 流程一-child").click();
  assert.equal(
    await page.getByRole("textbox", { name: "名称", exact: true }).inputValue(),
    "流程目标单据修改",
  );
  await page.getByRole("link", { name: "返回流程", exact: true }).click();
  await button("查看 流程一").click();
  await scenario("not-applied");
  await button("批准下级").click();
  await button("核实本次请求").click();
  await page
    .getByRole("status")
    .filter({ hasText: "已确认本次请求未应用" })
    .waitFor();
  await scenario("conflict");
  await button("批准下级").click();
  await page.getByRole("alert").filter({ hasText: "合成修订冲突" }).waitFor();
  await scenario("refresh-failure");
  await button("批准下级").click();
  await page.getByRole("alert").filter({ hasText: "合成刷新失败" }).waitFor();
  await button("重试读取").click();
  await page.getByText("已批准", { exact: true }).waitFor();
  await scenario("no-evidence");
  await button("打开单据").first().click();
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "证据不足" }).waitFor();
  await button("关闭实例").click();
  await button("查看 流程二").click();
  assert.ok(await button("创建下级").isDisabled());
  await page.getByLabel("会话作用域").selectOption("session-b");
  await button("查看 流程二").click();
  await page.getByLabel("根节点创建目标").selectOption("receipt");
  assert.ok(await button("创建下级").isEnabled());
  await page.getByLabel("会话作用域").selectOption("session-a");
  await button("查看 流程二").click();
  assert.ok(await button("创建下级").isDisabled());
}
