// Checks on the add-on package: manifest, permissions, files, the vendored parser, no network code,
// and the background script against a mock of the Thunderbird API.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = new URL("..", import.meta.url).pathname;
const EXT = join(ROOT, "extension");
const manifest = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("manifest: MV3, gecko id, minimum version, same version as package.json", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.browser_specific_settings.gecko.id, "thunderbird@gunsnprices.com");
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
  assert.equal(manifest.version, pkg.version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.homepage_url, "https://gunsnprices.com/developers");
});

test("manifest: only the permissions the features need, no host permissions", () => {
  assert.deepEqual(manifest.permissions, ["messagesRead", "menus"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.content_security_policy, undefined);
});

test("manifest: every referenced file exists", () => {
  const files = [
    ...Object.values(manifest.icons),
    ...Object.values(manifest.message_display_action.default_icon),
    manifest.message_display_action.default_popup,
    ...manifest.background.scripts,
  ];
  for (const f of files) assert.ok(existsSync(join(EXT, f)), f);
});

test("no network code, no remote scripts, no eval in the add-on", () => {
  const forbidden =
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\beval\s*\(|new Function\s*\(|importScripts|\.innerHTML\s*=|insertAdjacentHTML|document\.write/;
  for (const file of walk(EXT).filter((f) => /\.(js|html)$/.test(f))) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, forbidden, file);
    assert.doesNotMatch(src, /<script[^>]+src=["']https?:/i, file);
    assert.doesNotMatch(src, /\bimport\s*\(?\s*["']https?:/, file);
  }
});

test("vendored parser is an unchanged copy of the npm package", () => {
  const sources = readFileSync(join(EXT, "vendor", "SOURCES.txt"), "utf8");
  const listed = [...sources.matchAll(/^([0-9a-f]{64}) {2}(\S+)$/gm)];
  assert.ok(listed.length >= 9);
  const vendored = walk(join(EXT, "vendor", "gunsnprices"));
  assert.equal(listed.length, vendored.length);
  for (const [, sha, rel] of listed) {
    const body = readFileSync(join(EXT, rel));
    assert.equal(createHash("sha256").update(body).digest("hex"), sha, rel);
    const fromNpm = join(ROOT, "node_modules", rel.replace(/^vendor\//, ""));
    if (existsSync(fromNpm)) assert.ok(body.equals(readFileSync(fromNpm)), `${rel} differs from node_modules`);
  }
  const version = JSON.parse(readFileSync(join(EXT, "vendor", "gunsnprices", "package.json"), "utf8")).version;
  assert.equal(version, pkg.devDependencies.gunsnprices);
});

test("background: creates the context menu item and opens the result window with the selection", async () => {
  const calls = { created: [], windows: [], removed: 0 };
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
  globalThis.messenger = {
    menus: {
      removeAll: async () => calls.removed++,
      create: (props) => calls.created.push(props),
      onClicked: on("clicked"),
    },
    runtime: {
      onInstalled: on("installed"),
      onStartup: on("startup"),
      getURL: (p) => `moz-extension://test/${p}`,
    },
    windows: { create: async (props) => calls.windows.push(props) },
  };
  await import("../extension/background.js");
  await listeners.installed();
  assert.equal(calls.removed, 1);
  assert.deepEqual(calls.created, [
    { id: "gunsnprices-parse-selection", title: "Parse gun/ammo title", contexts: ["selection"] },
  ]);

  await listeners.clicked({ menuItemId: "gunsnprices-parse-selection", selectionText: "Glock 19 Gen5 & 9mm #1" });
  assert.equal(calls.windows.length, 1);
  const url = new URL(calls.windows[0].url);
  assert.equal(url.pathname, "/popup/popup.html");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("selection"), "Glock 19 Gen5 & 9mm #1");
  assert.equal(calls.windows[0].type, "popup");

  await listeners.clicked({ menuItemId: "something-else", selectionText: "x" });
  assert.equal(calls.windows.length, 1);
  delete globalThis.messenger;
});
