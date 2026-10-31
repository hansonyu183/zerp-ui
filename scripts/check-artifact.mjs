import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

// Inspect the tarball itself, never the working dist used to create it.
export async function checkArtifact(tgz, expected) {
  const files = execFileSync("tar", ["-tzf", tgz], { encoding: "utf8" })
    .trim()
    .split("\n");
  for (const file of files) {
    assert.ok(
      /^package\/(?:package\.json|README\.md|CHANGELOG\.md|LICENSE|dist\/(?:[\w.-]+\.(?:js|d\.ts|css|woff2)|MDI-LICENSE\.txt))$/.test(
        file,
      ),
      `Unexpected package member: ${file}`,
    );
  }
  const dir = await mkdtemp(join(resolve(dirname(tgz)), "artifact-audit-"));
  try {
    execFileSync("tar", ["-xzf", tgz, "-C", dir]);
    const root = join(dir, "package");
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    assert.equal(pkg.name, expected.name);
    assert.equal(pkg.version, expected.version);
    assert.equal(pkg.type, "module");
    assert.equal(pkg.license, "MIT");
    assert.deepEqual(pkg.exports, expected.exports);
    assert.deepEqual(pkg.peerDependencies, expected.peerDependencies);
    assert.deepEqual(pkg.dependencies, expected.dependencies);
    for (const file of [
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "dist/index.js",
      "dist/index.d.ts",
      "dist/zerp-ui.css",
      "dist/MDI-LICENSE.txt",
      "dist/materialdesignicons-webfont.woff2",
    ])
      assert.ok(
        (await stat(join(root, file))).size > 0,
        `Missing/empty ${file}`,
      );
    const entry = ts.createSourceFile(
      "index.js",
      await readFile(join(root, "dist/index.js"), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const publicNames = entry.statements.flatMap((statement) =>
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.map((element) => element.name.text)
        : [],
    );
    assert.deepEqual(
      publicNames.sort(),
      [
        "AppPage",
        "AuthPage",
        "ReportUnavailable",
        "createShellThemes",
        "defaultThemeChoice",
        "defineAccountPage",
        "defineConfiguration",
        "defineConfigurationPage",
        "defineCrud",
        "defineCrudPage",
        "defineDetailsPage",
        "defineDocument",
        "defineDocumentPage",
        "defineReport",
        "defineReportPage",
        "defineVoucher",
        "defineVoucherOperation",
        "defineVoucherOperationPage",
        "defineVoucherPage",
        "defineWorkflow",
        "defineWorkflowPage",
        "domainBlocks",
        "validateFields",
        "voucherOperationLabels",
      ].sort(),
      "Only the two complete components and finite non-component APIs may be exported",
    );
    const dependencies = { ...pkg.dependencies, ...pkg.peerDependencies };
    const imports = new Set();
    for (const file of files.filter((file) => /\.(?:js|d\.ts)$/.test(file))) {
      const path = join(dir, file);
      const source = await readFile(path, "utf8");
      assert.ok(
        !/\/Users\/|workspace:|\/code\/zerp\//.test(source),
        `Workspace leak: ${file}`,
      );
      for (const { fileName: name } of ts.preProcessFile(source, true, true)
        .importedFiles) {
        if (name.startsWith(".")) {
          const target = resolve(dirname(path), name);
          assert.ok(
            target.startsWith(`${root}/dist/`),
            `Escaped dist: ${name}`,
          );
          const candidates = file.endsWith(".d.ts")
            ? [target, `${target}.d.ts`]
            : [target];
          assert.ok(
            (
              await Promise.all(
                candidates.map((candidate) =>
                  stat(candidate).then(
                    () => true,
                    () => false,
                  ),
                ),
              )
            ).some(Boolean),
            `Unresolved packaged import ${file}: ${name}`,
          );
        } else {
          const dependency = name.startsWith("@")
            ? name.split("/").slice(0, 2).join("/")
            : name.split("/")[0];
          assert.ok(
            dependencies[dependency],
            `Undeclared dependency ${file}: ${name}`,
          );
          imports.add(name);
        }
      }
    }
    return {
      files,
      imports: [...imports].sort(),
      sha256: createHash("sha256")
        .update(await readFile(tgz))
        .digest("hex"),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
