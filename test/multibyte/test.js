const { expect } = require("chai");
const Utils = require("../../util");
const AdmZip = require("../../adm-zip");
const path = require("path");

describe("adm-zip", () => {
    it("adds multibyte ZIP comment in UTF-8 with appropriate byte", () => {
        const zip = new AdmZip();
        zip.addLocalFile(path.join(__dirname, "./じっぷ/じっぷ.txt"));
        zip.addZipComment("じっぷ");
        const willSend = zip.toBuffer();
        const end = willSend.slice(willSend.lastIndexOf(Utils.Constants.ENDSIG));
        const commentLength = end.readInt16LE(Utils.Constants.ENDCOM, 2);
        expect(commentLength).to.eq(9);
        const expected = Buffer.from("じっぷ");
        const actual = end.slice(Utils.Constants.ENDCOM + 2);
        expect(actual).to.include(expected);
        expect(expected).to.include(actual);
    });
});
