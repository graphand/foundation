import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import path from "path";
import packageJson from "./package.json";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    dts({
      insertTypesEntry: true,
      outDir: "dist",
    }),
  ],
  define: {
    __INTERNAL_CLIENT_VERSION__: `"${packageJson.version}"`,
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "@graphand/client",
      fileName: format => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["@graphand/core"],
      output: {
        globals: {},
      },
    },
  },
});
