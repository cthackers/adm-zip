exports.Reader = require("./reader").Reader;
exports.File = require("./reader").File;
exports.constants = require("./constants");

exports.test = function() {
    return require("./reader_test").run();
};