/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-config/library.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      // Define files to exclude from TypeScript linting
      files: [".eslintrc.cjs"],
      parserOptions: {
        project: null, // Disable TypeScript linting for these files
      },
    },
  ],
};
