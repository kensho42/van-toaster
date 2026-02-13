import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "demo-dist",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      input: {
        main: "index.html",
        alt: "alt-demo.html",
      },
    },
  },
});
