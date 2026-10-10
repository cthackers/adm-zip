"use strict";

const { expect } = require("chai");
const zlib = require("zlib");
const Zip = require("../adm-zip");
const ZipEntry = require("../zipEntry");
const { MainHeader } = require("../headers");
const Utils = require("../util");
const Constants = Utils.Constants;

const NAME = Buffer.from("a.txt");
const BODY = Buffer.from("hello zip64 world");
const SENT32 = 0xffffffff;
const SENT16 = 0xffff;

function u64(...values) {
    const buf = Buffer.alloc(values.length * 8);
    values.forEach((value, i) => buf.writeBigUInt64LE(BigInt(value), i * 8));
    return buf;
}

function extraRecord(id, data) {
    const head = Buffer.alloc(4);
    head.writeUInt16LE(id, 0);
    head.writeUInt16LE(data.length, 2);
    return Buffer.concat([head, data]);
}

function zip64Records(extra) {
    return Utils.parseExtraFields(extra).filter((field) => field.id === Constants.ID_ZIP64);
}

function classicEnd(entries, cdSize, cdOffset, comment) {
    const end = Buffer.alloc(Constants.ENDHDR);
    end.writeUInt32LE(Constants.ENDSIG, 0);
    end.writeUInt16LE(entries, Constants.ENDSUB);
    end.writeUInt16LE(entries, Constants.ENDTOT);
    end.writeUInt32LE(cdSize, Constants.ENDSIZ);
    end.writeUInt32LE(cdOffset, Constants.ENDOFF);
    end.writeUInt16LE(comment.length, Constants.ENDCOM);
    return Buffer.concat([end, comment]);
}

function zip64End(cdSize, cdOffset, recordOffset) {
    const rec = Buffer.alloc(Constants.ZIP64HDR);
    rec.writeUInt32LE(Constants.ZIP64SIG, 0);
    Utils.writeBigUInt64LE(rec, Constants.ZIP64HDR - Constants.ZIP64LEAD, Constants.ZIP64SIZE);
    rec.writeUInt16LE(45, Constants.ZIP64VEM);
    rec.writeUInt16LE(45, Constants.ZIP64VER);
    Utils.writeBigUInt64LE(rec, 1, Constants.ZIP64SUB);
    Utils.writeBigUInt64LE(rec, 1, Constants.ZIP64TOT);
    Utils.writeBigUInt64LE(rec, cdSize, Constants.ZIP64SIZB);
    Utils.writeBigUInt64LE(rec, cdOffset, Constants.ZIP64OFF);
    const loc = Buffer.alloc(Constants.END64HDR);
    loc.writeUInt32LE(Constants.END64SIG, 0);
    Utils.writeBigUInt64LE(loc, recordOffset, Constants.END64OFF);
    loc.writeUInt32LE(1, Constants.END64NUMDISKS);
    return Buffer.concat([rec, loc]);
}

/**
 * An archive with a single entry. `sentinels` lists the central header fields that
 * hold 0xFFFFFFFF / 0xFFFF, and `record` is the data of its zip64 extra field.
 */
