exports.Writer = require("./writer");
exports.CRC32 = require("./crc").CRC32;
exports.filesystem = require("./filesystem");

exports.EmptyArray = function EmptyArray(size) {
    var arr = [];
    for (var i = 0; i < size; i++) {
        arr.push(0)
    }
    return arr;
};

exports.copy = function(dest, deststart, destend, src, srcstart, srcend) {
    var total = 0;

    if (!srcstart) { srcstart = 0; }
    if (!srcend) { srcend = src.length; }

    if (Buffer.isBuffer(dest) && !Buffer.isBuffer(src)) {
        return (new Buffer(src)).copy(dest, deststart, srcstart, srcend)
    } else if (Buffer.isBuffer(dest) && Buffer.isBuffer(src)) {
        return src.copy(dest, deststart, srcstart, srcend);
    } else {
        for (var i = deststart; i < destend; i++) {
            if (srcstart + total >= srcend) {break}
            dest[i] = src[srcstart + total];
            total++;
        }
        return total;
    }
};

exports.defValue = function(val, def) {
    if (typeof val == "undefined") {
        return def;
    }
    return val;
};

exports.unitTests = function() {
  return {
      "writer": require("./writer_test"),
      "crc32" : require("./crc_test"),
      "filesystem" : require("./filesystem_test")
  }
};