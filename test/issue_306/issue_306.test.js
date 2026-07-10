"use strict";

// Issue 306: https://github.com/cthackers/adm-zip/issues/306
// extractEntryTo(dirEntry, target, maintainEntryPath=false) flattened every
// file to its basename, collapsing subdirectories together (and overwriting
// files that shared a name). It should instead keep each file's path relative
// to the extracted directory.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Zip = require("../../adm-zip");

const OUT = path.join(__dirname, "out");

function walk(dir, base) {
    let files = [];
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) files = files.concat(walk(p, base));
        else files.push(path.relative(base, p).split(path.sep).join("/"));
    }
    return files;
}

describe("ADM-ZIP - Issue 306 - extractEntryTo preserves subdirectories", () => {
    let buf;
    before(() => {
        const zip = new Zip();
        zip.addFile("repo-main/README.md", Buffer.from("readme"));
        zip.addFile("repo-main/src/index.js", Buffer.from("index"));
        zip.addFile("repo-main/src/util/helper.js", Buffer.from("helper"));
        buf = zip.toBuffer();
    });
    afterEach(() => fs.rmSync(OUT, { recursive: true, force: true }));

    it("keeps the subtree when maintainEntryPath is false (drops only the dir prefix)", () => {
        new Zip(buf).extractEntryTo("repo-main/", OUT, false, true);
        assert.deepStrictEqual(walk(OUT, OUT).sort(), ["README.md", "src/index.js", "src/util/helper.js"]);
    });

    it("keeps the full entry path when maintainEntryPath is true", () => {
        new Zip(buf).extractEntryTo("repo-main/", OUT, true, true);
        assert.deepStrictEqual(walk(OUT, OUT).sort(), ["repo-main/README.md", "repo-main/src/index.js", "repo-main/src/util/helper.js"]);
    });
});
