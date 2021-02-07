var fs = require('./fileSystem').require(),
    pth = require('path');

fs.existsSync = fs.existsSync || pth.existsSync;

module.exports = function (/*String*/ path) {
    var _path = path || '',
        _permissions = 0,
        _obj = newAttr(),
        _stat = null;

    function newAttr() {
        return {
            directory: false,
            readonly: false,
            hidden: false,
            executable: false,
            mtime: 0,
            atime: 0
        };
    }

    if (_path && fs.existsSync(_path)) {
        _stat = fs.statSync(_path);
        _obj.directory = _stat.isDirectory();
        _obj.mtime = _stat.mtime;
        _obj.atime = _stat.atime;
        _obj.executable = (0o111 & _stat.mode) != 0; // file is executable who ever har right not just owner
        _obj.readonly = (0o200 & _stat.mode) == 0; // readonly if owner has no write right
        _obj.hidden = pth.basename(_path)[0] === '.';
    } else {
        console.warn('Invalid path: ' + _path);
    }

    return {
        get directory() {
            return _obj.directory;
        },

        get readOnly() {
            return _obj.readonly;
        },

        get hidden() {
            return _obj.hidden;
        },

        get mtime() {
            return _obj.mtime;
        },

        get atime() {
            return _obj.atime;
        },

        get executable() {
            return _obj.executable;
        },

        decodeAttributes: function (val) {},

        encodeAttributes: function (val) {},

        toString: function () {
            return [
                '{',
                '\t"path" : "' + _path + ',',
                '\t"isDirectory" : ' + _obj.directory + ',',
                '\t"isReadOnly" : ' + _obj.readonly + ',',
                '\t"isHidden" : ' + _obj.hidden + ',',
                '\t"isExecutable" : ' + _obj.executable + ',',
                '\t"mTime" : ' + _obj.mtime + ',',
                '\t"aTime" : ' + _obj.atime,
                '}'
            ].join('\n');
        }
    };
};
