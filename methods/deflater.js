function JSDeflater(/*inbuff*/inbuf) {
    return {
        deflate : function(/*Buffer*/outputBuffer) {
            inbuf.copy(outputBuffer, 0);
        }
    }
}

module.exports = function(/*Buffer*/inbuf) {

    var zlib = require("zlib");

    return {
        deflate : function(/*Buffer*/outputBuffer) {
            // pff...does nothing (YET), just moves stuff around
            new JSDeflater(inbuf).deflate(outputBuffer);
            return outputBuffer;
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