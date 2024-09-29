import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import path from "path";
import fs from "fs";
import { builtinModules } from "module";
import pkg from "./package.json";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    dts({
      insertTypesEntry: true,
      outDir: "dist",
    }),
    {
      name: "chmod-plugin",
      apply: "build",
      writeBundle() {
        if (fs.existsSync("/opt/homebrew/bin/graphand")) {
          fs.chmodSync("/opt/homebrew/bin/graphand", "755");
        }
      },
    },
  ],
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        bin: path.resolve(__dirname, "src/bin.ts"),
      },
      name: "@graphand/cli",
      formats: ["cjs", "es"],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: [
        // Exclude all Node.js built-in modules (e.g., 'fs', 'path')
        ...builtinModules,
        // Exclude dependencies specified in package.json
        ...Object.keys(pkg.dependencies || {}),
      ],
      output: {
        globals: {},
      },
    },
  },
});
