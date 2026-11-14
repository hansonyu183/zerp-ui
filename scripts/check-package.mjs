import { execFileSync } from "node:child_process";
import {
  mkdir,
  realpath,
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
import { chromium } from "@playwright/test";
import { modelSmoke } from "./model-smoke.mjs";
import { modelBusinessSmoke } from "./model-business-smoke.mjs";
const modelBusinessMode = process.argv.includes("--model-business");
const exampleName = modelBusinessMode ? "model-business" : "model";
const smoke = modelBusinessMode ? modelBusinessSmoke : modelSmoke;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceBase = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const commands = [];
const run = (cmd, args, cwd = root) => {
  try {
    execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 << 20,
      env:
        cmd === "npm" && args[0] === "install"
          ? {
              ...process.env,
              HTTP_PROXY: "",
              HTTPS_PROXY: "",
              ALL_PROXY: "",
              http_proxy: "",
              https_proxy: "",
              all_proxy: "",
              NO_PROXY: "*",
            }
          : process.env,
    });
  } catch (error) {
    if (error.stdout) process.stderr.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
  commands.push({ command: [cmd, ...args], cwd, exitCode: 0 });
  console.log(`✓ ${cmd} ${args.join(" ")}`);
};
await mkdir(join(root, ".scratch"), { recursive: true });
const dir = await realpath(
  await mkdtemp(join(root, ".scratch/package-check-")),
);
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
await cp(join(root, "examples", exampleName), consumer, {
  recursive: true,
  filter: (path) => !path.includes("/dist"),
});
await cp(join(root, "examples/shared"), join(consumer, "shared"), {
  recursive: true,
});
for (const name of ["main.ts"]) {
  const path = join(consumer, name);
  await writeFile(
    path,
    (await readFile(path, "utf8")).replaceAll('"../shared/', '"./shared/'),
  );
}
for (const name of [
  "public-api",
  "reactive-model",
  "model-processing",
  "business-model",
]) {
  const fixture = await readFile(
    join(root, `tests/${name}.type-test.ts`),
    "utf8",
  );
  await writeFile(
    join(consumer, `${name}.type-test.ts`),
    fixture
      .replaceAll("../src/index", "@zerp/ui")
      .replaceAll("../src/model", "@zerp/ui/model"),
  );
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
run(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    "import assert from 'node:assert/strict'; import { object, text, application } from '@zerp/ui/model'; assert.equal(object('Sample', {name:text('Name', {value:'sample'})}).name.value, 'sample'); assert.equal(typeof application, 'function');",
  ],
  consumer,
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
for (const path of [
  "src/write-lock",
  "src/CrudView.vue",
  "src/DynamicForm.vue",
  "src/RecordDetails.vue",
  "src/VoucherEditor.vue",
  "dist/CrudView.vue",
  "dist/index.js",
]) {
  assert.throws(() => require.resolve(`@zerp/ui/${path}`), {
    code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
  });
}
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
  context.setDefaultTimeout(30_000);
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  const callbackTrace = [];
  const observe = (page) => {
    page.on("request", (request) =>
      requests.push({
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
      }),
    );
    page.on("console", (message) => {
      if (message.text().startsWith("synthetic-call:"))
        callbackTrace.push(message.text().slice("synthetic-call:".length));
    });
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
  const printEvidenceRoot = join(
    root,
    ".scratch/print-output",
    dir.split("/").at(-1),
  );
  const printEvidence = {
    sourceBase,
    tgzSha256: createHash("sha256")
      .update(await readFile(tgz))
      .digest("hex"),
  };
  const installedScenarioEvidence = await smoke(page, {
    ...printEvidence,
    mode: "installed-tgz",
    directory: join(printEvidenceRoot, "installed-tgz"),
  });
  const exampleRoot = join(root, "examples", exampleName);
  const exampleServer = await preview({
    root: exampleRoot,
    configFile: join(exampleRoot, "vite.config.ts"),
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  let builtScenarioEvidence;
  try {
    const localAddress = exampleServer.httpServer.address();
    assert.ok(localAddress && typeof localAddress !== "string");
    const exampleContext = await browser.newContext();
    const examplePage = await exampleContext.newPage();
    observe(examplePage);
    await examplePage.goto(`http://127.0.0.1:${localAddress.port}`);
    builtScenarioEvidence = await smoke(examplePage, {
      ...printEvidence,
      mode: "built-example",
      directory: join(printEvidenceRoot, "built-example"),
    });
    await exampleContext.close();
  } finally {
    await new Promise((yes, no) =>
      exampleServer.httpServer.close((e) => (e ? no(e) : yes())),
    );
  }
  assert.deepEqual(errors, []);
  assert.equal(
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    sourceBase,
    "source HEAD must remain unchanged throughout package validation",
  );
  const report = {
    sourceBase,
    commands,
    requests,
    callbackTrace,
    scenarios: {
      installed: installedScenarioEvidence,
      built: builtScenarioEvidence,
    },
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
      "model-only authentication/customer and business operation interactions",
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
      sourceBase,
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
