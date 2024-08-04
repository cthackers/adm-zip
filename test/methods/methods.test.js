const { expect } = require("chai");
//const Attr = require("../util").FileAttr;
const Zip = require("../../adm-zip");
const pth = require("path");
const fs = require("fs");
const rimraf = require("rimraf");
const Utils = require("../../util/utils");

describe("adm-zip.js - methods handling local files", () => {
    const wrapList = (c) => pth.normalize(pth.join(destination, c));
    const destination = "./test/xxx";
    const testFileFolderList = [
        { name: "subfolder1/subfolder2/zipEntry1.txt", content: "zipEntry1" },
        { name: "subfolder1/subfolder2/subfolder3/zipEntry2.txt", content: "zipEntry2" },
        { name: "subfolder1/subfolder2/subfolder3/zipEntry3.txt", content: "zipEntry3" },
        { name: "subfolder1/subfolder2/subfolder3/subfolder4/" }
    ];
    const testFileFileList = [
        { name: "folder/zipEntry1.txt", content: "zipEntry1" },
        { name: "folder/zipEntry2.txt", content: "zipEntry2" },
        { name: "folder/zipEntry3.txt", content: "zipEntry3" },
        { name: "folder/zipEntry4.txt", content: "zipEntry4" },
        { name: "folder/subfolder1/" },
        { name: "folder/subfolder2/" },
        { name: "folder/subfolder3/" }
    ];

    // clean up folder content
    afterEach((done) => rimraf(destination, done));

    describe(".deleteFile()", () => {
        const ultrazip = [
            "./attributes_test/asd/New Text Document.txt",
            "./attributes_test/blank file.txt",
            "./attributes_test/New folder/hidden.txt",
            "./attributes_test/New folder/hidden_readonly.txt",
            "./attributes_test/New folder/readonly.txt",
            "./utes_test/New folder/somefile.txt"
        ].map(wrapList);

        // Issue 523 - deletes additional files
        it("zip.deleteFile() - delete folder with subfolders", () => {
            const content = "test";
            const comment = "comment";
            const zip1 = new Zip({ noSort: true });
            zip1.addFile("test/");
            zip1.addFile("test/path1/");
            zip1.addFile("test/path1/file1.txt", content, comment);
            zip1.addFile("test/path1/folder1/");
            zip1.addFile("test/path1/folder1/file2.txt", content, comment);
            zip1.addFile("test/path2/");
            zip1.addFile("test/path2/file1.txt", content, comment);
            zip1.addFile("test/path2/folder1/");
            zip1.addFile("test/path2/folder1/file2.txt", content, comment);

            zip1.deleteFile("test/path1/");

            const zipEntries = zip1.getEntries().map((child) => child.entryName);

            expect(zipEntries).to.deep.equal(["test/", "test/path2/", "test/path2/file1.txt", "test/path2/folder1/", "test/path2/folder1/file2.txt"]);
        });

        it("zip.deleteFile() - delete folder", () => {
            const content = "test";
            const comment = "comment";
            const zip1 = new Zip({ noSort: true });
            zip1.addFile("test/");
            zip1.addFile("test/path1/");
            zip1.addFile("test/path1/file1.txt", content, comment);
            zip1.addFile("test/path1/folder1/");
            zip1.addFile("test/path1/folder1/file2.txt", content, comment);
            zip1.addFile("test/path2/");
            zip1.addFile("test/path2/file1.txt", content, comment);
            zip1.addFile("test/path2/folder1/");
            zip1.addFile("test/path2/folder1/file2.txt", content, comment);

            zip1.deleteFile("test/path1/", false);

            const zipEntries = zip1.getEntries().map((child) => child.entryName);

            expect(zipEntries).to.deep.equal([
                "test/",
                "test/path1/file1.txt",
                "test/path1/folder1/",
                "test/path1/folder1/file2.txt",
                "test/path2/",
                "test/path2/file1.txt",
                "test/path2/folder1/",
                "test/path2/folder1/file2.txt"
            ]);
        });

        it("zip.deleteFile() - delete files", () => {
            const content = "test";
            const comment = "comment";
            const zip1 = new Zip({ noSort: true });
            zip1.addFile("test/");
            zip1.addFile("test/path1/");
            zip1.addFile("test/path1/file1.txt", content, comment);
            zip1.addFile("test/path1/folder1/");
            zip1.addFile("test/path1/folder1/file2.txt", content, comment);

            zip1.deleteFile("test/path1/file1.txt", false);
            zip1.deleteFile("test/path1/folder1/file2.txt", false);

            const zipEntries = zip1.getEntries().map((child) => child.entryName);

            expect(zipEntries).to.deep.equal(["test/", "test/path1/", "test/path1/folder1/"]);
        });
    });

    describe(".extractAllTo() - sync", () => {
        const ultrazip = [
            "./attributes_test/asd/New Text Document.txt",
            "./attributes_test/blank file.txt",
            "./attributes_test/New folder/hidden.txt",
            "./attributes_test/New folder/hidden_readonly.txt",
            "./attributes_test/New folder/readonly.txt",
            "./utes_test/New folder/somefile.txt"
        ].map(wrapList);

        it("zip.extractAllTo(destination)", () => {
            const zip = new Zip("./test/assets/ultra.zip");
            zip.extractAllTo(destination);
            const files = walk(destination);

            expect(files.sort()).to.deep.equal(ultrazip.sort());
        });

        it("zip.extractAllTo(destination) - streamed file", () => {
            const zip = new Zip("./test/assets/stream-nozip64.zip");
            zip.extractAllTo(destination);
            const files = walk(destination);

            expect(files.sort()).to.deep.equal([pth.normalize("./test/xxx/lorem.txt")]);
        });
    });

    describe(".extractAllToAsync - sync", () => {
        const ultrazip = [
            "./attributes_test/asd/New Text Document.txt",
            "./attributes_test/blank file.txt",
            "./attributes_test/New folder/hidden.txt",
            "./attributes_test/New folder/hidden_readonly.txt",
            "./attributes_test/New folder/readonly.txt",
            "./utes_test/New folder/somefile.txt"
        ].map(wrapList);

        it("zip.extractAllToAsync(destination)", (done) => {
            const zip = new Zip("./test/assets/ultra.zip");
            zip.extractAllToAsync(destination, (error) => {
                const files = walk(destination);
                expect(files.sort()).to.deep.equal(ultrazip.sort());
                done();
            });
        });

        it("zip.extractAllToAsync(destination) [Promise]", function () {
            const zip = new Zip("./test/assets/ultra.zip");
            // note the return
            return zip.extractAllToAsync(destination).then(function (data) {
                const files = walk(destination);
                expect(files.sort()).to.deep.equal(ultrazip.sort());
            }); // no catch, it'll figure it out since the promise is rejected
        });

        it("zip.extractAllToAsync(destination, false, false, callback)", (done) => {
            const zip = new Zip("./test/assets/ultra.zip");
            zip.extractAllToAsync(destination, false, false, (error) => {
                const files = walk(destination);
                expect(files.sort()).to.deep.equal(ultrazip.sort());
                done();
            });
        });

        it("zip.extractAllToAsync(destination, false, false) [Promise]", function () {
            const zip = new Zip("./test/assets/ultra.zip");
            // note the return
            return zip.extractAllToAsync(destination, false, false).then(function (data) {
                const files = walk(destination);
                expect(files.sort()).to.deep.equal(ultrazip.sort());
            }); // no catch, it'll figure it out since the promise is rejected
        });

        it("zip.extractAllToAsync(destination, false, callback)", (done) => {
            const zip = new Zip("./test/assets/ultra.zip");
            zip.extractAllToAsync(destination, false, (error) => {
                const files = walk(destination);
                expect(files.sort()).to.deep.equal(ultrazip.sort());
                done();
            });
        });

        it("zip.extractAllToAsync(destination, false) [Promise]", () => {
            const zip = new Zip("./test/assets/ultra.zip");
            // note the return
            return zip.extractAllToAsync(destination, false).then(function (data) {
                const files = walk(destination);
                expect(files.sort()).to.deep.equal(ultrazip.sort());
            }); // no catch, it'll figure it out since the promise is rejected
        });
    });

    describe(".extractEntryTo() - sync", () => {
        // each entry one by one
        it("zip.extractEntryTo(entry, destination, false, true)", () => {
            const zip = new Zip("./test/assets/ultra.zip");
            var zipEntries = zip.getEntries();
            zipEntries.forEach((e) => zip.extractEntryTo(e, destination, false, true));

            const files = walk(destination);
            const ultrazip = ["blank file.txt", "hidden.txt", "hidden_readonly.txt", "New Text Document.txt", "readonly.txt", "somefile.txt"].map(wrapList);

            expect(files.sort()).to.deep.equal(ultrazip.sort());
        });

        // each entry one by one
        it("zip.extractEntryTo(entry, destination, true, true)", () => {
            const zip = new Zip("./test/assets/ultra.zip");
            var zipEntries = zip.getEntries();
            zipEntries.forEach((e) => zip.extractEntryTo(e, destination, true, true));

            const files = walk(destination);
            const ultrazip = [
                "./attributes_test/asd/New Text Document.txt",
                "./attributes_test/blank file.txt",
                "./attributes_test/New folder/hidden.txt",
                "./attributes_test/New folder/hidden_readonly.txt",
                "./attributes_test/New folder/readonly.txt",
                "./utes_test/New folder/somefile.txt"
            ].map(wrapList);

            expect(files.sort()).to.deep.equal(ultrazip.sort());
        });

        it("zip.extractEntryTo(entry, destination, false, true) -  [ extract folder from file where folders exists ]", () => {
            const zip = new Zip("./test/assets/maximum.zip");

            zip.extractEntryTo("./attributes_test/New folder/", destination, false, true);

            const files = walk(destination);
            const maximumzip = ["hidden.txt", "hidden_readonly.txt", "readonly.txt", "somefile.txt"].map(wrapList);

            expect(files.sort()).to.deep.equal(maximumzip.sort());
        });

        it("zip.extractEntryTo(entry, destination, false, true) -  [ extract folder from file where folders does not exists ]", () => {
            const zip = new Zip("./test/assets/maximum3.zip");

            zip.extractEntryTo("./attributes_test/New folder/", destination, false, true);

            const files = walk(destination);
            const maximumzip = ["hidden.txt", "hidden_readonly.txt", "readonly.txt", "somefile.txt"].map(wrapList);

            expect(files.sort()).to.deep.equal(maximumzip.sort());
        });

        it("zip.extractEntryTo(entry, destination, true, true) -  [ extract folder from file where folders exists ]", () => {
            const zip = new Zip("./test/assets/maximum.zip");

            zip.extractEntryTo("./attributes_test/New folder/", destination, true, true);

            const files = walk(destination);
            const maximumzip = [
                "./attributes_test/New folder/hidden.txt",
                "./attributes_test/New folder/hidden_readonly.txt",
                "./attributes_test/New folder/readonly.txt",
                "./attributes_test/New folder/somefile.txt"
            ].map(wrapList);
            expect(files.sort()).to.deep.equal(maximumzip.sort());
        });

        it("zip.extractEntryTo(entry, destination, true, true) -  [ extract folder from file where folders does not exists ]", () => {
            const zip = new Zip("./test/assets/maximum3.zip");

            zip.extractEntryTo("./attributes_test/New folder/", destination, true, true);

            const files = walk(destination);
            const maximumzip = [
                "./attributes_test/New folder/hidden.txt",
                "./attributes_test/New folder/hidden_readonly.txt",
                "./attributes_test/New folder/readonly.txt",
                "./attributes_test/New folder/somefile.txt"
            ].map(wrapList);
            expect(files.sort()).to.deep.equal(maximumzip.sort());
        });
    });

    describe(".addLocalFolder() - sync", () => {
        beforeEach(() => {
            genFiles(testFileFolderList, destination);
        });

        it("zip.addLocalFolder(destination)", () => {
            const zip = new Zip({ noSort: true });
            zip.addLocalFolder(destination);
            zip.toBuffer();

            const zip1Entries = zip.getEntries().map((e) => e.entryName);

            const expected = [
                "subfolder1/",
                "subfolder1/subfolder2/",
                "subfolder1/subfolder2/subfolder3/",
                "subfolder1/subfolder2/subfolder3/subfolder4/",
                "subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                "subfolder1/subfolder2/subfolder3/zipEntry3.txt",
                "subfolder1/subfolder2/zipEntry1.txt"
            ];

            expect(zip1Entries).to.deep.equal(expected);
        });

        it("zip.addLocalFolder(destination, zipPath)", () => {
            const zip = new Zip();
            zip.addLocalFolder(destination, "parent");
            zip.toBuffer();

            const zip1Entries = zip.getEntries().map((e) => e.entryName);

            const expected = [
                "parent/subfolder1/",
                "parent/subfolder1/subfolder2/",
                "parent/subfolder1/subfolder2/subfolder3/",
                "parent/subfolder1/subfolder2/subfolder3/subfolder4/",
                "parent/subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                "parent/subfolder1/subfolder2/subfolder3/zipEntry3.txt",
                "parent/subfolder1/subfolder2/zipEntry1.txt"
            ].sort();

            expect(zip1Entries).to.deep.equal(expected);
        });

        it("zip.addLocalFolder(destination, '', filter)", () => {
            const zip = new Zip();
            const filter = /zipEntry[23]\.txt/;
            zip.addLocalFolder(destination, "", filter);
            zip.toBuffer();

            const zip1Entries = zip.getEntries().map((e) => e.entryName);

            const expected = ["subfolder1/subfolder2/subfolder3/zipEntry2.txt", "subfolder1/subfolder2/subfolder3/zipEntry3.txt"].sort();

            expect(zip1Entries).to.deep.equal(expected);
        });

        it("zip.addLocalFolder(destination, '', filter)", () => {
            const zip = new Zip();
            const filter = function (str) {
                return str.slice(-1) === pth.sep;
            };
            zip.addLocalFolder(destination, "", filter);
            zip.toBuffer();

            const zip1Entries = zip.getEntries().map((e) => e.entryName);

            const expected = ["subfolder1/", "subfolder1/subfolder2/", "subfolder1/subfolder2/subfolder3/", "subfolder1/subfolder2/subfolder3/subfolder4/"].sort();

            expect(zip1Entries).to.deep.equal(expected);
        });
    });

    describe(".addLocalFileAsync() - async", () => {
        beforeEach(() => {
            genFiles(testFileFileList, destination);
        });

        it("zip.addLocalFileAsync({ localPath, comment, zipPath }, callback)", (done) => {
            const zip = new Zip();
            const zipPath = "folder";
            const fileComment = "file Comment";
            const list1 = testFileFileList.map((c) => c.name);
            list1.sort();
            zip.addZipComment(fileComment);

            setImmediate(
                list1.reverse().reduce(
                    function (next, file) {
                        return function (err, done) {
                            if (err) next(err, false);

                            const localPath = pth.resolve(destination, file);
                            const comment = pth.basename(file);

                            zip.addLocalFileAsync({ localPath, comment, zipPath }, function (err, done) {
                                if (err) next(err, false);

                                setImmediate(next, undefined, true);
                            });
                        };
                    },
                    function (err) {
                        if (err) done(err);

                        const zip1Entries = zip.getEntries().map((e) => e.entryName);
                        const zip1Comment = zip.getEntries().map((e) => e.comment);

                        const expected1 = list1;
                        const expected2 = list1.map((n) => pth.basename(n));

                        expect(zip1Entries.sort()).to.deep.equal(expected1.sort());
                        expect(zip1Comment.sort()).to.deep.equal(expected2.sort());
                        expect(zip.getZipComment()).to.equal(fileComment);

                        done();
                    }
                )
            );
        });
    });

    describe(".addLocalFolderAsync2() - async", () => {
        beforeEach(() => {
            genFiles(testFileFolderList, destination);
        });

        it("zip.addLocalFolderAsync2(destination, callback)", (done) => {
            const zip = new Zip();
            zip.addLocalFolderAsync2(destination, (error) => {
                if (error) done(false);

                zip.toBuffer(function () {
                    const zip1Entries = zip.getEntries().map((e) => e.entryName);

                    const expected = [
                        "subfolder1/",
                        "subfolder1/subfolder2/",
                        "subfolder1/subfolder2/subfolder3/",
                        "subfolder1/subfolder2/zipEntry1.txt",
                        "subfolder1/subfolder2/subfolder3/subfolder4/",
                        "subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                        "subfolder1/subfolder2/subfolder3/zipEntry3.txt"
                    ];

                    expect(zip1Entries).to.deep.equal(expected.sort());
                    done();
                });
            });
        });

        it("zip.addLocalFolderAsync2({localPath}, callback)", (done) => {
            const zip = new Zip();
            zip.addLocalFolderAsync2({ localPath: destination }, (error) => {
                if (error) done(false);

                zip.toBuffer(function () {
                    const zip1Entries = zip.getEntries().map((e) => e.entryName);

                    const expected = [
                        "subfolder1/",
                        "subfolder1/subfolder2/",
                        "subfolder1/subfolder2/subfolder3/",
                        "subfolder1/subfolder2/subfolder3/subfolder4/",
                        "subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                        "subfolder1/subfolder2/subfolder3/zipEntry3.txt",
                        "subfolder1/subfolder2/zipEntry1.txt"
                    ].sort();

                    expect(zip1Entries).to.deep.equal(expected);
                    done();
                });
            });
        });

        it("zip.addLocalFolderAsync2({localPath, namefix}, callback)", (done) => {
            const zip = new Zip();
            const namefix = (str) => str.toLowerCase();
            zip.addLocalFolderAsync2({ localPath: destination, namefix }, (error) => {
                if (error) done(false);

                zip.toBuffer(function () {
                    const zip1Entries = zip.getEntries().map((e) => e.entryName);

                    const expected = [
                        "subfolder1/",
                        "subfolder1/subfolder2/",
                        "subfolder1/subfolder2/subfolder3/",
                        "subfolder1/subfolder2/subfolder3/subfolder4/",
                        "subfolder1/subfolder2/subfolder3/zipentry2.txt",
                        "subfolder1/subfolder2/subfolder3/zipentry3.txt",
                        "subfolder1/subfolder2/zipentry1.txt"
                    ].sort();

                    expect(zip1Entries).to.deep.equal(expected);
                    done();
                });
            });
        });

        it("zip.addLocalFolderAsync2({localPath, namefix}, callback)", (done) => {
            const zip = new Zip();
            genFiles([{ name: "subfolder1/æble.txt", content: "apple" }], destination);

            zip.addLocalFolderAsync2({ localPath: destination, namefix: "latin1" }, (error) => {
                if (error) done(false);

                zip.toBuffer(function () {
                    const zip1Entries = zip.getEntries().map((e) => e.entryName);

                    const expected = [
                        "subfolder1/",
                        "subfolder1/ble.txt",
                        "subfolder1/subfolder2/",
                        "subfolder1/subfolder2/subfolder3/",
                        "subfolder1/subfolder2/subfolder3/subfolder4/",
                        "subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                        "subfolder1/subfolder2/subfolder3/zipEntry3.txt",
                        "subfolder1/subfolder2/zipEntry1.txt"
                    ].sort();

                    expect(zip1Entries).to.deep.equal(expected);
                    done();
                });
            });
        });

        it("zip.addLocalFolderAsync2({localPath, zipPath}, callback)", (done) => {
            const zip = new Zip();
            zip.addLocalFolderAsync2({ localPath: destination, zipPath: "parent" }, (error) => {
                if (error) done(false);

                zip.toBuffer(function () {
                    const zip1Entries = zip.getEntries().map((e) => e.entryName);

                    const expected = [
                        "parent/subfolder1/",
                        "parent/subfolder1/subfolder2/",
                        "parent/subfolder1/subfolder2/subfolder3/",
                        "parent/subfolder1/subfolder2/subfolder3/subfolder4/",
                        "parent/subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                        "parent/subfolder1/subfolder2/subfolder3/zipEntry3.txt",
                        "parent/subfolder1/subfolder2/zipEntry1.txt"
                    ].sort();

                    expect(zip1Entries).to.deep.equal(expected);
                    done();
                });
            });
        });

        it("zip.addLocalFolderAsync2({localPath, filter}, callback)", (done) => {
            const zip = new Zip();
            const filter = /zipEntry[23]\.txt/;
            zip.addLocalFolderAsync2({ localPath: destination, filter }, (error) => {
                if (error) done(false);

                zip.toBuffer(function () {
                    const zip1Entries = zip.getEntries().map((e) => e.entryName);

                    const expected = ["subfolder1/subfolder2/subfolder3/zipEntry2.txt", "subfolder1/subfolder2/subfolder3/zipEntry3.txt"].sort();

                    expect(zip1Entries).to.deep.equal(expected);
                    done();
                });
            });
        });

        it("zip.addLocalFolderAsync2({localPath, filter}, callback)", (done) => {
            const zip = new Zip();
            const filter = function (str) {
                return str.slice(-1) === pth.sep;
            };
            zip.addLocalFolderAsync2({ localPath: destination, filter }, (error) => {
                if (error) done(false);

                zip.toBuffer(function () {
                    const zip1Entries = zip.getEntries().map((e) => e.entryName);

                    const expected = ["subfolder1/", "subfolder1/subfolder2/", "subfolder1/subfolder2/subfolder3/", "subfolder1/subfolder2/subfolder3/subfolder4/"].sort();

                    expect(zip1Entries).to.deep.equal(expected);
                    done();
                });
            });
        });
    });

    describe(".addLocalFolderPromise() - promise", () => {
        beforeEach(() => {
            genFiles(testFileFolderList, destination);
        });

        it("zip.addLocalFolderPromise(destination)", async function () {
            const zip = new Zip();
            const zip1 = await zip.addLocalFolderPromise(destination);

            zip1.toBuffer();
            const zip1Entries = zip1.getEntries().map((e) => e.entryName);

            const expected = [
                "subfolder1/",
                "subfolder1/subfolder2/",
                "subfolder1/subfolder2/subfolder3/",
                "subfolder1/subfolder2/zipEntry1.txt",
                "subfolder1/subfolder2/subfolder3/subfolder4/",
                "subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                "subfolder1/subfolder2/subfolder3/zipEntry3.txt"
            ].sort();

            expect(zip1Entries).to.deep.equal(expected.sort());
        });

        it("zip.addLocalFolderPromise(destination, {namefix})", async function () {
            const zip = new Zip();
            const namefix = (str) => str.toLowerCase();
            const zip1 = await zip.addLocalFolderPromise(destination, { namefix });

            zip1.toBuffer();
            const zip1Entries = zip1.getEntries().map((e) => e.entryName);

            const expected = [
                "subfolder1/",
                "subfolder1/subfolder2/",
                "subfolder1/subfolder2/subfolder3/",
                "subfolder1/subfolder2/subfolder3/subfolder4/",
                "subfolder1/subfolder2/subfolder3/zipentry2.txt",
                "subfolder1/subfolder2/subfolder3/zipentry3.txt",
                "subfolder1/subfolder2/zipentry1.txt"
            ].sort();

            expect(zip1Entries).to.deep.equal(expected.sort());
        });

        it("zip.addLocalFolderPromise(destination, {zipPath})", async function () {
            const zip = new Zip();
            await zip.addLocalFolderPromise(destination, { zipPath: "parent" });
            const zip1Entries = zip.getEntries().map((e) => e.entryName);

            const expected = [
                "parent/subfolder1/",
                "parent/subfolder1/subfolder2/",
                "parent/subfolder1/subfolder2/subfolder3/",
                "parent/subfolder1/subfolder2/zipEntry1.txt",
                "parent/subfolder1/subfolder2/subfolder3/subfolder4/",
                "parent/subfolder1/subfolder2/subfolder3/zipEntry2.txt",
                "parent/subfolder1/subfolder2/subfolder3/zipEntry3.txt"
            ];

            expect(zip1Entries.sort()).to.deep.equal(expected.sort());
        });
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

function genFiles(list, location) {
    const utils = new Utils({ fs });

    for (const el of list) {
        const path = pth.resolve(location, el.name);
        if (el.name.slice(-1) === "/") {
            utils.makeDir(path);
        } else {
            utils.makeDir(pth.dirname(path));
            fs.writeFileSync(path, el.content, "utf8");
        }
    }
}
