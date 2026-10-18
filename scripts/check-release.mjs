import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkArtifact } from "./check-artifact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain"),
  "",
  "Release checks require a clean commit (use a clean worktree)",
);
const sourceSHA = git("rev-parse", "HEAD");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
assert.equal(pkg.version, "0.2.1");
const dir = join(root, ".scratch", "release", sourceSHA);
await mkdir(dir, { recursive: true });
const commands = [];
const run = (command, args) => {
  try {
    execFileSync(command, args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 << 20,
    });
  } catch (error) {
    if (error.stdout) process.stderr.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
  commands.push({ command: [command, ...args], exitCode: 0 });
  console.log(`✓ ${command} ${args.join(" ")}`);
};
// A downloaded release can be checked without repacking it.
const artifactIndex = process.argv.indexOf("--tgz");
assert.ok(
  artifactIndex < 0 || process.argv[artifactIndex + 1],
  "--tgz requires a path",
);
for (const script of ["typecheck", "lint", "format:check"])
  run("pnpm", [script]);
if (artifactIndex < 0) run("pnpm", ["test"]);
const slices = [
  { issue: 8, name: "direct", build: "build:example", flag: [] },
  ...[
    "configuration",
    "report",
    "document",
    "voucher",
    "workflow",
    "shell",
  ].map((name, index) => ({
    issue: index + 9,
    name,
    build: `build:${name}`,
    flag: [`--${name}`],
  })),
];
for (const slice of slices) run("pnpm", [slice.build]);
if (artifactIndex < 0) run("pnpm", ["pack", "--pack-destination", dir]);
const tgz =
  artifactIndex < 0
    ? join(dir, `zerp-ui-${pkg.version}.tgz`)
    : resolve(process.argv[artifactIndex + 1]);
const artifact = await checkArtifact(tgz, pkg);
if (artifactIndex >= 0) {
  const verified = JSON.parse(
    await readFile(join(dir, "evidence.json"), "utf8"),
  );
  assert.equal(verified.sourceSHA, sourceSHA);
  assert.equal(
    artifact.sha256,
    verified.sha256,
    "Downloaded artifact differs from the verified release tarball",
  );
}
const evidence = [];
for (const slice of slices) {
  const evidencePath = join(dir, `${slice.name}.json`);
  run("node", [
    "scripts/check-package.mjs",
    ...slice.flag,
    "--tgz",
    tgz,
    "--evidence",
    evidencePath,
  ]);
  const report = JSON.parse(await readFile(evidencePath, "utf8"));
  assert.equal(report.sha256, artifact.sha256);
  assert.equal(report.sourceBase, sourceSHA);
  evidence.push({ issue: slice.issue, name: slice.name, ...report });
}
assert.equal(git("rev-parse", "HEAD"), sourceSHA);
assert.equal(git("status", "--porcelain"), "");
const report = {
  sourceSHA,
  version: pkg.version,
  tgz,
  ...artifact,
  commands,
  slices: evidence,
  exitCode: 0,
  boundary:
    "Synthetic adapters only; no real ZERP API/E2E or production writes",
};
await writeFile(
  join(dir, artifactIndex < 0 ? "evidence.json" : "distribution-evidence.json"),
  JSON.stringify(report, null, 2) + "\n",
);
if (artifactIndex < 0)
  await writeFile(
    join(dir, "SHA256SUMS"),
    `${artifact.sha256}  zerp-ui-${pkg.version}.tgz\n`,
  );
console.log(
  JSON.stringify({
    sourceSHA,
    version: pkg.version,
    sha256: artifact.sha256,
    slices: evidence.map(({ name, exitCode }) => ({ name, exitCode })),
    exitCode: report.exitCode,
  }),
);
