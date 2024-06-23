const assert = require("assert");
const pth = require("path");
const Zip = require("../../adm-zip");
const rimraf = require("rimraf");
const iconv = require("iconv-lite");

describe("Multibyte Character Sets in Filename", () => {
    const destination = pth.resolve("./test/xxx");
    const asset1 = pth.resolve("./test/mbcs/", "chs_name.zip");

    // clean up folder content
    afterEach((done) => rimraf(destination, done));

    // chinese
    it("ascii filename and chinese content", (done) => {
        const encoding = "ascii";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const content = "测试文本\ntest text";

        const zip1 = new Zip({ decoder });
        zip1.addFile("ascii.txt", content);
        zip1.addFile("test/ascii.txt", content);
        zip1.writeZip(pth.join(destination, "00-ascii.zip"));

        const zip2 = new Zip(pth.join(destination, "00-ascii.zip"), { decoder });
        const text = zip2.readAsText("ascii.txt");
        assert(text === content, text);
        done();
    });

    it("add files with chinese filename into new zip", (done) => {
        const encoding = "gbk";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const content = "文件内容";
        const file = "中文路径.txt";

        const zip1 = new Zip({ decoder });
        zip1.addFile(file, content);
        zip1.addFile("test/" + file, content);
        zip1.writeZip(pth.join(destination, "01-chs_name.zip"));

        const zip2 = new Zip(pth.join(destination, "01-chs_name.zip"), { decoder });
        const text = zip2.readAsText(file);
        assert(text === content, text);
        done();
    });

    it("fetch file with chinese filename (gbk) in existing zip", (done) => {
        const encoding = "gbk";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        let tZip = new Zip(asset1, { decoder });
        for (let entry of tZip.getEntries()) {
            if (entry.isDirectory) continue;
            const CNpath = entry.entryName;
            assert(CNpath === "中文路径.txt");
        }
        done();
    });

    it("add file with chinese filename into existing zip", (done) => {
        const encoding = "gbk";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const content = "文件内容";
        const file1 = "test/中文测试.txt";
        const file2 = "中文路径.txt";

        let zip1 = new Zip(asset1, { decoder });
        zip1.addFile(file1, content);
        zip1.writeZip(pth.join(destination, "02-chs_name.zip"));

        const zip2 = new Zip(pth.join(destination, "02-chs_name.zip"), { decoder });
        const text1 = zip2.readAsText(file1);
        assert(text1 === content, text1);

        const text2 = zip2.readAsText(file2);
        assert(text2 === content, text2);

        done();
    });

    it("read and keep entry.extra while write zip", () => {
        const encoding = "gbk";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        let zip1 = new Zip(asset1, { decoder });
        let entry1 = zip1.getEntry("中文路径.txt", "gbk");
        zip1.writeZip(pth.join(destination, "03-chs_name_clone.zip"));

        let zip2 = new Zip(pth.join(destination, "03-chs_name_clone.zip"), { decoder });
        let entry2 = zip2.getEntry("中文路径.txt");
        assert(entry1.extra.equals(entry2.extra));

        // "read EFSflag"
        assert(entry1.header.flags_efs === false);
        assert(entry2.header.flags_efs === false);
    });

    it("add files with chinese filename (UTF-8) into new zip", (done) => {
        let zip1 = new Zip();
        zip1.addFile("測試.txt", "測試");
        zip1.addFile("test/測試.txt", "測試");
        zip1.writeZip(pth.join(destination, "04-cht_name.zip"));

        let zip2 = new Zip(pth.join(destination, "04-cht_name.zip"));
        let entry = zip2.getEntry("測試.txt");
        const text = zip2.readAsText(entry);
        assert(text === "測試", text);

        assert(entry.header.flags_efs);
        done();
    });

    it("add files with chinese filename (Big5) into new zip", (done) => {
        const encoding = "big5";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const content = iconv.encode("測試", encoding); // buffer

        let zip1 = new Zip({ decoder });
        zip1.addFile("測試.txt", content);
        zip1.addFile("test/測試.txt", content);
        zip1.writeZip(pth.join(destination, "05-cht_name_big5.zip"));

        const zip2 = new Zip(pth.join(destination, "05-cht_name_big5.zip"), { decoder });
        const entry = zip2.getEntry("測試.txt");
        const bufdata = zip2.readFile(entry);
        //console.log(entry.toJSON())
        assert(bufdata.equals(content));

        assert(!entry.header.flags_efs);
        done();
    });

    // japanese
    it("add files with japanese filename (UTF-8) into new zip", (done) => {
        const file = "にほんご.txt";
        const content = "にほんご";

        const zip1 = new Zip();
        zip1.addFile(file, content);
        zip1.addFile("test/" + file, content);
        zip1.writeZip(pth.join(destination, "06-jp_name.zip"));

        const zip2 = new Zip(pth.join(destination, "06-jp_name.zip"));
        const text1 = zip2.readAsText(file);
        assert(text1 === content, text1);
        const entry2 = zip2.getEntry("test/" + file);
        const text2 = zip2.readAsText(entry2);
        assert(text2 === content, text2);
        assert(entry2.header.flags_efs);
        done();
    });

    it("add files with japanese filename (EUC-JP) into new zip", (done) => {
        const encoding = "EUC-JP";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const file = "にほんご.txt";
        const content = iconv.encode("にほんご", encoding); // buffer

        const zip1 = new Zip({ decoder });
        zip1.addFile(file, content);
        zip1.addFile("test/" + file, content);
        zip1.writeZip(pth.join(destination, "07-jp_name.zip"));

        const zip2 = new Zip(pth.join(destination, "07-jp_name.zip"), { decoder });
        let entry1 = zip2.getEntry(file);
        let bufdata1 = zip2.readFile(entry1);
        assert(bufdata1.equals(content));
        let entry2 = zip2.getEntry("test/" + file);
        let bufdata2 = zip2.readFile(entry2);
        assert(bufdata2.equals(content));
        assert(entry1.header.flags_efs === false);
        assert(entry2.header.flags_efs === false);
        done();
    });

    it("add files with japanese filename (Shift_JIS) into new zip", (done) => {
        const encoding = "Shift_JIS";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const file = "にほんご.txt";
        const content = "にほんご";
        const bufdata = iconv.encode(content, "utf16le"); // buffer

        const zip1 = new Zip({ decoder });
        zip1.addFile(file, bufdata);
        zip1.addFile("test/" + file, bufdata);
        zip1.writeZip(pth.join(destination, "08-jp_name.zip"));

        const zip2 = new Zip(pth.join(destination, "08-jp_name.zip"), { decoder });
        let text1 = zip2.readAsText(file, "utf16le");
        assert(text1 === content, text1);
        let text2 = zip2.readAsText("test/" + file, "utf16le");
        assert(text2 === content, text2);
        done();
    });

    // hebrew (writing left to right)
    it("add files with hebrew filename (UTF-8) into new zip", (done) => {
        const file = "שפה עברית.txt";
        const content = "יונה לבנה קטנה עפה מעל אנגליה";

        const zip1 = new Zip();
        zip1.addFile(file, content);
        zip1.addFile("test/" + file, content);
        zip1.writeZip(pth.join(destination, "09-heb_name.zip"));

        const zip2 = new Zip(pth.join(destination, "09-heb_name.zip"));
        const text1 = zip2.readAsText(file);
        assert(text1 === content, text1);
        const entry2 = zip2.getEntry("test/" + file);
        const text2 = zip2.readAsText(entry2);
        assert(text2 === content, text2);
        assert(entry2.header.flags_efs);
        done();
    });

    it("add files with hebrew filename (win1255) into new zip", (done) => {
        const encoding = "win1255";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const file = "שפה עברית.txt";
        const content = "יונה לבנה קטנה עפה מעל אנגליה";
        const bufdata = iconv.encode(content, "utf16le"); // buffer

        const zip1 = new Zip({ decoder });
        zip1.addFile(file, bufdata);
        zip1.addFile("test/" + file, bufdata);
        zip1.writeZip(pth.join(destination, "10-heb_name.zip"));

        const zip2 = new Zip(pth.join(destination, "10-heb_name.zip"), { decoder });
        let text1 = zip2.readAsText(file, "utf16le");
        assert(text1 === content, text1);
        let text2 = zip2.readAsText("test/" + file, "utf16le");
        assert(text2 === content, text2);
        done();
    });

    // Cyrillic
    it("add files with bulgarian filename (win1251) into new zip", (done) => {
        const encoding = "win1251";
        const decoder = {
            encode: (data) => iconv.encode(data, encoding),
            decode: (data) => iconv.decode(data, encoding)
        };

        const file = "Български.txt";
        const content = "Приключенията на таралежа";
        const bufdata = iconv.encode(content, "utf16le"); // buffer

        const zip1 = new Zip({ decoder });
        zip1.addFile(file, bufdata);
        zip1.addFile("test/" + file, bufdata);
        zip1.writeZip(pth.join(destination, "11-bul_name.zip"));

        const zip2 = new Zip(pth.join(destination, "11-bul_name.zip"), { decoder });
        let entry1 = zip2.getEntry(file);
        let text1 = zip2.readAsText(entry1, "utf16le");
        assert(text1 === content, text1);
        let entry2 = zip2.getEntry("test/" + file);
        let text2 = zip2.readAsText(entry2, "utf16le");
        assert(text2 === content, text2);
        assert(entry1.header.flags_efs === false);
        assert(entry2.header.flags_efs === false);
        done();
    });

    // Unicode symbols
    it("add files with Unicode symbols filename (utf8) into new zip", (done) => {
        const file = "Symbols⌛🙈🙉.txt";
        const content = "♜♞♝♛♚♝♞♜\n♟♟♟♟♟♟♟♟\n♙♙♙♙♙♙♙♙\n♖♘♗♕♔♗♘♖";
        const bufdata = iconv.encode(content, "utf16le"); // buffer

        const zip1 = new Zip();
        zip1.addFile(file, bufdata);
        zip1.addFile("test/" + file, bufdata);
        zip1.writeZip(pth.join(destination, "12-sym_name.zip"));

        const zip2 = new Zip(pth.join(destination, "12-sym_name.zip"));
        let entry1 = zip2.getEntry(file);
        let text1 = zip2.readAsText(entry1, "utf16le");
        assert(text1 === content, text1);
        let entry2 = zip2.getEntry("test/" + file);
        let text2 = zip2.readAsText(entry2, "utf16le");
        assert(text2 === content, text2);
        assert(entry1.header.flags_efs);
        assert(entry2.header.flags_efs);
        done();
    });
});
