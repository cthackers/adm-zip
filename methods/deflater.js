var zlib = require('zlib');

module.exports = function(/*Buffer*/inbuf) {

    return {
        deflate : function(/*Buffer*/outputBuffer) {
            // pff...does nothing (YET), just moves stuff around
            inbuf.copy(outputBuffer, 0, index, index + ZipConstants.CENHDR);
        }
    }
};