"use strict";

// Issue 587: https://github.com/cthackers/adm-zip/issues/587
// Entry names that differ textually but resolve to the same path on disk
// ("./x", "a/../x", "x", or "a/" vs "a") were accepted as distinct entries by
// readEntries(), while extractAllTo() canonicalised them onto one file. The
// second entry was silently dropped, and getEntry()/readAsText() could validate
// one entry while extraction wrote another.
//
// The archive must now be rejected when it is read, and extraction must not
// report success when two entries end up on the same file.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Zip = require("../../adm-zip");

const OUT = path.join(__dirname, "out");

// Zip.addFile() normalises names, so a colliding archive cannot be built with
// it. Build the archive with unique same-length placeholder names, then patch
// the real names into the buffer (local header + central directory).
// Names must be at least 4 characters so the placeholders are unambiguous.
function craft(entries) {
    const zip = new Zip();
    const marks = entries.map((e, i) => {
        const letter = String.fromCharCode(0x51 + i); // Q, R, S, ...
        const isDir = e.name.endsWith("/");
        const mark = letter.repeat(e.name.length - (isDir ? 1 : 0)) + (isDir ? "/" : "");
        zip.addFile(mark, isDir ? Buffer.alloc(0) : Buffer.from(e.data || ""));
        return mark;
    });

    const buf = zip.toBuffer();
    entries.forEach((e, i) => {
        const markBuf = Buffer.from(marks[i]);
        const nameBuf = Buffer.from(e.name);
        assert.strictEqual(markBuf.length, nameBuf.length, "placeholder must keep the name length");
        let found = 0;
        for (let at = buf.indexOf(markBuf); at !== -1; at = buf.indexOf(markBuf, at + markBuf.length)) {
            nameBuf.copy(buf, at);
            found++;
        }
        assert.strictEqual(found, 2, `expected local + central header for "${e.name}"`);
    });
    return buf;
}

// does the filesystem under OUT treat "a" and "A" as the same file?
function isCaseInsensitive() {
    fs.mkdirSync(OUT, { recursive: true });
    const probe = path.join(OUT, "case-probe.txt");
    fs.writeFileSync(probe, "x");
    const result = fs.existsSync(path.join(OUT, "CASE-PROBE.TXT"));
    fs.rmSync(probe, { force: true });
    return result;
}

const nothingWritten = () => !fs.existsSync(OUT) || fs.readdirSync(OUT).length === 0;

