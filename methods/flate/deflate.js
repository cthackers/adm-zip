var token = require("./token"),
    utils = require("../../utils"),
    newHuffmanBitWriter = require("./huffman_bit_writer"),
    EmptyArray = utils.EmptyArray,
    copy = utils.copy;


const
    NoCompression = 0,
    BestSpeed = 1,
    FastCompression = 3,
    BestCompression = 9,
    DefaultCompression = -1,
    logWindowSize = 15,
    windowSize = 1 << logWindowSize,
    windowMask = windowSize - 1,
    minMatchLength = 3, // The smallest match that the compressor looks for
    maxMatchLength = 258, // The longest match for the compressor
    minOffsetSize = 1, // The shortest offset that makes any sense

    // The maximum number of tokens we put into a single flat block, just too
    // stop things from getting too large.
    maxFlateBlockTokens = 1 << 14,
    maxStoreBlockSize = 32768, //128 - 524288, 64 - 65535, 32 - 32768, 16 - 16384
    hashBits = 17,
    hashSize = 1 << hashBits,
    hashMask = (1 << hashBits) - 1,
    hashShift = (hashBits + minMatchLength - 1) / minMatchLength,
    maxHashOffset = 1 << 24,
    maxInt32 = 0xFFFFFFFF,
    skipNever = maxInt32;

// compression levels
module.exports.NoCompression = NoCompression;
module.exports.BestSpeed = BestSpeed;
module.exports.FastCompression = FastCompression;
module.exports.BestCompression = BestCompression;
module.exports.DefaultCompression = DefaultCompression;

function CompressionLevel(a, b, c, d, e) {
    this.good = a || 0;
    this.lazy = b || 0;
    this.nice = c || 0;
    this.chain = d || 0;
    this.fastSkipHashing = e || 0;
}

var levels = [
    new CompressionLevel(), // 0
    // For levels 1-3 we don't bother trying with lazy matches
    new CompressionLevel(3, 0, 8, 4, 4),
    new CompressionLevel(3, 0, 16, 8, 5),
    new CompressionLevel(3, 0, 32, 32, 6),
    // Levels 4-9 use increasingly more lazy matching
    // and increasingly stringent conditions for "good enough".
    new CompressionLevel(4, 4, 16, 16, skipNever),
    new CompressionLevel(8, 16, 32, 32, skipNever),
    new CompressionLevel(8, 16, 128, 128, skipNever),
    new CompressionLevel(8, 32, 128, 256, skipNever),
    new CompressionLevel(32, 128, 258, 1024, skipNever),
    new CompressionLevel(32, 258, 258, 4096, skipNever)
];

