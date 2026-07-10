"use strict";

// The .test() method indexed the entries array with an entry object
// (`_zip.entries[entry]`) instead of calling `entry.getData()`. That threw for
// every file entry, was swallowed, and made test() return false for any archive
// containing at least one file. It now verifies each entry decompresses.

const assert = require("assert");
const Zip = require("../../adm-zip");

describe("ADM-ZIP - .test() archive integrity", () => {
    it("returns true for a valid archive", () => {
        const zip = new Zip();
        zip.addFile("a.txt", Buffer.from("hello world ".repeat(50)));
        zip.addFile("dir/b.txt", Buffer.from("more content"));
        assert.strictEqual(new Zip(zip.toBuffer()).test(), true);
    });

    it("returns true for an archive with only directories", () => {
        const zip = new Zip();
        zip.addFile("dir/", Buffer.alloc(0));
        assert.strictEqual(new Zip(zip.toBuffer()).test(), true);
    });

    it("returns false when an entry's data is corrupted", () => {
        const zip = new Zip();
        zip.addFile("a.txt", Buffer.from("hello world this is compressible ".repeat(20)));
        const buf = zip.toBuffer();
        // flip a byte inside the first entry's compressed data (after LOCHDR + name)
        const corrupted = Buffer.from(buf);
        corrupted[40] ^= 0xff;
        assert.strictEqual(new Zip(corrupted).test(), false);
    });
});
