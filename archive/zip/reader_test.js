var fs = require("fs"),
    stream = require("stream"),
    path = require("path"),

    constants = require("./constants"),
    Reader = require("./reader").Reader,
    File = require("./zipEntry").File,
    Header = require("./zipEntry").FileHeader;

var crossPlatform = [
    {
        name: "hello",
        content: new Buffer("world \r\n"),
        mode: 438 // 0666
    },
    {
        name: "dir/bar",
        content: new Buffer("foo \r\n"),
        mode: 438 // 0666
    },
    {
        name: "dir/empty/",
        content: new Buffer(0),
        mode: constants.fileModes.dir | 511 // 0777
    },
    {
        name: "readonly",
        content: new Buffer("important \r\n"),
        mode: 292 // 0444
    }
];

var tests = [
    {
        name: "test.zip",
        comment: "This is a zipfile comment.",
        files: [
            {
                name: "test.text",
                content: new Buffer("This is a test text file.\n"),
                modtime: "09-05-10 12:12:02",
                mode: 420 //0644
            },
            {
                name: "gophercolor16x16.png",
                file: "gophercolor16x16.png",
                modtime: "09-05-10 15:52:58",
                mode: 420 //0644
            }
        ]
    },
    {
        name: "test-trailing-junk.zip",
        comment: "This is a zipfile comment.",
        files: [
            {
                name: "test.txt",
                content: new Buffer("This is a test text file.\n"),
                modtime: "09-05-10 12:12:02",
                mode: 420 //0644
            },
            {
                name: "gophercolor16x16.png",
                file: "gophercolor16x16.png",
                modtime: "09-05-10 15:52:58",
                mode: 420 //0644
            }
        ]
    },
    {
        name: "r.zip",
        source: recursiveZip,
        files: [
            {
                name: "r/r.zip",
                content: rZipBytes(),
                modtime: "03-04-10 00:24:16",
                mode: 438 // 0666
            }
        ]
    },
    {
        name: "symlink.zip",
        files: [
            {
                name: "symlink",
                content: new Buffer("../target"),
                mode: 511 | constants.fileModes.symlink // 0777
            }
        ]
    },
    {
        name: "readme.zip"
    },
    {
        name: "readme.notzip",
        error: "zip: not a valid zip file"
    },
    {
        name: "dd.zip",
        files: [
            {
                name: "filename",
                content: new Buffer("This is a test textfile.\n"),
                modtime: "02-02-11 13:06:20",
                mode: 438 // 0666
            }
        ]
    },
    {
        // created in windows XP file manager.
        name: "winxp.zip",
        files: crossPlatform
    },
    {
        // created by Zip 3.0 under Linux
        name: "unix.zip",
        files: crossPlatform
    },
    {
        // no data descriptor signatures (which are required by OS X)
        name: "no-datadesc-sig.zip",
        files: [
            {
                name: "foo.txt",
                content: new Buffer("foo\n"),
                modtime: "03-08-12 16:59:10",
                mode: 420 // 0644
            },
            {
                name: "bar.txt",
                content: new Buffer("bar\n"),
                modtime: "03-08-12 16:59:12",
                mode: 420 // 0644
            }
        ]
    },
    {
        // with data descriptor
        name: "with-datadesc-sig.zip",
        files: [
            {
                name: "foo.txt",
                content: new Buffer("foo\n"),
                mode: 438 // 0666
            },
            {
                name: "bar.txt",
                content: new Buffer("bar\n"),
                mode: 438 // 0666
            }
        ]
    },
    {
        name: "Bad-CRC32-in-data-descriptor",
        source: corruptCRC32Zip,
        files: [
            {
                name: "foot.txt",
                content: new Buffer("foo\n"),
                mode: 438, // 0666
                error: "zip: checksum error"
            },
            {
                name: "bar.txt",
                content: new Buffer("bar\n"),
                mode: 438 // 0666
            }
        ]
    },
    {
        // Tests that we verify (and accept valid) crc32s on files
        // with crc32s in their file header (not in data descriptors)
        name: "crc32-not-streamed.zip",
        files: [
            {
                name: "foo.txt",
                content: new Buffer("foo\n"),
                modtime: "03-08-12 16:59:10",
                mode: 420 // 0644
            },
            {
                name: "bar.txt",
                content: new Buffer("bar\n"),
                modtime: "03-08-12 16:59:12",
                mode: 420 // 0644
            }
        ]
    },
    {
        // Tests that we verify (and reject invalid) crc32s on files
        // with crc32s in their file header (not in data descriptors)
        name: "crc32-not-streamed.zip",
        source: corruptNotStreamedZip,
        files: [
            {
                name:       "foo.txt",
                content:    new Buffer("foo\n"),
                modtime:      "03-08-12 16:59:10",
                mode: 420, // 0644
                error: "zip: checksum error"
            },
            {
                name:    "bar.txt",
                content: new Buffer("bar\n"),
                modtime:   "03-08-12 16:59:12",
                mode: 420 // 0644
            }
        ]
    },
    {
        name: "zip64.zip",
        files: [
            {
                name: "README",
                content: new Buffer("This small file is in ZIP64 format.\n"),
                modtime: "08-10-12 14:33:32",
                mode: 420 // 0644
            }
        ]
    }
];