describe("ADM-ZIP - Issue 587 - colliding entry names", () => {
    afterEach(() => {
        fs.rmSync(OUT, { recursive: true, force: true });
    });

    describe("names that normalise to the same path are rejected", () => {
        const cases = {
            "a/../x.txt then x.txt": [
                { name: "a/../x.txt", data: "A" },
                { name: "x.txt", data: "B" }
            ],
            "x.txt then a/../x.txt": [
                { name: "x.txt", data: "B" },
                { name: "a/../x.txt", data: "A" }
            ],
            "./hello.txt then hello.txt (Snyk report)": [
                { name: "./hello.txt", data: "A" },
                { name: "hello.txt", data: "B" }
            ],
            "hello.txt then ./hello.txt": [
                { name: "hello.txt", data: "B" },
                { name: "./hello.txt", data: "A" }
            ],
            "doubled slash dir//x.txt vs dir/x.txt": [
                { name: "dir//x.txt", data: "A" },
                { name: "dir/x.txt", data: "B" }
            ],
            "directory dir/ then file dir": [{ name: "dir/" }, { name: "dir", data: "B" }],
            "file dir then directory dir/": [{ name: "dir", data: "B" }, { name: "dir/" }]
        };

        for (const [title, entries] of Object.entries(cases)) {
            it(`extractAllTo throws and writes nothing: ${title}`, () => {
                const buf = craft(entries);
                assert.throws(() => new Zip(buf).extractAllTo(OUT, true));
                assert.ok(nothingWritten(), "no entry may be extracted from a rejected archive");
            });
        }

        it("extractAllTo throws regardless of the overwrite flag", () => {
            const buf = craft(cases["a/../x.txt then x.txt"]);
            assert.throws(() => new Zip(buf).extractAllTo(OUT, false));
            assert.throws(() => new Zip(buf).extractAllTo(OUT, true));
        });

        it("extractAllToAsync rejects", async () => {
            const buf = craft(cases["a/../x.txt then x.txt"]);
            await assert.rejects(() => new Zip(buf).extractAllToAsync(OUT, true, false));
            assert.ok(nothingWritten());
        });

        it("getEntry / readAsText cannot validate one entry while another is extracted", () => {
            // the Snyk scenario: inspect "hello.txt", then extract the archive
            const buf = craft(cases["./hello.txt then hello.txt (Snyk report)"]);
            assert.throws(() => new Zip(buf).getEntry("hello.txt"));
            assert.throws(() => new Zip(buf).readAsText("hello.txt"));
        });
    });

    describe("a file cannot also be a parent directory", () => {
        it("file afile with afile/b.txt is rejected", () => {
            const buf = craft([
                { name: "afile", data: "A" },
                { name: "afile/b.txt", data: "B" }
            ]);
            assert.throws(() => new Zip(buf).extractAllTo(OUT, true));
            assert.ok(nothingWritten());
        });

        it("afile/b.txt before afile is rejected too (order independent)", () => {
            const buf = craft([
                { name: "afile/b.txt", data: "B" },
                { name: "afile", data: "A" }
            ]);
            assert.throws(() => new Zip(buf).extractAllTo(OUT, true));
            assert.ok(nothingWritten());
        });
    });

    describe("valid archives still extract", () => {
        it("a single entry with a redundant prefix is extracted to the normalised path", () => {
            const buf = craft([{ name: "./only.txt", data: "ok" }]);
            new Zip(buf).extractAllTo(OUT, true);
            assert.strictEqual(fs.readFileSync(path.join(OUT, "only.txt"), "utf8"), "ok");
        });

        it("directory entry followed by its children extracts normally", () => {
            const buf = craft([{ name: "dir/" }, { name: "dir/one.txt", data: "1" }, { name: "dir/sub/two.txt", data: "2" }]);
            new Zip(buf).extractAllTo(OUT, true);
            assert.strictEqual(fs.readFileSync(path.join(OUT, "dir", "one.txt"), "utf8"), "1");
            assert.strictEqual(fs.readFileSync(path.join(OUT, "dir", "sub", "two.txt"), "utf8"), "2");
        });

        it("files whose names merely share a prefix are not collisions", () => {
            const buf = craft([
                { name: "afile", data: "A" },
                { name: "afile2/b.txt", data: "B" }
            ]);
            new Zip(buf).extractAllTo(OUT, true);
            assert.strictEqual(fs.readFileSync(path.join(OUT, "afile"), "utf8"), "A");
            assert.strictEqual(fs.readFileSync(path.join(OUT, "afile2", "b.txt"), "utf8"), "B");
        });

        it("re-extracting over files from a previous run with overwrite=false still keeps them and does not throw", () => {
            const zip = new Zip();
            zip.addFile("keep.txt", Buffer.from("new"));
            const buf = zip.toBuffer();

            fs.mkdirSync(OUT, { recursive: true });
            fs.writeFileSync(path.join(OUT, "keep.txt"), "old");

            new Zip(buf).extractAllTo(OUT, false);
            assert.strictEqual(fs.readFileSync(path.join(OUT, "keep.txt"), "utf8"), "old");

            new Zip(buf).extractAllTo(OUT, true);
            assert.strictEqual(fs.readFileSync(path.join(OUT, "keep.txt"), "utf8"), "new");
        });

        it("names differing only by case are fine on a case-sensitive filesystem", function () {
            if (isCaseInsensitive()) this.skip();
            const zip = new Zip();
            zip.addFile("Case.txt", Buffer.from("upper"));
            zip.addFile("case.txt", Buffer.from("lower"));
            new Zip(zip.toBuffer()).extractAllTo(OUT, true);
            assert.strictEqual(fs.readFileSync(path.join(OUT, "Case.txt"), "utf8"), "upper");
            assert.strictEqual(fs.readFileSync(path.join(OUT, "case.txt"), "utf8"), "lower");
        });
    });

    describe("case-insensitive filesystems", () => {
        for (const overwrite of [false, true]) {
            it(`A.txt and a.txt reaching one file make extractAllTo throw (overwrite=${overwrite})`, function () {
                if (!isCaseInsensitive()) this.skip(); // distinct files on case-sensitive systems
                const zip = new Zip();
                zip.addFile("A.txt", Buffer.from("first"));
                zip.addFile("a.txt", Buffer.from("second"));
                const buf = zip.toBuffer();

                assert.throws(() => new Zip(buf).extractAllTo(OUT, overwrite));
                // the first entry is not silently replaced by the second
                const written = fs.readdirSync(OUT).map((n) => fs.readFileSync(path.join(OUT, n), "utf8"));
                assert.deepStrictEqual(written, ["first"]);
            });
        }
    });
});