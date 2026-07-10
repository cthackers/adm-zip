"use strict";

// Entry names come from untrusted input. The internal name->entry table used a
// plain object, so an entry named "__proto__" resolved to Object.prototype on
// lookup: addFile("__proto__", ...) crashed ("setData is not a function") and a
// crafted archive containing such an entry was hidden from getEntry/readFile.
// The table is now prototype-less (Object.create(null)).

const assert = require("assert");
const Zip = require("../../adm-zip");

describe("ADM-ZIP - prototype-polluting entry names", () => {
    it("addFile with a __proto__ / constructor name does not crash and round-trips", () => {
        const zip = new Zip();
        assert.doesNotThrow(() => {
            zip.addFile("__proto__", Buffer.from("A"));
            zip.addFile("constructor", Buffer.from("C"));
            zip.addFile("normal.txt", Buffer.from("B"));
        });
        const reopened = new Zip(zip.toBuffer());
        assert.deepStrictEqual(
            reopened
                .getEntries()
                .map((e) => e.entryName)
                .sort(),
            ["__proto__", "constructor", "normal.txt"]
        );
        assert.strictEqual(reopened.readFile("__proto__").toString(), "A");
        assert.strictEqual(reopened.readFile("constructor").toString(), "C");
    });

    it("does not pollute Object.prototype and returns null for missing entries", () => {
        const zip = new Zip();
        zip.addFile("__proto__", Buffer.from("x"));
        const reopened = new Zip(zip.toBuffer());
        assert.strictEqual(reopened.getEntry("does-not-exist"), null);
        assert.strictEqual({}.x, undefined);
        assert.strictEqual({}.polluted, undefined);
    });
});
