var fs = require("fs"),
    pth = require('path');

var ZipEntry = require("./zipEntry").ZipEntry,
    ZipFile =  require("./zipFile").ZipFile,
    ZipUtils = require("./zipUtils").ZipUtils;


exports.Zip = function(/*String*/inPath) {
    var _zip = undefined;

    if (inPath && typeof inPath === "string") {
        if (pth.existsSync(inPath)) { // load zip file
            _zip = new ZipFile(fs.readFileSync(inPath));
        } else { // create new zip file
            _zip = new ZipFile();
        }
    }

    function getEntry(/*Object*/entry) {
        if (entry && _zip) {
            var item;
            // If entry was given as a file name
            if (typeof entry === "string")
                item = _zip.getEntry(entry);
            // if entry was given as a ZipEntry object
            if (typeof entry === "object" && entry.entryName != undefined && entry.header != undefined)
                item =  _zip.getEntry(entry.entryName);

            if (item) {
                return item;
            }
        }
        return null;
    }

    return {
        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param entry ZipEntry object or String with the full path of the entry
         *
         * @return Buffer or Null in case of error
         */
        readFile : function(/*Object*/entry) {
            var item = getEntry(entry);
            return item && entry.data || null;
        },
        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param entry ZipEntry object or String with the full path of the entry
         * @param encoding If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText : function(/*Object*/entry, /*String - Optional*/encoding) {
            var item = getEntry(entry);
            if (item) {
                var data = entry.data;
                if (data && data.length) {
                    return data.toString(encoding || "utf8");
                }
            }
            return "";
        },

        deleteFile : function(/*Object*/entry, /*Boolean*/writeZip) {
            var item = getEntry(entry);
            if (item) {
                _zip.deleteEntry(item.entryName);
                if (writeZip) {
                    throw 'Not implemented'
                }
            }
        },

        addZipComment : function(/*String*/comment, /*Boolean*/writeZip) {
            _zip.comment = comment;
            if (writeZip) {
                throw 'Not implemented'
            }
        },

        getZipComment : function() {
            return _zip.comment;
        },

        addZipEntryComment : function(/*Object*/entry,/*String*/comment, /*Boolean*/writeZip) {
            var item = getEntry(entry);
            if (item) {
                item.comment = comment;
                if (writeZip) {
                    throw 'Not implemented';
                }
            }
        },

        getZipEntryComment : function(/*Object*/entry) {
            var item = getEntry(entry);
            if (item) {
                return item.comment;
            }
            return ''
        },

        updateFile : function(/*Object*/entry, /*Buffer*/content, /*Boolean*/writeZip) {
            var item = getEntry(entry);
            if (item) {
                item.data = content;
                if (writeZip) {
                    throw 'Not implemented';
                }
            }
        },

        addLocalFile : function(/*String*/localPath, /*Boolean*/writeZip) {
             if (pth.existsSync(localPath)) {

             } else {
                 throw "File not found: " + localPath;
             }
        },

        addLocalFolder : function(/*String*/localPath, /*Boolean*/writeZip) {
            if (pth.existsSync(localPath)) {

            } else {
                throw "File not found: " + localPath;
            }
        },

        addFile : function(/*String*/entryName, /*Buffer*/content, /*String*/comment, /*Number*/attr) {
            var entry = new ZipEntry();
            entry.entryName = entryName;
            entry.comment = comment || "";
            entry.attr = attr || 0666;
            if (entry.isDirectory && content.length) {
                throw 'A directory cannot have content';
            }
            entry.data = content;
            _zip.setEntry(entry);
        },

        /**
         * Returns an array of ZipEntry objects representing the files and folders inside the archive
         *
         * @return Array
         */
        getEntries : function() {
            if (_zip) {
               return _zip.entries;
            } else {
                return [];
            }
        },

        getEntry : function(/*String*/name) {
            return getEntry(name);
        },

        /**
         * Extracts the given entry to the given targetPath
         * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
         *
         * @param entry ZipEntry object or String with the full path of the entry
         * @param targetPath Target folder where to write the file
         * @param maintainEntryPath If full path is true and the entry is inside a folder, the entry folder
         *                          will be created in targetPath as well. Default is TRUE
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         *
         * @return Boolean
         */
        extractEntryTo : function(/*Object*/entry, /*String*/targetPath, /*Boolean*/maintainEntryPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;
            maintainEntryPath = typeof maintainEntryPath == "undefned" ? true : maintainEntryPath;

            var item = getEntry(entry);
            if (!item) {
                throw "Given entry doesn't exist";
            }

            var target = pth.resolve(targetPath, maintainEntryPath ? item.entryName : pth.basename(item.entryName));

            if (item.isDirectory) {
                target = pth.resolve(target, "..");
                var children = _zip.getEntryChildren(item);
                children.forEach(function(child) {
                    if (child.isDirectory) return;
                    var content = child.data;
                    if (!content) throw "Could not extract the file";
                    ZipUtils.writeFileTo(pth.resolve(targetPath, maintainEntryPath ? child.entryName : child.entryName.substr(item.entryName.length)), content, overwrite);
                })
            }

            var content = item.data;
            if (!content) throw "Could not extract the file";

            if (pth.existsSync(targetPath) && !overwrite) {
                throw "target file already exists";
            }
            ZipUtils.writeFileTo(target, content, overwrite);

            return true;
        },

        /**
         * Extracts the entire archive to the givn location
         *
         * @param targetPath Target location
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         */
        extractAllTo : function(/*String*/targetPath, /*Boolean*/overwrite) {
            overwrite = overwrite || false;
            if (!_zip) {
                throw "No zip file was loaded";
            }

            _zip.entries.forEach(function(entry) {
                 if (entry.isDirectory) return;
                var content = entry.data;
                if (!content) throw "Could not extract the file";
                ZipUtils.writeFileTo(pth.resolve(targetPath, entry.entryName), content, overwrite);
            })
        },

        writeZip : function(/*String*/targetFileName) {
            _zip.toBuffer();
        }
    }
};