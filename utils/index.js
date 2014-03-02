exports.Writer = require("./writer");
exports.CRC32 = require("./crc").CRC32;
exports.EmptyArray = function EmptyArray(size) {
    var arr = [];
    for (var i = 0; i < size; i++) {
        arr.push(0)
    }
    return arr;
};

exports.unitTests = function() {
  return {
      "writer": require("./writer_test"),
      "crc32" : require("./crc_test")
  }
};