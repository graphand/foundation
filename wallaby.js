module.exports = function () {
  return {
    name: "@graphand/client",
    testFramework: {
      configFile: "./jest.config.js",
    },
    runMode: "onsave",
  };
};
