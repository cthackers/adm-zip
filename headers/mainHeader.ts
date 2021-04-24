import { Constants, Errors, readBigUInt64LE } from "../util";
/* The entries in the end of central directory */
export class MainHeader {
    private _diskEntries = 0
    private _totalEntries = 0
    size = 0
    offset = 0
    commentLength = 0

    set diskEntries(val: number) {
        this._diskEntries = this._totalEntries = val;
    }
    get diskEntries() {
        return this._diskEntries
    }

    set totalEntries(val: number) {
        this._totalEntries = this._diskEntries = val;
    }
    get totalEntries() {
        return this._totalEntries
    }

    get mainHeaderSize() {
        return Constants.ENDHDR + this.commentLength;
    }

    loadFromBinary(data: Buffer) {
        // data should be 22 bytes and start with "PK 05 06"
        // or be 56+ bytes and start with "PK 06 06" for Zip64
        if ((data.length !== Constants.ENDHDR || data.readUInt32LE(0) !== Constants.ENDSIG) &&
            (data.length < Constants.ZIP64HDR || data.readUInt32LE(0) !== Constants.ZIP64SIG)
        ) {
            throw new Error(Errors.INVALID_END);
        }

        if (data.readUInt32LE(0) === Constants.ENDSIG) {
            // number of entries on this volume
            this._diskEntries = data.readUInt16LE(Constants.ENDSUB);
            // total number of entries
            this._totalEntries = data.readUInt16LE(Constants.ENDTOT);
            // central directory size in bytes
            this.size = data.readUInt32LE(Constants.ENDSIZ);
            // offset of first CEN header
            this.offset = data.readUInt32LE(Constants.ENDOFF);
            // zip file comment length
            this.commentLength = data.readUInt16LE(Constants.ENDCOM);
        } else {
            // number of entries on this volume
            this.diskEntries = readBigUInt64LE(data, Constants.ZIP64SUB);
            // total number of entries
            this.totalEntries = readBigUInt64LE(data, Constants.ZIP64TOT);
            // central directory size in bytes
            this.size = readBigUInt64LE(data, Constants.ZIP64SIZB); //Before it was ZIP64SIZ. Please Check
            // offset of first CEN header
            this.offset = readBigUInt64LE(data, Constants.ZIP64OFF);

            this.commentLength = 0;
        }
    }

    toBinary() {
        var b = Buffer.alloc(Constants.ENDHDR + this.commentLength);
        // "PK 05 06" signature
        b.writeUInt32LE(Constants.ENDSIG, 0);
        b.writeUInt32LE(0, 4);
        // number of entries on this volume
        b.writeUInt16LE(this.diskEntries, Constants.ENDSUB);
        // total number of entries
        b.writeUInt16LE(this.totalEntries, Constants.ENDTOT);
        // central directory size in bytes
        b.writeUInt32LE(this.size, Constants.ENDSIZ);
        // offset of first CEN header
        b.writeUInt32LE(this.offset, Constants.ENDOFF);
        // zip file comment length
        b.writeUInt16LE(this.commentLength, Constants.ENDCOM);
        // fill comment memory with spaces so no garbage is left there
        b.fill(" ", Constants.ENDHDR);

        return b;
    }

    toJSON() {
        // creates 0x0000 style output
        const offset = function (nr: number, len: number) {
            let offs = nr.toString(16).toUpperCase();
            while (offs.length < len) offs = "0" + offs;
            return "0x" + offs;
        };

        return {
            diskEntries: this.diskEntries,
            totalEntries: this.totalEntries,
            size: this.size + " bytes",
            offset: offset(this.offset, 4),
            commentLength: this.commentLength
        };
    }

    toString() {
        return JSON.stringify(this.toJSON(), null, "\t");
    }
};
