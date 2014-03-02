exports.compressor = require("./deflate").compressor;
exports.decompressor = require("./inflate").decompressor;

exports.unitTests = function() {
    return {
        "forwardCopy" : require("./copy_test"),
        "flate" : require("./flate_test"),
        "deflate" : require("./deflate_test")
    }
};
