var ZipEntry = require("./zipEntry").ZipEntry,
    ZipMainHeader = require("./headers/mainHeader").ZipMainHeader,
    ZipConstants = require("./zipConstants").ZipConstants;


exports.ZipFile = function(/*Buffer*/buf) {
    var entryList = [],
        entryTable = {},
        _comment = '',
        endHeader = new ZipMainHeader();

    if (buf) {
        readMainHeader();
    }

    function readEntries() {
        entryTable = {};
        entryList = new Array(endHeader.diskEntries);  // total number of entries
        var index = endHeader.offset;  // offset of first CEN header

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

    function readMainHeader() {
        var i = buf.length - ZipConstants.ENDHDR, // END header size
            n = Math.max(0, i - 0xFFFF), // 0xFFFF is the max zip file comment length
            endOffset = 0; // Start offset of the END header

        for (i; i >= n; i--) {
            if (buf[i] != 0x50) continue; // quick check that the byte is 'P'
            if (buf.readUInt32LE(i) == ZipConstants.ENDSIG) { // "PK\005\006"
                endOffset = i;
                break;
            }
        }
        if (!endOffset)
            throw "Invalid or unsupported zip format. No END header found";

        endHeader.loadFromBinary(buf.slice(endOffset, endOffset + ZipConstants.ENDHDR));
        if (endHeader.commentLength) {
            _comment = buf.toString('utf8', endOffset + ZipConstants.ENDHDR);
        }

        readEntries();
    }

    return {
        /**
         * Returns an array of ZipEntry objects existent in the current opened archive
         * @return Array
         */
        get entries () {
            return entryList;
        },

        /**
         * Archive comment
         * @return {String}
         */
        get comment () { return _comment; },
        set comment(val) {
            endHeader.commentLength = val.length;
            _comment = val;
        },

        /**
         * Returns a reference to the entry with the given name or null if entry is inexistent
         *
         * @param entryName
         * @return ZipEntry
         */
        getEntry : function(/*String*/entryName) {
            return entryTable[entryName] || null;
        },

        /**
         * Adds the given entry to the entry list
         *
         * @param entry
         */
        setEntry : function(/*ZipEntry*/entry) {
            entryList.push(entry);
            entryTable[entry.entryName] = entry;
        },

        /**
         * Removes the entry with the given name from the entry list.
         *
         * If the entry is a directory, then all nested files and directories will be removed
         * @param entryName
         */
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
            this.getEntryChildren()
            entryList.slice(entryList.indexOf(entry), 1);
            delete(entryTable[entryName]);
        },

        /**
         *  Iterates and returns all nested files and directories of the given entry
         *
         * @param entry
         * @return Array
         */
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

        /**
         * Returns the zip file
         *
         * @return Buffer
         */
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
