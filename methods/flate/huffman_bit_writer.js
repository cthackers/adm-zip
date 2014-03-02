var token = require("./token"),
    consts = require("./constants"),
    reverseBits = require("./reverse_bits");

const
    // The largest offset code.
    offsetCodeCount = 30,
    // The special code used to mark the end of a block.
    endBlockMarker = 256,
    // The first length code.
    lengthCodesStart = 257,
    // The number of codegen codes.
    codegenCodeCount = 19,
    badCode          = 255,
    maxLit = 286,
    maxBitsLimit = 16;

var
    // The number of extra bits needed by length code X - LENGTH_CODES_START.
    lengthExtraBits = [
        /* 257 */
        0, 0, 0,
        /* 260 */
        0, 0, 0, 0, 0, 1, 1, 1, 1, 2,
        /* 270 */
        2, 2, 2, 3, 3, 3, 3, 4, 4, 4,
        /* 280 */
        4, 5, 5, 5, 5, 0
    ],
    // The length indicated by length code X - LENGTH_CODES_START.
    lengthBase = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
        12, 14, 16, 20, 24, 28, 32, 40, 48, 56,
        64, 80, 96, 112, 128, 160, 192, 224, 255
    ],
    // offset code word extra bits.
    offsetExtraBits = [
        0, 0, 0, 0, 1, 1, 2, 2, 3, 3,
        4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
        9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
        /* extended window */
        14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20
    ],
    offsetBase = [
       /* normal deflate */
        0x000000, 0x000001, 0x000002, 0x000003, 0x000004,
        0x000006, 0x000008, 0x00000c, 0x000010, 0x000018,
        0x000020, 0x000030, 0x000040, 0x000060, 0x000080,
        0x0000c0, 0x000100, 0x000180, 0x000200, 0x000300,
        0x000400, 0x000600, 0x000800, 0x000c00, 0x001000,
        0x001800, 0x002000, 0x003000, 0x004000, 0x006000,

        /* extended window */
        0x008000, 0x00c000, 0x010000, 0x018000, 0x020000,
        0x030000, 0x040000, 0x060000, 0x080000, 0x0c0000,
        0x100000, 0x180000, 0x200000, 0x300000
    ],
    // The odd order in which the codegen code sizes are written.
    codegenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
    fixedLiteralEncoding = generateFixedLiteralEncoding(),
    fixedOffsetEncoding = generateFixedOffsetEncoding();

module.exports = huffmanBitWriter;

