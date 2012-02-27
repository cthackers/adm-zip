var Inflater = require('./inflater').Inflater;
    Deflater = require("./deflater").Deflater;
    ZipEntry = require("./zipEntry").ZipEntry;
    ZipConstants = require("./zipConstants").ZipConstants;


exports.ZipFile = function(/*Buffer*/buf) {
    var entryList = [],
        entryTable = {},
        _comment = '',
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

            if (!entry.isDirectory) {
                // read data
                entry.compressedData = buf.slice(entry.header.offset, entry.header.offset + ZipConstants.LOCHDR + entry.header.compressedSize + entry.entryName.length);
            }

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
        get comment () {
            return _comment;
        },
        set comment(val) {
            _comment = val;
        },
        getEntry : function(/*String*/entryName) {
            return entryTable[entryName];
        },
        setEntry : function(/*ZipEntry*/entry) {
            entryList.push(entry);
            entryTable[entry.entryName] = entry;
        },
        deleteEntry : function(/*String*/entryName) {
            var entry = entryTable[entryName];
            if (entry && entry.isDirectory) {
                var _self = this;
                this.getEntryChildren(entry).forEach(function(child) {
                    if (child.entryName != entryName) {
                        _self.deleteEntry(child.entryName)
                    }
                })
            }
            entryList.slice(entryList.indexOf(entry), 1);
            delete(entryTable[entryName]);
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
        toBuffer : function() {
            entryList.sort(function(a, b) {
                var nameA = a.entryName.toLowerCase( );
                var nameB = b.entryName.toLowerCase( );
                if (nameA < nameB) {return -1}
                if (nameA > nameB) {return 1}
                return 0;
            });

            var totalSize = 0, data = [], header = [], index = 0, dindex = 0;
            entryList.forEach(function(e) {
                data.push(e.compressedData);
                if (!header.length) {
                    console.log(e.header.toString())
                }
                header.push(e.header.toBinary());
                dindex += e.header.entryHeaderSize;
                totalSize += data[data.length - 1].length + e.header.entryHeaderSize;

            });
            console.log(data[0]);
            console.log("----")
            console.log(header[0])
            console.log(totalSize)
        }
    }
};
