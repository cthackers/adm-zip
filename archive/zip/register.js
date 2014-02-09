var store = require("../../methods/store"),
    flate = require("../../methods/flate"),
    compressors = {
        0: store.compressor, // store
        8: flate.compressor  // deflate
    },
    decompressors = {
        0: store.decompressor, // store
        8: flate.decompressor // deflate
    };

module.exports.compressor = function(method) {
    return compressors[method]
};

module.exports.decompressor = function(method) {
    return decompressors[method]
};

module.exports.RegisterDecompressor = function (method, d) {
    if (decompressors[method]) {
        throw Error("decompressor already registered")
    }
    decompressors[method] = d
};

module.exports.RegisterCompressor = function (method, c) {
    if (compressors[method]) {
        throw Error("compressor already registered")
    }
    compressors[method] = c
};

