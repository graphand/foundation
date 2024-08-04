"use strict";

module.exports = function () {
  return {
    autoDetect: true,
    name: "@graphand/.boilerplate",
    testFramework: {
      configFile: "./jest.config.json",
    },
    runMode: "onsave",
  };
};
