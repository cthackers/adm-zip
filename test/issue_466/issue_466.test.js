"use strict";

// Issue 466: https://github.com/cthackers/adm-zip/issues/466
// The `name` getter used substr(n.length - 1) for directories, which kept only
// the trailing "/", so a nested directory entry like "a/b/c/" reported an empty
// name instead of "c".

const assert = require("assert");
const Zip = require("../../adm-zip");

describe("ADM-ZIP - Issue 466 - directory entry name", () => {
    const zip = new Zip();
    zip.addFile("a/b/c/", Buffer.alloc(0));
    zip.addFile("top/", Buffer.alloc(0));
    zip.addFile("a/b/file.txt", Buffer.from("x"));
    zip.addFile("root.txt", Buffer.from("y"));

    const nameOf = (entryName) => zip.getEntry(entryName).name;

    it("returns the last segment for a nested directory", () => {
        assert.strictEqual(nameOf("a/b/c/"), "c");
    });

    it("returns the name for a top-level directory", () => {
        assert.strictEqual(nameOf("top/"), "top");
    });

    it("still returns the file name for files", () => {
        assert.strictEqual(nameOf("a/b/file.txt"), "file.txt");
        assert.strictEqual(nameOf("root.txt"), "root.txt");
    });
});
