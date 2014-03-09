var Reader = require("./archive/zip/reader").Reader,
    path = require("path"),
    fs = require("fs");

/**
 * ADMZip offers functionality to easily create/extract/manage zip archives
 *
 *
 * @param input Input can be a :
 *   - Buffer with the content of a zip file
 *   - String to a local zip file
 *
 * @constructor
 */
function ADMZip(input) {

    var z = this,
        reader = null,
        writer = null;

    this.error = "";

    if (input) {
        // input seems like a file name
        if (typeof input == "string") {
            if (fs.existsSync(input)) {
                reader = new Reader(input);
            } else {
                z.error = "File does not exists";
            }
        } else if (Buffer.isBuffer(input)) {
            reader = new Reader(input, input.length);
        } else if (typeof input == "number") {
            reader = new Reader(input);
        } else {
            z.error = "Invalid input"
        }
    }

    /**
     * Extracts the given entry from the archive and returns the content as a Buffer object
     * @param entry ZipEntry object or String with the full path of the entry
     *
     * @return Buffer or Null in case of error
     */
    this.readFile = function(entry) {
        if (typeof entry == "string") {
            entry = z.getEntry(entry)
        }
        if (entry) {
            return entry.read()
        }
        return null;
    };

    /**
     * Extracts the given entry from the archive and returns the content as plain text in the given encoding
     * @param entry ZipEntry object or String with the full path of the entry
     * @param encoding Optional. If no encoding is specified utf8 is used
     *
     * @return String
     */
    this.readAsText = function(/*Object*/entry, /*String - Optional*/encoding) {
        if (typeof entry == "string") {
            entry = z.getEntry(entry)
        }
        if (entry) {
            var data = entry.read();
            if (data) {
                return data.toString('utf8');
            }
        }
        return ""
    };

    /**
     * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
     *
     * @param entry
     */
    this.deleteFile = function(/*Object*/entry) {

    };

    /**
     * Adds a comment to the zip. The zip must be rewritten after adding the comment.
     *
     * @param comment
     */
    this.addZipComment = function(/*String*/comment) {
        if (reader) {
            reader.comment = new Buffer(comment);
        } else if (writer) {
            writer.comment = new Buffer(comment);
        }
    };

    /**
     * Returns the zip comment
     *
     * @return String
     */
    this.getZipComment = function() {
        if (reader) {
            return reader.comment;
        } else if (writer) {
            return writer.comment;
        }
        return "";
    };

    /**
     * Adds a file from the disk to the archive
     *
     * @param localPath
     * @param zipPath
     */
    this.addLocalFile = function(/*String*/localPath, /*String*/zipPath) {

    };

    /**
     * Adds a local directory and all its nested files and directories to the archive
     *
     * @param localPath
     * @param zipPath
     */
    this.addLocalFolder = function(/*String*/localPath, /*String*/zipPath) {

    };

    /**
     * Allows you to create a entry (file or directory) in the zip file.
     * If you want to create a directory the entryName must end in / and a null buffer should be provided.
     * Comment and attributes are optional
     *
     * @param entryName
     * @param content
     * @param comment
     * @param attr
     */
    this.addFile = function(/*String*/entryName, /*Buffer*/content, /*String*/comment, /*Number*/attr) {

    };

    /**
     * Returns an array of ZipEntry objects representing the files and folders inside the archive
     *
     * @return Array
     */
    this.getEntries = function() {
        if (reader) {
            return reader.files
        } else if (writer) {

        }
        return []
    };

    /**
     * Returns a ZipEntry object representing the file or folder specified by ``name``.
     *
     * @param name
     * @return ZipEntry
     */
    this.getEntry = function(/*String*/name) {
        var files = [];
        if (reader) {
            files = reader.files
        } else if (writer) {
            files = writer.files
        }
        for (var i = 0; 0 < files.length; i++) {
            if (files[i].header.entryName == name) {
                return files[i]
            }
        }
        return null
    };

    /**
     * Extracts the given entry to the given targetPath
     * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
     *
     * @param entry ZipEntry object or String with the full path of the entry
     * @param targetPath Target folder where to write the file
     * @param maintainEntryPath If maintainEntryPath is true and the entry is inside a folder, the entry folder
     *                          will be created in targetPath as well. Default is TRUE
     * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
     *                  Default is FALSE
     *
     * @return Boolean
     */
    this.extractEntryTo = function(/*Object*/entry, /*String*/targetPath, /*Boolean*/maintainEntryPath, /*Boolean*/overwrite) /*Boolean*/ {
        overwrite = overwrite || false;
        maintainEntryPath = typeof maintainEntryPath == "undefined" ? true : maintainEntryPath;

        var item = z.getEntry(entry);
        if (!item) {
            z.error = "Zip entry not found";
            return false
        }

        var target = path.resolve(targetPath, maintainEntryPath ? item.entryName : path.basename(item.header.entryName));

        if (item.header.isDirectory) {
            target = path.resolve(target, "..")
            var files = reader.files;
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                if (file.header.entryName.indexOf(item.header.entryName) == 0) {

                }
            }
        }

        return false
    };

    /**
     * Extracts the entire archive to the given location
     *
     * @param targetPath Target location
     * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
     *                  Default is FALSE
     */
    this.extractAllTo = function(/*String*/targetPath, /*Boolean*/overwrite) {

    };

    /**
     * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
     *
     * @param targetFileName
     * @param callback
     */
    this.writeZip = function(/*String*/targetFileName, /*Function*/callback) {

    };

    /**
     * Returns the content of the entire zip file as a Buffer object
     *
     * @return Buffer
     */
    this.toBuffer = function(/*Function*/onSuccess,/*Function*/onFail) {
        return null
    }
}

module.exports = ADMZip;
