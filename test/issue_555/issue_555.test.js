"use strict";

// Issue 555: https://github.com/cthackers/adm-zip/issues/555
// "Corrupted ZIP being created from simple read then write".
// sample.docx stores its entries with a data descriptor (general-purpose
// flag bit 3). Before the fix, read -> write -> read threw on getData()
// with "ADM-ZIP: No descriptor present".

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Zip = require("../../adm-zip");

const DOCX = path.join(__dirname, "sample.docx");
const OUT = path.join(__dirname, "directWrite.zip");

describe("ADM-ZIP - Issue 555 - corrupted zip from read then write", () => {
    after(() => fs.rmSync(OUT, { force: true }));

    it("read then write keeps the zip readable", async () => {
        const unzipped1 = new Zip(fs.readFileSync(DOCX));
        await unzipped1.writeZipPromise(OUT);
        const modifiedBuffer = await unzipped1.toBufferPromise();

        const unzipped2 = new Zip(modifiedBuffer);
        for (const entry of unzipped2.getEntries()) {
            assert.doesNotThrow(() => entry.getData(), `failed to read ${entry.entryName}`);
        }
    });
});
