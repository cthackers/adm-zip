// compression methods
define("method", {
    STORE: 0,   // no compression
    DEFLATE: 8  // deflated
});

define("signature", {
    fileHeader:      0x04034b50, // "PK\003\004"
    directoryHeader: 0x02014b50, // "PK\001\002"
    directoryEnd:    0x06054b50, // "PK\005\006"
    directory64Loc:  0x07064b50, // "PK\006\007"
    directory64End:  0x06064b50, // "PK\006\006"
    dataDescriptor:  0x08074b50  // "PK\007\008"
});

define("fieldSize", {
    fileHeader:       30, // + filename + extra
    directoryHeader:  46, // + filename + extra + comment
    directoryEnd:     22, // + comment
    dataDescriptor:   16, // four uint32: descriptor signature, crc32, compressed size, size
    dataDescriptor64: 24, // descriptor with 8 byte sizes
    directory64Loc:   20,
    directory64End:   56 // + extra
});

// Constants for the first byte in CreatorVersion
define("creator", {
    FAT:     0,
    Unix:    3,
    NTFS:   11,
    VFAT:   14,
    MacOSX: 19
});

// version numbers
define("version", {
   "zip20" : 20, // 2.0
   "zip45" : 45  // 4.5 (reads and writes zip64 archives)
});

// limits for non zip64 files
define("limits", {
    uint16 :      65535,
    uint32 : 4294967295
});

define("fileModes", {
    dir :       0x80000000,
    append :    0x40000000,
    exclusive : 0x20000000,
    temporary : 0x10000000,
    symlink :   0x8000000,
    device :    0x4000000,
    namedpipe : 0x2000000,
    socket :    0x1000000,
    setuid :    0x800000,
    setgid :    0x400000,
    chardevice :0x200000,
    sticky :    0x100000,

    type : 0x8f000000,

    msdosDir:      0x10,
    msdosReadOnly: 0x01
});

// extra header id's
define("zip64ExtraId", 0x0001); // zip64 Extended Information Extra Field


function define(name, value) {
    Object.defineProperty(exports, name, {
        value: value,
        enumerable: true
    });
}
