import { mkdir, readFile, writeFile } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const outputDirectory = new URL("../tmp/native/", import.meta.url);
const outputFile = new URL("Dayleaf.html", outputDirectory);

function removeImports(source) {
  return source.replace(/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gm, "");
}

function removeExports(source) {
  return source
    .replace(/^\s*export\s*\{[^}]+\};?\s*$/gm, "")
    .replace(/\bexport\s+(?=(?:const|class|function)\b)/g, "");
}

const [html, cssSource, utilsSource, storeSource, appSource] = await Promise.all([
  readFile(new URL("index.html", projectRoot), "utf8"),
  readFile(new URL("src/styles.css", projectRoot), "utf8"),
  readFile(new URL("src/utils.js", projectRoot), "utf8"),
  readFile(new URL("src/store.js", projectRoot), "utf8"),
  readFile(new URL("src/app.js", projectRoot), "utf8"),
]);

const css = cssSource.replace(/^@import\s+url\([^)]+\);\s*/m, "");
const javascript = [
  'document.documentElement.classList.add("native-app");',
  removeExports(utilsSource),
  removeExports(removeImports(storeSource)),
  removeImports(appSource),
].join("\n\n");

new Function(javascript);

const bundledHtml = html
  .replace(/\s*<link rel="manifest"[^>]*>\s*/g, "\n")
  .replace(/\s*<link rel="icon"[^>]*>\s*/g, "\n")
  .replace(
    /\s*<link rel="stylesheet" href="\/src\/styles\.css"\s*\/?>\s*/g,
    () => `\n    <style>\n${css}\n    </style>\n`,
  )
  .replace(
    /\s*<script type="module" src="\/src\/app\.js"><\/script>\s*/g,
    () => `\n    <script>\n${javascript}\n    </script>\n`,
  );

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, bundledHtml);
console.log(`Bundled native interface at ${outputFile.pathname}`);
