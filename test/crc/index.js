;(function () {
    var assert = require('assert');
    var path = require('path');
    var Zip = require('../../adm-zip');

    testGoodCrc();
    testBadCrc();

    // Good CRC
    function testGoodCrc() {
        var goodZip = new Zip(path.join(__dirname, 'good_crc.zip'));
        var entries = goodZip.getEntries();
        assert(entries.length === 1, 'Good CRC: Test archive contains exactly 1 file');

        var testFile = entries.filter(function (entry) {
            return entry.entryName === 'lorem_ipsum.txt';
        });
        assert(testFile.length === 1, 'Good CRC: lorem_ipsum.txt file exists as archive entry');

        var testFileEntryName = testFile[0].entryName;
        goodZip.readAsTextAsync(testFileEntryName, function (data, err) {
            assert(!err, 'Good CRC: error object not present');
            assert(data && data.length, 'Good CRC: buffer not empty');
        });
    }

    // Bad CRC
    function testBadCrc() {
        var badZip = new Zip(path.join(__dirname, 'bad_crc.zip'));
        var entries = badZip.getEntries();
        assert(entries.length === 1, 'Bad CRC: Test archive contains exactly 1 file');

        var testFile = entries.filter(function (entry) {
            return entry.entryName === 'lorem_ipsum.txt';
        });
        assert(testFile.length === 1, 'Bad CRC: lorem_ipsum.txt file exists as archive entry');

        var testFileEntryName = testFile[0].entryName;
        badZip.readAsTextAsync(testFileEntryName, function (data, err) {
            assert(data && data.length, 'Bad CRC: buffer not empty');
            assert(err, 'Bad CRC: error object present');
        });
    }
})();
