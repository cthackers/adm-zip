import { Constants, Errors, isWin, methodToString } from "../util";

/* The central directory file header */
export class EntryHeader {
    made = 0x14; // v2.0
    version = 10; // v1.0
    flags = 0;
    private _method = 0;
    private _time = 0;
    crc = 0;
    compressedSize = 0;
    size = 0;
    fileNameLength = 0;
    extraLength = 0;
    commentLength = 0;
    diskNumStart = 0;
    inAttr = 0;
    attr = 0;
    offset = 0;
    changed?: boolean = undefined;

    dataHeader: {
        fnameLen?: number;
        extraLen?: number;
        version?: number;
        flags?: number;
        method?: number;
        time?: number;
        crc?: number;
        compressedSize?: number;
        size?: number;
    } = {};
    setTime(value: number | Date) {
        const val = new Date(value);
        this._time =
            (((val.getFullYear() - 1980) & 0x7f) << 25) | // b09-16 years from 1980
            ((val.getMonth() + 1) << 21) | // b05-08 month
            (val.getDate() << 16) | // b00-04 hour
            // 2 bytes time
            (val.getHours() << 11) | // b11-15 hour
            (val.getMinutes() << 5) | // b05-10 minute
            (val.getSeconds() >> 1); // b00-04 seconds divided by 2
    }
    constructor() {
        this.made |= isWin ? 0x0a00 : 0x0300;
        this.setTime(+new Date());
    }

    get method() {
        return this._method;
    }
    set method(val) {
        switch (val) {
            case Constants.STORED:
                this.version = 10;
            case Constants.DEFLATED:
            default:
                this.version = 20;
        }
        this._method = val;
    }
    get time() {
        return new Date(
            ((this._time >> 25) & 0x7f) + 1980,
            ((this._time >> 21) & 0x0f) - 1,
            (this._time >> 16) & 0x1f,
            (this._time >> 11) & 0x1f,
            (this._time >> 5) & 0x3f,
            (this._time & 0x1f) << 1
        );
    }
    set time(val) {
        this.setTime(val);
    }

    get encripted() {
        return (this.flags & 1) === 1;
    }

    get entryHeaderSize() {
        return Constants.CENHDR + this.fileNameLength + this.extraLength + this.commentLength;
    }

    get realDataOffset() {
        return this.offset + Constants.LOCHDR + (this.dataHeader.fnameLen ?? 0) + (this.dataHeader.extraLen ?? 0);
    }

    loadDataHeaderFromBinary(input: Buffer) {
        var data = input.slice(this.offset, this.offset + Constants.LOCHDR);
        // 30 bytes and should start with "PK\003\004"
        if (data.readUInt32LE(0) !== Constants.LOCSIG) {
            throw new Error(Errors.INVALID_LOC);
        }
        this.dataHeader = {
            // version needed to extract
            version: data.readUInt16LE(Constants.LOCVER),
            // general purpose bit flag
            flags: data.readUInt16LE(Constants.LOCFLG),
            // compression method
            method: data.readUInt16LE(Constants.LOCHOW),
            // modification time (2 bytes time, 2 bytes date)
            time: data.readUInt32LE(Constants.LOCTIM),
            // uncompressed file crc-32 value
            crc: data.readUInt32LE(Constants.LOCCRC),
            // compressed size
            compressedSize: data.readUInt32LE(Constants.LOCSIZ),
            // uncompressed size
            size: data.readUInt32LE(Constants.LOCLEN),
            // filename length
            fnameLen: data.readUInt16LE(Constants.LOCNAM),
            // extra field length
            extraLen: data.readUInt16LE(Constants.LOCEXT)
        };
    }

    loadFromBinary(data: Buffer) {
        // data should be 46 bytes and start with "PK 01 02"
        if (data.length !== Constants.CENHDR || data.readUInt32LE(0) !== Constants.CENSIG) {
            throw new Error(Errors.INVALID_CEN);
        }
        // version made by
        this.made = data.readUInt16LE(Constants.CENVEM);
        // version needed to extract
        this.version = data.readUInt16LE(Constants.CENVER);
        // encrypt, decrypt flags
        this.flags = data.readUInt16LE(Constants.CENFLG);
        // compression method
        this.method = data.readUInt16LE(Constants.CENHOW);
        // modification time (2 bytes time, 2 bytes date)
        this._time = data.readUInt32LE(Constants.CENTIM);
        // uncompressed file crc-32 value
        this.crc = data.readUInt32LE(Constants.CENCRC);
        // compressed size
        this.compressedSize = data.readUInt32LE(Constants.CENSIZ);
        // uncompressed size
        this.size = data.readUInt32LE(Constants.CENLEN);
        // filename length
        this.fileNameLength = data.readUInt16LE(Constants.CENNAM);
        // extra field length
        this.extraLength = data.readUInt16LE(Constants.CENEXT);
        // file comment length
        this.commentLength = data.readUInt16LE(Constants.CENCOM);
        // volume number start
        this.diskNumStart = data.readUInt16LE(Constants.CENDSK);
        // internal file attributes
        this.inAttr = data.readUInt16LE(Constants.CENATT);
        // external file attributes
        this.attr = data.readUInt32LE(Constants.CENATX);
        // LOC header offset
        this.offset = data.readUInt32LE(Constants.CENOFF);
    }

