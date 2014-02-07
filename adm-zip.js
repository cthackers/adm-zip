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
function ADMZip(/*Buffer|String*/input) {

    return {

        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param entry ZipEntry object or String with the full path of the entry
         *
         * @return Buffer or Null in case of error
         */
        readFile : function(/*Object*/entry) {
            return null;
        },

        /**
         * Asynchronous readFile
         * @param entry ZipEntry object or String with the full path of the entry
         * @param callback
         *
         * @return Buffer or Null in case of error
         */
        readFileAsync : function(/*Object*/entry, /*Function*/callback) {
            return null
        },

        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param entry ZipEntry object or String with the full path of the entry
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText : function(/*Object*/entry, /*String - Optional*/encoding) {
            return "";
        },

        /**
         * Asynchronous readAsText
         * @param entry ZipEntry object or String with the full path of the entry
         * @param callback
         * @param encoding Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsTextAsync : function(/*Object*/entry, /*Function*/callback, /*String - Optional*/encoding) {
            return ""
        },

        /**
         * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
         *
         * @param entry
         */
        deleteFile : function(/*Object*/entry) {

        },

        /**
         * Adds a comment to the zip. The zip must be rewritten after adding the comment.
         *
         * @param comment
         */
        addZipComment : function(/*String*/comment) {

        },

        /**
         * Returns the zip comment
         *
         * @return String
         */
        getZipComment : function() {
            return "";
        },

        /**
         * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
         * The comment cannot exceed 65535 characters in length
         *
         * @param entry
         * @param comment
         */
        addZipEntryComment : function(/*Object*/entry,/*String*/comment) {

        },

        /**
         * Returns the comment of the specified entry
         *
         * @param entry
         * @return String
         */
        getZipEntryComment : function(/*Object*/entry) {

        },

        /**
         * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
         *
         * @param entry
         * @param content
         */
        updateFile : function(/*Object*/entry, /*Buffer*/content) {

        },

        /**
         * Adds a file from the disk to the archive
         *
         * @param localPath
         * @param zipPath
         */
        addLocalFile : function(/*String*/localPath, /*String*/zipPath) {

        },

        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param localPath
         * @param zipPath
         */
        addLocalFolder : function(/*String*/localPath, /*String*/zipPath) {

        },

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
        addFile : function(/*String*/entryName, /*Buffer*/content, /*String*/comment, /*Number*/attr) {

        },

        /**
         * Returns an array of ZipEntry objects representing the files and folders inside the archive
         *
         * @return Array
         */
        getEntries : function() {
            return []
        },

        /**
         * Returns a ZipEntry object representing the file or folder specified by ``name``.
         *
         * @param name
         * @return ZipEntry
         */
        getEntry : function(/*String*/name) {
            return null
        },

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
        extractEntryTo : function(/*Object*/entry, /*String*/targetPath, /*Boolean*/maintainEntryPath, /*Boolean*/overwrite) {
            return false
        },

        /**
         * Extracts the entire archive to the given location
         *
         * @param targetPath Target location
         * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         */
        extractAllTo : function(/*String*/targetPath, /*Boolean*/overwrite) {

        },

        /**
         * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
         *
         * @param targetFileName
         * @param callback
         */
        writeZip : function(/*String*/targetFileName, /*Function*/callback) {

        },

        /**
         * Returns the content of the entire zip file as a Buffer object
         *
         * @return Buffer
         */
        toBuffer : function(/*Function*/onSuccess,/*Function*/onFail,/*Function*/onItemStart,/*Function*/onItemEnd) {
            return null
        }
    }
}

module.exports = ADMZip;
