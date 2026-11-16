// Packs extension/ into dist/gunsnprices-thunderbird-<version>.xpi (a zip with manifest.json at the root).
// Nothing is compiled, bundled or minified: the .xpi holds the files of extension/ as they are in the repository.
//
// With --source it also writes dist/thunderbird-gunsnprices-<version>-source.zip from the git HEAD
// (git archive), for reviewers who ask for the source code.
//
// Usage: npm run build [-- --source]     needs the zip command (macOS, Linux) and git for --source
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const version = JSON.parse(readFileSync("extension/manifest.json", "utf8")).version;
const pkgVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
if (version !== pkgVersion) throw new Error(`manifest.json ${version} != package.json ${pkgVersion}`);

mkdirSync("dist", { recursive: true });
const xpi = resolve(`dist/gunsnprices-thunderbird-${version}.xpi`);
rmSync(xpi, { force: true });
// -X: no extra file attributes, -r: recursive, -9: best compression; skip hidden files such as .DS_Store
execFileSync("zip", ["-X", "-r", "-9", "-q", xpi, ".", "-x", ".*", "-x", "*/.*"], { cwd: "extension", stdio: "inherit" });
console.log(`${xpi} ${statSync(xpi).size} bytes`);

if (process.argv.includes("--source")) {
  const src = resolve(`dist/thunderbird-gunsnprices-${version}-source.zip`);
  rmSync(src, { force: true });
  execFileSync("git", ["archive", "--format=zip", `--prefix=thunderbird-gunsnprices-${version}/`, "-o", src, "HEAD"], {
    stdio: "inherit",
  });
  console.log(`${src} ${statSync(src).size} bytes`);
}
