exports.Inflater = function(/*Buffer*/inbuf) {
    var MAXBITS = 15, MAXLCODES = 286, MAXDCODES = 30, MAXCODES = 316, FIXLCODES = 288,
        LENS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258],
        LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0],
        DISTS = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577],
        DEXT = [ 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13],
        inbufpos = 0,
        incnt = 0,  // bytes read so far
        bitbuf = 0, // bit buffer
        bitcnt = 0, // number of bits in bit buffer
        lencode = undefined,
        distcode = undefined;

    function bits(need) {
        var val = bitbuf;
        while(bitcnt < need) {
            if (incnt == inbuf.length) throw 'available inflate data did not terminate';
            val |= inbuf[incnt++] << bitcnt;
            bitcnt += 8;
        }
        bitbuf = val >> need;
        bitcnt -= need;
        return val & ((1 << need) - 1);
    }

    function construct(h, length, n) {
        var offs = new Array();
        for (var len = 0; len <= MAXBITS; len++) h.count[len] = 0;
        for (var symbol = 0; symbol < n; symbol++) h.count[length[symbol]]++;
        if(h.count[0] == n) return 0;
        var left = 1;
        for(len = 1; len <= MAXBITS; len++) {
            left <<= 1;
            left -= h.count[len];
            if(left < 0) return left;
        }
        offs[1] = 0;
        for(len = 1; len < MAXBITS; len++) offs[len + 1] = offs[len] + h.count[len];
        for(symbol = 0; symbol < n; symbol++)
            if(length[symbol] !== 0) h.symbol[offs[length[symbol]]++] = symbol;
        return left;
    }

    function decode(h) {
        var code = 0, first = 0, index = 0;
        for(var len = 1; len <= MAXBITS; len++) {
            code |= bits(1);
            var count = h.count[len];
            if(code < first + count) return h.symbol[index + (code - first)];
            index += count;
            first += count;
            first <<= 1;
            code <<= 1;
        }
        return -9; // ran out of codes
    }

    function codes(buf) {
        var i = 0;
        do {
            var symbol = decode(lencode);
            if(symbol < 0) return symbol;
            if(symbol < 256) {
                buf[i++] = symbol;
            }
            else if(symbol > 256) {
                symbol -= 257;
                if(symbol >= 29)
                    throw "invalid literal/length or distance code in fixed or dynamic block";
                var len = LENS[symbol] + bits(LEXT[symbol]);
                symbol = decode(distcode);
                if(symbol < 0) return symbol;
                var dist = DISTS[symbol] + bits(DEXT[symbol]);
                /*if(dist > i)
                 throw "distance is too far back in fixed or dynamic block";*/
                while(len--)
                    buf[i++] = buf[i - dist - 1];
            }
        } while (symbol != 256);
        return 0;
    }

    function stored(buf) {
        bitbuf = 0;
        bitcnt = 0;
        if(incnt + 4 > inbuf.length) throw 'available inflate data did not terminate';
        var len = inbuf[incnt++];
        len |= inbuf[incnt++] << 8;
        if(inbuf[incnt++] != (~len & 0xff) || inbuf[incnt++] != ((~len >> 8) & 0xff))
            throw "stored block length did not match one's complement";
        if(incnt + len > inbuf.length) throw 'available inflate data did not terminate';
        var i = 0;
        while(len--) buf[i++] +=  inbuf[incnt++];
    }

    function constructFixedTables() {
        var lengths = new Array();
        for(var symbol = 0; symbol < 144; symbol++) lengths[symbol] = 8;
        for(; symbol < 256; symbol++) lengths[symbol] = 9;
        for(; symbol < 280; symbol++) lengths[symbol] = 7;
        for(; symbol < FIXLCODES; symbol++) lengths[symbol] = 8;
        construct(lencode, lengths, FIXLCODES);
        for(symbol = 0; symbol < MAXDCODES; symbol++) lengths[symbol] = 5;
        construct(distcode, lengths, MAXDCODES);
    }

    function constructDynamicTables() {
        var lengths = new Array(),
            order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
            nlen = bits(5) + 257,
            ndist = bits(5) + 1,
            ncode = bits(4) + 4;
        if(nlen > MAXLCODES || ndist > MAXDCODES) throw "dynamic block code description: too many length or distance codes";
        for(var index = 0; index < ncode; index++) lengths[order[index]] = bits(3);
        for(; index < 19; index++) lengths[order[index]] = 0;
        var err = construct(lencode, lengths, 19);
        if(err !== 0) throw "dynamic block code description: code lengths codes incomplete";
        index = 0;
        while(index < nlen + ndist) {
            var symbol = decode(lencode), len;
            if(symbol < 16) lengths[index++] = symbol;
            else {
                len = 0;
                if(symbol == 16) {
                    if(index === 0) throw "dynamic block code description: repeat lengths with no first length";
                    len = lengths[index - 1];
                    symbol = 3 + bits(2);
                }
                else if(symbol == 17) symbol = 3 + bits(3);
                else symbol = 11 + bits(7);
                if(index + symbol > nlen + ndist)
                    throw "dynamic block code description: repeat more than specified lengths";
                while(symbol--) lengths[index++] = len;
            }
        }

        err = construct(lencode, lengths, nlen);
        if(err < 0 || (err > 0 && nlen - lencode.count[0] != 1)) throw "dynamic block code description: invalid literal/length code lengths";
        err = construct(distcode, lengths.slice(nlen), ndist);
        if(err < 0 || (err > 0 && ndist - distcode.count[0] != 1)) throw "dynamic block code description: invalid distance code lengths";
        return err;
    }

    return {
        inflate : function(/*Buffer*/outputBuffer) {
            incnt = bitbuf = bitcnt = 0;
            var err = 0;
            do {
                var last = bits(1);
                var type = bits(2);
                if(type === 0) stored(outputBuffer); // uncompressed block
                else if(type == 3) throw 'invalid block type (type == 3)';
                else { // compressed block
                    lencode = {count:[], symbol:[]};
                    distcode = {count:[], symbol:[]};
                    if(type == 1) constructFixedTables();
                    else if(type == 2) err = constructDynamicTables();
                    if(err !== 0) return err;
                    err = codes(outputBuffer);
                }
                if(err !== 0) break;
            } while (!last);
            return err;
        }
    }
};