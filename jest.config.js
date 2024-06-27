module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  clearMocks: true,
  globalSetup: "./src/__jest__/globalSetup.ts",
  globalTeardown: "./src/__jest__/globalTeardown.ts",
  setupFilesAfterEnv: ["./src/__jest__/setup.ts"],
  coveragePathIgnorePatterns: ["node_modules", "<rootDir>/src/index.ts"],
  modulePathIgnorePatterns: ["dist", "node_modules"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        isolatedModules: true,
      },
    ],
  },
};
