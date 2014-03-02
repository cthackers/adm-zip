var crc32Table = [];

module.exports.CRC32 = function(data) {
    if (crc32Table.length == 0) {
        var c;
        for(var n = 0; n < 256; n++){
            c = n;
            for(var k =0; k < 8; k++){
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crc32Table[n] = c;
        }
    }
    var sum = 0 ^ (-1);
    i = 0;
    for (var len = data.length; i < len; i++) {
        sum = (sum >>> 8) ^ crc32Table[(sum ^ data[i]) & 0xFF];
    }
    return (sum ^ (-1)) >>> 0;
};


