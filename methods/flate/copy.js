// targetBuffer, [targetStart], [sourceStart], [sourceEnd]
module.exports.forwardCopy = function (mem, dst, src, n) {
   // var dest = mem.slice(dst, dst + n),
   //     source = mem.slice(src, src + n);

    if (dst <= src) {
        mem.copy(mem, dst, src, src + n);
        return
    }
    while (true) {
        if (dst >= src + n) {
            mem.copy(mem, dst, src, src + n);
            return
        }
        var k = dst - src;

        mem.copy(mem, dst, src, src + k);
        n -= k;
        dst += k
    }
};