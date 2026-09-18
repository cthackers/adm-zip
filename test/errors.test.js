"use strict";

const assert = require("assert");
const Errors = require("../util/errors");

describe("error messages", () => {
    const templates = {
        BAD_CRC: "CRC32 checksum failed {0}",
        FILE_IN_THE_WAY: "There is a file in the way: {0}",
        DUPLICATE_ENTRY: "Duplicate entry name {0}",
        FILE_NOT_FOUND: 'File not found: "{0}"'
    };

    for (const [name, template] of Object.entries(templates)) {
        it(`${name} formats each call independently`, () => {
            const prefix = "ADM-ZIP: ";
            const first = Errors[name]("first.txt");
            const second = Errors[name]("second.txt");

            assert(first instanceof Error);
            assert(second instanceof Error);
            assert.notStrictEqual(first, second);
            assert.strictEqual(first.message, prefix + template.replace("{0}", "first.txt"));
            assert.strictEqual(second.message, prefix + template.replace("{0}", "second.txt"));
            assert.strictEqual(Errors[name]().message, prefix + template);
            assert.strictEqual(Errors[name]("").message, prefix + template.replace("{0}", ""));
            assert.strictEqual(Errors[name]("third.txt").message, prefix + template.replace("{0}", "third.txt"));
        });
    }

    it("preserves messages without placeholders", () => {
        const first = Errors.NO_DATA();
        const second = Errors.NO_DATA("unused");

        assert(first instanceof Error);
        assert(second instanceof Error);
        assert.notStrictEqual(first, second);
        assert.strictEqual(first.message, "ADM-ZIP: Nothing to decompress");
        assert.strictEqual(second.message, first.message);
    });
});
