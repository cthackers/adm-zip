const { expect } = require("chai");
//const Attr = require("../util").FileAttr;
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

    it("zip.extractAllToAsync(destination)", (done) => {
        const zip = new Zip("./test/assets/ultra.zip");
        zip.extractAllToAsync(destination, (error) => {
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
            done();
        });
    });

    it("zip.extractAllToAsync(destination) [Promise]", function () {
        const zip = new Zip("./test/assets/ultra.zip");
        // note the return
        return zip.extractAllToAsync(destination).then(function (data) {
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
        }); // no catch, it'll figure it out since the promise is rejected
    });

    it("zip.extractAllToAsync(destination, false, false, callback)", (done) => {
        const zip = new Zip("./test/assets/ultra.zip");
        zip.extractAllToAsync(destination, false, false, (error) => {
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
            done();
        });
    });

    it("zip.extractAllToAsync(destination, false, false) [Promise]", function () {
        const zip = new Zip("./test/assets/ultra.zip");
        // note the return
        return zip.extractAllToAsync(destination, false, false).then(function (data) {
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
        }); // no catch, it'll figure it out since the promise is rejected
    });

    it("zip.extractAllToAsync(destination, false, callback)", (done) => {
        const zip = new Zip("./test/assets/ultra.zip");
        zip.extractAllToAsync(destination, false, (error) => {
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
            done();
        });
    });

    it("zip.extractAllToAsync(destination, false) [Promise]", () => {
        const zip = new Zip("./test/assets/ultra.zip");
        // note the return
        return zip.extractAllToAsync(destination, false).then(function (data) {
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
        }); // no catch, it'll figure it out since the promise is rejected
    });

    it("zip pathTraversal", () => {
        const target = pth.join(destination, "test");
        const zip = new Zip();
        zip.addFile("../../../test1.ext", "content");
        zip.addFile("folder/../../test2.ext", "content");
        zip.addFile("test3.ext", "content");

        const extract = new Zip(zip.toBuffer());
        zip.getEntries().forEach((e) => zip.extractEntryTo(e, destination, false, true));

        extract.extractAllTo(target);
        const files = walk(target);
        expect(files.sort()).to.deep.equal([pth.normalize("./test/xxx/test/test1.ext"), pth.normalize("./test/xxx/test/test2.ext"), pth.normalize("./test/xxx/test/test3.ext")]);
    });

    it("zip.addFile - add directory", () => {
        const zip1 = new Zip();
        zip1.addFile("dir11/", null);
        zip1.addFile("dir12/", undefined);
        zip1.addFile("dir13/", "");
        zip1.addFile("dir11/dir21/");
        zip1.addFile("dir11/dir22/");
        zip1.addFile("dir12/dir23/");
        zip1.addFile("dir13/dir24/");
        zip1.addFile("dir11/dir22/test.txt", "content");
        const zip2 = new Zip(zip1.toBuffer());
        const zip2Entries = zip2.getEntries().map((e) => e.entryName);

        expect(zip2Entries).to.deep.equal(["dir11/", "dir11/dir21/", "dir11/dir22/", "dir11/dir22/test.txt", "dir12/", "dir12/dir23/", "dir13/", "dir13/dir24/"]);
    });

    it("zip.extractEntryTo(entry, destination, false, true)", () => {
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

    it("passes issue-438-AddFile with windows path sepator", () => {
        const zip = new Zip();
        zip.addFile("foo\\bar.txt", "test", "test");
        zip.extractAllTo(destination);

        const files = walk(destination);

        expect(files.sort()).to.deep.equal([pth.normalize("./test/xxx/foo/bar.txt")].sort());
    });

    it("testing noSort option", () => {
        const content = "test";
        const comment = "comment";

        // is sorting working - value "false"
        const zip1 = new Zip({ noSort: false });
        zip1.addFile("a.txt", content, comment);
        zip1.addFile("c.txt", content, comment);
        zip1.addFile("b.txt", content, comment);
        zip1.addFile("a.txt", content, comment);
        zip1.toBuffer();

        const zip1Entries = zip1.getEntries().map((e) => e.entryName);
        expect(zip1Entries).to.deep.equal(["a.txt", "b.txt", "c.txt"]);

        // skip sorting - value "true"
        const zip2 = new Zip({ noSort: true });
        zip1.addFile("a.txt", content, comment);
        zip2.addFile("c.txt", content, comment);
        zip2.addFile("b.txt", content, comment);
        zip2.addFile("a.txt", content, comment);
        zip2.toBuffer();

        const zip2Entries = zip2.getEntries().map((e) => e.entryName);
        expect(zip2Entries).to.deep.equal(["c.txt", "b.txt", "a.txt"]);
    });

    /*
    it("repro: symlink", () => {
        const zip = new Zip("./test/assets/symlink.zip");
        zip.extractAllTo(destination);

        const linkPath = pth.join(destination, "link");
        const linkStat = fs.lstatSync(linkPath);
        expect(linkStat.isSymbolicLink()).to.be.true;

        const linkTarget = fs.readlinkSync(linkPath);
        expect(linkTarget).to.equal("target");

        const linkContent = fs.readFileSync(linkPath);
        expect(linkContent).to.equal("diddlydiddly doo, i'm a linkaroo");
    });
    */
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
