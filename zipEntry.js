var Utils = require("./util"),
    Headers = require("./headers"),
    Constants = Utils.Constants,
    Methods = require("./methods");

module.exports = function (/** object */ options, /*Buffer*/ input) {
    var _centralHeader = new Headers.EntryHeader(),
        _entryName = Buffer.alloc(0),
        _comment = Buffer.alloc(0),
        _isDirectory = false,
        uncompressedData = null,
        _extra = Buffer.alloc(0),
        _extralocal = Buffer.alloc(0),
        _efs = true;

    // assign options
    const opts = options;

    const decoder = typeof opts.decoder === "object" ? opts.decoder : Utils.decoder;
    _efs = decoder.hasOwnProperty("efs") ? decoder.efs : false;

    function getCompressedDataFromZip() {
        //if (!input || !Buffer.isBuffer(input)) {
        if (!input || !(input instanceof Uint8Array)) {
            return Buffer.alloc(0);
        }
        _extralocal = _centralHeader.loadLocalHeaderFromBinary(input);
        return input.slice(_centralHeader.realDataOffset, _centralHeader.realDataOffset + _centralHeader.compressedSize);
    }

    function crc32OK(data) {
        // When bit 3 (0x08) of the general-purpose flags is set, the crc-32 and
        // sizes were unknown when the local file header was written, so that
        // header carries placeholder zeros and the real values are repeated in a
        // data descriptor after the compressed data. adm-zip always parses the
        // central directory, whose header holds the authoritative crc-32 and
        // sizes, so we validate the payload against that value.
        //
        // Earlier versions instead located and parsed the trailing descriptor and
        // threw when it was absent or in an unexpected shape. Many valid archives
        // set the descriptor flag but write the real crc/sizes into the local and
        // central headers without emitting a descriptor (or write one we did not
        // recognise), so that strict handling rejected readable zips
        // (issues #533, #548, #554). Trusting the central-directory crc keeps the
        // integrity check while accepting those archives.
        const expectedCrc = _centralHeader.flags_desc || _centralHeader.localHeader.flags_desc ? _centralHeader.crc : _centralHeader.localHeader.crc;

        return Utils.crc32(data) === expectedCrc;
    }

    function decompress(/*Boolean*/ async, /*Function*/ callback, /*String, Buffer*/ pass) {
        if (typeof callback === "undefined" && typeof async === "string") {
            pass = async;
            async = void 0;
        }
        if (_isDirectory) {
            if (async && callback) {
                callback(Buffer.alloc(0), Utils.Errors.DIRECTORY_CONTENT_ERROR()); //si added error.
            }
            return Buffer.alloc(0);
        }

        var compressedData = getCompressedDataFromZip();

        if (compressedData.length === 0) {
            // File is empty, nothing to decompress.
            if (async && callback) callback(compressedData);
            return compressedData;
        }

        if (_centralHeader.encrypted) {
            if ("string" !== typeof pass && !Buffer.isBuffer(pass)) {
                throw Utils.Errors.INVALID_PASS_PARAM();
            }
            compressedData = Methods.ZipCrypto.decrypt(compressedData, _centralHeader, pass);
        }

        var data;

        switch (_centralHeader.method) {
            case Utils.Constants.STORED:
                // STORED entries are not compressed, so the uncompressed output is
                // exactly the bytes present in the archive. Allocate from the real
                // data length rather than the attacker-declared central-directory
                // size, otherwise a tiny archive can declare a huge size and force a
                // multi-gigabyte allocation before any validation (CVE-2026-39244).
                data = Buffer.alloc(compressedData.length);
                compressedData.copy(data);
                if (!crc32OK(data)) {
                    if (async && callback) callback(data, Utils.Errors.BAD_CRC()); //si added error
                    throw Utils.Errors.BAD_CRC();
                } else {
                    //si added otherwise did not seem to return data.
                    if (async && callback) callback(data);
                    return data;
                }
            case Utils.Constants.DEFLATED:
                // Do not pre-allocate the declared uncompressed size. The inflater
                // grows its output buffer as zlib emits data and caps the total at
                // the declared size (maxOutputLength), so a bogus size can no longer
                // trigger an eager allocation before the data is read (CVE-2026-39244).
                var inflater = new Methods.Inflater(compressedData, _centralHeader.size);
                if (!async) {
                    data = inflater.inflate();
                    if (!crc32OK(data)) {
                        throw Utils.Errors.BAD_CRC(`"${decoder.decode(_entryName)}"`);
                    }
                    return data;
                } else {
                    inflater.inflateAsync(function (result) {
                        if (callback) {
                            if (!crc32OK(result)) {
                                callback(result, Utils.Errors.BAD_CRC()); //si added error
                            } else {
                                callback(result);
                            }
                        }
                    });
                }
                break;
            default:
                if (async && callback) callback(Buffer.alloc(0), Utils.Errors.UNKNOWN_METHOD());
                throw Utils.Errors.UNKNOWN_METHOD();
        }
    }

    function compress(/*Boolean*/ async, /*Function*/ callback) {
        if ((!uncompressedData || !uncompressedData.length) && Buffer.isBuffer(input)) {
            // no data set or the data wasn't changed to require recompression
            if (async && callback) callback(getCompressedDataFromZip());
            return getCompressedDataFromZip();
        }

        if (uncompressedData.length && !_isDirectory) {
            var compressedData;
            // Local file header
            switch (_centralHeader.method) {
                case Utils.Constants.STORED:
                    _centralHeader.compressedSize = _centralHeader.size;

                    compressedData = Buffer.alloc(uncompressedData.length);
                    uncompressedData.copy(compressedData);

                    if (async && callback) callback(compressedData);
                    return compressedData;
                default:
                case Utils.Constants.DEFLATED:
                    var deflater = new Methods.Deflater(uncompressedData);
                    if (!async) {
                        var deflated = deflater.deflate();
                        _centralHeader.compressedSize = deflated.length;
                        return deflated;
                    } else {
                        deflater.deflateAsync(function (data) {
                            compressedData = Buffer.alloc(data.length);
                            _centralHeader.compressedSize = data.length;
                            data.copy(compressedData);
                            callback && callback(compressedData);
                        });
                    }
                    deflater = null;
                    break;
            }
        } else if (async && callback) {
            callback(Buffer.alloc(0));
        } else {
            return Buffer.alloc(0);
        }
    }

    function readUInt64LE(buffer, offset) {
        return Utils.readBigUInt64LE(buffer, offset);
    }

    function parseExtra(data) {
        try {
            var offset = 0;
            var signature, size, part;
            while (offset + 4 < data.length) {
                signature = data.readUInt16LE(offset);
                offset += 2;
                size = data.readUInt16LE(offset);
                offset += 2;
                part = data.slice(offset, offset + size);
                offset += size;
                if (Constants.ID_ZIP64 === signature) {
                    parseZip64ExtendedInformation(part);
                }
            }
        } catch (error) {
            throw Utils.Errors.EXTRA_FIELD_PARSE_ERROR();
        }
    }

    //Override header field values with values from the ZIP64 extra field
    function parseZip64ExtendedInformation(data) {
        var size, compressedSize, offset, diskNumStart;

        if (data.length >= Constants.EF_ZIP64_SCOMP) {
            size = readUInt64LE(data, Constants.EF_ZIP64_SUNCOMP);
            if (_centralHeader.size === Constants.EF_ZIP64_OR_32) {
                _centralHeader.size = size;
            }
        }
        if (data.length >= Constants.EF_ZIP64_RHO) {
            compressedSize = readUInt64LE(data, Constants.EF_ZIP64_SCOMP);
            if (_centralHeader.compressedSize === Constants.EF_ZIP64_OR_32) {
                _centralHeader.compressedSize = compressedSize;
            }
        }
        if (data.length >= Constants.EF_ZIP64_DSN) {
            offset = readUInt64LE(data, Constants.EF_ZIP64_RHO);
            if (_centralHeader.offset === Constants.EF_ZIP64_OR_32) {
                _centralHeader.offset = offset;
            }
        }
        if (data.length >= Constants.EF_ZIP64_DSN + 4) {
            diskNumStart = data.readUInt32LE(Constants.EF_ZIP64_DSN);
            if (_centralHeader.diskNumStart === Constants.EF_ZIP64_OR_16) {
                _centralHeader.diskNumStart = diskNumStart;
            }
        }
    }

    return {
        get entryName() {
            return decoder.decode(_entryName);
        },
        get rawEntryName() {
            return _entryName;
        },
        set entryName(val) {
            _entryName = Utils.toBuffer(val, decoder.encode);
            var lastChar = _entryName[_entryName.length - 1];
            _isDirectory = lastChar === 47 || lastChar === 92;
            _centralHeader.fileNameLength = _entryName.length;
        },

        get efs() {
            if (typeof _efs === "function") {
                return _efs(this.entryName);
            } else {
                return _efs;
            }
        },

        get extra() {
            return _extra;
        },
        set extra(val) {
            _extra = val;
            _centralHeader.extraLength = val.length;
            parseExtra(val);
        },

        get comment() {
            return decoder.decode(_comment);
        },
        set comment(val) {
            _comment = Utils.toBuffer(val, decoder.encode);
            _centralHeader.commentLength = _comment.length;
            if (_comment.length > 0xffff) throw Utils.Errors.COMMENT_TOO_LONG();
        },

        get name() {
            const n = decoder.decode(_entryName);
            // For directories the name is the last path segment; drop the trailing
            // separator first so "a/b/c/" yields "c" and not "" (issue #466).
            return _isDirectory
                ? n
                      .replace(/[/\\]$/, "")
                      .split("/")
                      .pop()
                : n.split("/").pop();
        },
        get isDirectory() {
            return _isDirectory;
        },

        getCompressedData: function () {
            return compress(false, null);
        },

        getCompressedDataAsync: function (/*Function*/ callback) {
            compress(true, callback);
        },

        setData: function (value) {
            uncompressedData = Utils.toBuffer(value, Utils.decoder.encode);
            if (!_isDirectory && uncompressedData.length) {
                _centralHeader.size = uncompressedData.length;
                _centralHeader.method = Utils.Constants.DEFLATED;
                _centralHeader.crc = Utils.crc32(value);
                _centralHeader.changed = true;
            } else {
                // folders and blank files should be stored
                _centralHeader.method = Utils.Constants.STORED;
            }
        },

        getData: function (pass) {
            if (_centralHeader.changed) {
                return uncompressedData;
            } else {
                return decompress(false, null, pass);
            }
        },

        getDataAsync: function (/*Function*/ callback, pass) {
            if (_centralHeader.changed) {
                callback(uncompressedData);
            } else {
                decompress(true, callback, pass);
            }
        },

        set attr(attr) {
            _centralHeader.attr = attr;
        },
        get attr() {
            return _centralHeader.attr;
        },

        set header(/*Buffer*/ data) {
            _centralHeader.loadFromBinary(data);
        },

        get header() {
            return _centralHeader;
        },

        packCentralHeader: function () {
            _centralHeader.flags_efs = this.efs;
            _centralHeader.extraLength = _extra.length;
            // 1. create header (buffer)
            var header = _centralHeader.centralHeaderToBinary();
            var addpos = Utils.Constants.CENHDR;
            // 2. add file name
            _entryName.copy(header, addpos);
            addpos += _entryName.length;
            // 3. add extra data
            _extra.copy(header, addpos);
            addpos += _centralHeader.extraLength;
            // 4. add file comment
            _comment.copy(header, addpos);
            return header;
        },

        packLocalHeader: function () {
            let addpos = 0;
            _centralHeader.flags_efs = this.efs;
            _centralHeader.extraLocalLength = _extralocal.length;
            // 1. construct local header Buffer
            const localHeaderBuf = _centralHeader.localHeaderToBinary();
            // 2. localHeader - crate header buffer
            const localHeader = Buffer.alloc(localHeaderBuf.length + _entryName.length + _centralHeader.extraLocalLength);
            // 2.1 add localheader
            localHeaderBuf.copy(localHeader, addpos);
            addpos += localHeaderBuf.length;
            // 2.2 add file name
            _entryName.copy(localHeader, addpos);
            addpos += _entryName.length;
            // 2.3 add extra field
            _extralocal.copy(localHeader, addpos);
            addpos += _extralocal.length;

            return localHeader;
        },

        toJSON: function () {
            const bytes = function (nr) {
                return "<" + ((nr && nr.length + " bytes buffer") || "null") + ">";
            };

            return {
                entryName: this.entryName,
                name: this.name,
                comment: this.comment,
                isDirectory: this.isDirectory,
                header: _centralHeader.toJSON(),
                compressedData: bytes(input),
                data: bytes(uncompressedData)
            };
        },

        toString: function () {
            return JSON.stringify(this.toJSON(), null, "\t");
        }
    };
};
