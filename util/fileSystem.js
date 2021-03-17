exports.require = function() {
  var fs = require("fs");
  if (globalThis.process && globalThis.process.versions && globalThis.process.versions['electron']) {
	  try {
	    originalFs = require("original-fs");
	    if (Object.keys(originalFs).length > 0) {
	      fs = originalFs;
      }
	  } catch (e) {}
  }
  return fs
};
