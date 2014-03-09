var Writer = require("./writer");

module.exports.run = function () {
    var w = new Writer();
    if (w.length != 0) {
        console.log("a new writer should have had 0 length");
        return false
    }

    w.write(new Buffer("abc"));
    if (w.length != 3) {
        console.log("invalid length");
        return false
    }

    if (w.buffer.toString() != "abc") {
        console.log("invalid content");
        return false;
    }
    var written = w.write("test");
    if (written != 4) {
        console.log("invalid bytes written reported");
        return false;
    }

    w.write([60,2,3]);

    if (w.length != 10) {
        console.log("invalid length");
        return false;
    }
    return true;
};