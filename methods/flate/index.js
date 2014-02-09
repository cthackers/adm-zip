exports.compressor = require("./deflate").compressor;

exports.decompressor = function(b) {
    var n = new Buffer(b.length);
    b.copy(n, 0, 0, b.length);
    return n
};

exports.test = function() {
    return require("./copy_test").run() &&
           require("./deflate_test").run();
};