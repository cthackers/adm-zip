var token = require("./token"),
    utils = require("../../utils"),
    reverseBits = require("./reverse_bits"),
    EmptyArray = utils.EmptyArray,
    copy = utils.copy;


const
    // The largest offset code.
    offsetCodeCount = 30,
    // The special code used to mark the end of a block.
    endBlockMarker = 256,
    // The first length code.
    lengthCodesStart = 257,
    // The number of codegen codes.
    codegenCodeCount = 19,
    badCode = 255,

    maxLit = 286,
    maxBitsLimit = 16;

var // The number of extra bits needed by length code X - LENGTH_CODES_START.
    lengthExtraBits = [
        /* 257 */ 0, 0, 0,
        /* 260 */ 0, 0, 0, 0, 0, 1, 1, 1, 1, 2,
        /* 270 */ 2, 2, 2, 3, 3, 3, 3, 4, 4, 4,
        /* 280 */ 4, 5, 5, 5, 5, 0
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

function huffmanBitWriter(/*Writer*/writer) {

    var w = this;

    this.writer = writer;
    // Data waiting to be written is bytes[0:nbytes]
    // and then the low nbits of bits.
    this.bits = 0;
    this.nbits = 0;
    this.bytes = new Buffer(64);
    this.nbytes = 0;
    this.literalFreq = EmptyArray(maxLit);
    this.offsetFreq = EmptyArray(offsetCodeCount);
    this.codegen = EmptyArray(offsetCodeCount + maxLit + 1);
    this.codegenFreq = EmptyArray(codegenCodeCount);
    this.literalEncoding = new HuffmanEncoder(maxLit);
    this.offsetEncoding = new HuffmanEncoder(offsetCodeCount);
    this.codegenEncoding = new HuffmanEncoder(codegenCodeCount);
    this.err = 0;

    this.reset = function(writer) {
        w.writer = writer;
        w.bits = 0;
        w.nbits = 0;
        w.nbytes = 0;
        w.err = 0;
        w.bytes = new Buffer(64);

        for (var i = 0; i < 64; i++) {
            w.bytes[i] = 0;
        }
        for (i = 0; i < w.codegen.length; i++) { w.codegen[i] = 0; }
        for (i = 0; i < w.literalFreq.length; i++) { w.literalFreq[i] = 0; }
        for (i = 0; i < w.offsetFreq.length; i++) { w.offsetFreq[i] = 0; }
        for (i = 0; i < w.codegenFreq.length; i++) { w.codegenFreq[i] = 0; }

        for (i = 0; i < 3; i++) {
            var enc = [w.literalEncoding, w.offsetEncoding, w.codegenEncoding][i];
            for (var j = 0; j < enc.code.length; j++) { enc.code[j] = 0; }
            for (j = 0; j < enc.codeBits.length; j++) { enc.codeBits[j] = 0; }
        }
    };

    w.reset(writer);

    this.flushBits = function() {
        if (w.err != 0) {
            w.nbits = 0;
            return
        }

        var bits = w.bits;
        w.bits >>= 16;
        w.nbits -= 16;

        var n = w.nbytes;
        w.bytes[n] = bits;
        w.bytes[n + 1] = bits >> 8;

        n += 2;
        if (n >= w.bytes.length) {
            w.writer.write(w.bytes);
            n = 0
        }
        w.nbytes = n;
    };

    this.flush = function() {
        if (w.err != 0) {
            w.nbits = 0;
            return
        }
        var n = w.nbytes;
        if (w.nbits > 8) {
            w.bytes[n] = w.bits;
            w.bits >>= 8;
            w.nbits -= 8;
            n++;
        }
        if (w.nbits > 0) {
            w.bytes[n] = w.bits;
            w.nbits = 0;
            n++;
        }
        w.bits = 0;
        w.writer.write(w.bytes.slice(0, n));
        w.nbytes = 0
    };

    this.writeBits = function(b, nb) {
        w.bits |= (b << w.nbits);
        w.nbits += nb;
        if (w.nbits >= 16) {
            w.flushBits();
        }
    };

    this.writeBytes = function(/*Buffer*/bytes) {
        if (w.err != 0) {
            return
        }
        var n = w.nbytes;
        if (w.nbits == 8) {
            w.bytes[n] = w.bits;
            w.nbits = 0;
            n++;
        }
        if (w.nbits != 0) {
            w.err = 1;
            return;
        }
        if (n != 0) {
            w.writer.write(w.bytes.slice(0, n));
        }
        w.nbytes = 0;
        w.writer.write(bytes)
    };

    this.generateCodegen = function(/*Number*/numLiterals, /*Number*/numOffsets) {
        for (var i = 0; i < w.codegenFreq.length; i++) {
            w.codegenFreq[i] = 0;
        }

        var codegen = w.codegen;

        copy(codegen, 0, numLiterals, w.literalEncoding.codeBits);
        copy(codegen, numLiterals, numLiterals + numOffsets, w.offsetEncoding.codeBits);
        codegen[numLiterals + numOffsets] = badCode;

        var size = codegen[0],
            count = 1,
            outIndex = 0;

        for (var inIndex = 1; size != badCode; inIndex++) {
            // INVARIANT: We have seen "count" copies of size that have not yet
            // had output generated for them.
            var nextSize = codegen[inIndex];
            if (nextSize == size) {
                count++;
                continue;
            }
            // We need to generate codegen indicating "count" of size.
            if (size != 0) {
                codegen[outIndex] = size;
                outIndex++;
                w.codegenFreq[size]++;
                count--;
                while (count >= 3) {
                    var n = 6;
                    if (n > count) {
                        n = count;
                    }
                    codegen[outIndex] = 16;
                    outIndex++;
                    codegen[outIndex] = n - 3;
                    outIndex++;
                    w.codegenFreq[16]++;
                    count -= n;
                }
            } else {
                while (count >= 11) {
                    var n = 138;
                    if (n > count) {
                        n = count;
                    }
                    codegen[outIndex] = 18;
                    outIndex++;
                    codegen[outIndex] = n - 11;
                    outIndex++;
                    w.codegenFreq[18]++;
                    count -= n;
                }
                if (count >= 3) {
                    codegen[outIndex] = 17;
                    outIndex++;
                    codegen[outIndex] = count - 3;
                    outIndex++;
                    w.codegenFreq[17]++;
                    count = 0;
                }
            }
            count--;
            for (; count >= 0; count--) {
                codegen[outIndex] = size;
                outIndex++;
                w.codegenFreq[size]++;
            }
            // Set up invariant for next time through the loop.
            size = nextSize;
            count = 1
        }
        // Marker indicating the end of the codegen.
        codegen[outIndex] = badCode;
    };

    this.writeCode = function(/*huffmanEncoder*/code, /*Number*/literal) {
        if (w.err != 0) {
            return
        }
        w.writeBits(code.code[literal], code.codeBits[literal]);
    };

    this.writeDynamicHeader = function(/*Number*/numLiterals, /*Number*/numOffsets, /*Number*/numCodegens, /*boolean*/isEof) {
        if (w.err != 0) {
            return
        }
        var firstBits = 4;
        if (isEof) {
            firstBits = 5;
        }
        w.writeBits(firstBits, 3);
        w.writeBits(numLiterals - 257, 5);
        w.writeBits(numOffsets - 1, 5);
        w.writeBits(numCodegens - 4, 4);

        var i = 0;

        for (; i < numCodegens; i++) {
            w.writeBits(w.codegenEncoding.codeBits[codegenOrder[i]], 3)
        }

        i = 0;
        while (true) {
            var codeWord = w.codegen[i];
            i++;
            if (codeWord == badCode) {
                break;
            }
            w.writeCode(w.codegenEncoding, codeWord);

            switch (codeWord) {
                case 16:
                    w.writeBits(w.codegen[i], 2);
                    i++;
                    break;
                case 17:
                    w.writeBits(w.codegen[i], 3);
                    i++;
                    break;
                case 18:
                    w.writeBits(w.codegen[i], 7);
                    i++;
                    break;
            }
        }
    };

    this.writeStoredHeader = function(/*Number*/length, /*Boolean*/isEof) {
        if (w.err != 0) {
            return false;
        }
        var flag = isEof ? 1 : 0;
        w.writeBits(flag, 3);
        w.flush();
        w.writeBits(length, 16);
        w.writeBits(length ^ 0xFFFF, 16);
        return true;
    };

    this.writeFixedHeader = function(/*Boolean*/isEof) {
        if (w.err != 0) {
            return
        }
        w.writeBits(isEof ? 3 : 2, 3);
    };

    this.writeBlock = function(/*Array*/tokens, /*Boolean*/eof, /*Buffer*/input) {

        if (w.err != 0) {
            return false;
        }
        var i = 0;
        for (; i < w.literalFreq.length; i++) {
            w.literalFreq[i] = 0;
        }
        for (i = 0; i < w.offsetFreq.length; i++) {
            w.offsetFreq[i] = 0;
        }

        tokens.push(endBlockMarker);

        for (i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            switch (token.typ(t)) {
                case 0 << 30:
                    w.literalFreq[token.literal(t)]++;
                    break;
                case 1 << 30:
                    var length = token.length(t),
                        offset = token.offset(t);
                    w.literalFreq[lengthCodesStart + token.lengthCode(length)]++;
                    w.offsetFreq[token.offsetCode(offset)]++;
            }
        }

        // get the number of literals
        var numLiterals = w.literalFreq.length;
        while (w.literalFreq[numLiterals - 1] == 0) {
            numLiterals--;
        }

        // get the number of offsets
        var numOffset = w.offsetFreq.length;
        while (numOffset > 0 && w.offsetFreq[numOffset - 1] == 0) {
            numOffset--;
        }
        if (numOffset == 0) {
            w.offsetFreq[0] = 1;
            numOffset = 1;
        }

        w.literalEncoding.generate(w.literalFreq, 15);
        w.offsetEncoding.generate(w.offsetFreq, 15);


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
                extraBits += w.literalFreq[lengthCode] * lengthExtraBits[lengthCode - lengthCodesStart]
            }
            for (var offsetCode = 4; offsetCode < numOffset; offsetCode++) {
                extraBits += w.offsetFreq[offsetCode] * offsetExtraBits[offsetCode];
            }
        }
        var size = 3 + fixedLiteralEncoding.bitLength(w.literalFreq) + fixedOffsetEncoding.bitLength(w.offsetFreq) + extraBits,
            literalEncoding = fixedLiteralEncoding,
            offsetEncoding = fixedOffsetEncoding,
            numCodegens = 0;

        w.generateCodegen(numLiterals, numOffset);
        w.codegenEncoding.generate(w.codegenFreq, 7);

        numCodegens = w.codegenFreq.length;
        while (numCodegens > 4 && w.codegenFreq[codegenOrder[numCodegens - 1]] == 0) {
            numCodegens--;
        }
        var dynamicHeader = (17 + (3 * numCodegens)) +
                w.codegenEncoding.bitLength(w.codegenFreq) +
                extraBits +
                (w.codegenFreq[16] * 2) +
                (w.codegenFreq[17] * 3) +
                (w.codegenFreq[18] * 7),
            dynamicSize = dynamicHeader + w.literalEncoding.bitLength(w.literalFreq) + w.offsetEncoding.bitLength(w.offsetFreq);

        if (dynamicSize < size) {
            size = dynamicSize;
            literalEncoding = w.literalEncoding;
            offsetEncoding = w.offsetEncoding;
        }

        if (storedSize < size) {
            w.writeStoredHeader(storedBytes, eof);
            w.writeBytes(input.slice(0, storedBytes));
            return;
        }

        if (literalEncoding == fixedLiteralEncoding) {
            w.writeFixedHeader(eof)
        } else {
            w.writeDynamicHeader(numLiterals, numOffset, numCodegens, eof)
        }
        for (i = 0; i < tokens.length; i++) {
            t = tokens[i];
            switch (token.typ(t)) {
                case 0 << 30:
                    w.writeCode(literalEncoding, token.literal(t));
                    break;
                case 1 << 30:
                    var length = token.length(t),
                        lengthCode = token.lengthCode(length);
                    w.writeCode(literalEncoding, lengthCode + lengthCodesStart);
                    var extraLengthBits = lengthExtraBits[lengthCode];
                    if (extraLengthBits > 0) {
                        w.writeBits(length - lengthBase[lengthCode], extraLengthBits);
                    }
                    var offset = token.offset(t),
                        offsetCode = token.offsetCode(offset);
                    w.writeCode(offsetEncoding, offsetCode);
                    var extraOffsetBits = offsetExtraBits[offsetCode];
                    if (extraOffsetBits > 0) {
                        w.writeBits(offset - offsetBase[offsetCode], extraOffsetBits)
                    }
                    break;
                default :
                    throw Error("unknown token type", t);
            }
        }
        return true
    }
}

