import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import packageJson from "./package.json";

export default defineConfig({
  plugins: [tsconfigPaths()],
  define: {
    __INTERNAL_CLIENT_VERSION__: `"${packageJson.version}"`,
  },
  test: {
    include: ["**/*.spec.ts"],
    globals: true,
    environment: "node",
  },
});