function huffmanBitWriter(/*Writer*/w) {

    var _literalFreq = EmptyArray(maxLit),
        _offsetFreq = EmptyArray(offsetCodeCount),
        _codegen = new Buffer(offsetCodeCount + maxLit + 1),
        _codegenFreq = new Buffer(codegenCodeCount),

        _literalEncoding = new huffmanEncoder(maxLit),
        _offsetEncoding = new huffmanEncoder(offsetCodeCount),
        _codegenEncoding = new huffmanEncoder(codegenCodeCount),

        _err = 0,
        // Data waiting to be written is bytes[0:nbytes]
        // and then the low nbits of bits.
        _bits  = 0,
        _nbits = 0,
        _bytes = new Buffer(64),
        _nbytes = 0;

    reset(w);

    function reset(writer) {
        w = writer;
        _bits = 0;
        _nbits = 0;
        _nbytes = 0;
        _bytes = new Buffer(64);
        _err = 0;
        for (var i = 0; i < _codegen.length; i++) { _codegen[i] = 0; }
        for (i = 0; i < _literalFreq.length; i++) { _literalFreq[i] = 0; }
        for (i = 0; i < _offsetFreq.length; i++) { _offsetFreq[i] = 0; }
        for (i = 0; i < _codegenFreq.length; i++) { _codegenFreq[i] = 0; }

        for (i = 0; i < 3; i++) {
            var enc = [_literalEncoding, _offsetEncoding, _codegenEncoding][i];
            for (var j = 0; j < enc.code.length; j++) {
                enc.code[j] = 0;
            }
            for (j = 0; j < enc.codeBits.length; j++) {
                enc.codeBits[j] = 0;
            }
        }
    }

    function flushBits() {
        if (_err != 0) {
            _nbits = 0;
            return
        }

        var bits = _bits;
        _bits >>= 16;
        _nbits -= 16;

        var n = _nbytes;
        _bytes[n] = bits;
        _bytes[n+1] = bits >> 8;

        n += 2;
        if (n >= _bytes.length) {
            w.write(_bytes);
            n = 0
        }
        _nbytes = n
    }

    function flush() {
        if (_err != 0) {
            _nbits = 0;
            return
        }
        var n = _nbytes;
        if (_nbits > 8) {
            _bytes[n] = _bits;
            _bits >>= 8;
            _nbits -= 8;
            n++;
        }
        if (_nbits > 0) {
            _bytes[n] = _bits;
            _nbits = 0;
            n++;
        }
        _bits = 0;
        w.write(_bytes.slice(0, n));
        _nbytes = 0
    }

    function writeBits(b, nb) {
        _bits |= (b << _nbits);
        _nbits += nb;
        if (_nbits >= 16) {
            flushBits();
        }
    }

    function writeBytes(/*Buffer*/bytes) {
        if (_err != 0) {
            return
        }
        var n = _nbytes;
        if (_nbits == 8) {
            _bytes[n] = _bits;
            _nbits = 0;
            n++;
        }
        if (_nbits != 0) {
            _err = 1;
            return;
        }
        if (n != 0) {
            w.write(_bytes.slice(0, n));
        }
        _nbytes = 0;
        w.write(bytes)
    }

    function generateCodegen(/*Number*/numLiterals, /*Number*/numOffsets) {
        for (var i = 0; i < _codegenFreq.length; i++) {
            _codegenFreq[i] = 0;
        }

        _literalEncoding.codeBits.copy(_codegen, 0, 0, numLiterals);

        _offsetEncoding.codeBits.copy(_codegen, numLiterals, 0, numLiterals+numOffsets)
        _codegen[numLiterals + numOffsets] = badCode;

        var size = _codegen[0],
            count = 1,
            outIndex = 0;
        for (var inIndex = 1; size != badCode; inIndex++) {
            // INVARIANT: We have seen "count" copies of size that have not yet
            // had output generated for them.
            var nextSize = _codegen[inIndex];
            if (nextSize == size) {
                count++;
                continue;
            }
            // We need to generate codegen indicating "count" of size.
            if (size != 0) {
                _codegen[outIndex] = size;
                outIndex++;
                _codegenFreq[size] = _codegenFreq[size] + 1;
                count--;
                for (;count >= 3;) {
                    var n = 6;
                    if (n > count) {
                        n = count;
                    }
                    _codegen[outIndex] = 16;
                    outIndex++;
                    _codegen[outIndex] = n - 3;
                    outIndex++;
                    _codegenFreq[16] = _codegenFreq[16] + 1;
                    count -= n;
                }
            } else {
                for (;count >= 11;) {
                    var n = 138;
                    if (n > count) {
                        n = count;
                    }
                    _codegen[outIndex] = 18;
                    outIndex++;
                    _codegen[outIndex] = n - 11;
                    outIndex++;
                    _codegenFreq[18] = _codegenFreq[18] + 1;
                    count -= n;
                }
                if (count >= 3) {
                    _codegen[outIndex] = 17;
                    outIndex++;
                    _codegen[outIndex] = count - 3;
                    outIndex++;
                    _codegenFreq[17] = _codegenFreq[17] + 1;
                    count++;
                }
            }
            count--;
            for (;count >= 0; count--) {
                _codegen[outIndex] = size;
                outIndex++;
                _codegenFreq[size] = _codegenFreq[size] + 1;
            }
            // Set up invariant for next time through the loop.
            size = nextSize;
            count = 1
        }
        // Marker indicating the end of the codegen.
        _codegen[outIndex] = badCode;
    }

    function writeCode(/*huffmanEncoder*/code, /*Number*/literal) {
        if (_err != 0) {
            return
        }
        writeBits(code.code[literal], code.codeBits[literal]);
    }

    function writeDynamicHeader(/*Number*/numLiterals, /*Number*/numOffsets, /*Number*/numCodegens, /*boolean*/isEof) {
        if (_err != 0) {
            return
        }
        var firstBits = 4;
        if (isEof) {
            firstBits = 5;
        }
        writeBits(firstBits, 3);
        writeBits(numLiterals - 257, 5);
        writeBits(numOffsets - 1, 5);
        writeBits(numCodegens - 4, 4);

        var i = 0;

        for (; i < numCodegens; i++) {
            writeBits(_codegenEncoding.codeBits[codegenOrder[i]], 3)
        }

        i = 0;
        for (;;) {
            var codeWord = _codegen[i];
            i++;
            if (codeWord == badCode) {
                break;
            }
            writeCode(_codegenEncoding, codeWord);

            switch (codeWord) {
                case 16:
                    writeBits(_codegen[i], 2);
                    i++;
                    break;
                case 17:
                    writeBits(_codegen[i], 3);
                    i++;
                    break;
                case 18:
                    writeBits(_codegen[i], 7);
                    i++;
                    break;
            }
        }
    }

    function writeStoredHeader(/*Number*/length, /*Boolean*/isEof) {
        if (_err != 0) {
            return false;
        }
        writeBits(isEof ? 1 : 0, 3);
        flush();
        writeBits(length, 16);
        writeBits(length ^ 0xFFFF, 16);
        return true;
    }

    function writeFixedHeader(/*Boolean*/isEof) {
        if (_err != 0) {
            return
        }
        writeBits(isEof ? 3 : 2, 3);
    }

    function writeBlock(/*Array*/tokens, /*Boolean*/eof, /*Buffer*/input) {

        if (_err != 0) {
            return false;
        }
        var i = 0;
        for (; i < _literalFreq.length; i++) { _literalFreq[i] = 0; }
        for (i = 0; i < _offsetFreq.length; i++) { _offsetFreq[i] = 0; }

        tokens.push(endBlockMarker);

        for (i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            switch (token.typ(t)) {
                case 0 << 30:
                    _literalFreq[token.literal(t)] = _literalFreq[token.literal(t)] + 1;
                    break;
                case 1 << 30:
                    var length = token.length(t),
                        offset = token.offset(t);
                    _literalFreq[lengthCodesStart + token.lengthCode(length)] = _literalFreq[lengthCodesStart + token.lengthCode(length)] + 1;
                    _offsetFreq[token.offsetCode(offset)] = _offsetFreq[token.offsetCode(offset)] + 1;
            }
        }

        // get the number of literals
        var numLiterals = _literalFreq.length;
        for (;_literalFreq[numLiterals-1] == 0;) {
            numLiterals--;
        }

        // get the number of offsets
        var numOffset = _offsetFreq.length;
        for (; numOffset > 0 && _offsetFreq[numOffset-1] == 0;) {
            numOffset--;
        }
        if (numOffset == 0) {
            _offsetFreq[0] = 1;
            numOffset = 1;
        }

        _literalEncoding.generate(_literalFreq, 15);
        _offsetEncoding.generate(_offsetFreq, 15);


        var storedBytes = 0;
        if (input != null) {
            storedBytes = input.length;
        }
        var extraBits = 0,
            storedSize = 0xFFFFFFFF;
        if (storedBytes <= 65535 && input != null) {
            storedSize = (storedBytes + 5) * 8;
            for (var lengthCode = lengthCodesStart + 8; lengthCode < numLiterals; lengthCode++) {
                // First eight length codes have extra size = 0.
                extraBits += _literalFreq[lengthCode] * lengthExtraBits[lengthCode - lengthCodesStart]
            }
            for (var offsetCode = 4; offsetCode < numOffset; offsetCode++) {
                extraBits += _offsetFreq[offsetCode] * offsetExtraBits[offsetCode];
            }
        }
        var size = 3 + fixedLiteralEncoding.bitLength(_literalFreq) + fixedOffsetEncoding.bitLength(_offsetFreq) + extraBits,
            literalEncoding = fixedLiteralEncoding,
            offsetEncoding = fixedOffsetEncoding,
            numCodegens = 0;

        generateCodegen(numLiterals, numOffset);
        _codegenEncoding.generate(_codegenFreq, 7);

        numCodegens = _codegenFreq.length;
        for (; numCodegens > 4 && _codegenFreq[codegenOrder[numCodegens - 1]] == 0;) {
            numCodegens--;
        }
        var dynamicHeader = 17+(3*numCodegens) +
                _codegenEncoding.bitLength(_codegenFreq) +
                extraBits +
                (_codegenFreq[16]*2) +
                (_codegenFreq[17]*3) +
                (_codegenFreq[18]*7),
            dynamicSize = dynamicHeader + _literalEncoding.bitLength(_literalFreq) + _offsetEncoding.bitLength(_offsetFreq);

        if (dynamicSize < size) {
            size = dynamicSize;
            literalEncoding = _literalEncoding;
            offsetEncoding = _offsetEncoding;
        }

        if (storedSize < size) {
            writeStoredHeader(storedBytes, eof);
            writeBytes(input.slice(0, storedBytes));
            return;
        }

        if (literalEncoding == fixedLiteralEncoding) {
            writeFixedHeader(eof)
        } else {
            writeDynamicHeader(numLiterals, numOffset, numCodegens, eof)
        }
        for (i = 0; i < tokens.length; i++) {
            t = tokens[i];
            switch (token.typ(t)) {
                case 0 << 30:
                    writeCode(literalEncoding, t, token.literal(t));
                    break;
                case 1 << 30:
                    var length = token.length(t),
                        lengthCode = token.lengthCode(length);
                    writeCode(literalEncoding, lengthCode + lengthCodesStart);
                    var extraLengthBits = lengthExtraBits[lengthCode];
                    if (extraLengthBits > 0) {
                        writeBits(length - lengthBase[lengthCode], extraLengthBits);
                    }
                    var offset = token.offset(t),
                        offsetCode = token.offsetCode(offset);
                    writeCode(offsetEncoding, offsetCode);
                    var extraOffsetBits = offsetExtraBits[offsetCode];
                    if (extraOffsetBits > 0) {
                        var extraOffset = offset - offsetBase[offsetCode];
                        writeBits(extraOffset, extraOffsetBits)
                    }
                    break;
                default :
                    throw Error("unknown token type", t);
            }
        }
        return true
    }

    return {
        reset : reset,
        flushBits : flushBits,
        flush : flush,
        writeBits : writeBits,
        writeBytes : writeBytes,
        generateCodegen : generateCodegen,
        writeCode : writeCode,
        writeDynamicHeader : writeDynamicHeader,
        writeStoredHeader : writeStoredHeader,
        writeFixedHeader : writeFixedHeader,
        writeBlock : writeBlock
    }
}

