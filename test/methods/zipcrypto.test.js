"use strict";
const { expect } = require("chai");
const { decrypt } = require("../../methods/zipcrypto");
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
        // result
        result: Buffer.from("test", "ascii"),
    };

    // test invalid input data
    it("handles invalid data field values / types", () => {
        for (const data of [ undefined, null, "str", true, false, 6, Buffer.alloc(4) ]) {
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
            decrypt(source.data, { crc: source.crc }, source.pwdbad);
        }).to.throw();

        expect(function okpassword() {
            decrypt(source.data, { crc: source.crc }, source.pwdok);
        }).to.not.throw();
    });

    // test decryption with both password types
    it("test decrypted data with password", () => {
        // test password, string
        const result1 = decrypt(source.data, { crc: source.crc }, source.pwdok);
        expect(result1.compare(source.result)).to.equal(0);

        // test password, buffer
        const result2 = decrypt( source.data,  { crc: source.crc }, Buffer.from(source.pwdok, "ascii"));
        expect(result2.compare(source.result)).to.equal(0);
    });
});
