export default function () {
  return {
    autoDetect: true,
    name: "@graphand/client",
    testFramework: {
      configFile: "./vitest.config.ts",
    },
    runMode: "onsave",
  };
}
