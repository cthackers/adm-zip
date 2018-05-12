var Attr = require("../util").FileAttr,
    Zip = require("../adm-zip"),
    fs = require("fs");

var zip = Zip("./test/assets/ultra.zip");

var zipEntries = zip.getEntries();

zipEntries.forEach(function(zipEntry)
{
	if (zipEntry.entryName === "attributes_test/blank file.txt")
	{
		zip.updateFile(zipEntry.entryName, "inner content");
		console.log(zip.readAsText(zipEntry.entryName));
	}
});

zipEntries.forEach(function(zipEntry)
{
	if (zipEntry.entryName === "attributes_test/blank file.txt")
	{
		console.log(zip.readAsText(zipEntry.entryName));
	}
});
zip.writeZip("files3.zip");