function Compressor() {
    var d = this;
    /*huffmanBitWriter*/
    this.w = null;
    // copy data to window
    this.fill = null;
    // process window
    this.step = null;
    // requesting flush
    this.flush = null;

    // Input hash chains
    // hashHead[hashValue] contains the largest inputIndex with the specified hash value
    // If hashHead[hashValue] is within the current window, then
    // hashPrev[hashHead[hashValue] & windowMask] contains the previous index
    // with the same hash value.
    this.chainHead = 0;
    this.hashHead = [];
    this.hashPrev = [];
    this.hashOffset = 0;

    // input window: unprocessed data is window[index:windowEnd]
    this.index = 0;
    this.window = new Buffer(0);
    this.windowEnd = 0;
    // window index where current tokens start
    this.blockStart = 0;
    // if true, still need to process window[index-1].
    this.byteAvailable = false;

    // queued output tokens
    this.tokens = [];

    // deflate state
    this.length = 0;
    this.offset = 0;
    this.hash = 0;
    this.maxInsertIndex = 0;

    this.err = "";

    this.fillDeflate = function (/*Buffer*/b) /*Number*/ {
        if (d.index >= 2 * windowSize - (minMatchLength + maxMatchLength)) {
            // shift the window by windowSize
            copy(d.window, 0, d.window.length, d.window, windowSize, 2 * windowSize);
            d.index -= windowSize;
            d.windowEnd -= windowSize;
            if (d.blockStart >= windowSize) {
                d.blockStart -= windowSize
            } else {
                d.blockStart = maxInt32;
            }
            d.hashOffset += windowSize;
            if (d.hashOffset > maxHashOffset) {
                var delta = d.hashOffset - 1;
                d.hashOffset -= delta;
                d.chainHead -= delta;
                for (var i = 0; i < d.hashPrev.length; i++) {
                    if (d.hashPrev[i] > delta) {
                        d.hashPrev[i] -= delta
                    } else {
                        d.hashPrev[i] = 0;
                    }
                }
                for (var j = 0; j < d.hashHead.length; j++) {
                    if (d.hashHead[j] > delta) {
                        d.hashHead[j] -= delta
                    } else {
                        d.hashHead[j] = 0;
                    }
                }
            }
        }
        var n = copy(d.window, d.windowEnd, d.window.length, b);
        d.windowEnd += n;
        return n
    };

    this.writeBlock = function (/*Array*/tokens, /*Number*/index, /*Boolean*/eof) /*boolean*/ {
        if (index > 0 || eof) {
            var window = new Buffer(0);
            if (d.blockStart <= index) {
                window = d.window.slice(d.blockStart, index);
            }
            d.blockStart = index;
            d.w.writeBlock(tokens, eof, window);
            return d.w.err == 0;
        }
        return true
    };

    this.findMatch = function (/*Number*/pos, /*Number*/prevHead, /*Number*/prevLength, /*Number*/lookAhead) /*Object*/ {
        var offset = 0,
            ok = false,
            minMatchLook = maxMatchLength;

        if (lookAhead < minMatchLook) {
            minMatchLook = lookAhead
        }

        var win = d.window.slice(0, pos + minMatchLook),
        // We quit when we get a match that's at least nice long
            nice = win.length - pos;

        if (d.nice < nice) {
            nice = d.nice
        }

        // If we've got a match that's good enough, only look in 1/4 the chain.
        var tries = d.chain;
        var length = prevLength;

        if (length >= d.good) {
            tries >>= 2
        }

        var w0 = win[pos],
            w1 = win[pos + 1],
            wEnd = win[pos + length],
            minIndex = pos - windowSize;

        for (var i = prevHead; tries > 0; tries--) {
            if (w0 == win[i] && w1 == win[i + 1] && wEnd == win[i + length]) {
                // The hash function ensures that if win[i] and win[i+1] match, win[i+2] matches
                var n = 3;
                while (pos + n < win.length && win[i + n] == win[pos + n]) {
                    n++;
                }

                if (n > length && (n > 3 || pos - i <= 4096)) {
                    length = n;
                    offset = pos - i;
                    ok = true;
                    if (n >= nice) {
                        // The match is good enough that we don't try to find a better one.
                        break
                    }
                    wEnd = win[pos + n]
                }
            }
            if (i == minIndex) {
                // hashPrev[i & windowMask] has already been overwritten, so stop now.
                break
            }
            i = d.hashPrev[i & windowMask] - d.hashOffset;
            if (i < minIndex || i < 0) {
                break;
            }
        }

        return {length: length, offset: offset, ok: ok}
    };

    this.writeStoredBlock = function (/*Buffer*/buf) /*string*/ {
        d.w.writeStoredHeader(buf.length, false);
        if (d.w.err != "") {
            return d.w.err
        }

        d.w.writeBytes(buf);
        return d.w.err;
    };

    this.initDeflate = function () {
        d.hashHead = EmptyArray(hashSize);
        d.hashPrev = EmptyArray(windowSize);
        d.window = new Buffer(windowSize * 2);
        d.hashOffset = 1;
        d.tokens = [];
        d.length = minMatchLength - 1;
        d.offset = 0;
        d.byteAvailable = false;
        d.index = 0;
        d.hash = 0;
        d.chainHead = -1;
    };

    this.deflate = function () {
        if (d.windowEnd - d.index < minMatchLength + maxMatchLength && !d.sync) {
            return
        }

        d.maxInsertIndex = d.windowEnd - (minMatchLength - 1);
        if (d.index < d.maxInsertIndex) {
            d.hash = (d.window[d.index] << hashShift) + d.window[d.index + 1];
        }
        while (true) {
            if (d.index > d.windowEnd) {
                throw Error("index > windowEnd")
            }

            var lookAhead = d.windowEnd - d.index;
            if (lookAhead < minMatchLength + maxMatchLength) {
                if (!d.sync) {
                    break;
                }
                if (d.index > d.windowEnd) {
                    throw Error("index > windowEnd")
                }
                if (lookAhead == 0) {
                    // Flush current output block if any.
                    if (d.byteAvailable) {
                        // There is still one pending token that needs to be flushed
                        d.tokens.push(token.literalToken(d.window[d.index - 1]));
                        d.byteAvailable = false;
                    }
                    if (d.tokens.length > 0) {
                        if (!d.writeBlock(d.tokens, d.index, false)) {
                            return
                        }
                        d.tokens = []
                    }
                    break;
                }
            }
            if (d.index < d.maxInsertIndex) {
                // Update the hash
                d.hash = ((d.hash << hashShift) + d.window[d.index + 2]) & hashMask;
                d.chainHead = d.hashHead[d.hash];
                d.hashPrev[d.index & windowMask] = d.chainHead;
                d.hashHead[d.hash] = d.index + d.hashOffset;
            }

            var prevLength = d.length,
                prevOffset = d.offset;

            d.length = minMatchLength - 1;
            d.offset = 0;

            var minIndex = d.index - windowSize;
            if (minIndex < 0) {
                minIndex = 0;
            }

            if (d.chainHead - d.hashOffset >= minIndex &&
                (d.fastSkipHashing != skipNever && lookAhead > minMatchLength - 1 ||
                    d.fastSkipHashing == skipNever && lookAhead > prevLength && prevLength < d.lazy)) {

                var match = d.findMatch(d.index, d.chainHead - d.hashOffset, minMatchLength - 1, lookAhead);
                if (match.ok) {
                    d.length = match.length;
                    d.offset = match.offset;
                }
            }
            if (d.fastSkipHashing != skipNever && d.length >= minMatchLength ||
                d.fastSkipHashing == skipNever && prevLength >= minMatchLength && d.length <= prevLength) {
                // There was a match at the previous step, and the current match is
                // not better. Output the previous match.
                if (d.fastSkipHashing != skipNever) {
                    d.tokens.push(token.matchToken(d.length - minMatchLength, d.offset - minOffsetSize))
                } else {
                    d.tokens.push(token.matchToken(prevLength - minMatchLength, prevOffset - minOffsetSize))
                }
                // Insert in the hash table all strings up to the end of the match.
                // index and index-1 are already inserted. If there is not enough
                // lookAhead, the last two strings are not inserted into the hash
                // table.
                if (d.length <= d.fastSkipHashing) {
                    var newIndex = 0;
                    if (d.fastSkipHashing != skipNever) {
                        newIndex = d.index + d.length
                    } else {
                        newIndex = d.index + prevLength - 1
                    }
                    for (d.index++; d.index < newIndex; d.index++) {
                        if (d.index < d.maxInsertIndex) {
                            d.hash = ((d.hash << hashShift) + d.window[d.index + 2]) & hashMask;
                            // Get previous value with the same hash.
                            // Our chain should point to the previous value.
                            d.hashPrev[d.index & windowMask] = d.hashHead[d.hash];
                            // Set the head of the hash chain to us.
                            d.hashHead[d.hash] = d.index + d.hashOffset
                        }
                    }
                    if (d.fastSkipHashing == skipNever) {
                        d.byteAvailable = false;
                        d.length = minMatchLength - 1
                    }
                } else {
                    // For matches this long, we don't bother inserting each individual
                    // item into the table
                    d.index += d.length;
                    if (d.index < d.maxInsertIndex) {
                        d.hash = (d.window[d.index] << hashShift) + d.window[d.index + 1];
                    }
                }
                if (d.tokens.length == maxFlateBlockTokens) {
                    // The block includes the current character
                    if (!d.writeBlock(d.tokens, d.index, false)) {
                        return
                    }
                    d.tokens = [];
                }
            } else {
                if (d.fastSkipHashing != skipNever || d.byteAvailable) {
                    var i = d.index - 1;
                    if (d.fastSkipHashing != skipNever) {
                        i = d.index;
                    }
                    d.tokens.push(token.literalToken(d.window[i]));
                    if (d.tokens.length == maxFlateBlockTokens) {
                        if (!d.writeBlock(d.tokens, i + 1, false)) {
                            return
                        }
                        d.tokens = []
                    }
                }
                d.index++;
                if (d.fastSkipHashing == skipNever) {
                    d.byteAvailable = true;
                }
            }
        }
    };

    this.fillStore = function (/*Buffer*/b) /*Number*/ {
        var n = copy(d.window, d.windowEnd, d.window.length, b);
        d.windowEnd += n;
        return n
    };

    this.store = function () {
        if (d.windowEnd > 0) {
            d.err = d.writeStoredBlock(d.window.slice(0, d.windowEnd))
        }
        d.windowEnd = 0;
    };

    this.write = function (/*Buffer*/b) /*Number*/ {
        var n = b.length;
        b = b.slice(d.fill(b));
        if (b.length > 0) {
            d.step();
            b = b.slice(d.fill(b));
        }
        return n
    };

    this.syncFlush = function () /*string*/ {
        d.sync = true;
        d.step();
        if (d.err == "") {
            d.w.writeStoredHeader(0, false);
            d.w.flush();
            d.err = d.w.err
        }
        d.sync = false;
        return d.err
    };

    this.init = function (/*Writer*/w, /*Number*/level) {
        d.w = new newHuffmanBitWriter(w);

        if (level == DefaultCompression) {
            level = 6;
        }

        if (level == NoCompression) {
            d.window = new Buffer(maxStoreBlockSize);
            d.fill = d.fillStore;
            d.step = d.store;
        } else if (1 <= level && level <= 9) {
            var compressionLevel = levels[level];

            d.good = compressionLevel.good;
            d.lazy = compressionLevel.lazy;
            d.nice = compressionLevel.nice;
            d.chain = compressionLevel.chain;
            d.fastSkipHashing = compressionLevel.fastSkipHashing;

            d.initDeflate();
            d.fill = d.fillDeflate;
            d.step = d.deflate;
        } else {
            throw Error("flate: invalid compression level " + level + ": value should be in range [-1, 9]")
        }
    };

    this.reset = function (/*Writer*/w) {
        d.w.reset(w);
        d.sync = false;

        if (d.chain = 0) {
            // level was no NoCompression
            for (var i = 0, len = d.window.length; i < len; i++) {
                d.window[i] = 0;
            }
            d.windowEnd = 0;
            return
        }

        d.chainHead = -1;
        d.hashHead = [];
        d.hashPrev = [];
        d.hashOffset = 1;
        d.index = 0;
        d.windowEnd = 0;
        d.window = new Buffer(0);
        d.blockStart = 0;
        d.byteAvailable = false;
        d.tokens = [];
        d.length = minMatchLength - 1;
        d.offset = 0;
        d.hash = 0;
        d.maxInsertIndex = 0;
    };

    this.close = function () {
        d.sync = true;
        d.step();
        if (!d.w.writeStoredHeader(0, true)) {
            return
        }
        d.w.flush()
    };
}

