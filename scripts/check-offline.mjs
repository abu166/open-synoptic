import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync("dist/sw.js", "utf8");
const assetLine = source.match(/const ASSETS=(\[[^;]+\]);/);
assert.ok(assetLine, "worker asset manifest exists");
const assets = JSON.parse(assetLine[1]);
for (const asset of assets)
  assert.ok(
    existsSync(`dist/${asset === "./" ? "index.html" : asset.slice(2)}`),
    `offline asset exists: ${asset}`,
  );
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
for (const icon of manifest.icons) assert.ok(existsSync(`dist/${icon.src}`));
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
const handlers = {},
  deleted = [],
  scope = "https://example.test/open-synoptic/";
let installed = false;
const caches = {
  open: async () => ({
    addAll: async (urls) => {
      assert.deepEqual(Array.from(urls), assets);
      installed = true;
    },
  }),
  keys: async () => ["aetheris-shell-old", "unrelated-app"],
  delete: async (key) => deleted.push(key),
  match: async (request) =>
    String(request).endsWith("index.html") ? "OFFLINE_SHELL" : undefined,
};
const self = {
  registration: { scope },
  location: new URL(`${scope}sw.js`),
  clients: { claim: async () => {} },
  addEventListener: (name, handler) => (handlers[name] = handler),
};
vm.runInNewContext(source, {
  self,
  caches,
  URL,
  fetch: async () => {
    throw Error("offline");
  },
});
let pending;
handlers.install({ waitUntil: (p) => (pending = p) });
await pending;
assert.ok(installed);
handlers.activate({ waitUntil: (p) => (pending = p) });
await pending;
assert.deepEqual(deleted, ["aetheris-shell-old"]);
let response;
handlers.fetch({
  request: {
    url: `${scope}?view=intelligence`,
    method: "GET",
    mode: "navigate",
  },
  respondWith: (p) => (response = p),
});
assert.equal(await response, "OFFLINE_SHELL");
let intercepted = false;
handlers.fetch({
  request: { url: "https://api.open-meteo.com/v1/forecast", method: "GET" },
  respondWith: () => (intercepted = true),
});
assert.equal(intercepted, false, "weather APIs are not intercepted");
console.log(
  `Offline checks passed: ${assets.length} assets, icons, scoped navigation fallback and cache isolation.`,
);