    dataHeaderToBinary() {
        // LOC header size (30 bytes)
        var data = Buffer.alloc(Constants.LOCHDR);
        // "PK\003\004"
        data.writeUInt32LE(Constants.LOCSIG, 0);
        // version needed to extract
        data.writeUInt16LE(this.version, Constants.LOCVER);
        // general purpose bit flag
        data.writeUInt16LE(this.flags, Constants.LOCFLG);
        // compression method
        data.writeUInt16LE(this.method, Constants.LOCHOW);
        // modification time (2 bytes time, 2 bytes date)
        data.writeUInt32LE(this._time, Constants.LOCTIM);
        // uncompressed file crc-32 value
        data.writeUInt32LE(this.crc, Constants.LOCCRC);
        // compressed size
        data.writeUInt32LE(this.compressedSize, Constants.LOCSIZ);
        // uncompressed size
        data.writeUInt32LE(this.size, Constants.LOCLEN);
        // filename length
        data.writeUInt16LE(this.fileNameLength, Constants.LOCNAM);
        // extra field length
        data.writeUInt16LE(this.extraLength, Constants.LOCEXT);
        return data;
    }

    entryHeaderToBinary() {
        // CEN header size (46 bytes)
        var data = Buffer.alloc(Constants.CENHDR + this.fileNameLength + this.extraLength + this.commentLength);
        // "PK\001\002"
        data.writeUInt32LE(Constants.CENSIG, 0);
        // version made by
        data.writeUInt16LE(this.made, Constants.CENVEM);
        // version needed to extract
        data.writeUInt16LE(this.version, Constants.CENVER);
        // encrypt, decrypt flags
        data.writeUInt16LE(this.flags, Constants.CENFLG);
        // compression method
        data.writeUInt16LE(this.method, Constants.CENHOW);
        // modification time (2 bytes time, 2 bytes date)
        data.writeUInt32LE(this._time, Constants.CENTIM);
        // uncompressed file crc-32 value
        data.writeUInt32LE(this.crc, Constants.CENCRC);
        // compressed size
        data.writeUInt32LE(this.compressedSize, Constants.CENSIZ);
        // uncompressed size
        data.writeUInt32LE(this.size, Constants.CENLEN);
        // filename length
        data.writeUInt16LE(this.fileNameLength, Constants.CENNAM);
        // extra field length
        data.writeUInt16LE(this.extraLength, Constants.CENEXT);
        // file comment length
        data.writeUInt16LE(this.commentLength, Constants.CENCOM);
        // volume number start
        data.writeUInt16LE(this.diskNumStart, Constants.CENDSK);
        // internal file attributes
        data.writeUInt16LE(this.inAttr, Constants.CENATT);
        // external file attributes
        data.writeUInt32LE(this.attr, Constants.CENATX);
        // LOC header offset
        data.writeUInt32LE(this.offset, Constants.CENOFF);
        // fill all with
        data.fill(0x00, Constants.CENHDR);
        return data;
    }

    toJSON() {
        const bytes = function (nr: number) {
            return nr + " bytes";
        };

        return {
            attr: this.attr,
            diskNumStart: this.diskNumStart,
            flags: this.flags,
            inAttr: this.inAttr,
            made: this.made,
            offset: this.offset,
            version: this.version,
            method: methodToString(this.method),
            time: this.time,
            crc: "0x" + this.crc.toString(16).toUpperCase(),
            compressedSize: bytes(this.compressedSize),
            size: bytes(this.size),
            fileNameLength: bytes(this.fileNameLength),
            extraLength: bytes(this.extraLength),
            commentLength: bytes(this.commentLength),
            entryHeaderSize: bytes(Constants.CENHDR + this.fileNameLength + this.extraLength + this.commentLength)
        };
    }

    toString() {
        return JSON.stringify(this.toJSON(), null, "\t");
    }
}
