import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "demo-dist",
    rollupOptions: {
      input: {
        main: "index.html",
        alt: "alt-demo.html",
      },
    },
  },
});
