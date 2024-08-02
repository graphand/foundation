import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
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
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "@graphand/cli",
      formats: ["cjs"],
      fileName: () => `index.js`,
    },
    rollupOptions: {
      external: ["commander", "chalk", "inquirer", "ora"],
      output: {
        globals: {},
      },
    },
  },
});
