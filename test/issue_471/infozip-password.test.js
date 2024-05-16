"use strict";

// Tests for github issue 471: https://github.com/cthackers/adm-zip/issues/471

const assert = require("assert");
const path = require("path");
const Zip = require("../../adm-zip");

describe("decryption with info-zip spec password check", () => {
    // test decryption with both password types
    it("test decrypted data with password", () => {
        // the issue-471-infozip-encrypted.zip file has been generated with Info-Zip Zip 2.32, but the Info-Zip
        // standard is used by other zip generators as well.
        const infoZip = new Zip(path.join(__dirname, "../assets/issue-471-infozip-encrypted.zip"));
        const entries = infoZip.getEntries();
        assert(entries.length === 1, "Good: Test archive contains exactly 1 file");

        const testFile = entries.filter(function (entry) {
            return entry.entryName === "dummy.txt";
        });
        assert(testFile.length === 1, "Good: dummy.txt file exists as archive entry");

        const readData = entries[0].getData("secret");
        assert(readData.toString("utf8").startsWith("How much wood could a woodchuck chuck"), "Good: buffer matches expectations");

        // assert that the following call throws an exception
        assert.throws(() => {
            const readDataBad = entries[0].getData("badpassword");
        }, "Good: error thrown for bad password");
    });
});
