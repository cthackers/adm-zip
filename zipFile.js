var Inflater = require('./inflater').Inflater;
    Deflater = require("./deflater").Deflater;
    ZipEntry = require("./zipEntry").ZipEntry;
    ZipConstants = require("./zipConstants").ZipConstants;


exports.ZipFile = function(/*Buffer*/buf) {
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

            var tmp = index,
                entry = new ZipEntry();

            entry.header = buf.slice(tmp, tmp += ZipConstants.CENHDR);
            entry.entryName = buf.toString('utf8', tmp, tmp += entry.header.fileNameLength);

            if (entry.header.extraLength)
                entry.extra = buf.slice(tmp, tmp += entry.header.extraLength);

            if (entry.header.commentLength)
                entry.comment = buf.toString('utf8', tmp, tmp + entry.header.commentLength);

            index += entry.header.entryHeaderSize;

            // read data
            entry.compressedData = buf.slice(entry.header.offset, entry.header.offset + entry.header.compressedSize);

            entryList[i] = entry;
            entryTable[entry.entryName] = entry;
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
        getEntryChildren : function(/*ZipEntry*/entry) {
            if (entry.isDirectory) {
                var list = [],
                    name = entry.entryName,
                    len = name.length;

                entryList.forEach(function(zipEntry) {
                    if (zipEntry.entryName.substr(0, len) == name) {
                        list.push(zipEntry);
                    }
                });
                return list;
            }
            return []
        },
        getInput : function(/*ZipEntry*/entry) {
            var index = entry.offset + 28;
            index += entry.entryName.length + 2;
            var tempBuff = new Buffer(entry.compressedSize);
            if (entry.compressedSize > 0) {
                buf.copy(tempBuff, 0, index, index + entry.compressedSize);
            }
            switch(entry.method) {
                case ZipConstants.STORED: // STORED
                    return tempBuff;
                    break;
                case ZipConstants.DEFLATED: // DEFALATED
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
