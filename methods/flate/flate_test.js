var decompressor = require("./inflate").decompressor,
    HuffmanDecoder = require("./inflate").HuffmanDecoder;

function testUncompressedSource() {
    var r = new decompressor(new Buffer([0x01, 0x01, 0x00, 0xfe, 0xff, 0x11])),
        output = new Buffer(1);

    r.Read(output);

    if (output.length != 1) {
        console.log("decompressor.Read() = " + output.length + ", want 1")
    }
    if (output[0] != 0x11) {
        console.log("output[0] = " + output[0] + ", want 0x11")
    }
    return true
}

var badBits = [
    {
        expected: false,
        bits: [4, 0, 0, 6, 4, 3, 2, 3, 3, 4, 4, 5, 0, 0, 0, 0, 5, 5, 6,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 8, 6, 0, 11, 0, 8, 0, 6, 6, 10, 8]
    },
    {
        expected: false,
        bits: [4, 0, 0, 6, 4, 3, 2, 3, 3, 4, 4, 5, 0, 0, 0, 0, 5, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11]
    },
    {
        expected: true,
        bits: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11]
    },
    {
        expected: false,
        bits: [11, 13]
    }
];

function testIssues() {
    for (var i = 0; i < badBits.length; i++) {
        var test = badBits[i],
            bits = badBits[i].bits,
            h = new HuffmanDecoder();
    }
    var ok = h.init(bits);
    if (ok != test.expected) {
        console.log("Given sequence of bits should have returned " + test.expected.toString());
        return false;
    }
    return true
}

module.exports.run = function () {
    return !(!testUncompressedSource() || !testIssues());
};