function corruptNotStreamedZip() {
    var buf = messWith("crc32-not-streamed.zip", function(buf) {
        buf[0x11]++;
        buf[0x9d]++;
    });

    return {
        reader: buf,
        len: buf.length
    }
}

function corruptCRC32Zip() {
    var buf = messWith("with-datadesc-sig.zip", function(buf) {
        buf[0x2d]++;
    });
    return {
        reader: buf,
        len: buf.length
    }
}

function messWith(fileName, corrupter) {
    var bytes = fs.readFileSync(path.join("test/testdata", fileName));
    corrupter(bytes);
    return bytes
}

// rZipBytes returns the bytes of a recursive zip file, without
// putting it on disk and triggering certain virus scanners.
function rZipBytes() {
    var s = [
        '0000000 50 4b 03 04 14 00 00 00 08 00 08 03 64 3c f9 f4',
        '0000010 89 64 48 01 00 00 b8 01 00 00 07 00 00 00 72 2f',
        '0000020 72 2e 7a 69 70 00 25 00 da ff 50 4b 03 04 14 00',
        '0000030 00 00 08 00 08 03 64 3c f9 f4 89 64 48 01 00 00',
        '0000040 b8 01 00 00 07 00 00 00 72 2f 72 2e 7a 69 70 00',
        '0000050 2f 00 d0 ff 00 25 00 da ff 50 4b 03 04 14 00 00',
        '0000060 00 08 00 08 03 64 3c f9 f4 89 64 48 01 00 00 b8',
        '0000070 01 00 00 07 00 00 00 72 2f 72 2e 7a 69 70 00 2f',
        '0000080 00 d0 ff c2 54 8e 57 39 00 05 00 fa ff c2 54 8e',
        '0000090 57 39 00 05 00 fa ff 00 05 00 fa ff 00 14 00 eb',
        '00000a0 ff c2 54 8e 57 39 00 05 00 fa ff 00 05 00 fa ff',
        '00000b0 00 14 00 eb ff 42 88 21 c4 00 00 14 00 eb ff 42',
        '00000c0 88 21 c4 00 00 14 00 eb ff 42 88 21 c4 00 00 14',
        '00000d0 00 eb ff 42 88 21 c4 00 00 14 00 eb ff 42 88 21',
        '00000e0 c4 00 00 00 00 ff ff 00 00 00 ff ff 00 34 00 cb',
        '00000f0 ff 42 88 21 c4 00 00 00 00 ff ff 00 00 00 ff ff',
        '0000100 00 34 00 cb ff 42 e8 21 5e 0f 00 00 00 ff ff 0a',
        '0000110 f0 66 64 12 61 c0 15 dc e8 a0 48 bf 48 af 2a b3',
        '0000120 20 c0 9b 95 0d c4 67 04 42 53 06 06 06 40 00 06',
        '0000130 00 f9 ff 6d 01 00 00 00 00 42 e8 21 5e 0f 00 00',
        '0000140 00 ff ff 0a f0 66 64 12 61 c0 15 dc e8 a0 48 bf',
        '0000150 48 af 2a b3 20 c0 9b 95 0d c4 67 04 42 53 06 06',
        '0000160 06 40 00 06 00 f9 ff 6d 01 00 00 00 00 50 4b 01',
        '0000170 02 14 00 14 00 00 00 08 00 08 03 64 3c f9 f4 89',
        '0000180 64 48 01 00 00 b8 01 00 00 07 00 00 00 00 00 00',
        '0000190 00 00 00 00 00 00 00 00 00 00 00 72 2f 72 2e 7a',
        '00001a0 69 70 50 4b 05 06 00 00 00 00 01 00 01 00 35 00',
        '00001b0 00 00 6d 01 00 00 00 00'
    ];
    var data = s.join(' ').replace(/[0-9a-f]{7}/g, '').replace(/\s+/g, '');
    return new Buffer(data, 'hex')
}