function archive({ sentinels = [], record = null, deflate = false, body = BODY, comment = Buffer.alloc(0), entryComment = Buffer.alloc(0), withZip64End = false } = {}) {
    const payload = deflate ? zlib.deflateRawSync(body) : body;
    const crc = Utils.crc32(body);

    const local = Buffer.alloc(Constants.LOCHDR);
    local.writeUInt32LE(Constants.LOCSIG, 0);
    local.writeUInt16LE(20, Constants.LOCVER);
    local.writeUInt16LE(deflate ? Constants.DEFLATED : Constants.STORED, Constants.LOCHOW);
    local.writeUInt32LE(crc, Constants.LOCCRC);
    local.writeUInt32LE(payload.length, Constants.LOCSIZ);
    local.writeUInt32LE(body.length, Constants.LOCLEN);
    local.writeUInt16LE(NAME.length, Constants.LOCNAM);
    const localBlock = Buffer.concat([local, NAME, payload]);

    const extra = record ? extraRecord(Constants.ID_ZIP64, record) : Buffer.alloc(0);
    const central = Buffer.alloc(Constants.CENHDR);
    central.writeUInt32LE(Constants.CENSIG, 0);
    central.writeUInt16LE(45, Constants.CENVEM);
    central.writeUInt16LE(45, Constants.CENVER);
    central.writeUInt16LE(deflate ? Constants.DEFLATED : Constants.STORED, Constants.CENHOW);
    central.writeUInt32LE(crc, Constants.CENCRC);
    central.writeUInt32LE(sentinels.includes("compressedSize") ? SENT32 : payload.length, Constants.CENSIZ);
    central.writeUInt32LE(sentinels.includes("size") ? SENT32 : body.length, Constants.CENLEN);
    central.writeUInt16LE(NAME.length, Constants.CENNAM);
    central.writeUInt16LE(extra.length, Constants.CENEXT);
    central.writeUInt16LE(entryComment.length, Constants.CENCOM);
    central.writeUInt16LE(sentinels.includes("diskNumStart") ? SENT16 : 0, Constants.CENDSK);
    central.writeUInt32LE(sentinels.includes("offset") ? SENT32 : 0, Constants.CENOFF);
    const centralBlock = Buffer.concat([central, NAME, extra, entryComment]);

    const parts = [localBlock, centralBlock];
    if (withZip64End) {
        parts.push(zip64End(centralBlock.length, localBlock.length, localBlock.length + centralBlock.length));
        parts.push(classicEnd(SENT16, SENT32, SENT32, comment));
    } else {
        parts.push(classicEnd(1, centralBlock.length, localBlock.length, comment));
    }
    return Buffer.concat(parts);
}

function readEntry(buffer) {
    const zip = new Zip(buffer);
    const entries = zip.getEntries();
    expect(entries).to.have.lengthOf(1);
    return zip.readAsText(entries[0]);
}

function newEntry({ size = 5, compressedSize = 5, offset = 0, version } = {}) {
    const entry = new ZipEntry({}, null);
    entry.entryName = "a.txt";
    if (version !== undefined) entry.header.version = version;
    entry.header.size = size;
    entry.header.compressedSize = compressedSize;
    entry.header.offset = offset;
    return entry;
}

function centralExtraOf(central) {
    const start = Constants.CENHDR + central.readUInt16LE(Constants.CENNAM);
    return central.slice(start, start + central.readUInt16LE(Constants.CENEXT));
}

function localExtraOf(local) {
    const start = Constants.LOCHDR + local.readUInt16LE(Constants.LOCNAM);
    return local.slice(start, start + local.readUInt16LE(Constants.LOCEXT));
}

