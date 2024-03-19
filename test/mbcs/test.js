const assert = require("assert");
const path = require("path");
const Zip = require("../../adm-zip");
const rimraf = require("rimraf");
const iconv = require('iconv-lite')

describe("Multibyte Character Sets in Filename", () => {
    const destination = __dirname + "/xxx";

    before((done) => {
        rimraf(destination, done)
    }
    );

    it("ascii filename and Chinese content", (done) => {
        let zip1 = new Zip();
        zip1.addFile('ascii.txt', '测试文本\ntest text');
        zip1.addFile('test/ascii.txt', '测试文本\ntest text');
        zip1.writeZip(path.join(destination, "00-ascii.zip"));

        let zip2 = new Zip(path.join(destination, "00-ascii.zip"));
        let entry = zip2.getEntry('ascii.txt');
        let text = zip2.readFile(entry);
        assert(text.toString() === '测试文本\ntest text', text.toString());
        done()
    });

    it("add files with chs filename into new zip", (done) => {
        let zip1 = new Zip();
        zip1.addFile('中文路径.txt', '文件内容');
        zip1.addFile('test/中文路径.txt', '文件内容');
        zip1.writeZip(path.join(destination, "01-chs_name.zip"));

        let zip2 = new Zip(path.join(destination, "01-chs_name.zip"));
        let entry = zip2.getEntry('中文路径.txt');
        let text = zip2.readFile(entry);
        assert(text.toString() === '文件内容', text.toString());
        done()
    });

    it("fetch file with chs filename (gbk) in existing zip", (done) => {
        let tZip = new Zip(path.join(__dirname, "chs_name.zip"));
        for(let entry of tZip.getEntries()){
            if(entry.isDirectory) continue;
            let CNpath = iconv.decode(entry.rawEntryName, 'gbk');
            assert(CNpath === '中文路径.txt')
        }
        done()
    });

    it("add file with chs filename into existing zip", (done) => {
        let zip1 = new Zip(path.join(__dirname, "chs_name.zip"));
        zip1.addFile('test/中文测试.txt', Buffer.from('文件内容'));
        let entry = zip1.getEntry(iconv.encode('中文路径.txt','gbk'));
        zip1.addFile('test/中文测试UTF-8.txt', Buffer.from('文件内容'));
        zip1.writeZip(path.join(destination, "02-chs_name.zip"));
        done()
    });

    it("read and keep entry.extra while write zip", () => {
        let zip1 = new Zip(path.join(__dirname, "chs_name.zip"));
        let entry1 = zip1.getEntry(iconv.encode('中文路径.txt','gbk'));
        zip1.writeZip(path.join(destination, "03-chs_name_clone.zip"))

        let zip2 = new Zip(path.join(destination, "03-chs_name_clone.zip"));
        let entry2 = zip2.getEntry(iconv.encode('中文路径.txt','gbk'));
        assert(entry1.extra.equals(entry2.extra));

        // "read EFSflag"
        assert(entry1.header.EFSflag === false);
        assert(entry2.header.EFSflag === false);
    });

    it("add files with cht filename (UTF-8) into new zip", (done) => {
        let zip1 = new Zip();
        zip1.addFile('測試.txt', '測試');
        zip1.addFile('test/測試.txt', '測試');
        zip1.writeZip(path.join(destination, "04-cht_name.zip"));

        let zip2 = new Zip(path.join(destination, "04-cht_name.zip"));
        let entry = zip2.getEntry('測試.txt');
        let text = zip2.readFile(entry);
        assert(text.toString() === '測試', text.toString());

        assert(entry.header.EFSflag);
        done()
    });
    it("add files with cht filename (Big5) into new zip", (done) => {
        let zip1 = new Zip();
        zip1.addFile(iconv.encode('測試.txt','big5'), iconv.encode('測試','big5'));
        zip1.addFile(iconv.encode('test/測試.txt','big5'), iconv.encode('測試','big5'));
        zip1.writeZip(path.join(destination, "05-cht_name_big5.zip"));

        let zip2 = new Zip(path.join(destination, "05-cht_name_big5.zip"));
        let entry = zip2.getEntry(iconv.encode('測試.txt','big5'));
        let text = zip2.readFile(entry);
        //console.log(entry.toJSON())
        assert(text.equals(iconv.encode('測試','big5')));

        assert(!entry.header.EFSflag);
        done()
    });

    it("add files with jp filename (UTF-8) into new zip", (done) => {
        let zip1 = new Zip();
        zip1.addFile('にほんご.txt', 'にほんご');
        zip1.addFile('test/にほんご.txt', 'にほんご');
        zip1.writeZip(path.join(destination, "06-jp_name.zip"));

        let zip2 = new Zip(path.join(destination, "06-jp_name.zip"));
        let entry = zip2.getEntry('にほんご.txt');
        let text = zip2.readFile(entry);
        assert(text.toString() === 'にほんご', text.toString());
        done()
    });
    it("add files with jp filename (EUC-JP) into new zip", (done) => {
        let zip1 = new Zip();
        zip1.addFile(iconv.encode('にほんご.txt','EUC-JP'), iconv.encode('にほんご','EUC-JP'));
        zip1.addFile(iconv.encode('test/にほんご.txt','EUC-JP'), iconv.encode('にほんご','EUC-JP'));
        zip1.writeZip(path.join(destination, "07-jp_name.zip"));

        let zip2 = new Zip(path.join(destination, "07-jp_name.zip"));
        let entry = zip2.getEntry(iconv.encode('にほんご.txt','EUC-JP'));
        let text = zip2.readFile(entry);
        //console.log(entry.toJSON())
        assert(text.equals(iconv.encode('にほんご','EUC-JP')));
        done()
    });
    it("add files with jp filename (Shift_JIS) into new zip", (done) => {
        let zip1 = new Zip();
        zip1.addFile(iconv.encode('にほんご.txt','Shift_JIS'), iconv.encode('にほんご','Shift_JIS'));
        zip1.addFile(iconv.encode('test/にほんご.txt','Shift_JIS'), iconv.encode('にほんご','Shift_JIS'));
        zip1.writeZip(path.join(destination, "08-jp_name.zip"));

        let zip2 = new Zip(path.join(destination, "08-jp_name.zip"));
        let entry = zip2.getEntry(iconv.encode('にほんご.txt','Shift_JIS'));
        let text = zip2.readFile(entry);
        //console.log(entry.toJSON())
        assert(text.equals(iconv.encode('にほんご','Shift_JIS')));
        done()
    });

});
