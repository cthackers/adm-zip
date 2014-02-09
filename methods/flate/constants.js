define("NoCompression", 0);
define("BestSpeed", 1);
define("fastCompression", 3);
define("BestCompression", 9);
define("DefaultCompression", -1);
define("logWindowSize", 15);
define("windowSize", 32768);
define("windowMask", 32767);
define("logMaxOffsetSize", 15);  // Standard DEFLATE
define("minMatchLength", 3);   // The smallest match that the compressor looks for
define("maxMatchLength", 258); // The longest match for the compressor
define("minOffsetSize", 1);   // The shortest offset that makes any sense

// The maximum number of tokens we put into a single flat block, just too
// stop things from getting too large.
define("maxFlateBlockTokens", 1 << 14);
define("maxStoreBlockSize", 65535);
define("hashBits", 17);
define("hashSize", 131072);
define("hashMask", 131071);
define("hashShift", 131074 / 3);
define("maxHashOffset", 16777216);

const maxint = 4294967295;
define("maxint", maxint);
define("skipNever", maxint);

define("levels", [
    // [good, lazy, nice, chain, fastSkipHashing]
    [0, 0, 0, 0, 0], // 0
    // For levels 1-3 we don't bother trying with lazy matches
    [3, 0, 8, 4, 4],
    [3, 0, 16, 8, 5],
    [3, 0, 32, 32, 6],
    // Levels 4-9 use increasingly more lazy matching
    // and increasingly stringent conditions for "good enough".
    [4, 4, 16, 16, maxint],
    [8, 16, 32, 32, maxint],
    [8, 16, 128, 128, maxint],
    [8, 32, 128, 256, maxint],
    [32, 128, 258, 1024, maxint],
    [32, 258, 258, 4096, maxint]
]);

function define(name, value) {
    Object.defineProperty(module.exports, name, {
        value: value,
        enumerable: true
    });
}