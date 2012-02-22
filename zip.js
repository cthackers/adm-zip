var fs = require("fs");

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

var ZipEntry = function(/*String*/name) {
    console.log("zip entry:",name);
     var _name = name,
         dostime = 0;
    return {
        get name () {
            return _name;
        },
        get time () {
            new Date(((dostime >> 25) & 0x7f) + 1980,((dostime >> 21) & 0x0f) - 1,(dostime >> 16) & 0x1f,(dostime >> 11) & 0x1f,(dostime >> 5) & 0x3f,(dostime & 0x1f) << 1).getTime();
        },
        set time(/*Number*/val) {
            var d = new Date(val);
            dostime = (d.getFullYear() - 1980 & 0x7f) << 25 | (d.getMonth() + 1) << 21 | d.getDay() << 16 | d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
        },
        get isDirectory () {
            return _name.charAt(_name.length - 1) == "/";
        },
        size : 0,
        compressedSize : 0,
        crc : 0,
        method : 0,
        extra : null,
        comment : '',
        flags : 0,
        version : 0,
        offset : 0
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
                console.log(i,"readEntries::Invalid CEN header (bad signature)", tmpBuff.toString());
                //throw new Error("readEntries::Invalid CEN header (bad signature)");
            }
            // handle filename
            var len = tmpBuff.readUInt16LE(ZipConstants.CENNAM); // 28
            if (len === 0) {
                console.log(i,"Missing entry name");
                //throw new Error("Missing entry name");
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
            entry.flag = tmpBuff.readUInt16LE(8);
            if ((entry.flag & 1) == 1) {
                console.log("readEntries::Encrypted ZIP entry not supported");
                throw new Error("readEntries::Encrypted ZIP entry not supported");
            }
            entry.method = tmpBuff.readUInt16LE(10);
            entry.time = tmpBuff.readUInt32LE(12);
            entry.crc = tmpBuff.readUInt32LE(16);
            entry.compressedSize = tmpBuff.readUInt32LE(20);
            entry.size = tmpBuff.readUInt32LE(24);
            entry.offset = tmpBuff.readUInt32LE(42);
            entryList[i] = entry;
            entryTable[entry.name] = entry;
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
        throw new Error("findEnd::Invalid zip");
    }

    return {
        get entries () {
            return entryList;
        },
        get size () {
            return entryList.length;
        },
        getEntry : function(/*String*/name) {
            return entryTable[name];
        },
        getInput : function(/*ZipEntry*/entry) {
            switch(entry.method) {
                case 0: // STORED
                    var index = entry.offset + 28;
                    index += entry.name.length + 2;
                    var tempBuff = new Buffer(entry.compressedSize);
                    if (entry.compressedSize > 0) {
                        buf.copy(tempBuff, 0, index, index + entry.compressedSize);
                    }
                    return tempBuff;
                    break;
                case 8: // DEFALATED
                    console.log("inflate");
                    break;
                default:
                    console.log("zipEntry::getInput::Invalid compression method");
                    // throw new Error("zipEntry::getInput::Invalid compression method");
                    break;
            }
        }
    }
};

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

    return {
        getFile : function(/*String*/path) {
            if (path && _zip) {
                var entry = _zip.getEntry(path);
                if (entry) {
                    return _zip.getInput(entry)
                }
            }
            return null;
        },

        deleteFile : function(/*String*/path) {

        },

        addComment : function(/*String*/comment) {
            throw Error("Not yet implemented!");
        },

        getComment : function() {
            throw Error("Not yet implemented!");
        },

        updateFile : function(/*String*/path, /*Buffer*/content) {
            throw Error("Not yet implemented!");
        },

        addFile : function(/*String*/path) {
             throw Error("Not yet implemented!");
        },

        addFiles : function(/*Array*/paths) {
            throw Error("Not yet implemented!");
        },

        getEntries : function() {
            if (_zip) {
               return _zip.entries;
            } else {
                return [];
            }
        },

        extract : function(/*String*/path, /*Number*/rules) {
            /*Possible values:
            EXTR_OVERWRITE - Default. On collision, the existing file is overwritten
            EXTR_SKIP - On collision, the existing file is skipped
            */
            throw Error("Not yet implemented!");
        },

        writeZip : function(/*String*/outFilename) {
            throw Error("Not yet implemented!");
        }
    }
};
