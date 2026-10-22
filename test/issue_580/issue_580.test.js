"use strict";

// Issue 580: https://github.com/cthackers/adm-zip/issues/580
// extractEntryTo(name, ..., keepOriginalPermission=true) read fileAttr from
// the original argument. A string name has no header, so extraction threw
// before writing the file. The resolved entry already has the header.
// childCount() is documented to return an integer, but a missing entry fell
// off the end of the function and returned undefined.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Zip = require("../../adm-zip");

const OUT = path.join(__dirname, "out");

describe("ADM-ZIP - Issue 580 - string entry permissions and childCount", () => {
    afterEach(() => fs.rmSync(OUT, { recursive: true, force: true }));

    it("extracts a file named by string when keepOriginalPermission is true", () => {
        const zip = new Zip();
        zip.addFile("hello.txt", Buffer.from("hello world"), "", 0o640);

        const written = zip.extractEntryTo("hello.txt", OUT, false, true, true);

        assert.strictEqual(written, true);
        assert.strictEqual(fs.readFileSync(path.join(OUT, "hello.txt"), "utf8"), "hello world");
    });

    it("still reads permissions from a ZipEntry object", () => {
        const zip = new Zip();
        zip.addFile("hello.txt", Buffer.from("hello world"), "", 0o640);
        const entry = zip.getEntry("hello.txt");

        const written = zip.extractEntryTo(entry, OUT, false, true, true);

        assert.strictEqual(written, true);
        assert.strictEqual(fs.readFileSync(path.join(OUT, "hello.txt"), "utf8"), "hello world");
    });

    it("childCount returns 0 when the entry does not exist", () => {
        const zip = new Zip();
        zip.addFile("a.txt", Buffer.from("a"));
        zip.addFile("dir/", Buffer.alloc(0));
        zip.addFile("dir/b.txt", Buffer.from("b"));

        assert.strictEqual(zip.childCount("does/not/exist"), 0);
        assert.strictEqual(zip.childCount("a.txt"), 0);
        assert.strictEqual(zip.childCount("dir/"), 1);
    });
});
