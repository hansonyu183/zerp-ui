import { copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await copyFile(
  require.resolve("@mdi/font/LICENSE"),
  new URL("../dist/MDI-LICENSE.txt", import.meta.url),
);
