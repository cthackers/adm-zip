exports.require = function() {
  var fs = require("fs");
  if (process && process.versions && process.versions['electron']) {
	  try {
	    originalFs = require("original-fs");
	    if (Object.keys(originalFs).length > 0) {
	      fs = originalFs;
      }
	  } catch (e) {}
  }
  return fs
};
