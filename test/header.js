"use strict";
const { expect } = require("chai");

describe("headers", () => {
    describe("main-header", () => {
        const mainHeader = require("../headers/mainHeader");
        // empty zip file
        const empty = Buffer.from("504b0506000000000000000000000000000000000000", "hex");
        const readBuf = Buffer.from("504b050600000000cac0cefaed0b0000eeffc0000000", "hex");

        // try read empty file
        it("read empty file", () => {
            const mainh = new mainHeader();
            mainh.loadFromBinary(empty);

            expect(mainh.commentLength).to.equal(0);
            expect(mainh.diskEntries).to.equal(0);
            expect(mainh.mainHeaderSize).to.equal(22);
            expect(mainh.offset).to.equal(0);
            expect(mainh.size).to.equal(0);
        });

        // write new empty file
        it("write empty file", () => {
            const mainh = new mainHeader();
            const buf = mainh.toBinary();

            expect(buf.length).to.equal(empty.length);
            expect(buf).to.eql(empty);
        });

        // compare values
        it("compare correct read values", () => {
            const mainh = new mainHeader();
            mainh.loadFromBinary(readBuf);

            expect(mainh.commentLength).to.equal(0);
            expect(mainh.mainHeaderSize).to.equal(22);
            expect(mainh.diskEntries).to.equal(0xc0ca);
            expect(mainh.totalEntries).to.equal(0xface);
            expect(mainh.offset).to.equal(0xc0ffee);
            expect(mainh.size).to.equal(0xbed);

            // test toJSON function
            expect(mainh.toJSON()).to.eql({
                diskEntries: 0xc0ca,
                totalEntries: 0xface,
                size: "3053 bytes",
                offset: "0xC0FFEE",
                commentLength: 0
            });
        });

        it("set comment length", () => {
            const mainh = new mainHeader();
            mainh.commentLength = 5;

            expect(mainh.commentLength).to.equal(5);
            expect(mainh.mainHeaderSize).to.equal(22 + 5);
        });

        // try read empty file
        it("test toString function", () => {
            const mainh = new mainHeader();
            mainh.loadFromBinary(empty);

            // test toJSON function
            expect(mainh.toJSON()).to.eql({
                totalEntries: 0,
                size: "0 bytes",
                offset: "0x0000",
                diskEntries: 0,
                commentLength: 0
            });

            // test toString function (remove CR from CRLF)
            expect(mainh.toString().replace(/\r/g, "")).to.equal(
                '{\n\t"diskEntries": 0,\n\t"totalEntries": 0,\n\t"size": "0 bytes",\n\t"offset": "0x0000",\n\t"commentLength": 0\n}'
            );
        });
    });

    describe("entry-header", () => {
        const entryHeader = require("../headers/entryHeader");
        const datestamp = [1981, 3, 1, 12, 10, 10];
        const readBuf = Buffer.from("504b0102140014000008080045618102efbeadde0001000000020000000000000000000000000000000000000000", "hex");

        // comparison values for readBuf
        const readBufValues = {
            attr: 0,
            inAttr: 0,
            offset: 0,
            flags: 0x800,
            made: 20,
            version: 20,

            method: 8,
            size: 0x200,
            compressedSize: 0x100,
            crc: 0xdeadbeef,

            diskNumStart: 0,
            commentLength: 0,
            extraLength: 0,
            fileNameLength: 0
        };

        it("compare binary header values with some predetermined values", () => {
            const head = new entryHeader();
            head.loadFromBinary(readBuf);

            for (const name in readBufValues) {
                expect(head[name]).to.equal(readBufValues[name]);
                head[name] = readBufValues[name];
            }

            expect(head.entryHeaderSize).to.equal(46);

            // split into individual values by local time or timezone messes up our results
            expect([head.time.getFullYear(), head.time.getMonth(), head.time.getDate(), head.time.getHours(), head.time.getMinutes(), head.time.getSeconds()]).to.eql(datestamp);

            // test toJSON function
            const headerdata = {
                made: 20,
                version: 20,
                flags: 2048,
                method: "DEFLATED (8)",
                crc: "0xDEADBEEF",
                compressedSize: "256 bytes",
                size: "512 bytes",
                fileNameLength: "0 bytes",
                extraLength: "0 bytes",
                commentLength: "0 bytes",
                diskNumStart: 0,
                inAttr: 0,
                attr: 0,
                offset: 0,
                entryHeaderSize: "46 bytes"
            };

            headerdata.time = head.time;
            expect(head.toJSON()).to.eql(headerdata);
        });

        it("read binary and create new binary from it, they have to be equal", () => {
            const head = new entryHeader();
            head.loadFromBinary(readBuf);
            const buf = head.entryHeaderToBinary();

            expect(buf.length).to.equal(readBuf.length);
            expect(buf).to.eql(readBuf);
        });

        it("construct header with values and compare, binaries have to be equal", () => {
            const head = new entryHeader();

            // Set Values
            for (const name in readBufValues) {
                head[name] = readBufValues[name];
            }

            // time from datestamp
            // header time is constructed with local time
            // if time is constructed by new Date() it is also in local zone and so it cancels possible timezone difference
            head.time = new Date(...datestamp);

            const buf = head.entryHeaderToBinary();

            expect(buf.length).to.equal(readBuf.length);
            expect(buf).to.eql(readBuf);
        });

        it("entryHeaderSize results if postdata is specified", () => {
            const head = new entryHeader();

            head.fileNameLength = 100;
            head.commentLength = 200;
            head.extraLength = 100;

            expect(head.entryHeaderSize).to.equal(446);
        });

        describe("data-header", () => {
            const dataheader = Buffer.from("504b030414000008080045618102efbeadde000100000002000000000000", "hex");

            const dataHeaderValues = {
                compressedSize: 0x100,
                crc: 0xdeadbeef,
                extraLen: 0,
                flags: 0x800,
                fnameLen: 0,
                method: 8,
                size: 0x200,
                version: 20
            };

            it("compare binary header values with predetermined values", () => {
                const head = new entryHeader();
                head.loadFromBinary(readBuf);
                head.loadDataHeaderFromBinary(dataheader);

                for (const name in dataHeaderValues) {
                    expect(head.dataHeader[name]).to.equal(dataHeaderValues[name]);
                }
            });

            it("read binary and create new binary from it, they have to be equal", () => {
                const head = new entryHeader();
                head.loadFromBinary(readBuf);
                head.loadDataHeaderFromBinary(dataheader);

                const buf = head.dataHeaderToBinary();

                expect(buf.length).to.equal(dataheader.length);
                expect(buf).to.eql(dataheader);
            });

            it("construct header by values and compare binaries have to be equal", () => {
                const head = new entryHeader();
                head.loadFromBinary(readBuf);

                // Set Values
                for (const name in readBufValues) {
                    head[name] = readBufValues[name];
                }

                // time from datestamp
                // header time is constructed with local time
                // if time is constructed by new Date() it is also in local zone and so it cancels possible timezone difference
                head.time = new Date(...datestamp);

                const buf = head.dataHeaderToBinary();

                expect(buf.length).to.equal(dataheader.length);
                expect(buf).to.eql(dataheader);
            });
        });
    });
});
