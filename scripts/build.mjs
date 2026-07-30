import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  cp(new URL("../index.html", import.meta.url), new URL("index.html", output)),
  cp(new URL("../src/", import.meta.url), new URL("src/", output), { recursive: true }),
  cp(new URL("../public/", import.meta.url), output, { recursive: true }),
]);
console.log("Built static app in dist/");
