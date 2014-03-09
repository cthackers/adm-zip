var compressor = require("./deflate").compressor,
    decompressor = require("./inflate").decompressor,
    Writer = require("../../utils").Writer;

var deflateTests = [
    [new Buffer(0), 0, new Buffer([1, 0, 0, 255, 255])],
    [new Buffer([0x11]), -1, new Buffer([18, 4, 4, 0, 0, 255, 255])],
    [new Buffer([0x11]), 4, new Buffer([18, 4, 4, 0, 0, 255, 255])],

    [new Buffer([0x11]), 0, new Buffer([0, 1, 0, 254, 255, 17, 1, 0, 0, 255, 255])],
    [new Buffer([0x11, 0x12]), 0, new Buffer([0, 2, 0, 253, 255, 17, 18, 1, 0, 0, 255, 255])],
    [new Buffer([0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11]), 0, new Buffer([0, 8, 0, 247, 255, 17, 17, 17, 17, 17, 17, 17, 17, 1, 0, 0, 255, 255])],
    [new Buffer([]), 1, new Buffer([1, 0, 0, 255, 255])],
    [new Buffer([0x11]), 1, new Buffer([18, 4, 4, 0, 0, 255, 255])],
    [new Buffer([0x11, 0x12]), 1, new Buffer([18, 20, 2, 4, 0, 0, 255, 255])],

    [new Buffer([0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11]), 1, new Buffer([18, 132, 2, 64, 0, 0, 0, 255, 255])],

    [new Buffer([]), 9, new Buffer([1, 0, 0, 255, 255])],
    [new Buffer([0x11]), 9, new Buffer([18, 4, 4, 0, 0, 255, 255])],
    [new Buffer([0x11, 0x12]), 9, new Buffer([18, 20, 2, 4, 0, 0, 255, 255])],
    [new Buffer([0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11]), 9, new Buffer([18, 132, 2, 64, 0, 0, 0, 255, 255])]
];

var deflateInflateTests = [
    new Buffer(0),
    new Buffer([0x11]),
    new Buffer([0x11, 0x12]),
    new Buffer([0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11]),
    new Buffer([0x11, 0x10, 0x13, 0x41, 0x21, 0x21, 0x41, 0x13, 0x87, 0x78, 0x13]),
   // largeDataChunk()
];

var reverseBitsTests = [
    [1, 1, 1],
    [1, 2, 2],
    [1, 3, 4],
    [1, 4, 8],
    [1, 5, 16],
    [17, 5, 17],
    [257, 9, 257],
    [29, 5, 23]
];

function largeDataChunk() {
    var buf = new Buffer(100000);
    for (var i = 0; i < 100000; i++) {
        buf[i] = i * i & 0xFF
    }
    return buf
}

function testDeflate() {
    for (var i = 0; i < deflateTests.length; i++) {
        var h = deflateTests[i],
            buf = new Writer(),
            w = compressor(buf, h[1]);

        w.Write(h[0]);
        w.Close();

        if (buf.buffer.toString('hex') != h[2].toString('hex')) {
            console.log("Deflate (%d, %s) = %s, want %s", h[1], h[0].toString('hex'), buf.buffer.toString('hex'), h[2].toString('hex'));
            return false
        }
    }
    return true;
}

function testToFromWithLevelAndLimit(level, input, name, limit) {
    var buf = new Writer(),
        w = compressor(buf, level);

    w.Write(input);
    w.Close();

    if (limit > 0 && buf.length > limit) {
        console.log("level: " + level + ", len(compress(data)) = "+ buf.length + " > limit = "+ limit);
        return false;
    }
    var r = new decompressor(buf.buffer),
        data;

    if (Buffer.isBuffer(r)) {
        data = r
    } else {
        data = new Buffer(input.length);
        var tmp = new Buffer(512),
            count = 0,
            read = 0;

        while (read = r.Read(tmp)) {
            tmp.copy(data, count, 0, read);
            count += read;
        }
        r.Close();
    }

    if (data.toString('hex') != input.toString('hex')) {
        console.log("decompress(compress(data)) != data: level=" + level + " input=" + name);
        return false;
    }

    return true;
}

function testDeflateInflate() {
    for (var i = 0; i < deflateInflateTests.length; i++) {
        var h = deflateInflateTests[i],
            name = "#" + i,
            limit = new Array(10);

        for (var j = 0; j < 10; j++) {
            limit[j] = 0;
            if (!testToFromWithLevelAndLimit(j, h, name, limit[j])) {
                return false;
            }
        }
    }
    return true;
}

function testReverseBits() {
    for (var i = 0; i < reverseBitsTests.length; i++) {
        var h = reverseBitsTests[i],
            reverseBits = require("./reverse_bits"),
            v = reverseBits(h[0], h[1]);
        if  (v != h[2]) {
            console.log("reverseBits("+ h[0] +"," + h[1] + ") = " + v + ", want " + h[2]);
            return false;
        }
    }
    return true;
}

function fail(name, expected, returned) {
    console.log("expected ",name," '", expected, "' got '",returned,"'");
    return false;
}

module.exports.run = function () {
    if (!testReverseBits()) {
        console.log("testReverseBits failed");
        return false
    }
    if (!testDeflate()) {
        console.log("testDeflate failed");
        return false
    }
    if (!testDeflateInflate()) {
        console.log("testDeflateInflate failed");
        return false
    }
    return true;
};