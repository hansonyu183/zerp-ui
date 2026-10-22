import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  cp,
  readFile,
  writeFile,
  stat,
  readdir,
} from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { voucherOperationSmoke } from "./voucher-operation-smoke.mjs";
import { chromium } from "@playwright/test";
const shellMode = process.argv.includes("--shell");
const workflowMode = process.argv.includes("--workflow");
const voucherMode = process.argv.includes("--voucher");
const documentMode = process.argv.includes("--document");
const reportMode = process.argv.includes("--report");
const configuration = process.argv.includes("--configuration");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commands = [];
const run = (cmd, args, cwd = root) => {
  try {
    execFileSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 32 << 20 });
  } catch (error) {
    if (error.stdout) process.stderr.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
  commands.push({ command: [cmd, ...args], cwd, exitCode: 0 });
  console.log(`✓ ${cmd} ${args.join(" ")}`);
};
await mkdir(join(root, ".scratch"), { recursive: true });
const dir = await mkdtemp(join(root, ".scratch/package-check-"));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const artifactIndex = process.argv.indexOf("--tgz");
assert.ok(
  artifactIndex < 0 || process.argv[artifactIndex + 1],
  "--tgz requires a path",
);
if (artifactIndex < 0) run("pnpm", ["pack", "--pack-destination", dir]);
const tgz =
  artifactIndex < 0
    ? join(dir, `zerp-ui-${pkg.version}.tgz`)
    : resolve(process.argv[artifactIndex + 1]);
