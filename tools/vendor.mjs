// Copies the gunsnprices parser from node_modules into extension/vendor/gunsnprices/ without changing any file,
// and writes extension/vendor/SOURCES.txt with the npm tarball URL, its integrity hash and a SHA-256 for every file,
// so a reviewer can check the copy against the official npm release.
//
// Usage: npm ci && npm run vendor
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const PKG = "gunsnprices";
const from = join("node_modules", PKG);
const to = join("extension", "vendor", PKG);
const FILES = ["package.json", "LICENSE", "LICENSE-DATA", "src"]; // runtime files only (no CLI, no types)

const meta = JSON.parse(readFileSync(join(from, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages[`node_modules/${PKG}`];
if (lock.version !== meta.version) throw new Error(`package-lock has ${lock.version}, node_modules has ${meta.version}`);

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const f of FILES) cpSync(join(from, f), join(to, f), { recursive: true });

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

const lines = [
  `${PKG} ${meta.version}, copied unchanged from the npm package by tools/vendor.mjs.`,
  `Tarball:   ${lock.resolved}`,
  `Integrity: ${lock.integrity}`,
  `Source:    https://github.com/gunsnprices/gunsnprices-js`,
  "",
  "Check: npm pack gunsnprices@" + meta.version + " && tar xzf gunsnprices-" + meta.version + ".tgz",
  "       && diff -r package/src extension/vendor/gunsnprices/src",
  "",
  "SHA-256 of each file:",
];
for (const p of walk(to)) {
  const sha = createHash("sha256").update(readFileSync(p)).digest("hex");
  lines.push(`${sha}  ${relative("extension", p)}`);
}
writeFileSync(join("extension", "vendor", "SOURCES.txt"), lines.join("\n") + "\n");
console.log(`vendored ${PKG} ${meta.version} into ${to}`);
