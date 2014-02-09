const
    offsetCodeCount = 30,
    endBlockMarker = 256,
    lengthCodesStart = 257,
    codegenCodeCount = 19,
    badCode          = 255;

var lengthExtraBits = [
        /* 257 */
        0, 0, 0,
        /* 260 */
        0, 0, 0, 0, 0, 1, 1, 1, 1, 2,
        /* 270 */
        2, 2, 2, 3, 3, 3, 3, 4, 4, 4,
        /* 280 */
        4, 5, 5, 5, 5, 0
    ],
    lengthBase = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
        12, 14, 16, 20, 24, 28, 32, 40, 48, 56,
        64, 80, 96, 112, 128, 160, 192, 224, 255
    ],
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
    codegenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

module.exports = function() {
    var
        bits  = 0,
        nbits = 0,
        bytes = new Array(64),
        nbytes = 0,
        literalFreq = [],
        offsetFreq = [],
        codegen = [],
        codegenFreq = [];

    return {

    }
};