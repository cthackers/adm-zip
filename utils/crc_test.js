var CRC32 = require("./crc").CRC32;

var tests = [
    {crc : 0x00000000, data : ""},
    {crc : 0x414FA339, data : new Buffer("The quick brown fox jumps over the lazy dog")},
    {crc : 0xE8B7BE43, data : new Buffer("a")},
    {crc : 0x352441C2, data : new Buffer("abc")},
    {crc : 0x20159D7F, data : new Buffer("message digest")},
    {crc : 0x4C2750BD, data : new Buffer("abcdefghijklmnopqrstuvwxyz")},
    {crc : 0x1FC2E6D2, data : new Buffer("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")},
    {crc : 0xF8C05F58, data : new Buffer("1234567890123456789012345678901234567890123456789")},
    {crc : 0x1F61E4E0, data : new Buffer("FFFFFFFFFFFFFFFFFFFFFFFFFFF")}
];

module.exports.run = function() {
    for (var i = 0; i < tests.length; i++) {
        var test  = tests[i],
            crc = CRC32(test.data);

        if (crc != test.crc) {
            console.log("Invalid CRC value. Got",crc,"expected",test.crc, "("+test.data+")");
            return false
        }
    }
    return true
};
