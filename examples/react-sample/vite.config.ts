import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import path from "path";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    dts({
      insertTypesEntry: true,
      outDir: "dist",
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "@graphand/module-boilerplate",
      fileName: format => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["@graphand/core", "@graphand/client"],
      output: {
        globals: {},
      },
    },
  },
});
