const {expect} = require('chai');
const Attr = require("../util").FileAttr;
const Zip = require("../adm-zip");
const pth = require("path");
const fs = require("fs");
const crypto =  require('crypto');
const rimraf = require("rimraf")

describe('adm-zip', () => {
    describe('file extraction tests', () => {
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

        it('passes issue-237-Twizzeld test case', () => {
            const zip = new Zip('./test/assets/issue-237-Twizzeld.zip');
            const zipEntries = zip.getEntries();
            zipEntries.forEach(function (zipEntry) {
                if (!zipEntry.isDirectory) {
                    zip.extractEntryTo(zipEntry, './', false, true);
                    // This should create text.txt on the desktop.
                    // It will actually create two, but the first is overwritten by the second.
                }
            });
            let text = fs.readFileSync('./text.txt').toString()
            expect(text).to.equal('ride em cowboy!')
            fs.unlinkSync('./text.txt')
        })
    })

    describe('file creation test', () => {
        describe('create file with unicode filename', () => {
            const file1 = {name:'Snøfall.txt', content: Buffer.from('test')};
            const zip = new Zip();
            zip.addFile(file1.name, file1.content);
            const entry = zip.getEntry(file1.name)

            // do we get zipentry with correct filename
            it('we got zipEntry with given name', () => {
                expect(entry).to.be.a('object');
            })
            // try keep file datetime constant so resulting hash would be same
            if (entry) entry.header.time = new Date(Date.UTC(1980,0,1,12)); // 1980/01/01 12:00 Z
            // generate zip buffer and then hash
            const hash = createHash(zip.toBuffer());
            // is hash same ??
            it('returned zipfile has expected hash value', () => {
                expect(hash).to.equal('4zUoVRlwo1exO1q0ur/9+Q==')
            })
        })
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

function createHash(buffer) {
    const hash = crypto
        .createHash('md5')
        .update(buffer)
        .digest('base64');
    return hash;
}