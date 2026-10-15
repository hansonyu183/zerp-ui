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
  join(root, configuration ? "examples/configuration" : "examples/direct"),
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
    configuration
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
  if (configuration) {
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
      ...(configuration
        ? [
            "configuration read/edit/save, conflict, exact reconciliation, refresh-only retry, three examples",
          ]
        : ["browser create/edit and 20 examples", "mobile card surface"]),
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
