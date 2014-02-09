var constants = require("./constants"),
    zipEntry = require("./zipEntry"),
    stream = require("stream"),
    fs = require("fs");

module.exports.Reader = Reader;

function Reader(r, size) {
    var _comment = "",
        _reader = r,
        _fd = undefined,
        _size = size,
        _files = [],
        _self = this;

    if (typeof r != "undefined") {
        initReader()
    }

    function readAt(loc, len, buffer) {
        if (_fd) {
            fs.readSync(_fd, buffer, 0, len, loc)
        } else {
            _reader.copy(buffer, 0, loc, loc + len)
        }
    }

    function initReader() {
        if (Buffer.isBuffer(r)) {
            _reader = r;
            if (!size) {
                _size = r.length
            }
        } else if (typeof r == "string") {
            var stats = fs.statSync(r);
            _size = stats.size;
            _fd = fs.openSync(r, "rs");
        }

        var end = readDirectoryEnd();
        _comment = end.comment;
        var offset = end.directoryOffset;

        for (var i = 0; i < end.directoryRecords; i++) {
            var f = new zipEntry.File(_fd || _reader, _size);
            try {
                offset += readDirectoryHeader(f, offset);
            } catch (e) {
                break;
            }
            _files.push(f)
        }
    }

    function readDirectoryEnd() {
        var dirEndOffset = 0,
            buf;

        for (var i = 0; i < 2; i++) {
            var bLen = [1024, 65 * 1024][i];
            if (bLen > _size) {
                bLen = _size
            }
            buf = new Buffer(bLen);
            readAt(_size - bLen, bLen, buf);

            var pos = findSignatureInBlock(buf);
            if (pos >= 0) {
                buf = buf.slice(pos);
                dirEndOffset = _size - bLen + pos;
                break;
            }

            if (i == 1 || bLen == _size) {
                throw Error("zip: not a valid zip file")
            }
        }

        // skip signature
        buf = buf.slice(4);
        var header = {
            diskNbr: buf.readUInt16LE(0),
            dirDiskNbr: buf.readUInt16LE(2),
            dirRecordsThisDisk: buf.readUInt16LE(4),
            directoryRecords: buf.readUInt16LE(6),

            directorySize: buf.readUInt32LE(8),
            directoryOffset: buf.readUInt32LE(12),

            commentLen: buf.readUInt16LE(16)
        };

        if (header.commentLen > buf.length) {
            throw Error("zip: invalid comment length")
        }
        header.comment = buf.toString('utf8', 18, 18 + header.commentLen);

        var p = findDirectory64End(dirEndOffset);
        if (p > 0) {
            var err = readDirectory64End(p, header);
            if (err != null) {
                throw err
            }
        }

        var offset = header.directoryOffset;
        if (offset < 0 || offset >= _size) {
            throw Error("zip: not a valid zip file");
        }

        return header;
    }

    function readDataDescriptor() {

    }

    function findDirectory64End(dirOffset) {
        var locOffset = dirOffset - constants.fieldSize.directory64Loc;
        if (locOffset < 0) {
            return -1;
        }
        var buf = new Buffer(constants.fieldSize.directory64Loc);
        try {
            readAt(locOffset, buf.length, buf);
        } catch (e) {
            return -1;
        }

        if (buf.readUInt32LE(0) != constants.signature.directory64Loc) {
            return -1;
        }
        return buf.readUInt32LE(4) | buf.readUInt32LE(8) << 32
    }

    function readDirectory64End(offset, header) {
        var buf = new Buffer(constants.fieldSize.directory64End);
        try {
            readAt(offset, buf.length, buf)
        } catch (e) {
            return e;
        }
        if (buf.readUInt32LE(0) != constants.signature.directory64End) {
            return Error("zip: not a valid zip file")
        }

        buf = buf.slice(12);
        header.diskNbr = buf.readUInt32LE(0);
        header.dirDiskNbr = buf.readUInt32LE(4);
        header.dirRecordsThisDisk = buf.readUInt32LE(8) | buf.readUInt32LE(12) << 32;
        header.directoryRecords = buf.readUInt32LE(16) | buf.readUInt32LE(20) << 32;
        header.directorySize = buf.readUInt32LE(24) | buf.readUInt32LE(28) << 32;
        header.directoryOffset = buf.readUInt32LE(32) | buf.readUInt32LE(36) << 32;

        return null
    }

    function findSignatureInBlock(b) {
        var dirEnd = constants.fieldSize.directoryEnd;
        for (var i = b.length - dirEnd; i >= 0; i--) {
            if (b.readInt32LE(i) == constants.signature.directoryEnd) {
                // n is length of comments
                var n = b.readUInt16LE(i + dirEnd - 2);
                if (n + dirEnd + i <= b.length) {
                    return i;
                }
            }
        }
        return -1;
    }

    function readDirectoryHeader(file, offset) {
        var buf = new Buffer(constants.fieldSize.directoryHeader);
        readAt(offset, buf.length, buf);

        if (buf.readUInt32LE(0) != constants.signature.directoryHeader) {
            throw Error("zip: not a valid zip file")
        }

        var h = file.header;

        h.creatorVersion = buf.readUInt16LE(4);
        h.readerVersion = buf.readUInt16LE(6);
        h.flags = buf.readUInt16LE(8);
        h.method = buf.readUInt16LE(10);
        h.modTime = buf.readUInt32LE(12);
        //h.modTime = {date: buf.readUInt16LE(14), time: buf.readUInt16LE(12)};
        h.crc32 = buf.readUInt32LE(16);
        h.compressedSize64 = h.compressedSize = buf.readUInt32LE(20);
        h.uncompressedSize64 = h.uncompressedSize = buf.readUInt32LE(24);
        h.externalAttr = buf.readUInt32LE(38);
        file.headerOffset = buf.readUInt32LE(42);

        var filenameLen = buf.readUInt16LE(28),
            extraLen = buf.readUInt16LE(30),
            commentLen = buf.readUInt16LE(32),
            d = new Buffer(filenameLen + extraLen + commentLen);

        readAt(offset + 46, d.length, d);

        h.entryName = d.slice(0, filenameLen);
        h.extra = d.slice(filenameLen, filenameLen + extraLen);
        h.comment = d.slice(filenameLen + extraLen, filenameLen + extraLen + commentLen);

        if (extraLen > 0) {
            var tag = h.extra.readUInt16LE(0),
                size = h.extra.readUInt16LE(2);

            if (size > h.extra.length) {
                throw Error("zip: not a valid zip file")
            }
            if (tag == 1) {
                // update directory values from the zip64 extra block
                if (extraLen >= 12) {
                    h.uncompressedSize64 = h.extra.readUInt32LE(4) | h.extra.readUInt32LE(8) << 32
                }
                if (extraLen >= 20) {
                    h.compressedSize64 = h.extra.readUInt32LE(12) | h.extra.readUInt32LE(16) << 32
                }
                if (extraLen >= 28) {
                    file.headerOffset = h.extra.readUInt32LE(20) | h.extra.readUInt32LE(28) << 32
                }
            }
        }
        return buf.length + d.length;
    }

    function findBodyOffset() {

    }


    return {
        get files () {
            return _files
        },

        set reader (reader) {
            _reader = reader;
        },

        get comment () {
            return _comment.toString("utf8");
        },
        set comment (value) {
            if (Buffer.isBuffer(value)) {
                _comment = _comment.slice(0,0);
                value.copy(_comment, 0, 0, value.length);
            } else {
                _comment = new Buffer(value)
            }
        },

        init: initReader
    }
}


