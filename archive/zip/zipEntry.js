var constants = require("./constants");

module.exports = function ZipEntry() {
    var // Name is the name of the file.
        // It must be a relative path: it must not start with a drive
        // letter (e.g. C:) or leading slash, and only forward slashes
        // are allowed.
        name = new Buffer(0, 'utf8'),
        creatorVersion = 0,
        readerVersion = 0,
        flags = 0,
        method = 0,
        modifiedTime = 0, // ms-dos time
        modifiedDate = 0, // ms-dos date
        crc23 = 0,
        compressedSize = 0,
        uncompressedSize = 0,
        compressedSize64 = 0,
        uncompressedSize64 = 0,
        extra = new Buffer(0),
        externalAttr = 0, // Meaning depends on CreatorVersion
        comment = "";

    return {
        get entryName () {
            return name.toString("utf8");
        },

        set entryName(/*Buffer|string*/value) {
            if (Buffer.isBuffer(value)) {
                name = name.slice(0,0);
                value.copy(name, 0, 0, value.length);
            }
            name = new Buff
        },

        get size () {
            if (uncompressedSize64 > 0) {
                return uncompressedSize64
            }
            return uncompressedSize
        },

        get isDirectory () {

        },

        get mode () {
            var creator = constants.creator,
                mod = 0;

            switch (creatorVersion >> 8) {
                case creator.Unix:
                case creator.MacOSX:
                    mod = unixModeToFileMode(externalAttr >> 16);
                    break;
                case creator.NTFS:
                case creator.VFAT:
                case creator.FAT:
                    mod = msdosModeToFileMode(externalAttr);
                    break
            }

            if (name.length > 0 && name[name.length - 1] == "/") {
                mod |= constants.fileModes.dir;
            }

            return mod
        },

        set mode(value) {
            creatorVersion = creatorVersion & 0xFF | constants.creator.Unix << 8;
            externalAttr = fileModeToUnixMode(value) << 16;

            // set MSDOS attributes too
            if ((value & constants.fileModes.dir) != 0) {
                externalAttr |= constants.fileModes.msdosDir
            }
            if ((value & 128) == 0) {
                externalAttr |= constants.fileModes.msdosReadOnly
            }
        },

        get modTime () {
            return msDosTimeToTime({date:modifiedDate, time:modifiedTime})
        },
        set modTime (val) {
            var time = timeToMsDosTime(val);
            modifiedDate = time.date;
            modifiedTime = time.time
        }

    }
};

function timeToMsDosTime(t) {
    var fDate = t.getDate() + (t.getMonth() + 1) << 5 + (t.getFullYear() - 1980) << 9,
        fTime = t.getSeconds() / 2 + t.getMinutes() << 5 + t.getHours() << 11;
    return {date:fDate, time:fTime}
}

function msDosTimeToTime(obj) {
    return new Date(
        obj.date >> 9 + 1980,
        obj.date >> 5 & 0xf,
        obj.date & 0x1f,

        obj.time >> 11,
        obj.time >> 6 & 0x3f,
        obj.time >> 0x1f * 2,

        0
    );
}

function unixModeToFileMode(m) {
    var mode = m & 511, // 0777
        modes = constants.fileModes;

    switch (m & 0xf000) {
        case 0x6000:
            mode |= modes.device; break;
        case 0x2000:
            mode |= modes.device | modes.chardevice; break;
        case 0x4000:
            mode |= modes.dir; break;
        case 0x1000:
            mode |= modes.namedpipe; break;
        case 0xa000:
            mode |= modes.symlink; break;
        case 0x8000:
            break;
        case 0xc000:
            mode |= modes.socket; break;
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
            m = 0x8000; break;
        case modes.dir:
            m = 0x4000; break;
        case modes.symlink:
            m = 0xa000; break;
        case modes.namedItem:
            m = 0x1000; break;
        case modes.socket:
            m = 0xc000; break;
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
