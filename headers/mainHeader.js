/* The entries in the end of central directory */
var ZipConstants = require("../zipConstants").ZipConstants;

exports.ZipMainHeader = function ZipMainHeader() {
    var _volumeEntries = 0,
        _totalEntries = 0,
        _size = 0,
        _offset = 0,
        _commentLength = 0;

    return {
        get diskEntries () { return _volumeEntries },
        set diskEntries (/*Number*/val) { _volumeEntries = val; },

        get totalEntries () { return _totalEntries },
        set totalEntries (/*Number*/val) { _totalEntries = val; },

        get size () { return _size },
        set size (/*Number*/val) { _size = val; },

        get offset () { return _offset },
        set offset (/*Number*/val) { _offset = val; },

        get commentLength () { return _commentLength },
        set commentLength (/*Number*/val) { _commentLength = val; },

        loadFromBinary : function(/*Buffer*/data) {
            // data should be 22 bytes and start with "PK 05 06"
            if (data.length != ZipConstants.ENDHDR || data.readUInt32LE(0) != ZipConstants.ENDSIG)
                throw "Invalid END header (bad signature)";

            // number of entries on this volume
            _volumeEntries = data.readUInt16LE(ZipConstants.ENDSUB);
            // total number of entries
            _totalEntries = data.readUInt16LE(ZipConstants.ENDTOT);
            // central directory size in bytes
            _size = data.readUInt32LE(ZipConstants.ENDSIZ);
            // offset of first CEN header
            _offset = data.readUInt32LE(ZipConstants.ENDOFF);
            // zip file comment length
            _commentLength = data.readUInt16LE(ZipConstants.ENDCOM);
        },

        toBinary : function() {
           var b = new Buffer(ZipConstants.ENDHDR + _commentLength);
            // "PK 05 06" signature
            b.writeUInt32LE(ZipConstants.ENDSIG, 0);
            b.writeUInt32LE(0, 4);
            // number of entries on this volume
            b.writeUInt16LE(ZipConstants.ENDSUB);
            // total number of entries
            b.writeUInt16LE(ZipConstants.ENDTOT);
            // central directory size in bytes
            b.writeUInt32LE(ZipConstants.ENDSIZ);
            // offset of first CEN header
            b.writeUInt32LE(ZipConstants.ENDOFF);
            // zip file comment length
            b.writeUInt16LE(ZipConstants.ENDCOM);
            // fill comment memory with spaces so no garbage is left there
            b.fill(" ", ZipConstants.ENDHDR);

            return b;
        },

        toString : function() {
            return '{\n' +
                '\t"diskEntries" : ' + _volumeEntries + ",\n" +
                '\t"totalEntries" : ' + _totalEntries + ",\n" +
                '\t"size" : ' + _size + " bytes,\n" +
                '\t"offset" : 0x' + _offset.toString(16).toUpperCase() + ",\n" +
                '\t"commentLength" : 0x' + _commentLength + "\n" +
            '}';
        }
    }
};