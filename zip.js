var fs = require("fs"),
    pth = require('path');

var ZipConstants = {
    LOCSIG: 0x04034b50,	// "PK\003\004"
    LOCHDR: 30,	// LOC header size
    LOCVER: 4,	// version needed to extract
    LOCNAM: 26, // filename length
    EXTSIG: 0x08074b50,	// "PK\007\008"
    EXTHDR: 16,	// EXT header size
    CENSIG: 0x02014b50,	// "PK\001\002"
    CENHDR: 46,	// CEN header size
    CENVER: 6, // version needed to extract
    CENNAM: 28, // filename length
    CENEXT: 30, // extra field length
    CENOFF: 42, // LOC header offset
    ENDSIG: 0x06054b50,	// "PK\005\006"
    ENDHDR: 22, // END header size
    ENDTOT: 10,	// total number of entries
    ENDOFF: 16, // offset of first CEN header
    STORED: 0,
    DEFLATED: 8
};

var Inflater = function(/*Buffer*/inbuf) {
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
        inflate : function(buf) {
            incnt = bitbuf = bitcnt = 0;
            var err = 0;
            do {
                var last = bits(1);
                var type = bits(2);
                if(type === 0) stored(buf); // uncompressed block
                else if(type == 3) throw 'invalid block type (type == 3)';
                else { // compressed block
                    lencode = {count:[], symbol:[]};
                    distcode = {count:[], symbol:[]};
                    if(type == 1) constructFixedTables();
                    else if(type == 2) err = constructDynamicTables();
                    if(err !== 0) return err;
                    err = codes(buf);
                }
                if(err !== 0) break;
            } while (!last);
            return err;
        }
    }
};

var ZipEntry = function ZipEntry(/*String*/entryName) {
     var _entryName = entryName,
         dostime = 0;

    return {
        get entryName () {
            return _entryName;
        },
        get name () {
            return _entryName.split("/").pop();
        },
        get time () {
            return new Date(((dostime >> 25) & 0x7f) + 1980,((dostime >> 21) & 0x0f) - 1,(dostime >> 16) & 0x1f,(dostime >> 11) & 0x1f,(dostime >> 5) & 0x3f,(dostime & 0x1f) << 1).getTime();
        },
        set time(/*Number*/val) {
            var d = new Date(val);
            dostime = (d.getFullYear() - 1980 & 0x7f) << 25 | (d.getMonth() + 1) << 21 | d.getDay() << 16 | d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
        },
        get isDirectory () {
            return _entryName.charAt(_entryName.length - 1) == "/";
        },
        size : 0,
        compressedSize : 0,
        crc : 0,
        method : 0,
        extra : null,
        comment : '',
        flags : 0,
        version : 0,
        offset : 0,

        toString : function() {
            return '{\n' +
                '\t"entryName" : "' + _entryName + '",\n' +
                '\t"name" : "' + this.name + '",\n' +
                '\t"isDirectory" : ' + (this.isDirectory ? "true" : "false") + ",\n" +
                '\t"mtime" : ' + new Date(this.time).toLocaleString() + ",\n" +
                '\t"size" : ' + this.size + ",\n" +
                '\t"compressedSize" : ' + this.compressedSize + ",\n" +
                '\t"crc" : 0x' + this.crc.toString(16).toUpperCase() + ",\n" +
                '\t"method" : ' + this.method + " (" + ({0:"store",8:"deflate"}[this.method] || 'unknown') +")" + ",\n" +
                '\t"comment" : "' + this.comment + '"' + ",\n" +
                '\t"flags" : ' + this.flags + ",\n" +
                '\t"version" : ' + this.version + "\n" +
                '}';
        }
    }
};

