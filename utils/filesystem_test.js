var filesystem = require("./filesystem");

module.exports.run = function() {

    if (!filesystem.isDir("testdata")) {
        console.log("isDir failed. testdata should have returned true");
        return false;
    }
    if (filesystem.isWindows) {
        if (!filesystem.isDir("c:/windows") || !filesystem.isDir("c:\\windows")) {
            console.log("isDir failed. should have normalized slashes");
            return false;
        }
    } else {
        if (!filesystem.isDir("/home") || !filesystem.isDir("\home")) {
            console.log("isDir failed. should have normalized slashes");
            return false;
        }
    }

    if (!filesystem.isFile("testdata/test.zip") || !filesystem.isFile("testdata\\test.zip")) {
        console.log("isFile failed. testdata/test.zip should have returned true");
        return false;
    }

    if (filesystem.ls("testdata").length != 26) {
        console.log("ls failed. testdata should contain 26 files");
        return false;
    }

    return true;
};