function recursiveZip() {
    var bytes = rZipBytes();
    return {
        reader: bytes,
        len: bytes.length
    }
}

function readTestFile(test, ft, f) {
    if (f.entryName != f.name) {
        return fail(f.name, f.entryName)
    }

    if (ft.modtime) {
        var time = new Date(ft.modtime);
        if (time.getTime() != f.header.modTime.getTime()) {
            return fail(time, f.header.modTime)
        }
    }

    if (!testFileMode(test.name, f, ft.mode)) {
        return false
    }

    var size0 = f.header.size,
        uncompressed = f.read(),
        size1 = uncompressed.length;

    if (size0 != size1) {
        return fail(size0, size1);
    }

    var c;
    if (ft.content) {
        c = ft.content
    } else {
        c = fs.readFileSync(path.join("testdata", ft.file))
    }

    if (c.length != uncompressed.length) {
        return fail(c.length, uncompressed.length)
    }

    if (c.toString('hex') != uncompressed.toString('hex')) {
        console.log("content of decompressed bytes is not as expected")
        return false
    }

    return true
}

function testFileMode(zipName, f, want) {
    var mode = f.header.mode;
    if (want == 0) {
        console.log(zipName, f.entryName,'mode: got ', mode, 'want none');
        return false
    } else if (mode != want) {
        console.log(zipName, f.entryName,'mode: got ', mode, 'want', want);
        return false
    }
    return true
}

function readTestZip(test) {
    var reader;

    try {
        if (test.source) {
            var source = test.source();
            reader = new Reader(source.reader, source.size);
        } else {
            reader = new Reader(path.join("testdata", test.name));
        }
    } catch (e) {
        if (!test.error) {
            console.log("Should have not thrown error. Got: '"+ e.message+"'");
            return false
        }
        if (e.message != (test.error || '')) {
            console.log("Should have thrown error: '" + test.error + "' but got '" + e.message + "'");
            return false
        }
        if (test.error == "zip: not a valid zip file") {
            return true;
        }
    }

    if (!test.files) {
        return true
    }

    if (test.comment && reader.comment != test.comment) {
        console.log("Expected comment '"+test.comment+"' got '"+reader.comment+"'");
        return false;
    }

    if (test.files && test.files.length != reader.files.length) {
        console.log("Expected file count", test.files.length, "got", reader.files.length);
        return false;
    }

    // test read of each file
    for (var i = 0; i < test.files.length; i++) {
        if (!readTestFile(test, test.files[i], reader.files[i])) {
            return false;
        }
    }

    return true
}

function testInvalidFiles() {
    return true
}

function fail(expected, returned) {
    console.log("expected '", expected, "' got '",returned,"'");
    return false;
}

module.exports.run = function () {
    for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        console.log("testing: ", test.name);

        if (!readTestZip(test)) {
            return false
        }
    }

    return testInvalidFiles();
};