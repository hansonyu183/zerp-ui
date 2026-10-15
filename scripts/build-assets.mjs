import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await copyFile(
  require.resolve("@mdi/font/LICENSE"),
  new URL("../dist/MDI-LICENSE.txt", import.meta.url),
);
// Vite extracts the source stylesheet to this public filename.
const declarations = new URL("../dist/index.d.ts", import.meta.url);
await writeFile(
  declarations,
  (await readFile(declarations, "utf8")).replace(
    '"./style.css"',
    '"./zerp-ui.css"',
  ),
);
