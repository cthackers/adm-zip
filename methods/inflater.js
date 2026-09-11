const version = +(process?.versions?.node ?? "").split(".")[0] || 0;

module.exports = function (/*Buffer*/ inbuf, /*number*/ expectedLength) {
    var zlib = require("zlib");
    const option = version >= 15 && expectedLength > 0 ? { maxOutputLength: expectedLength } : {};

    return {
        inflate: function () {
            return zlib.inflateRawSync(inbuf, option);
        },

        inflateAsync: function (/*Function*/ callback) {
            var tmp = zlib.createInflateRaw(option),
                parts = [],
                total = 0,
                done = false;
            // Route stream errors (e.g. Z_DATA_ERROR on malformed input, or the
            // maxOutputLength cap being exceeded) through the callback. Without an
            // "error" listener zlib re-throws the event as an uncaught exception on
            // a later tick, crashing the host process instead of failing the call.
            tmp.on("error", function (err) {
                if (done) return;
                done = true;
                callback && callback(Buffer.alloc(0), err);
            });
            tmp.on("data", function (data) {
                parts.push(data);
                total += data.length;
            });
            tmp.on("end", function () {
                if (done) return;
                done = true;
                var buf = Buffer.alloc(total),
                    written = 0;
                buf.fill(0);
                for (var i = 0; i < parts.length; i++) {
                    var part = parts[i];
                    part.copy(buf, written);
                    written += part.length;
                }
                callback && callback(buf);
            });
            tmp.end(inbuf);
        }
    };
};