function huffmanEncoder(/*Number*/size) {

    var h = this;

    this.codeBits = new Buffer(size);
    this.code = EmptyArray(size);

    this.bitLength = function(/*Array*/freq) {
        var total = 0;
        for (var i = 0, l = freq.length; i < l; i++) {
            var f = freq[i];
            if (f != 0) {
                total += (f * h.codeBits[i]);
            }
        }
        return total;
    };

    this.bitCounts = function(/*Array*/list, /*Number*/maxBits) {
        //console.log("bitCounts", maxBits, list)
        if (maxBits >= maxBitsLimit) {
            throw Error("flate: maxBits too large")
        }

        var n = list.length;
        list.push(maxNode());

        // The tree can't have greater depth than n - 1, no matter what.  This
        // saves a little bit of work in some small cases
        if (maxBits > n - 1) {
            maxBits = n - 1
        }

        // Create information about each of the levels.
        // A bogus "Level 0" whose sole purpose is so that
        // level1.prev.needed==0.  This makes level1.nextPairFreq
        // be a legitimate value that never gets chosen.
        var levels = new Array(maxBitsLimit),
        // leafCounts[i] counts the number of literals at the left
        // of ancestors of the rightmost node at level i.
        // leafCounts[i][j] is the number of literals at the left
        // of the level j ancestor.
            leafCounts = new Array(maxBitsLimit);

        for (var i = 0; i < maxBitsLimit; i++) {
            leafCounts[i] = EmptyArray(maxBitsLimit);
            levels[i] = {
                level: 0,
                lastFreq: 0,
                nextCharFreq: 0,
                nextPairFreq: 0,
                needed: 0
            };
        }

        // For every level, the first two items are the first two characters.
        // We initialize the levels as if we had already figured this out.
        for (var level = 1; level <= maxBits; level++) {
            levels[level] = {
                level:        level,
                lastFreq:     list[1].freq,
                nextCharFreq: list[2].freq,
                nextPairFreq: list[0].freq + list[1].freq,
                needed: 0
            };
            leafCounts[level][level] = 2;
            if (level == 1) {
                levels[level].nextPairFreq = 0xFFFFFFFF;
            }
        }

        // We need a total of 2*n - 2 items at top level and have already generated 2.
        levels[maxBits].needed = 2 * n - 4;
        level = maxBits;

        while (true) {
            var l = levels[level];
            if (l.nextPairFreq == 0xFFFFFFFF && l.nextCharFreq == 0xFFFFFFFF) {
                // We've run out of both leafs and pairs.
                // End all calculations for this level.
                // To make sure we never come back to this level or any lower level,
                // set nextPairFreq impossibly large.
                l.needed = 0;
                levels[level+1].nextPairFreq = 0xFFFFFFFF;
                level++;
                continue
            }

            var prevFreq = l.lastFreq;
            if (l.nextCharFreq < l.nextPairFreq) {
                // The next item on this row is a leaf node.
                var n = leafCounts[level][level] + 1;
                l.lastFreq = l.nextCharFreq;
                // Lower leafCounts are the same of the previous node.
                leafCounts[level][level] = n;
                l.nextCharFreq = list[n].freq
            } else {
                // The next item on this row is a pair from the previous row.
                // nextPairFreq isn't valid until we generate two
                // more values in the level below
                l.lastFreq = l.nextPairFreq;
                leafCounts[level] = [].concat(leafCounts[level-1].slice(0,level), leafCounts[level].slice(level));
                levels[l.level-1].needed = 2;
            }
            l.needed--;

            if (l.needed == 0) {
                // We've done everything we need to do for this level.
                // Continue calculating one level up.  Fill in nextPairFreq
                // of that level with the sum of the two nodes we've just calculated on
                // this level.
                if (l.level == maxBits) {
                    // All done!
                    break;
                }
                levels[l.level + 1].nextPairFreq = prevFreq + l.lastFreq;
                level++;
            } else {
                while (levels[level-1].needed > 0) {
                    level--
                }
            }
        }

        if (leafCounts[maxBits][maxBits] != n) {
            throw Error("leafCounts[maxBits][maxBits] != n")
        }

        var bitCount = EmptyArray(maxBits + 1),
            bits = 1,
            counts = leafCounts[maxBits];

        for (level = maxBits; level > 0; level--) {
            // chain.leafCount gives the number of literals requiring at least "bits"
            // bits to encode.
            bitCount[bits] = counts[level] - counts[level - 1];
            bits++;
        }

        return bitCount;
    };

    this.assignEncodingAndSize = function(/*Array*/bitCount, /*Array*/list) {
        var code = 0;
        for (var n = 0; n < bitCount.length; n++) {
            var bits = bitCount[n];
            code <<= 1;
            if (n == 0 || bits == 0) {
                continue;
            }
            // The literals list[len(list)-bits] .. list[len(list)-bits]
            // are encoded using "bits" bits, and get the values
            // code, code + 1, ....  The code values are
            // assigned in literal order (not frequency order).
            var chunk = list.slice(list.length - bits);
            sortByLiteral(chunk);
            for (var i = 0; i < chunk.length; i++) {
                var node = chunk[i];
                h.codeBits[node.literal] = n;
                h.code[node.literal] = reverseBits(code, n);
                code++
            }
            list = list.slice(0, list.length - bits);
        }
        return list
    };

    function sortByFreq(a) {
        a.sort(function(i, j) {
            if (i.freq == j.freq) {
                return i.literal > j.literal
            }
            return i.freq > j.freq;
        });
    }

    function sortByLiteral(a) {
        a.sort(function(i, j) {
            return i.literal > j.literal;
        });
    }

    this.generate = function(freq, maxBits) {
        var list = new Array(freq.length + 1),
        // Number of non-zero literals
            count = 0;

        for (var i = 0; i < list.length; i++) {
            list[i] = {literal:0, freq:0}
        }

        for (i = 0; i < freq.length; i++) {
            var f = freq[i];
            if (f != 0) {
                list[count] = {literal:i, freq:f};
                count++
            } else {
                h.codeBits[i] = 0;
            }
        }
        // If freq[] is shorter than codeBits[], fill rest of codeBits[] with zeros
        h.codeBits = h.codeBits.slice(0, freq.length);
        list = list.slice(0, count);
        if (count <= 2) {
            // Handle the small cases here, because they are awkward for the general case code.  With
            // two or fewer literals, everything has bit length 1.
            for (var j = 0; j < list.length; j++) {
                var node = list[j];
                // "list" is in order of increasing literal value.
                h.codeBits[node.literal] = 1;
                h.code[node.literal] = j;
            }
            return
        }
        sortByFreq(list);
        // Get the number of literals for each bit count
        var bitCount = h.bitCounts(list, maxBits);
        // And do the assignment
        h.assignEncodingAndSize(bitCount, list);
    };
}

