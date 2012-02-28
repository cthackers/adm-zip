var ZipConstants = require("./zipConstants").ZipConstants,
    ZipEntryHeader = require("./headers/entryHeader.js").ZipEntryHeader,
    ZipDataHeader = require("./headers/dataHeader.js").ZipDataHeader,
    Inflater = require("./methods/inflater.js").Inflater,
    Deflater = require("./methods/deflater.js").Deflater,
    ZipUtils = require("./zipUtils").ZipUtils;


exports.ZipEntry = function ZipEntry() {

    var _entryHeader = new ZipEntryHeader(),
        _dataHeader = new ZipDataHeader(),

        _entryName = "",
        _isDirectory = false,
        _extra = null,
        _compressedData = null,
        _data = null,
        _comment = "";

    function decompress() {
        if (_data == null)   {
            if (_compressedData == null) {
                throw 'Noting to decompress'
            }
            switch (_dataHeader.method) {
                case ZipConstants.STORED:
                    _data = new Buffer(_dataHeader.size);
                    _compressedData.copy(_data, 0, _dataHeader.fileHeaderSize);
                    if (ZipUtils.crc32(_data) != _dataHeader.crc) {
                        throw 'CRC32 checksum failed'
                    }
                    break;
                case ZipConstants.DEFLATED:
                    _data = new Buffer(_entryHeader.size);
                    new Inflater(_compressedData.slice(_dataHeader.fileHeaderSize)).inflate(_data);
                    if (ZipUtils.crc32(_data) != _dataHeader.crc) {
                        throw 'CRC32 checksum failed'
                    }
                    break;
                default:
                    throw "Invalid methods method on " + _entryName;
            }
        }
    }

    function compress() {
        if (_compressedData == null) {
            if (_data == null && !_isDirectory) {
                throw 'Nothing to compress '
            }
            if (_isDirectory) {
                _data = new Buffer(0);
            }
            // Local file header
            _dataHeader.version = 10;
            _dataHeader.flags = 0;
            _dataHeader.method = ZipConstants.STORED;
            _dataHeader.compressedSize = _data.length;
            _dataHeader.fileNameLength = _entryName.length;
            _dataHeader.extraLength = _extra && _extra.length || 0;

            _compressedData = new Buffer(ZipConstants.LOCHDR + _entryName.length + _data.length);
            _dataHeader.toBinary().copy(_compressedData);
            _compressedData.write(_entryName, ZipConstants.LOCHDR);
            _data.copy(_compressedData, ZipConstants.LOCHDR + _entryName.length);
        }
    }

    return {
        get entryName () { return _entryName; },
        set entryName (val) {
            _compressedData = null;
            _entryName = val;
            _isDirectory = val.charAt(_entryName.length - 1) == "/";
            _entryHeader.fileNameLength = val.length;
            _dataHeader.fileNameLenght = val.length;
        },

        get extra () { return _extra; },
        set extra (val) {
            _compressedData = null;
            _extra = val; 
            _entryHeader.extraLength = val.length;
            _dataHeader.extraLength = val.length;
        },
        
        get comment () { return _comment; },
        set comment (val) {
            _comment = val;
            _entryHeader.commentLength = val.length;
        },
        
        get name () { return _entryName.split("/").pop(); },
        get isDirectory () { return _isDirectory },

        set compressedData (value) {
            _compressedData = value;
            _dataHeader.loadFromBinary(_compressedData.slice(0, ZipConstants.LOCHDR));
            _data = null;
        },

        get compressedData () {
            compress();
            return _compressedData
        },

        set data (value) {
            _compressedData = null;
            _dataHeader.time = +new Date();
            _entryHeader.size = _dataHeader.size;

            if (!value || (value && !value.length)) {
                _dataHeader.compressedSize = value.length;
                _entryHeader.compressedSize = _dataHeader.compressedSize;
                _dataHeader.size = value.length;
                _dataHeader.crc = ZipUtils.crc32(value);
                _entryHeader.crc = _dataHeader.crc;
            }
            _entryHeader.method = _dataHeader.method;

            _data = value;
        },

        get data() {
            decompress();
            return _data
        },

        set header(/*Buffer*/data) {
            _entryHeader.loadFromBinary(data);
        },

        get header() {
            return _entryHeader;
        },

        toString : function() {
            return '{\n' +
                '\t"entryName" : "' + _entryName + "\",\n" +
                '\t"name" : "' + _entryName.split("/").pop() + "\",\n" +
                '\t"comment" : "' + _comment + "\",\n" +
                '\t"isDirectory" : ' + _isDirectory + ",\n" +
                '\t"header" : ' + _entryHeader.toString().replace(/\t/mg, "\t\t") + ",\n" +
                '\t"compressedData" : <' + (_compressedData && _compressedData.length  + " bytes buffer" || "null") + ">\n" +
                '\t"data" : <' + (_data && _data.length  + " bytes buffer" || "null") + ">\n" +
                '}';
        }
    }
};