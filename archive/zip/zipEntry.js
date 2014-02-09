var fs = require("fs"),

    constants = require("./constants"),
    register = require("./register");

module.exports.File = File;
module.exports.FileHeader = FileHeader;

function FileHeader() {
    var // Name is the name of the file.
    // It must be a relative path: it must not start with a drive
    // letter (e.g. C:) or leading slash, and only forward slashes
    // are allowed.
        name = new Buffer(0, 'utf8'),
        _uncompressedSize64 = 0,
        _uncompressedSize = 0,
        _compressedSize = 0,
        _compressedSize64 = 0,
        _externalAttr = 0,
        _flags = 0,
        _method = 0,
        _time = new Date(),
        _readerVersion = 0,
        _creatorVersion = 0;

    return {
        extra: new Buffer(0),
        crc32: 0,
        comment: new Buffer(0, 'utf8'),

        get creatorVersion() { return _creatorVersion },
        set creatorVersion(val) { _creatorVersion = val},

        get readerVersion() { return _readerVersion },
        set readerVersion(val) { _readerVersion = val},

        get flags() { return _flags },
        set flags(val) { _flags = val},

        get method() { return _method },
        set method(val) { _method = val},

        get externalAttr() { return _externalAttr },
        set externalAttr(val) { _externalAttr = val},

        get compressedSize() { return _compressedSize },
        set compressedSize(val) { _compressedSize = val},

        get compressedSize64() { return _compressedSize64 },
        set compressedSize64(val) { _compressedSize64 = val},

        get uncompressedSize() { return _uncompressedSize },
        set uncompressedSize(val) { _uncompressedSize = val},

        get uncompressedSize64() { return _uncompressedSize64 },
        set uncompressedSize64(val) { _uncompressedSize64 = val},

        get entryName() {
            return name.toString("utf8");
        },

        set entryName(/*Buffer|string*/value) {
            if (Buffer.isBuffer(value)) {
                name = new Buffer(value.length);
                value.copy(name, 0, 0, value.length);
            } else {
                name = new Buffer(value)
            }
        },

        get size() {
            if (_uncompressedSize64 > 0) {
                return _uncompressedSize64
            }
            return _uncompressedSize
        },

        get isDirectory() {
            return this.mode & constants.fileModes.dir != 0
        },

        get mode() {
            var creator = constants.creator,
                mod = 0;

            switch (_creatorVersion >> 8) {
                case creator.Unix:
                case creator.MacOSX:
                    mod = unixModeToFileMode(_externalAttr >> 16);
                    break;
                case creator.NTFS:
                case creator.VFAT:
                case creator.FAT:
                    mod = msdosModeToFileMode(_externalAttr);
                    break
            }

            if (name.length > 0 && name[name.length - 1] == "/") {
                mod |= constants.fileModes.dir;
            }

            return mod
        },

        set mode(value) {
            _creatorVersion = _creatorVersion & 0xFF | constants.creator.Unix << 8;
            _externalAttr = fileModeToUnixMode(value) << 16;

            // set MSDOS attributes too
            if ((value & constants.fileModes.dir) != 0) {
                _externalAttr |= constants.fileModes.msdosDir
            }
            if ((value & 128) == 0) {
                _externalAttr |= constants.fileModes.msdosReadOnly
            }
        },

        get modTime() {
            return _time
        },
        set modTime(val) {
            _time = new Date(
                ((val >> 25) & 0x7f) + 1980,
                ((val >> 21) & 0x0f) - 1,
                (val >> 16) & 0x1f,

                (val >> 11) & 0x1f,
                (val >> 5) & 0x3f,
                (val & 0x1f) << 1
            );
        },
        get msdosTime() {
            return (_time.getFullYear() - 1980 & 0x7f) << 25  // b09-16 years from 1980
                | (_time.getMonth() + 1) << 21                 // b05-08 month
                | _time.getDay() << 16                         // b00-04 hour

                // 2 bytes time
                | _time.getHours() << 11    // b11-15 hour
                | _time.getMinutes() << 5   // b05-10 minute
                | _time.getSeconds() >> 1;  // b00-04 seconds divided by 2
        }
    }
}

