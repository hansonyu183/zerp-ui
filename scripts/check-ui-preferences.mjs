import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const spec = await read("docs/ui-preferences.md");
const coverage = JSON.parse(await read("docs/ui-preferences.coverage.json"));
const clauses = [...spec.matchAll(/\*\*(UI-[A-Z]+-\d{2})\*\* ([^\n]+)/g)];
const ids = clauses.map((match) => match[1]);
assert.ok(ids.length > 0, "No numbered UI clauses");
assert.equal(new Set(ids).size, ids.length, "Duplicate normative clause ID");
assert.equal(
  new Set(coverage.clauses.map((row) => row.id)).size,
  coverage.clauses.length,
  "Duplicate coverage row",
);
assert.deepEqual(
  coverage.clauses.map((row) => row.id),
  ids,
  "Every normative clause needs exactly one ordered coverage row",
);
// Prevent silently adding an unnumbered requirement in the existing list format.
for (const line of spec.split("\n")) {
  if (/^(?:- |\d+\. )/.test(line))
    assert.match(line, /\*\*UI-[A-Z]+-\d{2}\*\*/, "Unnumbered requirement");
}
for (const [key, check] of Object.entries(coverage.checks)) {
  assert.match(check.file, /^(tests|scripts)\/[\w./-]+\.(ts|mjs)$/);
  assert.ok(
    check.anchor && (await read(check.file)).includes(check.anchor),
    `Missing evidence anchor: ${key}`,
  );
  assert.ok(check.surface && check.assertion, `Incomplete check: ${key}`);
  assert.ok(
    coverage.clauses.some((row) => row.checks.includes(key)),
    `Unreferenced evidence: ${key}`,
  );
}
for (const row of coverage.clauses) {
  const text = clauses.find((match) => match[1] === row.id)[2];
  assert.equal(
    row.requirementSha256,
    createHash("sha256").update(text).digest("hex"),
    `Requirement changed; review coverage before updating its digest: ${row.id}`,
  );
  assert.ok(row.remaining?.trim(), `Missing explicit limitations: ${row.id}`);
  assert.equal(
    new Set(row.checks).size,
    row.checks.length,
    `Duplicate evidence: ${row.id}`,
  );
  for (const key of row.checks)
    assert.ok(Object.hasOwn(coverage.checks, key), `Unknown check: ${key}`);
}
const partial = coverage.clauses.filter((row) => row.checks.length).length;
const lines = [
  "# UI 规范验证覆盖",
  "",
  "由 `docs/ui-preferences.coverage.json` 与原规范生成；修改清单后运行 `pnpm check:ui-preferences:inventory --write`。本文件不维护第二套规范或正式实施状态，工单见 [#159](" +
    coverage.issue +
    ")。",
  "",
  `共 ${ids.length} 条：${partial} 条有自动断言映射（均为部分覆盖），${ids.length - partial} 条尚无自动断言。映射存在不代表本次执行通过，也不代表整条符合；执行结果以本次命令退出码、Vitest 报告及 tgz evidence.json 为准。`,
  "",
  "验证策略：流程条款由任务审查；消费者专属条款由真实消费者验收；文案及常规 UI 语义审查由 Agent 按现有要求判断，不逐项询问用户；仅业务含义不明或需改变已确认要求时，在完成其余开发后按 UI-GOV-06 留一份交付清单。本库检查使用合成模型，不是实际 OIT/ZERP API/E2E。定向检查不是数学证明或全状态穷举。",
  "",
  "[UI 细节判断与交付清单](ui-preferences-quantification.md) 明确常规取舍由 Agent 处理，历史量化提议未成为强制标准。浏览器既有 1–2 CSS px 的测量容差用于子像素/同排判断，不授权内容位移或成为新的间距标准。既有 390/1440px 视口只是样本，不定义响应断点。",
  "",
  "## 条款映射",
  "",
  "| 编号 | 现有证据 | 未完成 / 验收边界 |",
  "| --- | --- | --- |",
];
for (const row of coverage.clauses)
  lines.push(
    `| ${row.id} | ${row.checks.length ? row.checks.map((key) => `[${key}](#${key})`).join("、") : "无自动断言"} | ${row.remaining.replaceAll("|", "\\|")} |`,
  );
lines.push("", "## 断言入口", "");
for (const [key, check] of Object.entries(coverage.checks)) {
  lines.push(
    `### ${key}`,
    "",
    `[${check.file}](../${check.file}) · ${check.surface}`,
    "",
    `定位：\`${check.anchor}\`。${check.assertion}。`,
    "",
  );
}
lines.push(
  "## 执行与维护",
  "",
  "- `pnpm check:ui-preferences:inventory` 只校验编号完整性、逐条原文摘要、覆盖引用及生成文档同步；不能证明行为。`--write` 更新此生成文件。",
  "- `pnpm test:ui-preferences` 运行直接公开入口的相关源码定向用例。它们不是独立安装证据。",
  "- `pnpm check:ui-preferences` 先校验清单并运行定向用例，再构建、打包、物理独立安装并运行 UI 定向浏览器场景。记录在 `.scratch/package-check-*/evidence.json` 的 `scenarios.installed.assertions`；不重跑全部业务场景。",
  "- `package-full` 为既有完整包场景入口，本片定向命令不执行它。正式发行门禁运行新静态模型完整场景，并执行本片新增主题/反馈浏览器断言；CI校验清单。历史通过记录不当作本轮重新执行结果。",
  "- 新增要求分配新编号；复合要求可用编号加语义后缀记录断言，禁止只验证一个子项就宣称整条通过。删除编号不得复用。新条款须有映射，即便暂时只能记录缺口。原文变更须先重审覆盖，再显式更新该行 requirementSha256（仅编号后的原文，UTF-8），防止旧断言悄悄沿用。",
  "",
);
const generated = lines.join("\n");
if (process.argv.includes("--write"))
  await writeFile(resolve(root, "docs/ui-preferences-coverage.md"), generated);
else
  assert.equal(
    await read("docs/ui-preferences-coverage.md"),
    generated,
    "Coverage document is stale; run inventory with --write",
  );
console.log(
  JSON.stringify({
    clauses: ids.length,
    partialMappings: partial,
    withoutAutomatedAssertions: ids.length - partial,
    inventory: "passed",
    behavioralResult: "not-executed-by-inventory",
  }),
);
