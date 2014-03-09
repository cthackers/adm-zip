var copy = require("../../utils").copy;

// targetBuffer, [targetStart], [sourceStart], [sourceEnd]
module.exports.forwardCopy = function (mem, dst, src, n) {
    if (dst <= src) {
        copy(mem, dst, dst+n, mem, src, src + n);
        return
    }
    while (true) {
        if (dst >= src + n) {
            copy(mem, dst, dst + n, mem, src, src + n);
            return
        }
        var k = dst - src;
        copy(mem, dst, dst + k, mem, src, src + k);
        n -= k;
        dst += k
    }
};