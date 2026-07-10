"use strict";

// Issue 541: https://github.com/cthackers/adm-zip/issues/541
// addLocalFolder walked the tree with statSync (which follows symlinks) and
// recursed into every directory. A symlink pointing back to an ancestor (common
// with yarn/npm workspaces: node_modules/<pkg> -> the package root) made the
// walk descend forever until the path failed with ELOOP / ENAMETOOLONG.
//
// The walk now resolves real paths and skips directories it has already visited,
// so symlink loops terminate instead of crashing.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Zip = require("../../adm-zip");

const ROOT = path.join(__dirname, "tree");

function buildTree() {
    fs.rmSync(ROOT, { recursive: true, force: true });
    // ROOT/workspace-a/index.js
    // ROOT/workspace-a/node_modules/workspace-a -> ../..  (loops back to ROOT)
    const wsNodeModules = path.join(ROOT, "workspace-a", "node_modules");
    fs.mkdirSync(wsNodeModules, { recursive: true });
    fs.writeFileSync(path.join(ROOT, "workspace-a", "index.js"), "module.exports = 1;\n");
    fs.symlinkSync("../..", path.join(wsNodeModules, "workspace-a"), "dir");
}

// Windows needs elevated rights / developer mode to create symlinks.
let symlinkSupported = true;
try {
    buildTree();
} catch (e) {
    symlinkSupported = false;
}

(symlinkSupported ? describe : describe.skip)("ADM-ZIP - Issue 541 - recursive symlinks", () => {
    before(buildTree);
    after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

    it("addLocalFolder does not loop forever on a symlink back to an ancestor", () => {
        const zip = new Zip();
        assert.doesNotThrow(() => zip.addLocalFolder(ROOT));
        const names = zip.getEntries().map((e) => e.entryName);
        // the real file was collected
        assert.ok(names.includes("workspace-a/index.js"), "expected workspace-a/index.js, got " + JSON.stringify(names));
        // the looping directory is recorded once but not descended into
        assert.strictEqual(names.filter((n) => n === "workspace-a/node_modules/workspace-a/").length, 1);
    });

    it("addLocalFolderPromise does not loop forever either", async () => {
        const zip = new Zip();
        await zip.addLocalFolderPromise(ROOT);
        const names = zip.getEntries().map((e) => e.entryName);
        assert.ok(names.includes("workspace-a/index.js"));
    });
});
