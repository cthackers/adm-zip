var fs = require("fs"),
    path = require("path"),
    os = require("os");

const PATH_SEPARATOR = path.normalize("/");

var isWindows = os.type().toLowerCase().indexOf("windows") != -1;

module.exports.isWindows = isWindows;

module.exports.createFolder = function(/*String*/name) /*Boolean*/ {

};

module.exports.fileExists = function(/*String*/name) /*Boolean*/ {

};

module.exports.folderExists = function(/*String*/name) /*Boolean*/ {

};

module.exports.writeFile = function(/*String*/name, /*Buffer*/content) /*Boolean*/ {

};

module.exports.rm = function(/*String*/name) /*Boolean*/ {

};

module.exports.ls = function(/*String*/basepath) /*Array*/ {
    if (!module.exports.isDir(basepath)) {
        return [];
    }

    return [];
};

module.exports.isDir = function(/*String*/name) /*Boolean*/ {
    name = path.normalize(name);
    if (!fs.existsSync(name)) {return false}
    return fs.statSync(name).isDirectory();
};

module.exports.isFile = function(/*String*/name) /*Boolean*/ {
    name = path.normalize(name);
    if (!fs.existsSync(name)) {return false}
    return fs.statSync(name).isFile();
};