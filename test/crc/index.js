const assert = require("assert");
const path = require("path");
const Zip = require("../../adm-zip");
const rimraf = require("rimraf");

describe("crc", () => {
    const destination = __dirname + "/xxx";

    beforeEach((done) => rimraf(destination, done));

    it("Good CRC", (done) => {
        const goodZip = new Zip(path.join(__dirname, "good_crc.zip"));
        const entries = goodZip.getEntries();
        assert(entries.length === 1, "Good CRC: Test archive contains exactly 1 file");

        const testFile = entries.filter(function (entry) {
            return entry.entryName === "lorem_ipsum.txt";
        });
        assert(testFile.length === 1, "Good CRC: lorem_ipsum.txt file exists as archive entry");

        const testFileEntryName = testFile[0].entryName;
        goodZip.readAsTextAsync(testFileEntryName, function (data, err) {
            assert(!err, "Good CRC: error object not present");
            assert(data && data.length, "Good CRC: buffer not empty");
            done();
        });
    });

    it("Bad CRC - async method returns err string", (done) => {
        const badZip = new Zip(path.join(__dirname, "bad_crc.zip"));
        const entries = badZip.getEntries();
        assert(entries.length === 1, "Bad CRC: Test archive contains exactly 1 file");

        const testFile = entries.filter(function (entry) {
            return entry.entryName === "lorem_ipsum.txt";
        });
        assert(testFile.length === 1, "Bad CRC: lorem_ipsum.txt file exists as archive entry");

        const testFileEntryName = testFile[0].entryName;
        badZip.readAsTextAsync(testFileEntryName, function (data, err) {
            assert(data && data.length, "Bad CRC: buffer not empty");
            assert(err, "Bad CRC: error object present");
            done();
        });
    });

    it("Bad CRC - sync method throws an error object", (done) => {
        const badZip = new Zip(path.join(__dirname, "bad_crc.zip"));
        const entries = badZip.getEntries();
        const testFile = entries.filter(function (entry) {
            return entry.entryName === "lorem_ipsum.txt";
        });
        const testFileEntryName = testFile[0].entryName;

        try {
            badZip.readAsText(testFileEntryName);
        } catch (e) {
            assert(e.stack, "Bad CRC: threw something other than an Error instance");
            done();
            return;
        }
        assert.fail("Bad CRC: did not throw exception");
    });

    it("CRC is not changed after re-created", () => {
        const goodZip = new Zip(path.join(__dirname, "good_crc.zip"));
        const original = goodZip.getEntries()[0].header.crc;
        assert.equal(original, 3528145192);
        const newZipPath = destination + "/good_crc_new.zip";
        goodZip.writeZip(newZipPath);
        const newZip = new Zip(newZipPath);
        const actual = newZip.getEntries()[0].header.crc;
        assert.equal(actual, original);
    });
});
