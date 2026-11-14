"use strict";

// Issue 589: https://github.com/cthackers/adm-zip/issues/589
// "addLocalFolder RegExp filter with g or y flag skips matching files".
// A global or sticky RegExp keeps lastIndex between test() calls, so the
// filter skipped every other matching file.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Zip = require("../../adm-zip");

describe("ADM-ZIP - Issue 589 - RegExp filter with g or y flag", () => {
    const expected = ["a.txt", "b.txt", "c.txt", "d.txt"];
    let dir;

    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "adm-zip-589-"));
        for (const name of ["a.txt", "b.txt", "c.txt", "d.txt", "e.md"]) {
            fs.writeFileSync(path.join(dir, name), "x");
        }
    });

    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const names = (zip) =>
        zip
            .getEntries()
            .map((e) => e.entryName)
            .sort();

    for (const filter of [/\.txt$/g, /^\w\.txt$/y]) {
        describe(`filter ${filter}`, () => {
            it("addLocalFolder", () => {
                const zip = new Zip();
                zip.addLocalFolder(dir, "", filter);
                assert.deepStrictEqual(names(zip), expected);
            });

            it("addLocalFolderAsync", (done) => {
                const zip = new Zip();
                zip.addLocalFolderAsync(
                    dir,
                    (ok, err) => {
                        if (err) return done(err);
                        if (!ok) return;
                        try {
                            assert.deepStrictEqual(names(zip), expected);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    },
                    "",
                    filter
                );
            });

            it("addLocalFolderPromise", async () => {
                const zip = new Zip();
                await zip.addLocalFolderPromise(dir, { filter });
                assert.deepStrictEqual(names(zip), expected);
            });

            it("can reuse the same RegExp", () => {
                for (let i = 0; i < 2; i++) {
                    const zip = new Zip();
                    zip.addLocalFolder(dir, "", filter);
                    assert.deepStrictEqual(names(zip), expected);
                }
            });
        });
    }
});
