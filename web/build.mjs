// Baut die Webseite nach dist/: bündelt src/main.ts mit esbuild und kopiert HTML, CSS und Daten.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const ZIEL = "dist";
rmSync(ZIEL, { recursive: true, force: true });
mkdirSync(ZIEL, { recursive: true });

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  sourcemap: true,
  format: "esm",
  target: "es2022",
  outfile: `${ZIEL}/app.js`,
  define: { __BUILD_ZEIT__: JSON.stringify(new Date().toISOString()) },
  logLevel: "info",
});

cpSync("index.html", `${ZIEL}/index.html`);
cpSync("styles.css", `${ZIEL}/styles.css`);
cpSync("node_modules/maplibre-gl/dist/maplibre-gl.css", `${ZIEL}/maplibre-gl.css`);
cpSync("public/daten", `${ZIEL}/daten`, { recursive: true });