await stat(tgz);
const consumer = join(dir, "consumer");
await mkdir(consumer);
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
        ...Object.fromEntries(
          Object.keys(pkg.peerDependencies).map((name) => [
            name,
            pkg.devDependencies[name],
          ]),
        ),
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
    shellMode
      ? "examples/shell"
      : workflowMode
        ? "examples/workflow"
        : voucherMode
          ? "examples/voucher"
          : documentMode
            ? "examples/document"
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
if (shellMode) {
  const appPath = join(consumer, "App.vue");
  let app = await readFile(appPath, "utf8");
  for (const name of [
    "direct",
    "configuration",
    "report",
    "document",
    "voucher",
    "workflow",
  ]) {
    await cp(join(root, "examples", name), join(consumer, "modules", name), {
      recursive: true,
      filter: (p) => !p.includes("/dist"),
    });
    app = app.replaceAll(`../${name}/`, `./modules/${name}/`);
  }
  await writeFile(appPath, app);
}
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
      include: ["**/*.ts", "**/*.vue"],
    },
    null,
    2,
  ),
);
const fixture = await readFile(
  join(
    root,
    shellMode
      ? "tests/shell.type-test.ts"
      : workflowMode
        ? "tests/workflow.type-test.ts"
        : voucherMode
          ? "tests/voucher.type-test.ts"
          : documentMode
            ? "tests/document.type-test.ts"
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
  fixture.replaceAll("../src/index", "@zerp/ui"),
);
if (voucherMode) {
  const operationTypes = await readFile(
    join(root, "tests/voucher-operation.type-test.ts"),
    "utf8",
  );
  await writeFile(
    join(consumer, "operations.type-test.ts"),
    operationTypes
      .replaceAll("../src/index", "@zerp/ui")
      .replaceAll(
        "../examples/voucher/operation-adapter",
        "./operation-adapter",
      ),
  );
}
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
const libraryRequire = createRequire(require.resolve("@zerp/ui/style.css"));
for (const name of Object.keys(pkg.peerDependencies)) {
  assert.equal(
    libraryRequire.resolve(name),
    require.resolve(name),
    `${name} has a second host instance`,
  );
}
run("npm", ["ls", "vue", "vuetify", "vue-router", "--all"], consumer);
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
// Check every shipped declaration, including those not used by this example.
// Upstream Vuetify/TypeScript declarations have their own diagnostics; do not
// suppress our package's diagnostics with the consumer's skipLibCheck setting.
const ts = require("typescript");
const declarationRoot = dirname(require.resolve("@zerp/ui/style.css"));
const declarationFiles = (await readdir(declarationRoot))
  .filter((name) => name.endsWith(".d.ts"))
  .map((name) => join(declarationRoot, name));
const declarationProgram = ts.createProgram(declarationFiles, {
  strict: true,
  skipLibCheck: false,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  types: [],
});
const declarationDiagnostics = ts.getPreEmitDiagnostics(declarationProgram);
const packageDiagnostics = declarationDiagnostics.filter(
  (diagnostic) =>
    !diagnostic.file ||
    diagnostic.file.fileName.startsWith(`${declarationRoot}/`),
);
assert.equal(
  packageDiagnostics.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(packageDiagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => consumer,
    getNewLine: () => "\n",
  }),
);
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
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const observe = (page) => {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (request) =>
      errors.push(`Failed resource: ${request.url()}`),
    );
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
  };
  observe(page);
  await page.goto(`http://127.0.0.1:${address.port}`);
  const smoke = shellMode
    ? shellSmoke
    : workflowMode
      ? workflowSmoke
      : voucherMode
        ? voucherSmoke
        : documentMode
          ? documentSmoke
          : reportMode
            ? reportSmoke
            : configuration
              ? configurationSmoke
              : directSmoke;
  await smoke(page);
  const exampleName = shellMode
    ? "shell"
    : workflowMode
      ? "workflow"
      : voucherMode
        ? "voucher"
        : documentMode
          ? "document"
          : reportMode
            ? "report"
            : configuration
              ? "configuration"
              : "direct";
  const exampleRoot = join(root, "examples", exampleName);
  const exampleServer = await preview({
    root: exampleRoot,
    configFile: join(exampleRoot, "vite.config.ts"),
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  try {
    const localAddress = exampleServer.httpServer.address();
    assert.ok(localAddress && typeof localAddress !== "string");
    const exampleContext = await browser.newContext();
    const examplePage = await exampleContext.newPage();
    observe(examplePage);
    await examplePage.goto(`http://127.0.0.1:${localAddress.port}`);
    await smoke(examplePage);
    await exampleContext.close();
  } finally {
    await new Promise((yes, no) =>
      exampleServer.httpServer.close((e) => (e ? no(e) : yes())),
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
    declarations: {
      checkedFiles: declarationFiles.length,
      packageErrors: packageDiagnostics.length,
      thirdPartyDiagnostics:
        declarationDiagnostics.length - packageDiagnostics.length,
    },
    checks: [
      "independent install",
      "type inference and rejected pairs",
      "production build",
      "CSS/font resolution",
      "public exports",
      "single Vue/Vuetify/Router host resolution and npm installation tree",
      "no failed browser assets",
      ...(shellMode
        ? [
            "auth flows, app themes/defaults, all six view consumers, navigation links/new tab, retries, account and responsive navigation in both contexts",
          ]
        : workflowMode
          ? [
              "workflow node/target eligibility, exact audit reconciliation, voucher/runtime consumer routing and refresh-only retry in both contexts",
            ]
          : voucherMode
            ? [
                "voucher header/detail/child dialog, local and outer draft cancellation, source adoption, attachments, independent script identity, approvals/history and exact reconciliation in both consumer contexts",
              ]
            : documentMode
              ? [
                  "document official/candidate/history/audit, local blocks, stage/read/submit/approve, exact reconciliation and refresh-only retry in both consumer contexts",
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
  const evidenceIndex = process.argv.indexOf("--evidence");
  if (evidenceIndex >= 0) {
    assert.ok(process.argv[evidenceIndex + 1], "--evidence requires a path");
    await writeFile(
      resolve(process.argv[evidenceIndex + 1]),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  console.log(
    JSON.stringify({
      slice: exampleName,
      sourceBase: sha,
      sha256: report.sha256,
      exitCode: report.exitCode,
    }),
  );
} finally {
  await browser?.close();
  if (server)
    await new Promise((yes, no) =>
      server.httpServer.close((e) => (e ? no(e) : yes())),
    );
}

async function directSmoke(page) {
  await page
    .getByRole("heading", { name: "合成示例 · 账簿", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page
    .getByRole("textbox", { name: "名称", exact: true })
    .fill("离仓安装新增");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("cell", { name: "离仓安装新增", exact: true }).waitFor();
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
  await page.getByRole("cell", { name: "离仓安装修改", exact: true }).waitFor();
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
    await page.locator("thead").evaluate((el) => getComputedStyle(el).display),
    "none",
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
  await page.getByLabel("报表示例").selectOption("fixed");
  await button("查询").click();
  await page.getByText("服务端全结果合计", { exact: false }).waitFor();
  await page.getByLabel("固定关键字").fill("未查询条件");
  const fixedDownload = page.waitForEvent("download");
  await button("导出").click();
  assert.equal(
    (await fixedDownload).suggestedFilename(),
    "synthetic-1-complete.csv",
  );
  await button("下一页").click();
  await page.getByText("第 2 页", { exact: false }).waitFor();
  await page.setViewportSize({ width: 390, height: 600 });
  const scroll = page.locator(".zerp-report-scroll");
  // Check actual overflow and layout without screenshot/visual comparisons.
  const position = await scroll.evaluate((element) => {
    element.scrollLeft = 180;
    element.scrollTop = 40;
    return { left: element.scrollLeft, top: element.scrollTop };
  });
  assert.ok(position.left > 0);
  assert.ok(position.top > 0);
  assert.equal(
    await page
      .getByRole("columnheader", { name: "精确金额", exact: true })
      .evaluate((element) => getComputedStyle(element).display),
    "table-cell",
  );
  await button("离开并保存报表").click();
  await button("返回报表").click();
  await page.getByText("第 2 页", { exact: false }).waitFor();
  await page.waitForFunction(
    () => !document.body.textContent.includes("结果待重验"),
  );
  assert.deepEqual(
    await scroll.evaluate((element) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    })),
    position,
  );
  await button("上一页").click();
  const target = page.getByRole("link", {
    name: "查看 合成记录甲",
    exact: true,
  });
  assert.equal(await target.getAttribute("href"), "#synthetic-one");
  await target.press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "record · synthetic-1 · one · one" })
    .waitFor();
  await button("返回报表").click();
  await page.waitForFunction(
    () => !document.body.textContent.includes("结果待重验"),
  );
  await button("明细 合成记录甲").click();
  await page
    .getByRole("status")
    .filter({ hasText: "detail · synthetic-1 · one · one" })
    .waitFor();
  await button("返回报表").click();
  await page.waitForFunction(
    () => !document.body.textContent.includes("结果待重验"),
  );
  await button("选择 合成记录甲").click();
  await page
    .getByRole("status")
    .filter({ hasText: "select · synthetic-1 · one · one" })
    .waitFor();
  await page.getByLabel("重验资格").selectOption("expired");
  await button("返回报表").click();
  await page
    .getByText("结果已失效或无权访问，请重新查询。", { exact: true })
    .waitFor();
  assert.ok(await button("导出").isDisabled());
  await page.getByLabel("重验资格").selectOption("valid");
  await page.getByLabel("固定读取情景").selectOption("pending");
  await button("查询").click();
  await button("停止等待").click();
  await page
    .getByRole("status")
    .filter({ hasText: "服务端执行未确认取消" })
    .waitFor();
  await button("取消服务端查询").click();
  await page
    .getByRole("status")
    .filter({ hasText: "服务端已取消。" })
    .waitFor();
}

async function documentSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const scenario = (value) => page.getByLabel("写入情景").selectOption(value);
  const name = () => page.getByRole("textbox", { name: "名称", exact: true });
  const expectValue = async (field, value) =>
    assert.equal(await field.inputValue(), value);
  await page
    .getByRole("heading", { name: "合成档案 · 定价", exact: true })
    .waitFor();
  await expectValue(page.getByLabel("定价金额"), "9007199254740993.0100");
  await button("历史 v1").click();
  await expectValue(name(), "合成历史快照");
  assert.equal(await button("编辑档案").count(), 0);
  await button("正式资料").click();
  await button("编辑档案").click();
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
  await button("提交档案").click();
  await page
    .getByRole("status")
    .filter({ hasText: "附件暂存结果未知" })
    .waitFor();
  await button("关闭编辑").click();
  await button("重试读取").click();
  assert.ok(await button("编辑档案").isDisabled());
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "尚未业务提交" }).waitFor();
  await scenario("business-unknown");
  await button("编辑档案").click();
  await button("提交档案").click();
  await page
    .getByRole("status")
    .filter({ hasText: "业务写入结果未知" })
    .waitFor();
  await button("关闭编辑").click();
  await button("重试读取").click();
  assert.ok(await button("编辑档案").isDisabled());
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
  await button("停用档案").click();
  await button("启用档案").waitFor();
  await button("启用档案").click();
  await button("编辑档案").click();
  await scenario("refresh-failure");
  await button("提交档案").click();
  await page.getByRole("alert").filter({ hasText: "合成刷新失败" }).waitFor();
  assert.ok(await button("编辑档案").isDisabled());
  await button("重试读取").click();
  await page.getByLabel("档案示例").selectOption("formula");
  await page
    .getByRole("heading", { name: "合成档案 · 配方", exact: true })
    .waitFor();
  await expectValue(page.getByLabel("配方用量"), "0.0100");
  await button("编辑档案").click();
  await page.getByLabel("配方原料").selectOption("b");
  await page.getByLabel("配方用量").fill("1.2300");
  await scenario("conflict");
  await button("提交档案").click();
  await page.getByRole("alert").filter({ hasText: "合成修订冲突" }).waitFor();
  await scenario("no-evidence");
  await button("提交档案").click();
  await button("关闭编辑").click();
  await button("核实本次请求").click();
  await page.getByRole("status").filter({ hasText: "证据不足" }).waitFor();
  assert.ok(await button("编辑档案").isDisabled());
}

async function voucherSmoke(page) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const standalone = page.getByRole("region", {
    name: "独立单据编辑展示示例",
    exact: true,
  });
  const scenario = (value) => page.getByLabel("写入情景").selectOption(value);
  const value = () => page.getByRole("textbox", { name: "名称", exact: true });
  const expectValue = async (field, expected) =>
    assert.equal(await field.inputValue(), expected);
  await page
    .getByRole("heading", { name: "合成单据 · ordinary", exact: true })
    .waitFor();
  const ordinary = page.getByRole("region", {
    name: "合成单据 · ordinary",
    exact: true,
  });
  await standalone.getByRole("button", { name: "编辑配方 · 明细行 1" }).click();
  await standalone.getByRole("button", { name: "新增配方" }).click();
  await standalone.getByLabel("原料").fill("合成原料甲");
  await standalone.getByLabel("用量").fill("0.0100");
  await standalone.getByRole("button", { name: "确定子项" }).click();
  await standalone.getByRole("button", { name: "确定配方" }).click();
  assert.ok(
    (
      await standalone.getByRole("table", { name: "单据明细" }).textContent()
    )?.includes("1 项"),
  );
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
  assert.equal(
    await ordinary.getByRole("button", { name: "新增明细行" }).count(),
    0,
  );
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
  // Script writes keep a separate configuration identity and gate voucher submission.
  const script = page.getByRole("region", {
    name: "合成独立脚本",
    exact: true,
  });
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
  const opening = page.getByRole("region", {
    name: "合成单据 · opening",
    exact: true,
  });
  const openingButton = (name) =>
    opening.getByRole("button", { name, exact: true });
  await openingButton("新增明细行").click();
  await page.getByLabel("行名称").fill("取消行");
  await openingButton("取消明细行").click();
  assert.equal(await page.getByText("取消行", { exact: true }).count(), 0);
  await openingButton("新增明细行").click();
  await page.getByLabel("行名称").fill("保留行");
  await openingButton("确定明细行").click();
  await openingButton("编辑配方 · 明细行 1").click();
  await openingButton("新增配方").click();
  await opening.getByLabel("子项金额").fill("2.5000");
  await openingButton("确定子项").click();
  await openingButton("取消配方").click();
  assert.ok(
    (
      await opening.getByRole("table", { name: "单据明细" }).textContent()
    )?.includes("0 项"),
  );
  await openingButton("编辑配方 · 明细行 1").click();
  await openingButton("新增配方").click();
  await opening.getByLabel("子项金额").fill("2.5000");
  await openingButton("确定子项").click();
  await openingButton("确定配方").click();
  await button("提交单据").click();
  await button("查看 SYN-2").click();
  await page.getByText(/保留行/).waitFor();
  await openingButton("查看配方 · 明细行 1").click();
  assert.equal(await openingButton("确定配方").count(), 0);
  await openingButton("关闭配方").click();
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
  await voucherOperationSmoke(page);
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

async function shellSmoke(page) {
  await page.getByRole("heading", { name: "流程", exact: true }).waitFor();
  for (const preset of ["md1", "md2", "md3"]) {
    await page.getByLabel("主题预设").selectOption(preset);
    await page
      .getByRole("button", { name: "切换明暗模式", exact: true })
      .click();
    assert.ok(
      await page.locator(`.zerp-shell.v-theme--zerp-${preset}-dark`).count(),
    );
    await page
      .getByRole("button", { name: "切换明暗模式", exact: true })
      .click();
  }
  await page.reload();
  await page.locator(".zerp-shell.v-theme--zerp-md3-light").waitFor();
  await page.getByRole("button", { name: "模拟品牌失败", exact: true }).click();
  await page.getByRole("button", { name: "重试品牌", exact: true }).click();
  await page.getByRole("button", { name: "模拟导航失败", exact: true }).click();
  await page.getByRole("button", { name: "重试导航", exact: true }).click();
  for (const name of ["直接维护", "配置", "报表", "资料档案", "单据", "流程"]) {
    const link = page.getByRole("link", { name, exact: true });
    assert.ok(await link.getAttribute("href"));
    await link.click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await link.getAttribute("aria-current"), "page");
  }
  const originalURL = page.url();
  await page
    .getByRole("link", { name: "报表", exact: true })
    .dispatchEvent("click", { metaKey: true, button: 0 });
  assert.equal(page.url(), originalURL);
  const newTab = page.context().waitForEvent("page");
  await page
    .getByRole("link", { name: "报表", exact: true })
    .click({ button: "middle" });
  const popup = await newTab;
  await popup.waitForURL("**/report");
  await popup.waitForLoadState();
  assert.ok(popup.url().endsWith("/report"));
  await popup.close();
  await page
    .getByRole("button", { name: "账户：演示账户", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "修改密码", exact: true }).click();
  await page.getByLabel("新密码", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "取消账户修改", exact: true }).click();
  assert.equal(await page.getByLabel("新密码", { exact: true }).count(), 0);
  await page
    .getByRole("button", { name: "账户：演示账户", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await page.reload();
  await page.getByRole("heading", { name: "星河演示", exact: true }).waitFor();
  assert.equal(await page.locator(".zerp-shell").count(), 0);
  await page.getByRole("button", { name: "注册账号", exact: true }).click();
  await page.getByLabel("账号", { exact: true }).fill("synthetic-user");
  await page.getByLabel("密码", { exact: true }).fill("synthetic-password");
  await page.getByLabel("确认密码", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "注册账号", exact: true }).click();
  await page.getByRole("button", { name: "忘记密码", exact: true }).click();
  await page.getByLabel("账号", { exact: true }).fill("synthetic-user");
  await page.getByRole("button", { name: "找回密码", exact: true }).click();
  await page.getByLabel("新密码", { exact: true }).fill("reset-password");
  await page.getByLabel("确认密码", { exact: true }).fill("reset-password");
  await page.getByRole("button", { name: "设置新密码", exact: true }).click();
  await page.getByLabel("账号", { exact: true }).fill("synthetic-user");
  await page.getByLabel("密码", { exact: true }).fill("reset-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "模拟品牌失败", exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "重试品牌", exact: true })
      .isVisible(),
  );
  await page.getByRole("button", { name: "重试品牌", exact: true }).click();
  await page.getByRole("button", { name: "切换导航", exact: true }).click();
  await page.getByRole("link", { name: "报表", exact: true }).click();
  await page.getByRole("heading", { name: "报表", exact: true }).waitFor();
}