function File(r, zipSize) {

    var comment = new Buffer(0),
        _fd = undefined,
        _reader = r,
        _header = new FileHeader(),
        _headerOffset = 0;

    if (Buffer.isBuffer(r)) {
        _reader = r;
    } else {
        _fd = r
    }

    function readAt(loc, len, buffer) {
        if (_fd) {
            fs.readSync(_fd, buffer, 0, len, loc)
        } else {
            _reader.copy(buffer, 0, loc, loc + len)
        }
    }

    function dataOffset() {
        var bodyOffset = findBodyOffset();
        return _headerOffset + bodyOffset
    }

    function read() {
        var bodyOffset = findBodyOffset(),
            size = _header.compressedSize64;

        var buf = new Buffer(size),
            decomp = register.decompressor(_header.method);

        if (!decomp) {
            throw Error("zip: unsupported compression algorithm")
        }
        var rc = decomp(buf),
            decompressed = new Buffer(_header.uncompressedSize64),
            desc;

        if (hasDataDescriptor()) {
            desc = new Buffer(constants.fieldSize.dataDescriptor);
            readAt(_headerOffset + bodyOffset + size, desc.length, desc)
        }

        return decompressed
    }

    function readDataDescriptor() {

    }

    function findBodyOffset() {
        var buf = new Buffer(constants.fieldSize.fileHeader);
        readAt(_headerOffset, buf.length, buf);

        if (buf.readUInt32LE(0) != constants.signature.fileHeader) {
            throw Error("zip: not a valid zip file")
        }
        buf = buf.slice(26);
        var filenameLen = buf.readUInt16LE(0),
            extraLen = buf.readUInt16LE(2);

        return constants.fieldSize.fileHeader + filenameLen + extraLen;
    }

    function hasDataDescriptor() {
        return _header.flags & 0x8 != 0
    }

    return {
        header : _header,
        get headerOffset () {
            return _headerOffset
        },
        set headerOffset(val) {
            _headerOffset = val
        },
        read : read
    }
}

function unixModeToFileMode(m) {
    var mode = m & 511, // 0777
        modes = constants.fileModes;

    switch (m & 0xf000) {
        case 0x6000:
            mode |= modes.device;
            break;
        case 0x2000:
            mode |= modes.device | modes.chardevice;
            break;
        case 0x4000:
            mode |= modes.dir;
            break;
        case 0x1000:
            mode |= modes.namedpipe;
            break;
        case 0xa000:
            mode |= modes.symlink;
            break;
        case 0x8000:
            break;
        case 0xc000:
            mode |= modes.socket;
            break;
    }

    if (m & 0x400) {
        mode |= modes.setgid
    }
    if (m & 0x800) {
        mode |= modes.setuid
    }
    if (m & 0x200) {
        mode |= modes.sticky
    }

    return mode
}

function msdosModeToFileMode(m) {
    var mode = 0;
    if (m & constants.fileModes.msdosDir) {
        mode = constants.fileModes.dir | 511; // 0777
    } else {
        mode = 438; // 0666
    }
    if (m & constants.fileModes.msdosReadOnly) {
        mode ^= 146; // 0222
    }
    return mode
}

function fileModeToUnixMode(mode) {
    var m = 0,
        modes = constants.fileModes;

    switch (mode & modes.type) {
        default:
            m = 0x8000;
            break;
        case modes.dir:
            m = 0x4000;
            break;
        case modes.symlink:
            m = 0xa000;
            break;
        case modes.namedItem:
            m = 0x1000;
            break;
        case modes.socket:
            m = 0xc000;
            break;
        case modes.device:
            if (mode & modes.chardevice) {
                m = 0x2000;
            } else {
                m = 0x6000;
            }
            break
    }
    if (mode & modes.setuid) {
        m |= 0x800;
    }
    if (mode & modes.setgid) {
        m |= 0x400;
    }
    if (mode & modes.sticky) {
        m |= 0x200;
    }
    return m | (mode & 511) // 0777
}
