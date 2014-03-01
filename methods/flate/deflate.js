var consts = require("./constants"),
    token = require("./token"),
    utils = require("../../utils"),
    hufWriter = require("./huffman_bit_writer");

module.exports.compressor = function(w, level) {
    var dw = Writer();
    dw.d.init(w, level);
    return dw
};

function Writer() {
    var d = compressor();

    return {
        get d () {
          return d
        },
        Write :  function (data) {
            return d.write(data)
        },
        Flush :  function () {
            d.syncFlush()
        },
        Close : function () {
            d.close();
        }
    }
}

function compressor() {
    var compressionLevel = consts.levels[0],
        w,
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
        sync = false,
        fill, step;

    function init(_w, level) {
        w = new hufWriter(_w);

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

    function writeBlock(/*Array*/tokens, /*Number*/index, /*Boolean*/eof) {
        if (index > 0 || eof) {
            var _window = new Buffer(0);
            if (blockStart <= index) {
                _window = window.slice(blockStart, index);
            }
            blockStart = index;
            return w.writeBlock(tokens, eof, _window);
        }
        return true
    }

    function fillDeflate(/*Buffer*/b) {
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
        var n =  b.copy(window, windowEnd);
        windowEnd += n;
        return n
    }

    function initDeflate() {
        hashHead = EmptyArray(consts.hashSize);
        hashPrev = EmptyArray(consts.windowSize);
        window = new Buffer(consts.windowSize * 2);
        hashOffset = 1;
        tokens = [];
        length = consts.minMatchLength - 1;
        offset = 0;
        byteAvailable = false;
        index = 0;
        hash = 0;
        chainHead = -1;
    }

    function findMatch(pos, prevHead, prevLength, lookAhead) {
        var result = {
                length : 0,
                offset : 0,
                ok : false
            },
            minMatchLook = consts.maxMatchLength;

        if (lookAhead < minMatchLook) {
            minMatchLook = lookAhead
        }

        var win = window.slice(0, pos + minMatchLook),
            nice = win.length - pos;
        // We quit when we get a match that's at least nice long
        if (compressionLevel[2] < nice) {
            nice = compressionLevel[2]
        }
        // If we've got a match that's good enough, only look in 1/4 the chain.
        var tries = compressionLevel[4];
        result.length = prevLength;
        if (result.length >= compressionLevel[0]) {
            tries >>= 2
        }

        var w0 = win[pos],
            w1 = win[pos + 1],
            wEnd = win[pos + result.length],
            minIndex = pos - consts.windowSize;

        for (var i = prevHead; tries > 0; tries--) {
            if (w0 == win[i] && w1 == win[i+1] && wEnd == win[i + result.length]) {
                // The hash function ensures that if win[i] and win[i+1] match, win[i+2] matches
                var n = 3;
                while (pos + n < win.length && win[i + n] == win[pos + n]) {
                    n++;
                }
                if (n > result.length && (n > 3 || pos - i <= 4096)) {
                    result.length = n;
                    result.offset = pos - i;
                    result.ok = true;
                    if (n >= compressionLevel[2]) {
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
            i = hashPrev[i & consts.windowMask] - hashOffset;
            if (i < minIndex || i < 0) {
                break;
            }
        }

        return result
    }

    function deflate() {
        var minMatchLength = consts.minMatchLength,
            maxMatchLength = consts.maxMatchLength,
            hashShift = consts.hashShift,
            hashMask = consts.hashMask,
            windowMask = consts.windowMask,
            windowSize = consts.windowSize,
            skipNever = consts.skipNever,
            minOffsetSize = consts.minOffsetSize,

            fastSkipHashing = compressionLevel[4];


        if (windowEnd - index < minMatchLength + maxMatchLength && !sync) {
            return
        }

        maxInsertIndex = windowEnd - (minMatchLength - 1);
        if (index < maxInsertIndex) {
            hash = window[index] << hashShift + window[index + 1];
        }

        for (;;) {
            if (index > windowEnd) {
                throw Error("index > windowEnd")
            }

            var lookAhead = windowEnd - index;
            if (lookAhead < minMatchLength + maxMatchLength) {
                if (!sync) {
                    break;
                }
                if (index > windowEnd) {
                    throw Error("index > windowEnd")
                }
                if (lookAhead == 0) {
                    // Flush current output block if any.
                    if (byteAvailable) {
                        // There is still one pending token that needs to be flushed
                        tokens.push(token.literalToken(window[index - 1]));
                        byteAvailable = false;
                    }
                    if (tokens.length > 0) {
                        if (!writeBlock(tokens, index, false)) {
                            return
                        }
                        tokens = []
                    }
                    break;
                }
            }
            if (index < maxInsertIndex) {
                // Update the hash
                hash = (hash << hashShift + window[index + 2]) & hashMask;
                chainHead = hashHead[hash];
                hashPrev[index & windowMask] = chainHead;
                hashHead[hash] = index + hashOffset;
            }

            var prevLength = length,
                prevOffset = offset;

            length = minMatchLength - 1;
            offset = 0;

            var minIndex = index - windowSize;
            if (minIndex < 0) {
                minIndex = 0;
            }

            if (chainHead - hashOffset >= minIndex &&
                (fastSkipHashing != skipNever && lookAhead > minMatchLength - 1 ||
                    fastSkipHashing == skipNever && lookAhead > prevLength && prevLength < compressionLevel[1])) {

                var match = findMatch(index, chainHead - hashOffset, minMatchLength - 1, lookAhead);
                if (match.ok) {
                    length = match.length;
                    offset = match.offset;
                }
            }
            if (fastSkipHashing != skipNever && length >= minMatchLength ||
                fastSkipHashing == skipNever && prevLength >= minMatchLength && length <= prevLength) {
                // There was a match at the previous step, and the current match is
                // not better. Output the previous match.
                if (fastSkipHashing != skipNever) {
                    tokens.push(token.matchToken(length - minMatchLength, offset - minOffsetSize))
                } else {
                    tokens.push(token.matchToken(prevLength - minMatchLength, prevOffset - minOffsetSize))
                }
                // Insert in the hash table all strings up to the end of the match.
                // index and index-1 are already inserted. If there is not enough
                // lookAhead, the last two strings are not inserted into the hash
                // table.
                if (length <= fastSkipHashing) {
                    var newIndex = 0;
                    if (fastSkipHashing != skipNever) {
                        newIndex = index + length
                    } else {
                        newIndex = index + prevLength - 1
                    }
                    for (index++; index < newIndex; index++) {
                        if (index < maxInsertIndex) {
                            hash = (hash << hashShift + window[index + 2]) & hashMask;
                            // Get previous value with the same hash.
                            // Our chain should point to the previous value.
                            hashPrev[index & windowMask] = hashHead[hash];
                            // Set the head of the hash chain to us.
                            hashHead[hash] = index + hashOffset
                        }
                    }
                    if (fastSkipHashing == skipNever) {
                        byteAvailable = false;
                        length = minMatchLength - 1
                    }
                } else {
                    index += length;
                    if (index < maxInsertIndex) {
                        hash = window[index] << hashShift + window[index + 1];
                    }
                }
                if (tokens.length == consts.maxFlateBlockTokens) {
                    // The block includes the current character
                    if (!writeBlock(tokens, index, false)) {
                        return
                    }
                    tokens = [];
                }
            } else {
                if (fastSkipHashing != skipNever || byteAvailable) {
                    var i = index - 1;
                    if (fastSkipHashing != skipNever) {
                        i = index;
                    }
                    tokens.push(token.literalToken(window[i]));
                    if (tokens.length == consts.maxFlateBlockTokens) {
                        if (!writeBlock(tokens, i+1, false)) {
                            return
                        }
                        tokens = []
                    }
                }
                index++;
                if (fastSkipHashing == skipNever) {
                    byteAvailable = true;
                }
            }
        }
    }

    function fillStore(b) {
        var n = b.copy(window, windowEnd);
        windowEnd += n;
        return n
    }

    function store() {
        if (windowEnd > 0) {
            writeStoredBlock(window.slice(0, windowEnd))
        }
        windowEnd = 0;
    }

    function write(b) {
        var n = b.length;
        b = b.slice(fill(b));
        if (b.length > 0) {
            step();
            b = b.slice(fill(b));
        }
        return n
    }

    function writeStoredBlock(buf) {
        w.writeStoredHeader(buf.length, false);
        w.writeBytes(buf)
    }

    function syncFlush() {
        sync = true;
        step();
        w.writeStoredHeader(0, false);
        w.flush();
        sync = false
    }

    function reset(w) {
        w.reset(w);
        sync = false;
        switch (compressionLevel[3]) {
            case 0:
                // level was NoCompression
                for (i = 0; i < window.length; i++) {
                    window[i] = 0;
                }
                windowEnd = 0;
                break;
            default:
                chainHead = -1;
                hashHead = [];
                hashPrev = [];
                hashOffset = 1;
                index = 0;
                windowEnd = 0;
                window = new Buffer(0);
                blockStart = 0;
                byteAvailable = false;
                tokens = [];
                length = consts.minMAtchLength - 1;
                offset = 0;
                hash = 0;
                maxInsertIndex = 0;
                break;
        }

    }

    function close() {
        sync = true;
        step();
        if (!w.writeStoredHeader(0, true)) {
            return
        }
        w.flush()
    }

    return {
        init : init,
        write : write,
        syncFlush : syncFlush,
        close : close,
        reset : reset
    }
}

function EmptyArray(size) {
    var arr = [];
    for (var i = 0; i < size; i++) {
        arr.push(0)
    }
    return arr;
}