function generateFixedLiteralEncoding() {
    var h = new huffmanEncoder(286),
        codeBits = h.codeBits,
        code = h.code;

    for (var ch = 0; ch < 286; ch++) {
        var bits = 0,
            size = 0;
        if (ch < 144) {
            // size 8, 000110000  .. 10111111
            bits = ch + 48;
            size = 8
        } else if (ch < 256) {
            // size 9, 110010000 .. 111111111
            bits = ch + 400 - 144;
            size = 9
        } else if (ch < 280) {
            // size 7, 0000000 .. 0010111
            bits = ch - 256;
            size = 7
        } else {
            // size 8, 11000000 .. 11000111
            bits = ch + 192 - 280;
            size = 8
        }
        codeBits[ch] = size;
        code[ch] = reverseBits(bits, size)
    }
    return h;
}

function generateFixedOffsetEncoding() {
    var h = new huffmanEncoder(30),
        codeBits = h.codeBits,
        code = h.code;

    for (var ch = 0; ch < 30; ch++) {
        codeBits[ch] = 5;
        code[ch] = reverseBits(ch, 5);
    }
    return h;
}

function EmptyArray(size) {
    var arr = [];
    for (var i = 0; i < size; i++) {
        arr.push(0)
    }
    return arr;
}

function maxNode() {
    return {
        literal: 65535,
        freq: 2147483647
    }
}