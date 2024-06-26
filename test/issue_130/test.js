"use strict";

const assert = require("assert");
const fs = require("fs");
const pth = require("path");
const Zip = require("../../adm-zip");
const rimraf = require("rimraf");

describe("ADM-ZIP - Issues", () => {
    const destination = pth.resolve("./test/xxx");
    const unzipped = pth.join(destination, "unzipped");

    // clean up folder content
    afterEach((done) => rimraf(destination, done));

    it("Issue 130 - Created zip's under Windows are corrupt", () => {
        // init the final zip file
        const writeZip = new Zip();

        // file in root folder
        writeZip.addFile("root_file.txt", "root");

        // add folder
        writeZip.addFile("sub/", Buffer.alloc(0));

        // file in sub folder
        writeZip.addFile("sub/sub_file.txt", "sub");

        // files from local folder
        writeZip.addLocalFolder(pth.resolve("./test/issue_130", "nested"), "nested");

        // write to disk
        writeZip.writeZip(pth.join(destination, "test.zip"));

        // read zip from disk
        const readZip = new Zip(pth.join(destination, "test.zip"));

        // unpack everything
        readZip.extractAllTo(unzipped, true);

        // assert the files
        const fileRoot = fs.readFileSync(pth.join(unzipped, "root_file.txt"), "utf8");
        assert(fileRoot === "root", "root file not correct");

        const fileSub = fs.readFileSync(pth.join(unzipped, "sub/sub_file.txt"), "utf8");
        assert(fileSub === "sub", "sub file not correct");

        const fileNested = fs.readFileSync(pth.join(unzipped, "nested/nested_file.txt"), "utf8");
        assert(fileNested === "nested", "nested file not correct");

        const fileDeeper = fs.readFileSync(pth.join(unzipped, "nested/deeper/deeper_file.txt"), "utf8");
        assert(fileDeeper === "deeper", "deeper file not correct");
    });
});
