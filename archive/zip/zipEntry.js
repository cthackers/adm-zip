var fs = require("fs"),

    utils = require("../../utils"),
    constants = require("./constants"),
    register = require("./register");

module.exports.File = File;
module.exports.FileHeader = FileHeader;

function FileHeader() {
    var f = this,

    // Name is the name of the file.
    // It must be a relative path: it must not start with a drive
    // letter (e.g. C:) or leading slash, and only forward slashes
    // are allowed.
    name = new Buffer(0, 'utf8'),
    _time = new Date();

    this.extra = new Buffer(0);
    this.crc32 = 0;
    this.comment = new Buffer(0, 'utf8');
    this.creatorVersion = 0x0A;
    this.readerVersion = 0x0A;
    this.flags = 0;
    this.method = 0;
    this.externalAttr = 0;
    this.compressedSize = 0;
    this.compressedSize64 = 0;
    this.uncompressedSize = 0;
    this.uncompressedSize64 = 0;

    this.__defineGetter__("entryName", function(){
        return name.toString('utf8');
    });

    this.__defineSetter__("entryName", function(/*Buffer|string*/value){
        if (Buffer.isBuffer(value)) {
            name = new Buffer(value.length);
            value.copy(name, 0, 0, value.length);
        } else {
            name = new Buffer(value)
        }
    });

    this.__defineGetter__("size", function(){
        if (f.uncompressedSize64 > 0) {
            return f.uncompressedSize64
        }
        return f.uncompressedSize
    });

    this.__defineGetter__("isDirectory", function(){
        return (this.mode & constants.fileModes.dir) != 0
    });

    this.__defineGetter__("isEncrypted", function(){
        return (f.flags & 1) != 0
    });

    this.__defineGetter__("mode", function(){
        var creator = constants.creator,
            mod = 0;

        switch (f.creatorVersion >> 8) {
            case creator.Unix:
            case creator.MacOSX:
                mod = unixModeToFileMode(f.externalAttr >> 16);
                break;
            case creator.NTFS:
            case creator.VFAT:
            case creator.FAT:
                mod = msdosModeToFileMode(f.externalAttr);
                break
        }

        if (name.length > 0 && name[name.length - 1] == "/") {
            mod |= constants.fileModes.dir;
        }

        return mod
    });

    this.__defineSetter__("mode", function(/*Buffer|string*/value){
        f.creatorVersion = f.creatorVersion & 0xFF | constants.creator.Unix << 8;
        f.externalAttr = fileModeToUnixMode(value) << 16;

        // set MSDOS attributes too
        if ((value & constants.fileModes.dir) != 0) {
            f.externalAttr |= constants.fileModes.msdosDir
        }
        if ((value & 128) == 0) {
            f.externalAttr |= constants.fileModes.msdosReadOnly
        }
    });

    this.__defineGetter__("modTime", function() {
        return _time
    });

    this.__defineSetter__("modTime", function(val) {
        _time = new Date(
            ((val >> 25) & 0x7f) + 1980,
            ((val >> 21) & 0x0f) - 1,
            (val >> 16) & 0x1f,

            (val >> 11) & 0x1f,
            (val >> 5) & 0x3f,
            (val & 0x1f) << 1
        );
    });

    this.__defineGetter__("msdosTime", function() {
        return (_time.getFullYear() - 1980 & 0x7f) << 25  // b09-16 years from 1980
            | (_time.getMonth() + 1) << 21                 // b05-08 month
            | _time.getDay() << 16                         // b00-04 hour

            // 2 bytes time
            | _time.getHours() << 11    // b11-15 hour
            | _time.getMinutes() << 5   // b05-10 minute
            | _time.getSeconds() >> 1;  // b00-04 seconds divided by 2
    });

    this.toString = function() {
        return '{\n' +
            '\tcreatorVersion : ' + f.creatorVersion + ",\n" +
            '\treaderVersion : ' + f.readerVersion + ",\n" +
            '\tflags : ' + f.flags + ",\n" +
            '\tmethod : ' + f.method + ",\n" +
            '\texternalAttr : ' + f.externalAttr + ",\n" +
            '\tcompressedSize : ' + f.compressedSize + "B,\n" +
            '\tcompressedSize64 : ' + f.compressedSize64 + "B,\n" +
            '\tuncompressedSize : ' + f.size + "B,\n" +
            '\tisDirectory : ' + (f.isDirectory ? "true" : "false") + ",\n" +
            '\tisEncrypted : ' + (f.isEncrypted ? "true" : "false") + ",\n" +
            '\tmode : 0' + f.mode.toString(8) + ",\n" +
            '\tentryName : "' + name.toString("utf8") + '",\n' +
            '\tmodTime : ' + f.modTime.toString() + ",\n" +
            '\tcrc32 : 0x' + f.crc32.toString(16).toUpperCase() + ",\n" +
            '\textra : ' + (f.extra.toString('hex') || '<null>') + ",\n" +
            '\tcomment : "' + f.comment.toString('utf8')  + '",\n' +
            '}'
    }
}

function File(r, zipSize) {

    var f = this,
        comment = new Buffer(0),
        _fd = undefined,
        _reader = r;

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
        return f.headerOffset + bodyOffset
    }

    function readDataDescriptor(buf) {
        var i = 0,
            maybeSig = buf.readUInt32LE(i);
        if (maybeSig != constants.signature.dataDescriptor) {
            // no data descriptor signature
            if (maybeSig != f.header.crc32) {
                throw Error("zip: checksum error")
            }
        } else {
            i += 4;
            if (buf.readUInt32LE(i) != f.header.crc32) {
                throw Error("zip: checksum error")
            }
        }
    }

    function findBodyOffset() {
        var buf = new Buffer(constants.fieldSize.fileHeader);
        readAt(f.headerOffset, buf.length, buf);

        if (buf.readUInt32LE(0) != constants.signature.fileHeader) {
            throw Error("zip: not a valid zip file")
        }
        buf = buf.slice(26);
        var filenameLen = buf.readUInt16LE(0),
            extraLen = buf.readUInt16LE(2);

        return constants.fieldSize.fileHeader + filenameLen + extraLen;
    }

    this.header = new FileHeader();

    this.headerOffset = 0;

    this.read = function () {
        var bodyOffset = findBodyOffset(),
            size = f.header.compressedSize64;

        var buf = new Buffer(size),
            decomp = register.decompressor(f.header.method);

        if (!decomp) {
            throw Error("zip: unsupported compression algorithm")
        }

        readAt(f.headerOffset + bodyOffset, size, buf);

        var rc = new decomp(buf),
            desc;

        if ((f.header.flags & 0x8) != 0) {
            desc = new Buffer(constants.fieldSize.dataDescriptor);
            readAt(f.headerOffset + bodyOffset + size, desc.length, desc);
            readDataDescriptor(desc)
        }

        var data;
        if (Buffer.isBuffer(rc)) {
            data = rc;
        } else {
            data = new Buffer(f.header.size);
            rc.Read(data);
        }
        if (utils.CRC32(data) != f.header.crc32) {
            throw Error("zip: checksum error")
        }
        return data;
    };

    this.toString = function() {
        return "{\n" +
            "header : " + f.header.toString() + "\n" +
            "comment : ''\n" +
            "}"
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
