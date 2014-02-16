exports.Writer = require("./writer");

exports.unitTests = function() {
  return {
      "writer": require("./writer_test")
  }
};