import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await copyFile(
  require.resolve("@mdi/font/LICENSE"),
  new URL("../dist/MDI-LICENSE.txt", import.meta.url),
);
// Style imports belong to runtime and CSS assets, not to index.d.ts.
const declarations = new URL("../dist/index.d.ts", import.meta.url);
await writeFile(
  declarations,
  (await readFile(declarations, "utf8")).replace(
    /^import "(?:vuetify\/styles|\.\/styles\/(?:style|shell-layout)\.css)";\n/gm,
    "",
  ),
);

// Reuse the maintained glyph rules, with the same single published woff2 asset.
const stylesheet = new URL("../dist/zerp-ui.css", import.meta.url);
const mdi = (
  await readFile(
    require.resolve("@mdi/font/css/materialdesignicons.css"),
    "utf8",
  )
).replace(
  /@font-face\s*\{[^}]*\}/,
  '@font-face {font-family:"Material Design Icons";src:url("./materialdesignicons-webfont.woff2") format("woff2");font-weight:normal;font-style:normal;font-display:swap;}',
);
await writeFile(stylesheet, mdi + "\n" + (await readFile(stylesheet, "utf8")));
