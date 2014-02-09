var consts = require("./constants"),
    token = require("./token");

module.exports.compressor = compressor;

function compressor(input, level) {
    var w,
        compressionLevel = consts.levels[0],
        chainHead = 0,
        hashHead = [],
        hashPrev = [],
        hashOffset = 0,

        index = 0,
        window = new Buffer(0),
        windowEnd = 0,
        blockStart = 0,
        byteAvailable = false,

        tokens = [],
        length = 0,
        offset = 0,
        hash = 0,
        maxInsertIndex = 0,
        fill, step;

    function init() {
        w = require("./huffman_bit_writer");
        switch (level) {
            case consts.NoCompression:
                window = new Buffer(consts.maxStoreBlockSize);
                fill = fillStore;
                step = store;
                break;
            case consts.DefaultCompression:
                level = 6;
            default:
                if (1 <= level && level <= 9) {
                    compressionLevel = consts.levels[level];
                    initDeflate();
                    fill = fillDeflate;
                    step = deflate;
                } else {
                    throw Error("flate: invalid compression level " + level + ": value should be in range [-1, 9]")
                }
        }
    }

    function writeBlock(tokens, index, eof) {
        if (index > 0 || eof) {
            var window = new Buffer();
            if (blockStart <= index) {
                window = window.slice(blockStart, index)
            }
            blockStart = index;
            w.writeBlock(tokens, eof, window)
        }
    }

    function fillDeflate(b) {
        var windowSize = consts.windowSize;

        if (index >= 2 * windowSize - (consts.minMatchLength + consts.maxMatchLength)) {
            window.copy(window, 0, windowSize, 2 * windowSize);
            index -= windowSize;
            windowEnd -= windowSize;
            if (blockStart >= windowSize) {
                blockStart -= windowSize
            } else {
                blockStart = consts.maxint
            }
            hashOffset += windowSize;
            if (hashOffset > consts.maxHashOffset) {
                var delta = hashOffset - 1;
                hashOffset -= delta;
                chainHead -= delta;
                for (var i = 0; i < hashPrev.length; i++) {
                    if (hashPrev[i] > delta) {
                        hashPrev[i] -= delta
                    } else {
                        hashPrev[i] = 0;
                    }
                }
                for (var j = 0; j < hashHead.length; j++) {
                    if (hashHead[j] > delta) {
                        hashHead[j] -= delta
                    } else {
                        hashHead[j] = 0;
                    }
                }
            }
        }
        var n = window.length - windowEnd;
        b.copy(window, windowEnd);
        return n
    }

    function initDeflate() {
        hashHead = new Array(consts.hashSize);
        hashPrev = new Array(consts.windowSize);
        window = new Array(consts.windowSize * 2);
        hashOffset = 1;
        tokens = new Array(consts.maxFlateBlockTokens + 1);
        length = consts.minMatchLength - 1;
        offset = 0;
        byteAvailable = 0;
        index = 0;
        hash = 0;
        chainHead = -1;
    }

    function deflate() {

    }

    function fillStore(b) {
        var n = window.length - windowEnd;
        window.copy(b, 0, windowEnd, n);
        windowEnd += n;
        return n
    }

    function store() {
        if (windowEnd > 0) {
            writeStoredBlock(window.slice(0, windowEnd))
        }
        windowEnd = 0;
    }

    function writeStoredBlock(buf) {
        w.writeStoredHeader(buf.length, false);
        w.writeBytes(buf)
    }

    function syncFlush() {
        step();
        w.writeStoredHeader(0, false);
        w.flush();
    }

    return input
}