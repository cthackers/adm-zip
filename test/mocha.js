const {expect} = require('chai');
const Attr = require("../util").FileAttr;
const Zip = require("../adm-zip");
const pth = require("path");
const fs = require("fs");
const rimraf = require("rimraf")

describe('adm-zip', () => {

    const destination = './test/xxx'

    beforeEach(done => {
        rimraf(destination, err => {
            if (err) return done(err)
            console.log('Cleared directory: ' + destination)
            return done()
        })
    })

    it('zip.extractAllTo()', () => {
        const zip = new Zip('./test/assets/ultra.zip');
        zip.extractAllTo(destination);
        const files = walk(destination)

        expect(files.sort()).to.deep.equal([
            "./test/xxx/attributes_test/asd/New Text Document.txt",
            "./test/xxx/attributes_test/blank file.txt",
            "./test/xxx/attributes_test/New folder/hidden.txt",
            "./test/xxx/attributes_test/New folder/hidden_readonly.txt",
            "./test/xxx/attributes_test/New folder/readonly.txt",
            "./test/xxx/utes_test/New folder/somefile.txt"
        ].sort());
    })

    it('zip.extractEntryTo(entry, destination, false, true)', () => {
        const destination = './test/xxx'
        const zip = new Zip('./test/assets/ultra.zip');
        var zipEntries = zip.getEntries();
        zipEntries.forEach(e => zip.extractEntryTo(e, destination, false, true));

        const files = walk(destination)
        expect(files.sort()).to.deep.equal([
            "./test/xxx/blank file.txt",
            "./test/xxx/hidden.txt",
            "./test/xxx/hidden_readonly.txt",
            "./test/xxx/New Text Document.txt",
            "./test/xxx/readonly.txt",
            "./test/xxx/somefile.txt"
        ].sort());
    })

    it('zip.extractEntryTo(entry, destination, true, true)', () => {
        const destination = './test/xxx'
        const zip = new Zip('./test/assets/ultra.zip');
        var zipEntries = zip.getEntries();
        zipEntries.forEach(e => zip.extractEntryTo(e, destination, true, true));

        const files = walk(destination)
        expect(files.sort()).to.deep.equal([
            "./test/xxx/attributes_test/asd/New Text Document.txt",
            "./test/xxx/attributes_test/blank file.txt",
            "./test/xxx/attributes_test/New folder/hidden.txt",
            "./test/xxx/attributes_test/New folder/hidden_readonly.txt",
            "./test/xxx/attributes_test/New folder/readonly.txt",
            "./test/xxx/utes_test/New folder/somefile.txt"
        ].sort());
    })
})

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
        } else {
            /* Is a file */
            results.push(file);
        }
    });
    return results;
}

function walkD(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
            results.push(file);
        }
    });
    return results;
}