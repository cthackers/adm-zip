var ZipConstants = require("./zipConstants").ZipConstants;

exports.ZipEntryHeader = function ZipEntryHeader() {
    var _verMade = 0,
        _version = 0,
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
        _inattr = 0,
        _attr = 0,
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

            if (data.length != ZipConstants.CENHDR || data.readUInt32LE(0) != ZipConstants.CENSIG) {
                throw "readEntries::Invalid CEN header (bad signature)";
            }

            _verMade = data.readUInt16LE(ZipConstants.CENVEM);
            _version = data.readUInt16LE(ZipConstants.CENVER);
            _flags = data.readUInt16LE(ZipConstants.CENFLG);
            _method = data.readUInt16LE(ZipConstants.CENHOW);
            _time = data.readUInt32LE(ZipConstants.CENTIM);
            _crc = data.readUInt32LE(ZipConstants.CENCRC);
            _compressedSize = data.readUInt32LE(ZipConstants.CENSIZ);
            _size = data.readUInt32LE(ZipConstants.CENLEN);
            _fnameLen = data.readUInt16LE(ZipConstants.CENNAM);
            _extraLen = data.readUInt16LE(ZipConstants.CENEXT);
            _comLen = data.readUInt16LE(ZipConstants.CENCOM);
            _diskStart = data.readUInt16LE(ZipConstants.CENDSK);
            _inattr = data.readUInt16LE(ZipConstants.CENATT);
            _attr = data.readUInt16LE(ZipConstants.CENATX);
            _offset = data.readUInt32LE(ZipConstants.CENOFF);
        },

        toBinary : function() {
            var data = new Buffer(ZipConstants.CENHDR);
             data.writeUInt16LE(_verMade, ZipConstants.CENVEM);
             data.writeUInt16LE(_version, ZipConstants.CENVER);
             data.writeUInt16LE(_flags, ZipConstants.CENFLG);
             data.writeUInt16LE(_method, ZipConstants.CENHOW);
             data.writeUInt32LE(_time, ZipConstants.CENTIM);
             data.writeUInt32LE(_crc, ZipConstants.CENCRC);
             data.writeUInt32LE(_compressedSize, ZipConstants.CENSIZ);
             data.writeUInt32LE(_size, ZipConstants.CENLEN);
             data.writeUInt16LE(_fnameLen, ZipConstants.CENNAM);
             data.writeUInt16LE(_extraLen, ZipConstants.CENEXT);
             data.writeUInt16LE(_comLen, ZipConstants.CENCOM);
             data.writeUInt16LE(_diskStart, ZipConstants.CENDSK);
             data.writeUInt16LE(_inattr, ZipConstants.CENATT);
             data.writeUInt16LE(_attr, ZipConstants.CENATX);
             data.writeUInt32LE(_offset, ZipConstants.CENOFF);
             return data;
        },

        toString : function() {
            return ''; // @TODO: show this nicely formated
        }
    }
};