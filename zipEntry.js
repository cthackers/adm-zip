var ZipConstants = require("./zipConstants").ZipConstants,
    ZipEntryHeader = require("./zipEntryHeader").ZipEntryHeader;


exports.ZipEntry = function ZipEntry() {

    var header = new ZipEntryHeader(),

        _entryName = "",
        _isDirectory = false,
        _extra = null,
        _compressedData = null,
        _data = null,
        _comment = "";

    return {
        get entryName () { return _entryName; },
        set entryName (val) { 
            _entryName = val; 
            _isDirectory = val.charAt(_entryName.length - 1) == "/";
            header.fileNameLength = val.length;
        },

        get extra () { return _extra; },
        set extra (val) { 
            _extra = val; 
            header.extraLength = val.length;
        },
        
        get comment () { return _comment; },
        set comment (val) { 
            _comment = val;
            header.commentLength = val.length;
        },
        
        get name () { return _entryName.split("/").pop(); },
        get isDirectory () { return _isDirectory },

        set compressedData (value) {
            _compressedData = value;
        },

        get compressedData () {
            if (_compressedData) {
                return _compressedData;
            } else {
                // compress data and return it
                return null;
            }
        },

        set data (value) {
            _data = value;
        },

        get data() {
            if (_data) {
                return _data;
            } else {
                if (_compressedData == null) {
                    return new Buffer();
                }

                // decompress data and return it
                switch (header.method) {
                    case ZipConstants.STORED:
                        var idx = 28 + header.fileNameLength + 2;
                        console.log(header.extraLength)
                        return _compressedData.slice(idx);
                        break;
                    case ZipConstants.DEFLATED:
                        _data = new Buffer(header.size);
                        var idx = 28 + header.fileNameLength + 2;
                        new Inflater(_compressedData.slice(idx, idx + header.compressedSize)).inflate(_data);
                        return _data;
                        break;
                    default:
                        throw "Invalid compression method on " + _entryName;
                }
            }
        },

        set header(/*Buffer*/data) {
            header.loadFromBinary(data);
        },

        get header() {
            return header;
        },

        toString : function() {

        }
    }
};