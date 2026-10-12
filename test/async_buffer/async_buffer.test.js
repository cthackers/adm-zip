"use strict";

// toAsyncBuffer() (used by toBuffer(onSuccess, onFail), toBufferPromise() and
// writeZipPromise()) recursed once per entry. Entries that are not recompressed
// call back synchronously, so an unmodified archive with a few thousand entries
// overflowed the stack. In addition, compress() read the local header of such an
// entry twice; the first callback had already moved header.offset, so on archives
// whose stored order differs from the sorted output order the second read failed
// after onSuccess had been called, and onFail was invoked as well.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Zip = require("../../adm-zip");
const Utils = require("../../util");

const ENTRIES = 5000;

// Builds a zip of STORED entries in memory. Names are not zero padded and are
// written in insertion order (f0, f1, f2 ... f10), which is not the sorted order
// adm-zip writes them in, so every entry moves when the archive is rewritten.
function buildZip(count, corruptIndex = -1) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (let i = 0; i < count; i++) {
        const name = Buffer.from(`f${i}.txt`);
        const data = Buffer.from(`hello ${i}`);
        const crc = Utils.crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(i === corruptIndex ? 0xdeadbeef : 0x04034b50, 0);
        local.writeUInt16LE(10, 4); // version needed
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        parts.push(local, name, data);

        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0);
        cen.writeUInt16LE(20, 4); // version made by
        cen.writeUInt16LE(10, 6); // version needed
        cen.writeUInt32LE(crc, 16);
        cen.writeUInt32LE(data.length, 20);
        cen.writeUInt32LE(data.length, 24);
        cen.writeUInt16LE(name.length, 28);
        cen.writeUInt32LE(offset, 42);
        central.push(cen, name);

        offset += local.length + name.length + data.length;
    }
    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(count, 8);
    end.writeUInt16LE(count, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, centralBuf, end]);
}

function assertContents(buffer, count) {
    const zip = new Zip(buffer);
    assert.strictEqual(zip.getEntries().length, count);
    for (let i = 0; i < count; i++) {
        assert.strictEqual(zip.readAsText(`f${i}.txt`), `hello ${i}`, `f${i}.txt`);
    }
}

// Runs toBuffer(onSuccess, onFail) and returns the sequence of callbacks seen.
// It waits for the first callback and then gives any late (wrongly fired)
// callback a chance to run before returning.
function callbackSequence(zip) {
    return new Promise((resolve) => {
        const seen = [];
        let timer = null;
        const record = (entry) => {
            seen.push(entry);
            if (!timer) timer = setTimeout(() => resolve(seen), 100);
        };
        zip.toBuffer(
            (buffer) => record({ type: "success", buffer }),
            (err) => record({ type: "fail", err })
        );
    });
}

describe("ADM-ZIP - async serialization of archives with many entries", () => {
    const source = buildZip(ENTRIES);

    it("the generated source archive is valid", () => {
        assertContents(source, ENTRIES);
    });

    it("toBufferPromise() resolves for an unmodified archive with thousands of entries", async () => {
        const zip = new Zip(source);
        const out = await zip.toBufferPromise();
        assertContents(out, ENTRIES);
    });

    it("toBuffer(onSuccess, onFail) calls onSuccess once and never onFail", async () => {
        const seen = await callbackSequence(new Zip(source));
        assert.deepStrictEqual(
            seen.map((s) => s.type),
            ["success"]
        );
        assertContents(seen[0].buffer, ENTRIES);
    });

    it("onFail is not called after onSuccess for a small archive whose entries move", async () => {
        const seen = await callbackSequence(new Zip(buildZip(60)));
        assert.deepStrictEqual(
            seen.map((s) => s.type),
            ["success"]
        );
        assertContents(seen[0].buffer, 60);
    });

    it("keeps unmodified entries and entries recompressed asynchronously together", async () => {
        const zip = new Zip(source);
        zip.addFile("added.txt", Buffer.from("added ".repeat(100)));
        zip.updateFile("f2500.txt", Buffer.from("changed ".repeat(100)));
        const out = new Zip(await zip.toBufferPromise());
        assert.strictEqual(out.getEntries().length, ENTRIES + 1);
        assert.strictEqual(out.readAsText("added.txt"), "added ".repeat(100));
        assert.strictEqual(out.readAsText("f2500.txt"), "changed ".repeat(100));
        assert.strictEqual(out.readAsText("f0.txt"), "hello 0");
        assert.strictEqual(out.readAsText(`f${ENTRIES - 1}.txt`), `hello ${ENTRIES - 1}`);
    });

    it("an entry that cannot be read reaches onFail exactly once and onSuccess never", async () => {
        const seen = await callbackSequence(new Zip(buildZip(3000, 1500)));
        assert.deepStrictEqual(
            seen.map((s) => s.type),
            ["fail"]
        );
        assert.ok(seen[0].err instanceof Error);
        assert.match(seen[0].err.message, /Invalid LOC header/);
    });

    it("toBufferPromise() rejects with the entry error", async () => {
        const zip = new Zip(buildZip(3000, 1500));
        await assert.rejects(zip.toBufferPromise(), /Invalid LOC header/);
    });

    it("an exception thrown by onSuccess is not reported through onFail", () => {
        let failed = 0;
        assert.throws(
            () =>
                new Zip().toBuffer(
                    () => {
                        throw new Error("from onSuccess");
                    },
                    () => failed++
                ),
            /from onSuccess/
        );
        assert.strictEqual(failed, 0);
    });

    describe("writeZipPromise()", () => {
        let dir;
        before(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), "adm-zip-async-"));
        });
        after(() => fs.rmSync(dir, { recursive: true, force: true }));

        it("writes an archive with thousands of entries", async () => {
            const target = path.join(dir, "many.zip");
            await new Zip(source).writeZipPromise(target);
            assertContents(fs.readFileSync(target), ENTRIES);
        });
    });
});