describe("zip64 extended information extra field", () => {
    describe("reading", () => {
        it("reads a record that holds only the local header offset", () => {
            // what writers emit for a small file stored past 4 GiB
            expect(readEntry(archive({ sentinels: ["offset"], record: u64(0) }))).to.equal(BODY.toString());
        });

        it("reads a record that holds only the compressed size", () => {
            const payload = zlib.deflateRawSync(BODY);
            const buffer = archive({ deflate: true, sentinels: ["compressedSize"], record: u64(payload.length) });
            expect(readEntry(buffer)).to.equal(BODY.toString());
        });

        it("reads the two sizes in order, uncompressed size first", () => {
            const payload = zlib.deflateRawSync(BODY);
            const zip = new Zip(archive({ deflate: true, sentinels: ["size", "compressedSize"], record: u64(BODY.length, payload.length) }));
            const entry = zip.getEntries()[0];
            expect(entry.header.size).to.equal(BODY.length);
            expect(entry.header.compressedSize).to.equal(payload.length);
            expect(zip.readAsText(entry)).to.equal(BODY.toString());
        });

        it("reads the disk number after the fields that precede it", () => {
            const record = Buffer.concat([u64(0), Buffer.from([3, 0, 0, 0])]);
            const entry = new Zip(archive({ sentinels: ["offset", "diskNumStart"], record })).getEntries()[0];
            expect(entry.header.offset).to.equal(0);
            expect(entry.header.diskNumStart).to.equal(3);
        });

        it("ignores fields stored without a sentinel after the ones it needs", () => {
            // Go's archive/zip always stores both sizes and the offset
            const payload = zlib.deflateRawSync(BODY);
            const record = u64(BODY.length, payload.length, 0xdeadbeef);
            expect(readEntry(archive({ deflate: true, sentinels: ["size", "compressedSize"], record }))).to.equal(BODY.toString());
            // and `zip -fz` archives updated later keep a record no field refers to
            expect(readEntry(archive({ record: u64(BODY.length) }))).to.equal(BODY.toString());
        });

        it("keeps sizes and offsets above 32 bits and values equal to the sentinel", () => {
            const entry = new ZipEntry({}, null);
            const central = Buffer.alloc(Constants.CENHDR);
            central.writeUInt32LE(Constants.CENSIG, 0);
            central.writeUInt32LE(SENT32, Constants.CENLEN);
            central.writeUInt32LE(SENT32, Constants.CENSIZ);
            central.writeUInt32LE(SENT32, Constants.CENOFF);
            entry.header = central;
            entry.extra = extraRecord(Constants.ID_ZIP64, u64(0x1_2345_6789, SENT32, 0x2_0000_0000));
            expect(entry.header.size).to.equal(0x1_2345_6789);
            expect(entry.header.compressedSize).to.equal(SENT32);
            expect(entry.header.offset).to.equal(0x2_0000_0000);
        });

        it("refuses a record that is missing a value a sentinel asks for", () => {
            expect(() => new Zip(archive({ sentinels: ["size", "compressedSize"], record: u64(BODY.length) })).getEntries()).to.throw(/missing a required value/);
        });

        it("finds the zip64 end record through its locator", () => {
            // a backward search for the record's signature finds this comment first
            const comment = Buffer.concat([Buffer.from("PK\u0006\u0006"), Buffer.alloc(60, 0x41)]);
            const zip = new Zip(archive({ withZip64End: true, comment }));
            expect(zip.getEntries()).to.have.lengthOf(1);
            expect(zip.readAsText(zip.getEntries()[0])).to.equal(BODY.toString());
            expect(zip.getZipComment()).to.equal(comment.toString());
        });

        it("reads an archive whose central directory ends with the locator signature", () => {
            // an entry comment ending right before the end record, with offset bytes
            // that point nowhere (or cannot even be represented)
            for (const fill of [0x00, 0x41, 0xff]) {
                const entryComment = Buffer.concat([Buffer.from("PK\u0006\u0007"), Buffer.alloc(16, fill)]);
                expect(readEntry(archive({ entryComment })), `fill ${fill}`).to.equal(BODY.toString());
            }
        });

        it("keeps the archive comment when the archive has a zip64 end record", () => {
            const zip = new Zip(archive({ withZip64End: true, comment: Buffer.from("zip64 comment") }));
            expect(zip.getZipComment()).to.equal("zip64 comment");
            expect(zip.getEntries()).to.have.lengthOf(1);
        });

        it("reads an archive of exactly 65535 entries that has no zip64 end record", function () {
            this.timeout(20000);
            // Python's zipfile writes 0xFFFF entry counts without a zip64 record
            const locals = [];
            const centrals = [];
            let offset = 0;
            for (let i = 0; i < SENT16; i++) {
                const name = Buffer.from(`f${i}`);
                const local = Buffer.alloc(Constants.LOCHDR);
                local.writeUInt32LE(Constants.LOCSIG, 0);
                local.writeUInt16LE(10, Constants.LOCVER);
                local.writeUInt16LE(name.length, Constants.LOCNAM);
                const central = Buffer.alloc(Constants.CENHDR);
                central.writeUInt32LE(Constants.CENSIG, 0);
                central.writeUInt16LE(10, Constants.CENVER);
                central.writeUInt16LE(name.length, Constants.CENNAM);
                central.writeUInt32LE(offset, Constants.CENOFF);
                locals.push(local, name);
                centrals.push(central, name);
                offset += local.length + name.length;
            }
            const centralBlock = Buffer.concat(centrals);
            const buffer = Buffer.concat([...locals, centralBlock, classicEnd(SENT16, centralBlock.length, offset, Buffer.alloc(0))]);
            expect(new Zip(buffer).getEntries()).to.have.lengthOf(SENT16);
        });
    });

    describe("writing", () => {
        it("puts only the fields that do not fit into the central record, in order", () => {
            const central = newEntry({ size: 0x1_0000_0011, compressedSize: 9, offset: 0x1_0000_0022 }).packCentralHeader();
            expect(central.readUInt32LE(Constants.CENLEN)).to.equal(SENT32);
            expect(central.readUInt32LE(Constants.CENSIZ)).to.equal(9);
            expect(central.readUInt32LE(Constants.CENOFF)).to.equal(SENT32);
            const records = zip64Records(centralExtraOf(central));
            expect(records).to.have.lengthOf(1);
            expect(records[0].data.equals(u64(0x1_0000_0011, 0x1_0000_0022))).to.equal(true);
        });

        it("writes both sizes into the local record when either one does not fit", () => {
            const local = newEntry({ size: 6, compressedSize: SENT32 }).packLocalHeader();
            expect(local.readUInt32LE(Constants.LOCLEN)).to.equal(SENT32);
            expect(local.readUInt32LE(Constants.LOCSIZ)).to.equal(SENT32);
            const records = zip64Records(localExtraOf(local));
            expect(records).to.have.lengthOf(1);
            expect(records[0].data.equals(u64(6, SENT32))).to.equal(true);

            expect(zip64Records(localExtraOf(newEntry({ offset: 0x1_0000_0000 }).packLocalHeader()))).to.have.lengthOf(0);
        });

        it("raises the version needed to extract to 4.5 without lowering a higher one", () => {
            for (const [version, expected] of [
                [20, 45],
                [63, 63]
            ]) {
                const entry = newEntry({ size: 0x1_0000_0000, version });
                expect(entry.packLocalHeader().readUInt16LE(Constants.LOCVER)).to.equal(expected);
                expect(entry.packCentralHeader().readUInt16LE(Constants.CENVER)).to.equal(expected);
            }
            expect(newEntry({ version: 20 }).packCentralHeader().readUInt16LE(Constants.CENVER)).to.equal(20);
        });

        it("drops a record copied from the input once every field fits", () => {
            const source = archive({ sentinels: ["size", "compressedSize", "offset"], record: u64(BODY.length, BODY.length, 0) });
            const zip = new Zip(source);
            const entry = zip.getEntries()[0];
            entry.extra = Buffer.concat([entry.extra, extraRecord(0x5455, Buffer.from([1, 2, 3, 4, 5]))]);
            const rebuilt = new Zip(zip.toBuffer());
            expect(readEntry(rebuilt.toBuffer())).to.equal(BODY.toString());
            const extra = rebuilt.getEntries()[0].extra;
            expect(zip64Records(extra)).to.have.lengthOf(0);
            expect(Utils.parseExtraFields(extra).map((field) => field.id)).to.deep.equal([0x5455]);
        });

        it("keeps bytes after the last extra field record when rebuilding it", () => {
            const padding = Buffer.alloc(3);
            const rebuilt = Utils.replaceExtraField(Buffer.concat([extraRecord(Constants.ID_ZIP64, u64(1)), padding]), Constants.ID_ZIP64, null);
            expect(rebuilt.equals(padding)).to.equal(true);
        });

        it("writes a zip64 end record when a count, size or offset equals its reserved value", () => {
            for (const [field, value] of [
                ["totalEntries", SENT16],
                ["size", SENT32],
                ["offset", SENT32]
            ]) {
                const header = new MainHeader();
                header.diskEntries = 1;
                header.totalEntries = 1;
                header.size = 1;
                header.offset = 1;
                header[field] = value;
                if (field === "totalEntries") header.diskEntries = value;
                const binary = header.toBinary();
                expect(binary.readUInt32LE(0), field).to.equal(Constants.ZIP64SIG);
                const locator = binary.slice(Constants.ZIP64HDR, Constants.ZIP64HDR + Constants.END64HDR);
                expect(locator.readUInt32LE(0), field).to.equal(Constants.END64SIG);
                const end = binary.slice(Constants.ZIP64HDR + Constants.END64HDR);
                expect(end.readUInt32LE(0), field).to.equal(Constants.ENDSIG);
                expect(end.readUInt16LE(Constants.ENDTOT), field).to.equal(field === "totalEntries" ? SENT16 : 1);
                expect(end.readUInt32LE(Constants.ENDSIZ), field).to.equal(field === "size" ? SENT32 : 1);
                expect(end.readUInt32LE(Constants.ENDOFF), field).to.equal(field === "offset" ? SENT32 : 1);
            }
        });

        it("refuses to write a 64-bit value it cannot represent exactly", () => {
            expect(() => Utils.writeBigUInt64LE(Buffer.alloc(8), 2 ** 53, 0)).to.throw();
            expect(() => newEntry({ size: 2 ** 53 })).to.throw();
        });
    });
});
