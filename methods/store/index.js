exports.compressor = function(b) {
    var n = new Buffer(b.length);
    b.copy(n, 0, 0, b.length);
    return n
};
exports.decompressor = function(b) {
    var n = new Buffer(b.length);
    b.copy(n, 0, 0, b.length);
    return n
};