var ZipFile = function(/*Buffer*/buf) {
    var entryList = [],
        entryTable = {},
        index = 0;

    readEntries();

    function readEntries() {
        entryTable = {};
        var endLoc = findEnd();
        entryList = new Array(buf.readUInt16LE(endLoc + ZipConstants.ENDTOT));  // total number of entries
        index = buf.readUInt32LE(endLoc + ZipConstants.ENDOFF);  // offset of first CEN header

        for(var i = 0; i < entryList.length; i++) {
            var tmpBuff = new Buffer(ZipConstants.CENHDR);
            buf.copy(tmpBuff, 0, index, index + ZipConstants.CENHDR);
            index += ZipConstants.CENHDR;

            if (tmpBuff.readUInt32LE(0) != ZipConstants.CENSIG) {
                throw "readEntries::Invalid CEN header (bad signature)";
            }
            // handle filename
            var len = tmpBuff.readUInt16LE(ZipConstants.CENNAM); // 28
            if (len === 0) {
                throw "Missing entry name";
            }

            var entry = new ZipEntry(buf.toString('utf8', index, index + len));
            index += len;

            // handle extra field
            len = tmpBuff.readUInt16LE(ZipConstants.CENEXT);
            if(len > 0) {
                entry.extra = new Buffer(len);
                buf.copy(entry.extra, 0, index, index + len);
                index += len;
            }
            // handle file comment
            index += tmpBuff.readUInt16LE(32);
            // now get the remaining fields for the entry
            entry.version = tmpBuff.readUInt16LE(ZipConstants.CENVER);
            entry.flags = tmpBuff.readUInt16LE(8);
            if ((entry.flags & 1) == 1) {
                throw "readEntries::Encrypted ZIP entry not supported";
            }
            entry.method = tmpBuff.readUInt16LE(10);
            entry.time = tmpBuff.readUInt32LE(12);
            entry.crc = tmpBuff.readUInt32LE(16);
            entry.compressedSize = tmpBuff.readUInt32LE(20);
            entry.size = tmpBuff.readUInt32LE(24);
            entry.offset = tmpBuff.readUInt32LE(42);
            entryList[i] = entry;
            entryTable[entry.entryName] = entry;
            delete(tmpBuff)
        }
    }

    function findEnd() {
        var i = buf.length - ZipConstants.ENDHDR, // END header size
            n = Math.max(0, i - 0xFFFF); // 0xFFFF is the max zip file comment length
        for (i; i >= n; i--) {
            if (buf[i] != 0x50) continue; // quick check that the byte is 'P'
            if (buf.readUInt32LE(i) == ZipConstants.ENDSIG) { // "PK\005\006"
                return i;
            }
        }
        throw "findEnd::Invalid zip";
    }

    return {
        get entries () {
            return entryList;
        },
        get size () {
            return entryList.length;
        },
        getEntry : function(/*String*/entryName) {
            return entryTable[entryName];
        },
        getInput : function(/*ZipEntry*/entry) {
            var index = entry.offset + 28;
            index += entry.entryName.length + 2;
            var tempBuff = new Buffer(entry.compressedSize);
            if (entry.compressedSize > 0) {
                buf.copy(tempBuff, 0, index, index + entry.compressedSize);
            }
            switch(entry.method) {
                case 0: // STORED
                    return tempBuff;
                    break;
                case 8: // DEFALATED
                    var b2 = new Buffer(entry.size);
                    b2.fill(0x00);
                    new Inflater(tempBuff).inflate(b2);
                    return b2;
                    break;
                default:
                    throw "zipEntry::getInput::Invalid compression method";
                    break;
            }
        }
    }
};

var Utils = (function() {

    function mkdirSync(path) {
        var curesolvedPath = path.split('\\')[0];
        path.split('\\').forEach(function(name) {
            if (!name || name.substr(-1,1) == ":") return;
            curesolvedPath += '\\' + name;
            var stat;
            try {
                stat = fs.statSync(curesolvedPath);
            } catch (e) {
                fs.mkdirSync(curesolvedPath);
            }
            if (stat && stat.isFile())
                throw 'There is a file in the way: ' + curesolvedPath;
        });
    }

    return {
        makeDir : function(path) {
            mkdirSync(path);
        }
    }

})();

