"use strict";

// Issues 470 / 459 / 402: https://github.com/cthackers/adm-zip/issues/470
// writeFileToAsync ignored the error from its retry fs.open, so when a file
// could not be opened (insufficient permissions #470, an invalid filename on
// Windows #459, or exhausted file descriptors #402) it passed an undefined fd
// to fs.write and threw an uncaught ERR_INVALID_ARG_TYPE that crashed the
// process. Write errors were also silently reported as success.
//
// Failures must now be reported through the callback (callback(false)) without
// throwing. This is driven with a mock fs so the result does not depend on real
// filesystem permissions (which root bypasses).

const assert = require("assert");
const Utils = require("../../util/utils");

const fileStat = { isDirectory: () => false, isFile: () => true };

// A fs stub whose target file and parent folder already "exist" and whose calls
// succeed, unless overridden. statSync is required for Utils to accept a custom fs.
function mockFs(overrides) {
    return Object.assign(
        {
            statSync: () => fileStat,
            exists: (p, cb) => cb(true),
            stat: (p, cb) => cb(null, fileStat),
            open: (p, flags, mode, cb) => cb(null, 3),
            write: (fd, buf, off, len, pos, cb) => cb(null, len, buf),
            close: (fd, cb) => cb(null),
            chmod: (p, mode, cb) => cb(null)
        },
        overrides
    );
}

describe("ADM-ZIP - Issue 470/459/402 - writeFileToAsync error handling", () => {
    it("reports failure (no crash) when the file cannot be opened, even on retry", (done) => {
        const u = new Utils({ fs: mockFs({ open: (p, f, m, cb) => cb(new Error("EACCES: permission denied")) }) });
        assert.doesNotThrow(() => {
            u.writeFileToAsync("/nope/file.txt", Buffer.from("x"), true, undefined, (succ) => {
                assert.strictEqual(succ, false);
                done();
            });
        });
    });

    it("reports failure on a write error instead of silently succeeding", (done) => {
        const u = new Utils({ fs: mockFs({ write: (fd, b, o, l, p, cb) => cb(new Error("EIO")) }) });
        u.writeFileToAsync("/nope/file.txt", Buffer.from("x"), true, undefined, (succ) => {
            assert.strictEqual(succ, false);
            done();
        });
    });

    it("retries once after chmod and writes when the second open succeeds", (done) => {
        let opens = 0;
        const u = new Utils({ fs: mockFs({ open: (p, f, m, cb) => (++opens === 1 ? cb(new Error("EACCES")) : cb(null, 5)) }) });
        u.writeFileToAsync("/nope/file.txt", Buffer.from("x"), true, undefined, (succ) => {
            assert.strictEqual(succ, true);
            assert.strictEqual(opens, 2, "should retry open exactly once");
            done();
        });
    });

    it("succeeds on the normal path", (done) => {
        const u = new Utils({ fs: mockFs() });
        u.writeFileToAsync("/nope/file.txt", Buffer.from("x"), true, undefined, (succ) => {
            assert.strictEqual(succ, true);
            done();
        });
    });
});
