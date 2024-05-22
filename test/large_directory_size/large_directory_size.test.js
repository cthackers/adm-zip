"use strict";

const assert = require("assert");
const path = require("path");
const Zip = require("../../adm-zip");

describe("read zip file header with invalid large number of entries", () => {
    it("throws too large error", () => {
        // this zip file reports 2147483648 disk entry count which is impossible
        const zip = new Zip(path.join(__dirname, "../assets/large_directory_size.zip"));
        // assert that the following call throws an exception
        assert.throws(() => {
            zip.getEntries();
        }, new Error("Number of disk entries is too large"));
    });
});

