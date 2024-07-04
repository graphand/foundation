"use strict";

module.exports = function () {
  return {
    autoDetect: true,
    name: "@graphand/module-realtime",
    testFramework: {
      configFile: "./jest.config.json",
    },
    runMode: "onsave",
  };
};
