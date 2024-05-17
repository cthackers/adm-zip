"use strict";
const { expect } = require("chai");
const { decrypt, encrypt, _salter } = require("../../methods/zipcrypto");
const { crc32 } = require("../../util/utils");

// node crypto
const { createHash } = require("crypto");

describe("method - zipcrypto decrypt", () => {
    const source = {
        crc: 0xd87f7e0c,
        // 16 byte buffer as test source
        data: Buffer.from("D1Q5///EbpBY6rHIZXvd3A==", "base64"),
        // just data integrity check
        md5: "wYHjota6dQNazueWO9/uDg==",
        pwdok: "secret",
        pwdbad: "Secret",
        flagsencrypted: 0x01,
        flagsinfozipencrypted: 0x09,
        timeHighByte: 0xd8,
        // result
        result: Buffer.from("test", "ascii")
    };

    // test invalid input data
    it("handles invalid data field values / types", () => {
        for (const data of [undefined, null, "str", true, false, 6, Buffer.alloc(4)]) {
            const result = decrypt(data, { crc: source.crc }, source.pwdok);
            expect(result).to.have.lengthOf(0);
        }
    });

    // test is data intact
    it("is test data valid", () => {
        // source data
        const md5sum = createHash("md5");
        md5sum.update(source.data);
        expect(md5sum.digest("base64")).to.equal(source.md5);
        // result data
        expect(crc32(source.result)).to.equal(source.crc);
    });

    // is error thrown if invalid password was provided
    it("should throw if invalid password is provided", () => {
        expect(function badpassword() {
            decrypt(source.data, { crc: source.crc, flags: source.flagsencrypted }, source.pwdbad);
        }).to.throw();

        expect(function okpassword() {
            decrypt(source.data, { crc: source.crc, flags: source.flagsencrypted }, source.pwdok);
        }).to.not.throw();
    });

    // is error thrown if invalid password was provided
    it("should throw if invalid password is provided for Info-Zip bit 3 flag", () => {
        expect(function badpassword() {
            decrypt(source.data, { crc: source.crc, flags: source.flagsinfozipencrypted, timeHighByte: source.timeHighByte }, source.pwdbad);
        }).to.throw();

        expect(function okpassword() {
            decrypt(source.data, { crc: source.crc, flags: source.flagsinfozipencrypted, timeHighByte: source.timeHighByte }, source.pwdok);
        }).to.not.throw();
    });

    // test decryption with both password types
    it("test decrypted data with password", () => {
        // test password, string
        const result1 = decrypt(source.data, { crc: source.crc, flags: source.flagsencrypted }, source.pwdok);
        expect(result1.compare(source.result)).to.equal(0);

        // test password, buffer
        const result2 = decrypt(source.data, { crc: source.crc, flags: source.flagsencrypted }, Buffer.from(source.pwdok, "ascii"));
        expect(result2.compare(source.result)).to.equal(0);
    });
});

describe("method - zipcrypto encrypt", () => {
    const source = {
        crc: 0xd87f7e0c,
        // data
        data_str: "test",
        data_buffer: Buffer.from("test", "ascii"),
        salt: Buffer.from("xx+OYQ1Pkvo0ztPY", "base64"),
        // 16 byte buffer as test source
        data: Buffer.from("D1Q5///EbpBY6rHIZXvd3A==", "base64"),
        // just data integrity check
        pwdok: "secret",
        // result
        result: Buffer.from("D1Q5///EbpBY6rHIZXvd3A==", "base64")
    };

    // test binary results with known salt
    it("test binary results with known salt", () => {
        const head = { crc: source.crc };
        // inject known salt
        _salter(source.salt);
        const result = encrypt(source.data_str, head, source.pwdok, false);
        expect(result.compare(source.result)).to.equal(0);
        // restore salting
        _salter();
    });

    // test decryption with both password types
    it("test encryption and decrytion with node random salt", () => {
        const head = { crc: source.crc };
        _salter("node");
        // test password, string
        const data_buf = Buffer.from(source.data_str);
        const result1 = encrypt(source.data_str, head, source.pwdok, false);
        const result2 = decrypt(result1, head, source.pwdok);
        expect(result2.compare(data_buf)).to.equal(0);
        _salter();
    });

    // test decryption with both password types
    it("test encryption and decrytion with known source data", () => {
        const head = { crc: source.crc };
        // test password, string
        const data_buf = Buffer.from(source.data_str);
        const result1 = encrypt(source.data_str, head, source.pwdok, false);
        const result2 = decrypt(result1, head, source.pwdok);
        expect(result2.compare(data_buf)).to.equal(0);
    });

    // test how encrytion will handle some random data
    it("test encrypting and decryting with some javascript objects", () => {
        const tests = [true, null, false, undefined, {}, [], 747, new Date(), [{}]];
        const head = {};

        for (const test of tests) {
            const data_buf = test == null ? Buffer.alloc(0) : Buffer.from(test.toString());
            head.crc = crc32(data_buf);

            const result1 = encrypt(test, head, source.pwdok, false);
            const result2 = decrypt(result1, head, source.pwdok);
            expect(result2.compare(data_buf)).to.equal(0);
        }
    });
});
