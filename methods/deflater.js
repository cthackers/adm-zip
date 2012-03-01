function JSDeflater(/*inbuff*/inbuf) {
    return {
        deflate : function(/*Buffer*/outputBuffer) {
            inbuf.copy(outputBuffer, 0, index, index + ZipConstants.CENHDR);
        }
    }
}

module.exports = function(/*Buffer*/inbuf) {

    var zlib = require("zlib");

    return {
        deflate : function(/*Buffer*/outputBuffer) {
            // pff...does nothing (YET), just moves stuff around
            inbuf.copy(outputBuffer, 0, index, index + ZipConstants.CENHDR);
        },

        deflateAsync : function(/*Function*/callback) {
            var tmp = zlib.createInflateRaw();
            tmp.on('data', function(data) {
                callback(data);
            });
            tmp.end(inbuf)
        }
    }
};