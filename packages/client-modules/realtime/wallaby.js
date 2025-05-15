export default function () {
  return {
    autoDetect: true,
    name: "@graphand/module-realtime",
    testFramework: {
      configFile: "./vitest.config.ts",
    },
    runMode: "onsave",
  };
}
