exports.Reader = require("./reader").Reader;
exports.File = require("./reader").File;
exports.constants = require("./constants");

exports.unitTests = function() {
    return {
        "reader" : require("./reader_test")
    };
};
