import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    sourcemap: true,
    target: "es2022",
    outDir: "dist",
    rollupOptions: {
      external: ["vanjs-core"],
    },
  },
});
