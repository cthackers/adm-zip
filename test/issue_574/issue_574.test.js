"use strict";

// Issue 574 / CVE-2026-76845: https://github.com/cthackers/adm-zip/issues/574
// extractAllTo/extractEntryTo/extractAllToAsync followed a pre-existing symlink
// placed at the extraction destination, allowing a crafted entry name to write
// content outside of the requested extraction root.
//
// The fix rejects a pre-existing symlink at any path component strictly inside
// the resolved extraction root before writing to it or creating directories
// through it. Path components *above* the root (e.g. an OS-level ancestor
// symlink such as macOS's /var -> /private/var, which sits above every
// os.tmpdir() path) are intentionally left unchecked, since they are not
// attacker-controlled by the archive and rejecting them would break ordinary
// extraction into any temp directory.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Zip = require("../../adm-zip");

const ROOT = path.join(__dirname, "extract-root");
const OUTSIDE = path.join(__dirname, "outside.txt");

let symlinkSupported = true;
try {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
    fs.symlinkSync(".", path.join(ROOT, "link"), "dir");
} catch (error) {
    symlinkSupported = false;
} finally {
    fs.rmSync(ROOT, { recursive: true, force: true });
}

function archive() {
    const zip = new Zip();
    zip.addFile("link/payload.txt", Buffer.from("attacker content"));
    return new Zip(zip.toBuffer());
}

(symlinkSupported ? describe : describe.skip)("ADM-ZIP - Issue 574 - symlink extraction guard", () => {
    beforeEach(() => {
        fs.rmSync(ROOT, { recursive: true, force: true });
        fs.mkdirSync(ROOT, { recursive: true });
        fs.writeFileSync(OUTSIDE, "original");
        fs.symlinkSync(".", path.join(ROOT, "link"), "dir");
    });

    afterEach(() => {
        fs.rmSync(ROOT, { recursive: true, force: true });
        fs.rmSync(OUTSIDE, { force: true });
    });

    it("blocks extractAllTo from writing through a symlink", () => {
        assert.throws(() => archive().extractAllTo(ROOT, true));
        assert.strictEqual(fs.readFileSync(OUTSIDE, "utf8"), "original");
    });

    it("blocks extractEntryTo from writing through a symlink", () => {
        const zip = archive();
        assert.throws(() => zip.extractEntryTo(zip.getEntry("link/payload.txt"), ROOT, true, true));
        assert.strictEqual(fs.readFileSync(OUTSIDE, "utf8"), "original");
    });

    it("reports extractAllToAsync failure without writing through a symlink", (done) => {
        archive().extractAllToAsync(ROOT, true, false, (error) => {
            assert.ok(error);
            assert.strictEqual(fs.readFileSync(OUTSIDE, "utf8"), "original");
            done();
        });
    });

    it("does not flag legitimate nested extraction", () => {
        const zip = new Zip();
        zip.addFile("a/b/normal.txt", Buffer.from("fine"));
        new Zip(zip.toBuffer()).extractAllTo(ROOT, true);
        assert.strictEqual(fs.readFileSync(path.join(ROOT, "a", "b", "normal.txt"), "utf8"), "fine");
    });
});

// Regression check: an OS-level symlink *above* the extraction root (e.g. macOS's
// /var -> /private/var, which sits above os.tmpdir()) must not be mistaken for an
// attacker-controlled symlink and must not block ordinary extraction.
(symlinkSupported ? describe : describe.skip)("ADM-ZIP - Issue 574 - extraction under a symlinked ancestor directory", () => {
    it("extracts normally when the destination lives under a pre-existing OS symlink", () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "adm-zip-issue-574-"));
        try {
            const zip = new Zip();
            zip.addFile("a/b/normal.txt", Buffer.from("fine"));
            new Zip(zip.toBuffer()).extractAllTo(tmp, true);
            assert.strictEqual(fs.readFileSync(path.join(tmp, "a", "b", "normal.txt"), "utf8"), "fine");
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
