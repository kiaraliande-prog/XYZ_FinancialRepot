// Build step for the XYZ Financial Report static site.
//
//   node build.mjs
//
// Reads src/app.jsx (the React source, kept verbatim from the original
// v3.8 module plus a small runtime-globals shim and a mount call) and
// transpiles the JSX to browser-ready JavaScript at ./app.js, which
// index.html loads directly. No in-browser Babel is required at runtime.
//
// Requires @babel/core and @babel/preset-react on the build machine:
//   npm install --no-save @babel/core @babel/preset-react
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src", "app.jsx");
const out = join(here, "app.js");

const code = readFileSync(src, "utf8");
const result = babel.transformSync(code, {
  presets: [["@babel/preset-react", { runtime: "classic" }]],
  comments: true,
  compact: false,
});
writeFileSync(out, result.code);
console.log(`Transpiled ${src} -> ${out} (${result.code.length} bytes)`);
