# ADM-ZIP for NodeJS

Allows you to extract and create zip archives in memory or to/from disk

# Installation

With [npm](http://npmjs.org) do:

    $ npm install adm-zip
	
# Welcome
ADM-ZIP is a pure JavaScript implementation for zip data compression for [NodeJS](http://nodejs.org/). 

## What is it good for?
The library allows you to:

* decompress zip files directly to disk or in memory buffers
* compress files and store them to disk in .zip format or in compressed buffers
* update content of/add new/delete files from an existing .zip

# Dependencies
There are no other nodeJS libraries that ADM-ZIP is dependent of

# Examples

## Basic decompression
```javascript

	var Zip = require('adm-zip').Zip;

	// reading archives
	var file = new Zip("my_file.zip");
	var zipEntries = file.getEntries(); // an array of ZipEntry records

	zipEntries.forEach(function(entry) {
	    console.log(entry); // outputs zip entry information (name, time, isDirectory, size, compressedSize, crc, method, comment, flags, version, offset)
	});

	console.log(file.getFile("some_folder/my_file.txt").toString('utf8')); // outputs the content of some_folder/my_file.txt
```

For more detailed information please check out the [wiki](https://github.com/cthackers/adm-zip/wiki).