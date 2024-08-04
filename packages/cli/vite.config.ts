import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import path from "path";
import fs from "fs";

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
      name: "@graphand/client",
      formats: ["cjs", "es"],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: ["commander", "chalk", "@inquirer/prompts", "ora", "conf", "esbuild", /^node:.*/],
      output: {
        globals: {},
      },
    },
  },
});