exports.Zip = function(/*String*/inPath) {

    var _zip = undefined;

    if (inPath && typeof inPath === "string") {
        try {
            fs.lstatSync(inPath);
            _zip = new ZipFile(fs.readFileSync(inPath));
        } catch(e) {
            // file doesn't exist
        }
    }

    function getEntry(/*Object*/entry) {
        if (entry && _zip) {
            var item;
            // If entry was given as a file name
            if (typeof entry === "string")
                item = _zip.getEntry(entry);
            // if entry was given as a ZipEntry object
            if (typeof entry === "object" && entry.entryName != undefined && entry.offset != undefined)
                item =  _zip.getEntry(entry.entryName);

            if (item) {
                return item;
            }
        }
        return null;
    }

    function getEntryChildren(/*ZipEntry*/entry) {
        if (entry && _zip && entry.isDirectory) {
            var list = [],
                name = entry.entryName;
                len = name.length;

            _zip.entries.forEach(function(zipEntry) {
                if (zipEntry.entryName.substr(0, len) == name) {
                    list.push(zipEntry);
                }
            });
            return list;
        }
        return []
    }


    function writeFileTo(/*String*/path, /*Buffer*/content, /*Boolean*/overwrite) {
        if (pth.existsSync(path)) {
            if (!overwrite)
                return false; // cannot overwite
            var stat = fs.statSync(path);
            if (stat.isDirectory()) {
                return false;
            }
        }
        var folder = pth.dirname(path);
        if (!pth.existsSync(folder)) {
            Utils.makeDir(folder);
        }

        var fd;
        try {
            fd = fs.openSync(path, 'w', 0666);
        } catch(e) {
            fs.chmodSync(path, 0666);
            fd = fs.openSync(path, 'w', 0666);
        }
        if (fd) {
            fs.writeSync(fd, content, 0, content.length, 0);
            fs.closeSync(fd);
        }
    }

    return {
        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param entry ZipEntry object or String with the full path of the entry
         *
         * @return Buffer or Null in case of error
         */
        readFile : function(/*Object*/entry) {
            var item = getEntry(entry);
            return item && _zip.getInput(item) || null;
        },
        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param entry ZipEntry object or String with the full path of the entry
         * @param encoding If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText : function(/*Object*/entry, /*String - Optional*/encoding) {
            var item = getEntry(entry);
            if (item) {
                var data = _zip.getInput(item);
                if (data) {
                    return data.toString(encoding || "utf8");
                }
            }
            return "";
        },

        deleteFile : function(/*String*/entry, /*Boolean*/writeZip) {
            throw "Not yet implemented!";
        },

        addZipComment : function(/*String*/comment, /*Boolean*/writeZip) {
            throw "Not yet implemented!";
        },

        getZipComment : function() {
            throw "Not yet implemented!";
        },

        addFileComment : function(/*Object*/entry, /*String*/comment, /*Boolean*/writeZip) {
            throw "Not yet implemented!";
        },

        updateFile : function(/*Object*/entry, /*Buffer*/content, /*Boolean*/writeZip) {
            throw "Not yet implemented!";
        },

        addLocalFile : function(/*String*/localPath, /*Boolean*/writeZip) {
             throw "Not yet implemented!";
        },

        addFile : function(/*String*/entryName, /*Buffer*/content, /*Boolean*/writeZip) {
            throw "Not yet implemented!";
        },

        /**
         * Returns an array of ZipEntry objects representing the files and folders inside the archive
         *
         * @return Array
         */
        getEntries : function() {
            if (_zip) {
               return _zip.entries;
            } else {
                return [];
            }
        },

        /**
         * Extracts the given entry to the given targetPath
         * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
         *
         * @param entry ZipEntry object or String with the full path of the entry
         * @param targetPath Target folder where to write the file
         * @param maintainEntryPath If full path is true and the entry is inside a folder, the entry folder
         *                          will be created in targetPath as well. Default is TRUE
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         *
         * @return Boolean
         */
        extractEntryTo : function(/*Object*/entry, /*String*/targetPath, /*Boolean*/maintainEntryPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;
            maintainEntryPath = typeof maintainEntryPath == "undefned" ? true : maintainEntryPath;

            var item = getEntry(entry);
            if (!item) {
                throw "Given entry doesn't exist";
            }

            var target = pth.resolve(targetPath, maintainEntryPath ? item.entryName : pth.basename(item.entryName));

            if (item.isDirectory) {
                target = pth.resolve(target, "..");
                var children = getEntryChildren(item);
                children.forEach(function(child) {
                    if (child.isDirectory) return;
                    var content = _zip.getInput(child);
                    if (!content) throw "Could not extract the file";
                    writeFileTo(pth.resolve(targetPath, maintainEntryPath ? child.entryName : child.entryName.substr(item.entryName.length)), content, overwrite);
                })
            }

            var content = _zip.getInput(item);
            if (!content) throw "Could not extract the file";

            if (pth.existsSync(targetPath) && !overwrite) {
                throw "target file already exists";
            }
            writeFileTo(target, content, overwrite);

            return true;
        },

        extractAllTo : function(/*String*/targetPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;

        },

        writeZip : function(/*String*/targetFileName) {
            throw "Not yet implemented!";
        }
    }
};
