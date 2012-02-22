# ADM-ZIP for NodeJS

Allows you to extract and create zip archives in memory or to/from disk

# Installation

With [npm](http://npmjs.org) do:

    $ npm install adm-zip

# Examples

## Basic
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


# API Documentation

### constructor Zip(String path = "")
If a file is specified and the file exists on disk, the the file is read and can be extracted or modified
If the file doesn't exist on disk, then when calling writeZip() method, if no argument will be specified, this path will be used

### getFile(String path)
Returns a Buffer with the file content

### deleteFile(String path)
Deletes the specified file entry from the zip archive and updates the zip file
NOT YET IMPLEMENTED

### addComment(String comment)
Adds the given comment to the zip
NOT YET IMPLEMENTED

### getComment() {
Returns the comment of the zip file
NOT YET IMPLEMENTED

### updateFile(String path, Buffer content)
Updates the specified file entry inside the zip and updates the zip file
NOT YET IMPLEMENTED

### addFile(String path, Buffer content = null)
Adds the content to the archive at the specified entry path
NOT YET IMPLEMENTED

### addFiles(Array paths)
Adds more files to the archive
NOT YET IMPLEMENTED

### getEntries()
Returns an array of ZipEntry objects from the zip
NOT YET IMPLEMENTED

### extract(String path, Boolean override = true)
Extracts the zip file to the given path. On collisions, the file can be overriden or skipped based on the 'override' argument
NOT YET IMPLEMENTED

### writeZip(String outFilename)
Writes a newly created zip to disk at spcified filename
NOT YET IMPLEMENTED