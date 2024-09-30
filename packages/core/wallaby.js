export default function () {
  return {
    autoDetect: true,
    name: "@graphand/core",
    testFramework: {
      configFile: "./vitest.config.ts",
    },
    runMode: "onsave",
  };
}
