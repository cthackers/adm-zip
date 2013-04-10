var Attr = require("../util").FileAttr,
    Zip = require("../adm-zip");


var zip = new Zip();

zip.addFile("test.txt", new Buffer("inner content of the file"), "entry comment goes here", null);
zip.addFile("fuck/test.txt", new Buffer("inner content of the file"), "entry comment goes here", null);
zip.writeZip('./test/package.zip');

delete(zip);

zip = new Zip('./test/package.zip');
zip.getEntries().forEach(function(entry) {
   console.log(entry.toString());
});
console.log(zip.readAsText('test.txt'));
