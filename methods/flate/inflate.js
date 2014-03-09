var fixedHuffmanDecoder = require("./fixedhuff"),
    reverseBits = require("./reverse_bits"),
    forwardCopy = require("./copy").forwardCopy;

var maxCodeLen = 6,
    maxHist = 32768,
    maxLit = 286,
    maxDist = 32,
    numCodes = 19,
    huffmanChunkBits = 9,
    huffmanNumChunks  = 1 << huffmanChunkBits,
    huffmanCountMask  = 15,
    huffmanValueShift = 4,
    codeOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
    reverseByte = reverseBits.reverseByte;

module.exports.decompressor = function(/*Reader*/r) /*Reader*/ {
    var f = new Decompressor();
    f.r = r;
    return f;
};

module.exports.HuffmanDecoder = HuffmanDecoder;

function HuffmanDecoder() {
    var h = this;

    this.min = 0; // the minimum code length
    this.chunks = new Array(huffmanNumChunks); // chunks as described above
    this.links = []; // overflow links
    this.linkMask = 0; // mask the width of the link table

    for (var i = 0; i < huffmanNumChunks; i++) {
        this.chunks[i] = 0;
    }

    // Initialize Huffman decoding tables from array of code lengths.
    this.init = function(bits) {
        // Count number of codes of each length,
        // compute min and max length.
        var count = new Array(maxCodeLen),
            min = 0,
            max = 0;

        for (var i = 0; i < maxCodeLen; i++) {
            count[i] = 0;
        }
        for (i = 0; i < bits.length; i++) {
            var n = bits[i];
            if (n == 0) {
                continue;
            }
            if (min == 0 || n < min) {
                min = n;
            }
            if (n > max) {
                max = n;
            }
            count[n] = count[n] + 1;
        }
        if (max == 0) {
            return false;
        }
        h.min = min;

        var linkBits = 0,
            numLinks = 0;

        if (max > huffmanChunkBits) {
            linkBits = max - huffmanChunkBits;
            numLinks = 1 << linkBits;
            h.linkMask = numLinks - 1;
        }
        var code = 0,
            nextCode = new Array(maxCodeLen);

        for (i = 0; i < maxCodeLen; i++) {
            nextCode[i] = 0;
        }

        for (i = min; i <= max; i++) {
            if (i == huffmanChunkBits + 1) {
                // create link tables
                var link = code >> 1;
                if (huffmanNumChunks < link) {
                    return false;
                }
                h.links = new Array(huffmanNumChunks - link);
                for (var loop = 0; loop < huffmanNumChunks - link; loop++) {
                    h.links[loop] = [];
                }
                for (var j = link; j < huffmanNumChunks; j++) {
                    var reverse = reverseByte[j >> 8] | reverseByte[j & 0xFF] << 8;
                    reverse >>= 16 - huffmanChunkBits;
                    var off = j - link;
                    h.chunks[reverse] = off << huffmanValueShift + i;
                    h.links[off] = new Array(1 << linkBits);
                    for (loop = 0; loop < 1 << linkBits; loop++) {
                        h.links[off][loop] = 0
                    }
                }
                var n = count[i];
                nextCode[i] = code;
                code += n;
                code <<= 1;
            }
        }

        for (i = 0; i < bits.length; i++) {
            var n = bits[i];
            if (n == 0) {
                continue;
            }
            var code = nextCode[n];
            nextCode[n] = nextCode[n] + 1;

            var chunk = i << huffmanValueShift | n,
                reverse = reverseByte[code >> 8] | reverseByte[code & 0xFF] << 8;

            reverse >>= 16 - n;
            if (n <= huffmanChunkBits) {
                for (var off = reverse; off < huffmanNumChunks; off += 1 << n) {
                    h.chunks[off] = chunk;
                }
            } else {
                var value = h.chunks[reverse & (huffmanNumChunks - 1)] >> huffmanValueShift;
                if (value >= h.links.length) {
                    return false;
                }
                var linktab = h.links[value];
                reverse >>= huffmanChunkBits;
                for (var off = reverse; off < numLinks; off += 1 << (n - huffmanChunkBits)) {
                    linktab[off] = chunk
                }
            }
        }
        return true;
    }
}

