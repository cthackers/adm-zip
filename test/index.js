var Attr = require("../util").FileAttr,
    Zip = require("../adm-zip"),
	pth = require("path");
    fs = require("fs");


var zip = new Zip('./test/assets/ultra.zip');
zip.extractAllTo('./test/xxx');