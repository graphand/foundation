"use strict";

module.exports = function () {
  return {
    autoDetect: true,
    name: "@graphand/cli",
    testFramework: {
      configFile: "./jest.config.json",
    },
    runMode: "onsave",
  };
};
