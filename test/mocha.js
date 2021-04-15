const { expect } = require("chai");
const Attr = require("../util").FileAttr;
const Zip = require("../adm-zip");
const pth = require("path");
const fs = require("fs");
const rimraf = require("rimraf");

describe("adm-zip", () => {
    const destination = "./test/xxx";

    // clean up folder content
    afterEach((done) => rimraf(destination, done));

    it("zip.extractAllTo()", () => {
        const zip = new Zip("./test/assets/ultra.zip");
        zip.extractAllTo(destination);
        const files = walk(destination);

        expect(files.sort()).to.deep.equal(
            [
                pth.normalize("./test/xxx/attributes_test/asd/New Text Document.txt"),
                pth.normalize("./test/xxx/attributes_test/blank file.txt"),
                pth.normalize("./test/xxx/attributes_test/New folder/hidden.txt"),
                pth.normalize("./test/xxx/attributes_test/New folder/hidden_readonly.txt"),
                pth.normalize("./test/xxx/attributes_test/New folder/readonly.txt"),
                pth.normalize("./test/xxx/utes_test/New folder/somefile.txt")
            ].sort()
        );
    });

    it("zip pathTraversal", () => {
        const target = pth.join(destination, "test");
        const zip = new Zip();
        zip.addFile("../../../test1.ext", "content");
        zip.addFile("folder/../../test2.ext", "content");
        zip.addFile("test3.ext", "content");
        const buf = zip.toBuffer();

        const extract = new Zip(buf);
        var zipEntries = zip.getEntries();
        zipEntries.forEach((e) => zip.extractEntryTo(e, destination, false, true));

        extract.extractAllTo(target);
        const files = walk(target);
        expect(files.sort()).to.deep.equal([pth.normalize("./test/xxx/test/test1.ext"), pth.normalize("./test/xxx/test/test2.ext"), pth.normalize("./test/xxx/test/test3.ext")]);
    });

    it("zip.extractEntryTo(entry, destination, false, true)", () => {
        const destination = "./test/xxx";
        const zip = new Zip("./test/assets/ultra.zip");
        var zipEntries = zip.getEntries();
        zipEntries.forEach((e) => zip.extractEntryTo(e, destination, false, true));

        const files = walk(destination);
        expect(files.sort()).to.deep.equal(
            [
                pth.normalize("./test/xxx/blank file.txt"),
                pth.normalize("./test/xxx/hidden.txt"),
                pth.normalize("./test/xxx/hidden_readonly.txt"),
                pth.normalize("./test/xxx/New Text Document.txt"),
                pth.normalize("./test/xxx/readonly.txt"),
                pth.normalize("./test/xxx/somefile.txt")
            ].sort()
        );
    });

    it("zip.extractEntryTo(entry, destination, true, true)", () => {
        const destination = "./test/xxx";
        const zip = new Zip("./test/assets/ultra.zip");
        var zipEntries = zip.getEntries();
        zipEntries.forEach((e) => zip.extractEntryTo(e, destination, true, true));

        const files = walk(destination);
        expect(files.sort()).to.deep.equal(
            [
                pth.normalize("./test/xxx/attributes_test/asd/New Text Document.txt"),
                pth.normalize("./test/xxx/attributes_test/blank file.txt"),
                pth.normalize("./test/xxx/attributes_test/New folder/hidden.txt"),
                pth.normalize("./test/xxx/attributes_test/New folder/hidden_readonly.txt"),
                pth.normalize("./test/xxx/attributes_test/New folder/readonly.txt"),
                pth.normalize("./test/xxx/utes_test/New folder/somefile.txt")
            ].sort()
        );
    });

    it("passes issue-237-Twizzeld test case", () => {
        const zip = new Zip("./test/assets/issue-237-Twizzeld.zip");
        const zipEntries = zip.getEntries();
        zipEntries.forEach(function (zipEntry) {
            if (!zipEntry.isDirectory) {
                zip.extractEntryTo(zipEntry, "./", false, true);
                // This should create text.txt on the desktop.
                // It will actually create two, but the first is overwritten by the second.
            }
        });
        let text = fs.readFileSync("./text.txt").toString();
        expect(text).to.equal("ride em cowboy!");
        fs.unlinkSync("./text.txt");
    });
});

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + "/" + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
        } else {
            /* Is a file */
            results.push(pth.normalize(file));
        }
    });
    return results;
}

function walkD(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + "/" + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
            results.push(file);
        }
    });
    return results;
}
