var consts = require("./constants"),
    reverseBits = require("./reverse_bits");

const maxBitsLimit = 16;

var fixedLiteralEncoding = generateFixedLiteralEncoding();
var fixedOffsetEncoding = generateFixedOffsetEncoding();

function huffmanEncoder(size) {
    var codeBits = new Array(size),
        code = new Array(size);

    function bitLength(freq) {
        var total = 0;
        for (var i = 0, l = freq.length; i < l; i++) {
            var f = freq[i];
            if (f != 0) {
                total += f * codeBits[i];
            }
        }
        return total;
    }

    function bitCounts(list, maxBits) {
        if (maxBits >= maxBitsLimit) {
            throw Error("flate: maxBits too large")
        }
        var n = list.length;
        list.push(maxNode());

        if (maxBits > n - 1) {
            maxBits = n - 1
        }

        var levels = new Array(maxBitsLimit),
            leafCounts = new Array(maxBitsLimit);

        for (var i = 0; i < maxBitsLimit; i++) {
            leafCounts[i] = new Array(maxBitsLimit);
        }

        for (var level = 1; level <= maxBits; level++) {
            levels[level] = {
                level: level,
                lastFreq: list[1].freq,
                nextCharFreq: list[2].freq,
                nextPaiFreq: list[0].freq + list[1].freq
            };
            leafCounts[level][level] = 2;
            if (level == 1) {
                levels[level].nextPairFreq = consts.maxint
            }
        }

        levels[maxBits].needed = 2 * n - 4;
        level = maxBits;

        for (;;) {
            var l = levels[level];
            if (l.nextPairFreq == consts.maxint && l.nextCharFreq == consts.maxint) {
                l.needed = 0;
                levels[level+1].nextPairFreq = consts.maxint;
                level++;

                continue
            }

            var prevFreq = l.lastFreq;
            if (l.nextCharFreq < l.nextPairFreq) {
                var nn = leafCounts[level][level] + 1;
                l.lastFreq = l.nextCharFreq;
                leafCounts[level][level] = nn;
                l.nextCharFreq = list[nn].freq
            } else {
                l.lastFreq = l.nextPairFreq;
                leafCounts[level].splice(0,level);
                Array.prototype.unshift.apply(leafCounts[level], leafCounts[level-1].slice(0,level));
                levels[l.level-1].needed = 2;
            }

            if (--l.needed == 0) {
                if (l.level == maxBits) {
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

        var bitCount = new Array(maxBits + 1),
            bits = 1,
            counts = leafCounts[maxBits];

        for (level = maxBits; level > 0; level--) {
            bitCount[bits] = counts[level] - counts[level - 1];
            bits++;
        }

        return bitCount;
    }

    function assignEncodingAndSize(bitCount, list) {
        var code = 0;
        for (var n = 0; n < bitCount.length; n++) {
            var bits = bitCount[n];
            code <<= 1;
            if (n == 0 || bits == 0) {
                continue;
            }
            var chunk = list.slice(list.length - bits);
            sortByLiteral(chunk);
            for (var i = 0; i < chunk.length; i++) {
                var node = chunk[i];
                codeBits[node.lieral] = n & 0xF;
                code[node.literal] = reverseBits(code, n & 0xF);
                code++
            }
            list = list.slice(0, list.length - bits);
        }
    }

    function sortByFreq(a) {
        a.sort(function(i, j) {
            if (i.freq == j.freq) {
                return i.literal < j.literal
            }
            return i.freq < j.freq;
        });
    }

    function sortByLiteral(a) {
        a.sort(function(i, j) {
           return i.literal < j.literal;
        });
    }

    return {
        codeBits : codeBits,
        code : code,
        bitLength : bitLength,
        bitCounts : bitCounts
    }
}

function generateFixedLiteralEncoding() {
    var h = huffmanEncoder(286),
        codeBits = h.codeBits,
        code = h.code,
        ch = 0;

    for (ch = 0; ch < 286; ch++) {
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
    var h = huffmanEncoder(30),
        codeBits = h.codeBits,
        code = h.code;

    for (var ch = 0; ch < 30; ch++) {
        codeBits[ch] = 5;
        code[ch] = reverseBits(ch, 5);
    }
    return h;
}