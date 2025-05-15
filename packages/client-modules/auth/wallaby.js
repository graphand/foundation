export default function () {
  return {
    autoDetect: true,
    name: "@graphand/module-auth",
    testFramework: {
      configFile: "./vitest.config.ts",
    },
    runMode: "onsave",
  };
}
