import { defineConfig } from "vite";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    {
      name: "aetheris-offline",
      apply: "build",
      generateBundle(_options, bundle) {
        const assets = [
          "./",
          "./index.html",
          "./favicon.svg",
          "./icon.svg",
          "./icon-192.png",
          "./icon-512.png",
          "./manifest.webmanifest",
          ...Object.keys(bundle)
            .filter((k) => /\.(js|css|mjs)$/.test(k))
            .map((k) => "./" + k),
        ];
        const version = createHash("sha256")
          .update(JSON.stringify(assets))
          .digest("hex")
          .slice(0, 12);
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `
const CACHE='aetheris-shell-${version}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('aetheris-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(event.request.mode==='navigate'){
   event.respondWith(fetch(event.request).then(response=>response.ok?response:caches.match(new URL('index.html',self.registration.scope))).catch(()=>caches.match(new URL('index.html',self.registration.scope))));return;
 }
 event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});`,
        });
      },
    },
  ],
  base: process.env.GITHUB_PAGES === "true" ? "/open-synoptic/" : "/",
  resolve: {
    alias: {
      "@aetheris/i18n": new URL("./src/i18n", import.meta.url).pathname,
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes("use client")
        )
          return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes("maplibre-gl")) return "maplibre";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
