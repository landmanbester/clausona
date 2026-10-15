import { build } from "esbuild";
import path from "node:path";
import { writeFileSync, mkdirSync, chmodSync } from "node:fs";

// Stub out react-devtools-core — ink imports it but it's unnecessary for CLI
const stubDir = "node_modules/.clausona-stubs";
mkdirSync(stubDir, { recursive: true });
writeFileSync(
  path.join(stubDir, "react-devtools-core.js"),
  "export default undefined;\n",
);

await build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire } from "node:module";',
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
  jsx: "automatic",
  alias: {
    "react-devtools-core": `./${stubDir}/react-devtools-core.js`,
  },
});

// The banner has a shebang; make the artefact directly runnable too.
chmodSync("dist/index.js", 0o755);