Compressor.prototype = new CompressionLevel();

module.exports.compressor = function (/*Writer*/w, /*Number*/level, /*Buffer*/dict) /*Writer*/ {
    var dw;
    if (dict) {
        dw = new Writer();
        dw.Write(dict);
        dw.enabled = true;
        dw.Flush();
        dw.dict = dict;
    } else {
        dw = new Writer();
        dw.d.init(w, level);
    }

    return dw
};

// A Writer takes data written to it and writes the compressed
// form of that data to an underlying writer
function Writer() {
    var w = this;

    this.dict = new Buffer(0);
    this.enabled = false;

    this.d = new Compressor();

    this.Close = function () {
        w.d.close()
    };

    this.Flush = function () {
        return w.d.syncFlush()
    };

    // Write writes data to w, which will eventually write the
    // compressed form of data to its underlying writer.
    this.Write = function (/*Buffer*/data) /*Number*/ {
        if (this.dict.length)
            if (this.enabled) {
                return data.length
            } else {
                return data.length
        } else {
            return w.d.write(data)
        }
    };

    this.Reset = function(/*Writer*/dst) {
        var dw = w.d.w.w;
        if (dw.dict.length) {
            dw.w = dst;
            w.d.reset(dw);
            dw.enabled = false;
            w.Write(w.dict);
            w.Flush();
            dw.enabled = true;
        } else {
            w.d.reset(dst);
        }
    };

    this.close = w.Close;
    this.flush = w.Flush;
    this.write = w.Write;
    this.reset = w.Reset;
}