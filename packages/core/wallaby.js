"use strict";

module.exports = function () {
  return {
    autoDetect: true,
    name: "@graphand/core",
    testFramework: {
      configFile: "./jest.config.json",
    },
    runMode: "onsave",
  };
};
