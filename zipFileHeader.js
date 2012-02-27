var ZipConstants = require("./zipConstants").ZipConstants,
    ZipUtils = require("./zipUtils").ZipUtils;

exports.ZipFileHeader = function ZipFileHeader() {

    var _version = 0,
        _flags = 0,
        _method = 0,
        _time = 0,
        _crc = 0,
        _compressedSize = 0,
        _size = 0,
        _fnameLen = 0,
        _extraLen = 0;

    return {
        get version () { return _version; },
        set version (val) { _version = val },

        get flags () { return _flags },
        set flags (val) { _flags = val; },

        get method () { return _method; },
        set method (val) { _method = val; },

        get time () {
            return new Date(
                ((_time >> 25) & 0x7f) + 1980,
                ((_time >> 21) & 0x0f) - 1,
                (_time >> 16) & 0x1f,
                (_time >> 11) & 0x1f,
                (_time >> 5) & 0x3f,
                (_time & 0x1f) << 1
            );
        },
        set time (val) {
            val = new Date(val);
            _time = (val.getFullYear() - 1980 & 0x7f) << 25
                | (val.getMonth() + 1) << 21
                | val.getDay() << 16
                | val.getHours() << 11
                | val.getMinutes() << 5
                | val.getSeconds() >> 1;
        },

        get crc () { return _crc; },
        set crc (val) { _crc = val; },

        get compressedSize () { return _compressedSize; },
        set compressedSize (val) { _compressedSize = val; },

        get size () { return _size; },
        set size (val) { _size = val; },

        get fileNameLength () { return _fnameLen; },
        set fileNameLenght (val) { _fnameLen = val; },

        get extraLength () { return _extraLen },
        set extraLength (val) { _extraLen = val; },

        get encripted () { return (_flags & 1) == 1 },

        get fileHeaderSize () {
            return ZipConstants.LOCHDR + _fnameLen + _extraLen;
        },

        loadFromBinary : function(/*Buffer*/data) {

            if (data.length != ZipConstants.LOCHDR || data.readUInt32LE(0) != ZipConstants.LOCSIG) {
                throw "readEntries::Invalid CEN header (bad signature)";
            }

            _version = data.readUInt16LE(ZipConstants.LOCVER);
            _flags = data.readUInt16LE(ZipConstants.LOCFLG);
            _method = data.readUInt16LE(ZipConstants.LOCHOW);
            _time = data.readUInt32LE(ZipConstants.LOCTIM);
            _crc = data.readUInt32LE(ZipConstants.LOCCRC);
            _compressedSize = data.readUInt32LE(ZipConstants.LOCSIZ);
            _size = data.readUInt32LE(ZipConstants.LOCLEN);
            _fnameLen = data.readUInt16LE(ZipConstants.LOCNAM);
            _extraLen = data.readUInt16LE(ZipConstants.LOCEXT);
        },

        toBinary : function() {
            var data = new Buffer(ZipConstants.LOCHDR);
            data.writeUInt32LE(ZipConstants.LOCSIG, 0);
            data.writeUInt16LE(_version, ZipConstants.LOCVER);
            data.writeUInt16LE(_flags, ZipConstants.LOCFLG);
            data.writeUInt16LE(_method, ZipConstants.LOCHOW);
            data.writeUInt32LE(_time, ZipConstants.LOCTIM);
            data.writeInt32LE(_crc, ZipConstants.LOCCRC);
            data.writeUInt32LE(_compressedSize, ZipConstants.LOCSIZ);
            data.writeUInt32LE(_size, ZipConstants.LOCLEN);
            data.writeUInt16LE(_fnameLen, ZipConstants.LOCNAM);
            data.writeUInt16LE(_extraLen, ZipConstants.LOCEXT);
            return data;
        },

        toString : function() {
            return '{\n' +
                '\t"version" : ' + _version + ",\n" +
                '\t"flags" : ' + _flags + ",\n" +
                '\t"method" : ' + ZipUtils.methodToString(_method) + ",\n" +
                '\t"time" : ' + _time + ",\n" +
                '\t"crc" : 0x' + _crc.toString(16).toUpperCase() + ",\n" +
                '\t"compressedSize" : ' + _compressedSize + " bytes,\n" +
                '\t"size" : ' + _size + " bytes,\n" +
                '\t"fnameLen" : ' + _fnameLen + ",\n" +
                '\t"extraLen" : ' + _extraLen + " bytes,\n" +
                '\t"fileHeaderSize" : ' + (ZipConstants.LOCHDR + _fnameLen + _extraLen) + " bytes\n" +
                '}';
        }
    }
};