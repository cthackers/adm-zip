"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
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
    rimraf.sync(ROOT);
}

(symlinkSupported ? describe : describe.skip)("ADM-ZIP - extraction symlink protection", () => {
    beforeEach(() => {
        fs.rmSync(ROOT, { recursive: true, force: true });
        fs.mkdirSync(ROOT, { recursive: true });
        fs.writeFileSync(OUTSIDE, "original");
        fs.symlinkSync(".", path.join(ROOT, "link"), "dir");
    });

    afterEach(() => {
        rimraf.sync(ROOT);
        fs.rmSync(OUTSIDE, { force: true });
    });

    function archive() {
        const zip = new Zip();
        zip.addFile("link/payload.txt", "attacker content");
        return new Zip(zip.toBuffer());
    }

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
});
