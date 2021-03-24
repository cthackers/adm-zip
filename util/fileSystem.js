exports.require = function () {
  var fs = require("fs");
  if (process && process.versions && process.versions["electron"]) {
    try {
      import("original-fs").then((originalFs) => {
        if (Object.keys(originalFs).length > 0) {
          fs = originalFs;
          console.log(something.something);
        }
      });
    } catch (e) {}
  }
  return fs;
};