function HuffmanEncoder(/*Number*/size) {
    var h = this;

    this.codeBits = EmptyArray(size);
    this.code = EmptyArray(size);

    this.bitLength = function (/*Array*/freq) /*Number*/ {
        var total = 0;
        for (var i = 0, l = freq.length; i < l; i++) {
            var f = freq[i];
            if (f != 0) {
                total += f * h.codeBits[i];
            }
        }
        return total;
    };

    this.bitCounts = function (/*Array*/list, /*Number*/maxBits) /*Array*/ {
        if (maxBits >= maxBitsLimit) {
            throw Error("flate: maxBits too large")
        }

        var n = list.length;
        list.push({
            literal: 0xFFFF, // max int16
            freq: 0x7FFFFFFF // max int32
        });

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

        for (var level = 1; level <= maxBits; level++) {
            // For every level, the first two items are the first two characters.
            // We initialize the levels as if we had already figured this out.
            levels[level] = {
                level:        level,
                lastFreq:     list[1].freq,
                nextCharFreq: list[2].freq,
                nextPairFreq: list[0].freq + list[1].freq,
                needed: 0
            };
            leafCounts[level][level] = 2;
            if (level == 1) {
                levels[level].nextPairFreq = 0x7FFFFFFF;
            }
        }

        // We need a total of 2*n - 2 items at top level and have already generated 2.
        levels[maxBits].needed = 2 * n - 4;
        level = maxBits;

        while (true) {
            var l = levels[level];
            if (l.nextPairFreq == 0x7FFFFFFF && l.nextCharFreq == 0x7FFFFFFF) {
                // We've run out of both leafs and pairs.
                // End all calculations for this level.
                // To make sure we never come back to this level or any lower level,
                // set nextPairFreq impossibly large.
                l.needed = 0;
                levels[level + 1].nextPairFreq = 0x7FFFFFFF;
                level++;
                continue
            }

            var prevFreq = l.lastFreq;
            if (l.nextCharFreq < l.nextPairFreq) {
                // The next item on this row is a leaf node.
                var m = leafCounts[level][level] + 1;
                l.lastFreq = l.nextCharFreq;
                // Lower leafCounts are the same of the previous node.
                leafCounts[level][level] = m;
                l.nextCharFreq = list[m].freq
            } else {
                // The next item on this row is a pair from the previous row.
                // nextPairFreq isn't valid until we generate two
                // more values in the level below
                l.lastFreq = l.nextPairFreq;
                // Take leaf counts from the lower level, except counts[level] remains the same.
                copy(leafCounts[level], 0, level, leafCounts[level-1], 0, level);
                levels[l.level - 1].needed = 2;
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
                // If we stole from below, move down temporarily to replenish it.
                while (levels[level - 1].needed > 0) {
                    level--
                }
            }
        }

        // Somethings is wrong if at the end, the top level is null or hasn't used
        // all of the leaves.
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

    this.assignEncodingAndSize = function (/*Array*/bitCount, /*Array*/list) {
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
        a.sort(function (i, j) {
            if (i.freq == j.freq) {
                return i.literal > j.literal
            }
            return i.freq > j.freq;
        });
    }

    function sortByLiteral(a) {
        a.sort(function (i, j) {
            return i.literal > j.literal;
        });
    }

    this.generate = function (freq, maxBits) {
        var list = new Array(freq.length + 1),
        // Number of non-zero literals
            count = 0;

        for (var i = 0; i < list.length; i++) {
            list[i] = {literal: 0, freq: 0}
        }

        for (i = 0; i < freq.length; i++) {
            var f = freq[i];
            if (f != 0) {
                list[count] = {literal: i, freq: f};
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
    var h = new HuffmanEncoder(286),
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
    var h = new HuffmanEncoder(30),
        codeBits = h.codeBits,
        code = h.code;

    for (var ch = 0; ch < 30; ch++) {
        codeBits[ch] = 5;
        code[ch] = reverseBits(ch, 5);
    }
    return h;
}
