var compressor = require("./deflate").compressor;

var deflateTests = [
    [new Buffer(0), 0, new Buffer([1, 0, 0, 255, 255])],
    [new Buffer([0x11]), -1, new Buffer([18, 4, 4, 0, 0, 255, 255])],
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
    largeDataChunk()
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
            buf = require("../../utils").Writer(),
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

function testDeflateInflate() {

}

function testReverseBits() {

}

module.exports.run = function () {
    if (!testDeflate()) {
        return false
    }
    return true;
};