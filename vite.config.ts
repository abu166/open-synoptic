import { defineConfig } from "vite";
export default defineConfig({
  resolve: { alias: { "@aetheris/i18n": new URL("./src/i18n", import.meta.url).pathname } },
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
