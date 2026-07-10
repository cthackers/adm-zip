"use strict";

// Issue 530: https://github.com/cthackers/adm-zip/issues/530
// extractAllTo(..., keepOriginalPermission=true) stopped preserving unix
// permissions in 0.5.15. The file case was fixed later (the fileAttr getter),
// but directory permissions were still dropped: extractAllTo never chmod'd
// directories, and extractAllToAsync chmod'd them eagerly -- which also crashed
// when a directory's mode was restrictive (e.g. 0o500) because the files inside
// could no longer be written.
//
// Directory permissions must be restored after the directory's contents are
// written, deepest first.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Zip = require("../../adm-zip");

const OUT = path.join(__dirname, "out");

// chmod everything back to writable so a restrictive (0o500) directory can be
// removed during cleanup.
function makeRemovable(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        try {
            fs.chmodSync(p, 0o755);
        } catch (e) {
            /* ignore */
        }
        if (fs.statSync(p).isDirectory()) makeRemovable(p);
    }
}

// Archive laid out as:
//   d/            0o500  (read+execute only: must not block writing its files)
//   d/f.txt       0o640
//   d/sub/        0o700
//   d/sub/g.txt   0o644
function sampleZip() {
    const zip = new Zip();
    zip.addFile("d/", Buffer.alloc(0), "", 0o500);
    zip.addFile("d/f.txt", Buffer.from("f"), "", 0o640);
    zip.addFile("d/sub/", Buffer.alloc(0), "", 0o700);
    zip.addFile("d/sub/g.txt", Buffer.from("g"), "", 0o644);
    return zip.toBuffer();
}

const modeOf = (p) => fs.statSync(p).mode & 0o777;

(process.platform === "win32" ? describe.skip : describe)("ADM-ZIP - Issue 530 - keep unix permissions on extract", () => {
    afterEach(() => {
        makeRemovable(OUT);
        fs.rmSync(OUT, { recursive: true, force: true });
    });

    it("extractAllTo restores directory and file permissions", () => {
        new Zip(sampleZip()).extractAllTo(OUT, true, true);

        assert.strictEqual(modeOf(path.join(OUT, "d")), 0o500);
        assert.strictEqual(modeOf(path.join(OUT, "d", "f.txt")), 0o640);
        assert.strictEqual(modeOf(path.join(OUT, "d", "sub")), 0o700);
        assert.strictEqual(modeOf(path.join(OUT, "d", "sub", "g.txt")), 0o644);
        // files under the restrictive 0o500 directory were still written
        assert.strictEqual(fs.readFileSync(path.join(OUT, "d", "f.txt"), "utf8"), "f");
        assert.strictEqual(fs.readFileSync(path.join(OUT, "d", "sub", "g.txt"), "utf8"), "g");
    });

    it("extractAllToAsync restores permissions without locking itself out", (done) => {
        new Zip(sampleZip()).extractAllToAsync(OUT, true, true, (err) => {
            try {
                assert.ok(!err, err && err.message);
                assert.strictEqual(modeOf(path.join(OUT, "d")), 0o500);
                assert.strictEqual(modeOf(path.join(OUT, "d", "f.txt")), 0o640);
                assert.strictEqual(modeOf(path.join(OUT, "d", "sub")), 0o700);
                assert.strictEqual(modeOf(path.join(OUT, "d", "sub", "g.txt")), 0o644);
                assert.strictEqual(fs.readFileSync(path.join(OUT, "d", "sub", "g.txt"), "utf8"), "g");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("leaves permissions at the OS default when keepOriginalPermission is false", () => {
        new Zip(sampleZip()).extractAllTo(OUT, true, false);
        // not asserting an exact mode (depends on umask); just that extraction
        // succeeds and the restrictive archived mode was NOT applied
        assert.notStrictEqual(modeOf(path.join(OUT, "d")), 0o500);
        assert.strictEqual(fs.readFileSync(path.join(OUT, "d", "f.txt"), "utf8"), "f");
    });
});
