const version = +(process?.versions?.node ?? "").split(".")[0] || 0;
const Errors = require("../util/errors");

module.exports = function (/*Buffer*/ inbuf, /*number*/ expectedLength) {
    var zlib = require("zlib");
    // Cap decompression output at the entry's declared uncompressed size to bound
    // decompression bombs (CVE-2026-39244). A declared size of 0 must not disable
    // the cap: a genuinely empty entry inflates to 0 bytes, so a 1-byte floor
    // still lets it through while stopping a bomb that lies about its size
    // (GHSA-rcw4-f5rp-g42v). zlib requires maxOutputLength >= 1.
    const maxOutputLength = expectedLength > 0 ? expectedLength : 1;
    const option = version >= 15 ? { maxOutputLength } : {};

    return {
        inflate: function () {
            return zlib.inflateRawSync(inbuf, option);
        },

        inflateAsync: function (/*Function*/ callback) {
            var tmp = zlib.createInflateRaw(option),
                parts = [],
                total = 0,
                done = false;
            const fail = function (err) {
                if (done) return;
                done = true;
                tmp.destroy();
                callback && callback(Buffer.alloc(0), err);
            };
            // Route stream errors (e.g. Z_DATA_ERROR on malformed input) through the
            // callback. Without an "error" listener zlib re-throws the event as an
            // uncaught exception on a later tick, crashing the host process instead
            // of failing the call (GHSA-8238-w5pm-2374).
            tmp.on("error", function (err) {
                fail(err);
            });
            tmp.on("data", function (data) {
                if (done) return;
                total += data.length;
                // The streaming API ignores maxOutputLength, so enforce the cap by
                // hand; otherwise the async path decompresses without limit while the
                // sync path is capped (GHSA-v429-h5qx-84wm, GHSA-c6fg-446q-cg94).
                if (total > maxOutputLength) {
                    return fail(Errors.MAX_OUTPUT_EXCEEDED());
                }
                parts.push(data);
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
