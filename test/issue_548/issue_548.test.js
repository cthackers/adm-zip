"use strict";

// Issues 548 / 533 / 554: https://github.com/cthackers/adm-zip/issues/548
// A regression introduced in 0.5.15 (PR #508) made adm-zip locate and strictly
// parse the trailing data descriptor whenever general-purpose flag bit 3 is set,
// throwing ("No descriptor present" / "Descriptor data is malformed" / ...) when
// the descriptor was absent or in an unexpected shape. Many valid archives set
// the flag but write the real crc/sizes into the local and central headers
// without emitting a descriptor, so readable zips were rejected.
//
// The fix validates the payload against the authoritative central-directory
// crc-32 instead of the descriptor, which keeps the integrity check while
// accepting these archives.

const assert = require("assert");
const path = require("path");
const Zip = require("../../adm-zip");
const Utils = require("../../util/utils");

const u16 = (n) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n >>> 0);
    return b;
};
const u32 = (n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n >>> 0);
    return b;
};

// Single STORED entry with the data-descriptor flag (bit 3) set but NO
// descriptor written after the data. `crc` is the value placed in the central
// directory header.
function craftDescriptorFlaggedZip(crc) {
    const name = Buffer.from("f.txt");
    const content = Buffer.from("hello world");
    const flags = 0x08; // bit 3: data descriptor
    const lfh = Buffer.concat([
        u32(0x04034b50),
        u16(20),
        u16(flags),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(content.length),
        u32(content.length),
        u16(name.length),
        u16(0),
        name,
        content
    ]);
    const cd = Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(flags),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(content.length),
        u32(content.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(0),
        name
    ]);
    const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(1), u16(1), u32(cd.length), u32(lfh.length), u16(0)]);
    return Buffer.concat([lfh, cd, eocd]);
}

describe("ADM-ZIP - Issue 548/533/554 - descriptor-flagged archives", () => {
    it("reads a real-world zip that sets the descriptor flag but writes no descriptor", () => {
        const zip = new Zip(path.join(__dirname, "testfile.zip"));
        const entries = zip.getEntries();
        assert.strictEqual(entries.length, 1);
        assert.strictEqual(entries[0].header.flags_desc, true, "fixture must have bit 3 set");
        assert.doesNotThrow(() => entries[0].getData());
        assert.strictEqual(zip.readAsText("index.js").startsWith('"use strict";'), true);
    });

    it("accepts a descriptor-flagged entry whose central-directory crc is correct", () => {
        const crc = Utils.crc32(Buffer.from("hello world")) >>> 0;
        const zip = new Zip(craftDescriptorFlaggedZip(crc));
        assert.strictEqual(zip.getEntries()[0].getData().toString(), "hello world");
    });

    it("still rejects a descriptor-flagged entry whose crc does not match (integrity preserved)", () => {
        const zip = new Zip(craftDescriptorFlaggedZip(0xdeadbeef));
        assert.throws(() => zip.getEntries()[0].getData(), /CRC32/);
    });
});