function Decompressor() {
    var f = this,
        loop = 0;

        // Input source.
    this.r = null;
    this.roffset = 0;
    this.woffset = 0;

    // Input bits, in top of b.
    this.b = 0;
    this.nb = 0;

        // Huffman decoders for literal/length, distance.
    this.h1 = new HuffmanDecoder();
    this.h2 = new HuffmanDecoder();

    // Length arrays used to define Huffman codes.
    this.bits = new Array(maxLit + maxDist);
    this.codebits = new Array(numCodes);

        // Output history, buffer.
    this.hist = new Buffer(maxHist);
    this.hp = 0; // current output position in buffer
    this.hw = 0; // have written hist[0:hw] already
    this.hfull = false; // buffer has filled at least once

        // Temporary buffer (avoids repeated allocation).
    this.buf = new Buffer(4);

    this.final = false;
    this.err = "";
    this.toRead = new Buffer(0);
    this.hl = null;
    this.hd = null;
    this.copyLen = 0;
    this.copyDist = 0;

    for (loop = 0; loop < f.bits.length; loop++) {
        f.bits[loop] = 0;
    }
    for (loop = 0; loop < f.codebits.length; loop++) {
        f.codebits[loop] = 0;
    }

    for (loop = 0; loop < maxHist; loop++ ) {
        f.hist[loop] = 0;
    }

    this.nextBlock = function() {
        if (f.final) {
            if (f.hw != f.hp) {
            //    console.log("nextBlock() FLUSH")
                f.flush(f.nextBlock);
                return;
            }
            f.err = "End of file";
            return;
        }
        while(f.nb < 3) {
            f.err = f.moreBits();
            if (f.err) {
                return
            }
        }

        f.final = ((f.b & 1) == 1);
        f.b >>= 1;

        var typ = (f.b & 3);
        f.b >>= 2;
        f.nb -= 3;

        switch (typ) {
            case 0:
                f.dataBlock();
                break;
            case 1:
                f.hl = fixedHuffmanDecoder;
                f.hd = null;
                f.huffmanBlock();
                break;
            case 2:
                f.err = f.readHuffman();
                if (f.err) {
                    break;
                }
                f.hl = f.h1;
                f.hd = f.h2;
                break;
            default :
                f.err = "Corrupted input";
                break;
        }
    };

    this.Read = function(/*Buffer*/b) {
        while (true) {
            if (f.toRead.length > 0) {
                var n = f.toRead.copy(b);
                f.toRead = f.toRead.slice(n);
                return n;
            }
            if (f.err) {
                return 0;
            }
            f.step(f);
        }
    };

    this.Close = function() {
        if (f.err == "End of file") {
            return null
        }
        return f.err;
    };

    this.readHuffman = function() {
        while (f.nb < 14) {
            var err = f.moreBits;
            if (err) {
                return err;
            }
        }
        var nlit = (f.b & 0x1F) + 257;
        if (nlit > maxLit) {
            return "Corrupted input";
        }
        f.b >>= 5;
        var ndist = (f.b & 0x1F) + 1;
        f.b >>= 5;
        var nclen = (f.b & 0xF) + 4;
        f.b >>= 4;
        f.nb -= 14;

        for (var i = 0; i < nclen; i++) {
            while (f.nb < 3) {
                var err = f.moreBits();
                if (err) {
                    return err;
                }
            }
            f.codebits[codeOrder[i]] = (f.b & 0x7);
            f.b >>= 3;
            f.nb -= 3;
        }

        for (var i = nclen; i < codeOrder.length; i++) {
            f.codebits[codeOrder[i]] = 0;
        }

        if (f.h1.init(f.codebits)) {
            return "Corrupted input";
        }

        for (var i = 0, n = nlit + ndist; i < n; ) {
            var x = f.huffSym(f.h1);
            if (x < 16) {
                f.bits[i] = x;
                i++;
                continue;
            }
            var rep = 0,
                nb = 0,
                b = 0;
            switch (x) {
                default :
                    return "Unexpected length code";
                    break;
                case 16:
                    rep = 3;
                    nb = 2;
                    if (i == 0) {
                        return "Corrupted input"
                    }
                    b = f.bits[i - 1];
                    break;
                case 17:
                    rep = 3;
                    nb = 3;
                    b = 0;
                    break;
                case 18:
                    rep = 11;
                    nb = 7;
                    b = 0;
                    break;
            }
            while (f.nb < nb) {
                var err = f.moreBits();
                if (err) {
                    return err;
                }
            }
            rep += f.b & (1 << nb- 1);
            f.b >>= nb;
            f.nb -= nb;
            if (i + rep > n) {
                return "Corrupted input";
            }
            for (var j = 0; j < rep; j++) {
                f.bits[i] = b;
                i++;
            }
        }
        if (!f.h1.init(f.bits.slice(0, nlit)) || !f.h2.init(f.bits.slice(nlit, nlit + ndist))) {
            return "Corrupted input";
        }
        return "";
    };

    this.huffmanBlock = function() {
        while (true) {
            var v = f.huffSym(f.hl);
            var n = 0,
                length = 0;

            if (v < 256) {
                f.hist[f.hp] = v;
                f.hp++;
                if (f.hp == f.hist.length) {
                    console.log("huffmanBlock() FLUSH")
                    f.flush(f.huffmanBlock);
                    return
                }
                continue;
            } else if (v == 256) {
                f.step = f.nextBlock;
                return
            } else if (v < 265) {
                length = v - 254;
                n = 0;
            } else if (v < 269) {
                length = v * 2 - 519;
                n = 1;
            } else if (v < 273) {
                length = v * 4 - 1057;
                n = 2;
            } else if (v < 277) {
                length = v * 8 - 2149;
                n = 3;
            } else if (v < 281) {
                length = v * 16 - 4365;
                n = 4;
            } else if (v < 285) {
                length = v * 32 - 8861;
                n = 5;
            } else {
                length = 258;
                n = 0;
            }

            if (n > 0) {
                while (f.nb < n) {
                    var err = f.moreBits();
                    if (err) {
                        f.err = err;
                        return
                    }
                }
                length += f.b & (1 << n - 1);
                f.b >>= n;
                f.nb -= n;
            }

            var dist = 0;
            if (f.hd == null) {
                while (f.nb < 5) {
                    var err = f.moreBits();
                    if (err) {
                        f.err = err;
                        return;
                    }
                }
                dist = reverseByte[(f.b & 0x1F) << 3];
                f.b >>= 5;
                f.nb -= 5;
            } else {
                var err = f.huffSym(f.hd);
                if (err) {
                    f.err = err;
                    return
                }
            }

            if (dist < 4) {
                dist ++
            } else if (dist >= 30) {
                f.err = "Corrupted input";
                return
            } else {
                var nb = (dist - 2) >> 1,
                    extra = (dist & 1) << nb;
                while (f.nb < nb) {
                    var err = f.moreBits();
                    if (err) {
                        f.err = err;
                        return;
                    }
                }
                extra |= f.b & (1 << (nb - 1));
                f.b >>= nb;
                f.nb -= nb;
                dist = (1 << (nb + 1)) + 1 + extra;
            }

            if (dist > f.hist.length) {
                f.err = "Bad history distance";
                return
            }

            if (!f.hfull && dist > f.hp) {
                f.err = "Corrupted input"
                return
            }

            f.copyLen = length;
            f.copyDist = dist;
            if (f.copyHist()) {
                return;
            }
        }
    };

    this.copyHist = function() {
        var p = f.hp - f.copyDist;
        if (p < 0) {
            p += f.hist.length;
        }

        while (f.copyLen > 0) {
            var n = f.copyLen,
                x = f.hist.length - f.hp;
            if (n > x) {
                n = x;
            }
            x = f.hist.length - p;
            if (n > x) {
                n = x;
            }
            forwardCopy(f.hist, f.hp, p, n);
            p += n;
            f.hp += n;
            f.copyLen -= n;
            if (f.hp == f.hist.length) {
                console.log("copyHist() FLUSH")
                f.flush(f.copyHuff);
                return true;
            }
            if (p == f.hist.length) {
                p = 0;
            }
        }
        return false;
    };

    this.copyHuff = function() {
        if (f.copyHist()) {
            return
        }
        f.huffmanBlock();
    };

    this.dataBlock = function() {
    //    console.log("dataBlock()")
        f.nb = 0;
        f.b = 0;

        f.buf.writeInt32LE(f.r.readInt32LE(f.roffset, true), 0, true);

        var nr = 4;
        f.roffset += nr;
      //  console.log("dataBlock() nr,",nr, "fbuf", f.buf)

        var n = f.buf[0] | (f.buf[1] << 8),
            nn = f.buf[2] | (f.buf[3] << 8);

       // console.log("dataBlock() n,",n, "nn", nn)
      //  console.log("dataBlock() uint16(nn),",nn, "uint16(^n)", (0xFFFF^n))

        if (nn != (0xFFFF^n)) {
            f.err = "Corrupted input";
            return;
        }
        if (n == 0) {
       //     console.log("dataBlock() FLUSH")
            f.flush(f.nextBlock);
            return;
        }
        f.copyLen = n;
        f.copyData();
    };

    this.copyData = function() {
     //   console.log("copyData()", f.copyLen)
        var n = f.copyLen;
        while (n > 0) {
            var m = f.hist.length - f.hp;
            if (m > n) {
                m = n;
            }

            for (var x = 0; x < m; x++) {
                f.hist.writeInt8(f.r.readInt8(f.roffset++, true), f.hp + x, true)
            }
            m = x;
       //     console.log("- copyData() m",m, "r.roffset", f.roffset)
            n -= m;
            f.hp += m;
       //     console.log("- copyData() n",n, "f.hp", f.hp, "len(f.hist)", f.hist.length)
            if (f.hp == f.hist.length) {
                f.copyLen = n;
       //         console.log("copyData() FLUSH")
                f.flush(f.copyData);
                return;
            }
        }
        f.step = f.nextBlock;
    };

    this.setDict = function(/*Buffer*/dict) {
        if (dict.length > f.hist.length) {
            dict = dict.slice(dict.length - f.hist.length);
        }
        f.hp = dict.copy(f.hist, 0);
        if (f.hp == f.hist.length) {
            f.hp = 0;
            f.hfull = true;
        }
        f.hw = f.hp;
    };

    this.moreBits = function() {
        var c = f.r.readUInt8(f.roffset++);
        f.b |= c << f.nb;
        f.nb += 8;
        return "";
    };

    this.huffSym = function(h) {
        var n = h.min;
        while (true) {
            while (f.nb < n) {
                var err = f.moreBits();
                if (err) {
                    return 0;
                }
            }
            var chunk = h.chunks[f.b & (huffmanNumChunks - 1)];
            n = chunk & huffmanCountMask;
            if (n > huffmanChunkBits) {
                chunk = h.links[chunk >> huffmanValueShift][(f.b >> huffmanChunkBits) & h.linkMask]
                n = chunk & huffmanCountMask;
                if (n == 0) {
                    f.err = "Corrupted input";
                    return 0;
                }
            }
            if (n <= f.nb) {
                f.b >>= n;
                f.nb -= n;
                return chunk >> huffmanValueShift;
            }
        }
    };

    this.flush = function(step) {
       // console.log("flush() f.hw", f.hw, "f.hp", f.hp)
        f.toRead = f.hist.slice(f.hw, f.hp);
        f.woffset += f.hp - f.hw;
        f.hw = f.hp;
       // console.log("flush() f.woffset", f.woffset, "f.hw", f.hw)
        if (f.hp == f.hist.length) {
            f.hp = 0;
            f.hw = 0;
            f.hfull = true;
           // console.log("flush() full")
        }
        f.step = step;
    };

    // Next step in the decompression,
    // and decompression state.
    this.step = this.nextBlock;
}