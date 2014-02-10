exports.compressor = require("./deflate").compressor;

exports.decompressor = function(b) {
    var n = new Buffer(b.length);
    b.copy(n, 0, 0, b.length);
    return n
};

exports.unitTests = function() {
    return {
        "forwardCopy" : require("./copy_test"),
        "deflate" : require("./deflate_test")
    }
};
