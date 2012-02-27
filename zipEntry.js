var ZipConstants = require("./zipConstants").ZipConstants,
    ZipEntryHeader = require("./zipEntryHeader").ZipEntryHeader,
    ZipFileHeader = require("./zipFileHeader").ZipFileHeader,
    ZipUtils = require("./zipUtils").ZipUtils;


exports.ZipEntry = function ZipEntry() {

    var _header = new ZipEntryHeader(),
        _localFileHeader = new ZipFileHeader(),

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
            switch (_localFileHeader.method) {
                case ZipConstants.STORED:
                    _data = new Buffer(_localFileHeader.size);
                    _compressedData.copy(_data, 0, _localFileHeader.fileHeaderSize);
                    if (ZipUtils.crc32(_data) != _localFileHeader.crc) {
                        throw 'CRC32 checksum failed'
                    }
                    break;
                case ZipConstants.DEFLATED:
                    _data = new Buffer(_header.size);
                    new Inflater(_compressedData.slice(_localFileHeader.entryHeaderSize)).inflate(_data);
                    if (ZipUtils.crc32(_data) != _localFileHeader.crc) {
                        throw 'CRC32 checksum failed'
                    }
                    break;
                default:
                    throw "Invalid compression method on " + _entryName;
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
            _localFileHeader.version = 10;
            _localFileHeader.flags = 0;
            _localFileHeader.method = ZipConstants.STORED;
            _localFileHeader.compressedSize = _data.length;
            _localFileHeader.fileNameLength = _entryName.length;
            _localFileHeader.extraLength = _extra && _extra.length || 0;

            _compressedData = new Buffer(ZipConstants.LOCHDR + _entryName.length + _data.length);
            _localFileHeader.toBinary().copy(_compressedData);
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
            _header.fileNameLength = val.length;
            _localFileHeader.fileNameLenght = val.length;
        },

        get extra () { return _extra; },
        set extra (val) {
            _compressedData = null;
            _extra = val; 
            _header.extraLength = val.length;
            _localFileHeader.extraLength = val.length;
        },
        
        get comment () { return _comment; },
        set comment (val) {
            _comment = val;
            _header.commentLength = val.length;
        },
        
        get name () { return _entryName.split("/").pop(); },
        get isDirectory () { return _isDirectory },

        set compressedData (value) {
            _compressedData = value;
            _localFileHeader.loadFromBinary(_compressedData.slice(0, ZipConstants.LOCHDR));
            _data = null;
        },

        get compressedData () {
            compress();
            return _compressedData
        },

        set data (value) {
            _compressedData = null;
            _localFileHeader.time = +new Date();
            _header.size = _localFileHeader.size;

            if (!value || (value && !value.length)) {
                _localFileHeader.compressedSize = value.length;
                _header.compressedSize = _localFileHeader.compressedSize;
                _localFileHeader.size = value.length;
                _localFileHeader.crc = ZipUtils.crc32(value);
                _header.crc = _localFileHeader.crc;
            }
            _header.method = _localFileHeader.method;

            _data = value;
        },

        get data() {
            decompress();
            return _data
        },

        set header(/*Buffer*/data) {
            _header.loadFromBinary(data);
        },

        get header() {
            return _header;
        },

        toString : function() {
            return '{\n' +
                '\t"entryName" : "' + _entryName + "\",\n" +
                '\t"name" : "' + _entryName.split("/").pop() + "\",\n" +
                '\t"comment" : "' + _comment + "\",\n" +
                '\t"isDirectory" : ' + _isDirectory + ",\n" +
                '\t"header" : ' + _header.toString().replace(/\t/mg, "\t\t") + ",\n" +
                '\t"compressedData" : <' + (_compressedData && _compressedData.length  + " bytes buffer" || "null") + ">\n" +
                '\t"data" : <' + (_data && _data.length  + " bytes buffer" || "null") + ">\n" +
                '}';
        }
    }
};