"use strict";

module.exports = function () {
  return {
    autoDetect: true,
    name: "@graphand/module-auth",
    testFramework: {
      configFile: "./jest.config.json",
    },
    runMode: "onsave",
  };
};
