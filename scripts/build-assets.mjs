import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await copyFile(
  require.resolve("@mdi/font/LICENSE"),
  new URL("../dist/MDI-LICENSE.txt", import.meta.url),
);
// CSS has no type exports. Vite extracts it for the explicit style.css entry;
// do not leave a side-effect CSS import requiring ambient types in index.d.ts.
const declarations = new URL("../dist/index.d.ts", import.meta.url);
await writeFile(
  declarations,
  (await readFile(declarations, "utf8")).replace('import "./style.css";\n', ""),
);
