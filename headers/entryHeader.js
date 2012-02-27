/* The central directory file header */
var ZipConstants = require("../zipConstants.js").ZipConstants,
    ZipUtils = require("../zipUtils.js").ZipUtils

exports.ZipEntryHeader = function ZipEntryHeader() {
    var _verMade = 0,
        _version = 10,
        _flags = 0,
        _method = 0,
        _time = 0,
        _crc = 0,
        _compressedSize = 0,
        _size = 0,
        _fnameLen = 0,
        _extraLen = 0,
        _comLen = 0,
        _diskStart = 0,
        _inattr = 0666,
        _attr = 0666,
        _offset = 0;

    return {
        get made () { return _verMade; },
        set made (val) { _verMade = val; },

        get version () { return _version; },
        set version (val) { _version = val },

        get flags () { return _flags },
        set flags (val) { _flags = val; },

        get method () { return _method; },
        set method (val) { _method = val; },

        get time () { return _time; },
        set time (val) { _time = val },

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

        get commentLength () { return _comLen },
        set commentLength (val) { _comLen = val },

        get diskNumStart () { return _diskStart },
        set diskNumStart (val) { _diskStart = val },

        get inAttr () { return _inattr },
        set inAttr (val) { _inattr = val },

        get attr () { return _attr },
        set attr (val) { _attr = val },

        get offset () { return _offset },
        set offset (val) { _offset = val },

        get encripted () { return (_flags & 1) == 1 },

        get entryHeaderSize () {
            return ZipConstants.CENHDR + _fnameLen + _extraLen + _comLen;
        },

        loadFromBinary : function(/*Buffer*/data) {
            // data should be 46 bytes and start with "PK 01 02"
            if (data.length != ZipConstants.CENHDR || data.readUInt32LE(0) != ZipConstants.CENSIG) {
                throw "Invalid CEN header (bad signature)";
            }
            // version made by
            _verMade = data.readUInt16LE(ZipConstants.CENVEM);
            // version needed to extract
            _version = data.readUInt16LE(ZipConstants.CENVER);
            // encrypt, decrypt flags
            _flags = data.readUInt16LE(ZipConstants.CENFLG);
            // compression method
            _method = data.readUInt16LE(ZipConstants.CENHOW);
            // modification time (2 bytes time, 2 bytes date)
            _time = data.readUInt32LE(ZipConstants.CENTIM);
            // uncompressed file crc-32 value
            _crc = data.readUInt32LE(ZipConstants.CENCRC);
            // compressed size
            _compressedSize = data.readUInt32LE(ZipConstants.CENSIZ);
            // uncompressed size
            _size = data.readUInt32LE(ZipConstants.CENLEN);
            // filename length
            _fnameLen = data.readUInt16LE(ZipConstants.CENNAM);
            // extra field length
            _extraLen = data.readUInt16LE(ZipConstants.CENEXT);
            // file comment length
            _comLen = data.readUInt16LE(ZipConstants.CENCOM);
            // volume number start
            _diskStart = data.readUInt16LE(ZipConstants.CENDSK);
            // internal file attributes
            _inattr = data.readUInt16LE(ZipConstants.CENATT);
            // external file attributes
            _attr = data.readUInt16LE(ZipConstants.CENATX);
            // LOC header offset
            _offset = data.readUInt32LE(ZipConstants.CENOFF);
        },

        toBinary : function() {
            // CEN header size (46 bytes)
            var data = new Buffer(ZipConstants.CENHDR);
            // "PK\001\002"
            data.writeUInt32LE(ZipConstants.CENSIG, 0);
            // version made by
            data.writeUInt16LE(_verMade, ZipConstants.CENVEM);
            // version needed to extract
            data.writeUInt16LE(_version, ZipConstants.CENVER);
            // encrypt, decrypt flags
            data.writeUInt16LE(_flags, ZipConstants.CENFLG);
            // compression method
            data.writeUInt16LE(_method, ZipConstants.CENHOW);
            // modification time (2 bytes time, 2 bytes date)
            data.writeUInt32LE(_time, ZipConstants.CENTIM);
            // uncompressed file crc-32 value
            data.writeInt32LE(_crc, ZipConstants.CENCRC, true);
            // compressed size
            data.writeUInt32LE(_compressedSize, ZipConstants.CENSIZ);
            // uncompressed size
            data.writeUInt32LE(_size, ZipConstants.CENLEN);
            // filename length
            data.writeUInt16LE(_fnameLen, ZipConstants.CENNAM);
            // extra field length
            data.writeUInt16LE(_extraLen, ZipConstants.CENEXT);
            // file comment length
            data.writeUInt16LE(_comLen, ZipConstants.CENCOM);
            // volume number start
            data.writeUInt16LE(_diskStart, ZipConstants.CENDSK);
            // internal file attributes
            data.writeUInt16LE(_inattr, ZipConstants.CENATT);
            // external file attributes
            data.writeUInt16LE(_attr, ZipConstants.CENATX);
            // LOC header offset
            data.writeUInt32LE(_offset, ZipConstants.CENOFF);
            return data;
        },

        toString : function() {
            return '{\n' +
                '\t"made" : ' + _verMade + ",\n" +
                '\t"version" : ' + _version + ",\n" +
                '\t"flags" : ' + _flags + ",\n" +
                '\t"method" : ' + ZipUtils.methodToString(_method) + ",\n" +
                '\t"time" : ' + _time + ",\n" +
                '\t"crc" : 0x' + _crc.toString(16).toUpperCase() + ",\n" +
                '\t"compressedSize" : ' + _compressedSize + " bytes,\n" +
                '\t"size" : ' + _size + " bytes,\n" +
                '\t"fileNameLength" : ' + _fnameLen + ",\n" +
                '\t"extraLength" : ' + _extraLen + " bytes,\n" +
                '\t"commentLength" : ' + _comLen + " bytes,\n" +
                '\t"diskNumStart" : ' + _diskStart + ",\n" +
                '\t"inAttr" : ' + _inattr + ",\n" +
                '\t"attr" : ' + _attr + ",\n" +
                '\t"offset" : ' + _offset + ",\n" +
                '\t"entryHeaderSize" : ' + (ZipConstants.CENHDR + _fnameLen + _extraLen + _comLen) + " bytes\n" +
                '}';
        }
    }
};