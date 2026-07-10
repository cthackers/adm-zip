"use strict";

// Issue 379: https://github.com/cthackers/adm-zip/issues/379
// extractAllTo / extractAllToAsync aborted the whole extraction when fs.utimes
// failed ("Unable to set utimes"), even though the file content had already been
// written. Setting the modification time is best-effort metadata (it can fail on
// an invalid date in the archive or a filesystem that doesn't support it) and
// must not fail extraction.

const assert = require("assert");
const realFs = require("fs");
const path = require("path");
const Zip = require("../../adm-zip");

const OUT = path.join(__dirname, "out");

// A real fs whose utimes always fails, to simulate the reported condition.
const failingUtimesFs = Object.assign({}, realFs, {
    utimesSync: () => {
        throw new Error("ENOSYS: utimes not supported");
    },
    utimes: (p, atime, mtime, cb) => cb(new Error("ENOSYS: utimes not supported"))
});

function sampleZip() {
    const zip = new Zip();
    zip.addFile("dir/file.txt", Buffer.from("hello"));
    zip.addFile("top.txt", Buffer.from("bye"));
    return zip.toBuffer();
}

describe("ADM-ZIP - Issue 379 - utimes failure must not abort extraction", () => {
    afterEach(() => realFs.rmSync(OUT, { recursive: true, force: true }));

    it("extractAllTo still extracts content when utimes fails", () => {
        const zip = new Zip(sampleZip(), { fs: failingUtimesFs });
        assert.doesNotThrow(() => zip.extractAllTo(OUT, true, false));
        assert.strictEqual(realFs.readFileSync(path.join(OUT, "dir", "file.txt"), "utf8"), "hello");
        assert.strictEqual(realFs.readFileSync(path.join(OUT, "top.txt"), "utf8"), "bye");
    });

    it("extractAllToAsync still extracts content when utimes fails", (done) => {
        const zip = new Zip(sampleZip(), { fs: failingUtimesFs });
        zip.extractAllToAsync(OUT, true, false, (err) => {
            try {
                assert.ok(!err, err && err.message);
                assert.strictEqual(realFs.readFileSync(path.join(OUT, "dir", "file.txt"), "utf8"), "hello");
                assert.strictEqual(realFs.readFileSync(path.join(OUT, "top.txt"), "utf8"), "bye");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});
