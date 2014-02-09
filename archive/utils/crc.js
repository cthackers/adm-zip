var crc32Table = [];

module.exports.CRC32 = function() {

    if (crc32Table.length == 0) {
        for (var i = 0; i < 256; i++) {
            var crc = i;
            for (var j = 0; j < 8; j++) {
                if ((crc&1) == 1) {
                    crc = (crc >> 1) ^ 0xedb88320
                } else {
                    crc >>= 1
                }
            }
            crc32Table[i] = crc
        }
    }


};


