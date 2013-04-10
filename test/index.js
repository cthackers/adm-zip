var Attr = require("../util").FileAttr,
    AdmZip = require("../adm-zip");

var asd = new AdmZip("test/assets/bootstrap.zip");
    asd.extractAllTo("./");
