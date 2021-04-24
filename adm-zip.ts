import { Constants, FileSystem, isWin, Errors, findFiles, writeFileTo, makeDir, writeFileToAsync } from "./util";
const fs: typeof import('fs') = FileSystem.fileSystem();
import pth from "path";
import ZipEntry from "./zipEntry";
import ZipFile from "./zipFile";
import { ZipFileType } from "./types";

const defaultOptions = {
    // option "noSort" : if true it disables files sorting
    noSort: false,
    // read entries during load (initial loading may be slower)
    readEntries: false,
    // default method is none
    method: Constants.NONE
};

function canonical(p: string) {
    // trick normalize think path is absolute
    var safeSuffix = pth.posix.normalize("/" + p.split("\\").join("/"));
    return pth.join(".", safeSuffix);
}
function sanitize(prefix: string, name: string) {
    prefix = pth.resolve(pth.normalize(prefix));
    var parts = name.split("/");
    for (var i = 0, l = parts.length; i < l; i++) {
        var path = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
        if (path.indexOf(prefix) === 0) {
            return path;
        }
    }
    return pth.normalize(pth.join(prefix, pth.basename(name)));
}

function fixPath(zipPath: string) {
    const { join, normalize, sep } = pth.posix;
    // convert windows file separators and normalize
    return join(".", normalize(sep + zipPath.split("\\").join(sep) + sep));
}
export type AdmZipOptions = { noSort?: boolean, readEntries?: boolean, method?: Constants, input?: string | Uint8Array, filename?: string }
export class AdmZip {
    private _zip: ZipFileType;
    private opts: AdmZipOptions;

    constructor(input?: string | Buffer | null, options?: AdmZipOptions) {
        let inBuffer: Buffer | null = null;

        // create object based default options, allowing them to be overwritten
        this.opts = { ...defaultOptions, ...options };

        if (input instanceof Buffer) {
            inBuffer = input;
            this.opts.method = Constants.BUFFER;
        } else if (input && "string" === typeof input) {
            // load zip file
            if (fs.existsSync(input)) {
                this.opts.method = Constants.FILE;
                this.opts.filename = input;
                inBuffer = fs.readFileSync(input);
            } else {
                throw new Error(Errors.INVALID_FILENAME);
            }
        }

        // create variable
        this._zip = ZipFile(inBuffer, this.opts);
    }

    /**
     * Extracts the given entry from the archive and returns the content as a Buffer object
     * @param entry ZipEntry object or String with the full path of the entry
     *
     * @return Buffer or Null in case of error
     */
    readFile(entry: string | typeof ZipEntry, pass: Buffer | string) {
        var item = this.getEntry(entry);
        return (item && item.getData(pass)) || null;
    }

    /**
     * Asynchronous readFile
     * @param entry ZipEntry object or String with the full path of the entry
     * @param callback
     *
     * @return Buffer or Null in case of error
     */
    readFileAsync(entry: string | typeof ZipEntry, callback: (error: null | Buffer, respn: string) => void) {
        var item = this.getEntry(entry);
        if (item) {
            item.getDataAsync(callback);
        } else {
            callback(null, "getEntry failed for:" + entry);
        }
    }

    /**
     * Extracts the given entry from the archive and returns the content as plain text in the given encoding
     * @param entry ZipEntry object or String with the full path of the entry
     * @param encoding Optional. If no encoding is specified utf8 is used
     *
     * @return String
     */
    readAsText(/**Object*/ entry: string | typeof ZipEntry, /**String=*/ encoding: string = "utf8") {
        var item = this.getEntry(entry);
        if (item) {
            var data = item.getData();
            if (data && data.length) {
                return data.toString(encoding);
            }
        }
        return "";
    }

    /**
     * Asynchronous readAsText
     * @param entry ZipEntry object or String with the full path of the entry
     * @param callback
     * @param encoding Optional. If no encoding is specified utf8 is used
     *
     * @return String
     */
    readAsTextAsync(/**Object*/ entry, /**Function*/ callback, /**String=*/ encoding?: string) {
        var item = this.getEntry(entry);
        if (item) {
            item.getDataAsync(function (data, err) {
                if (err) {
                    callback(data, err);
                    return;
                }

                if (data && data.length) {
                    callback(data.toString(encoding || "utf8"));
                } else {
                    callback("");
                }
            });
        } else {
            callback("");
        }
    }

    /**
     * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
     *
     * @param entry
     */
    deleteFile(/**Object*/ entry: string) {
        // @TODO: test deleteFile
        var item = this.getEntry(entry);
        if (item) {
            this._zip.deleteEntry(item.entryName);
        }
    }

    /**
     * Adds a comment to the zip. The zip must be rewritten after adding the comment.
     *
     * @param comment
     */
    addZipComment(/**String*/ comment: string) {
        // @TODO: test addZipComment
        this._zip.comment = comment;
    }

    /**
     * Returns the zip comment
     *
     * @return String
     */
    getZipComment() {
        return this._zip.comment || "";
    }

    /**
     * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
     * The comment cannot exceed 65535 characters in length
     *
     * @param entry
     * @param comment
     */
    addZipEntryComment(entry: string | typeof ZipEntry, /**String*/ comment: string) {
        var item = this.getEntry(entry);
        if (item) {
            item.comment = comment;
        }
    }

    /**
     * Returns the comment of the specified entry
     *
     * @param entry
     * @return String
     */
    getZipEntryComment(entry: string | typeof ZipEntry) {
        var item = this.getEntry(entry);
        if (item) {
            return item.comment || "";
        }
        return "";
    }

    /**
     * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
     *
     * @param entry
     * @param content
     */
    updateFile(entry: string | typeof ZipEntry, content: Buffer) {
        var item = this.getEntry(entry);
        if (item) {
            item.setData(content);
        }
    }

    /**
     * Adds a file from the disk to the archive
     *
     * @param localPath File to add to zip
     * @param zipPath Optional path inside the zip
     * @param zipName Optional name for the file
     */
    addLocalFile(localPath: string, oldZipPath?: string, zipName?: string, comment?: string) {
        if (fs.existsSync(localPath)) {
            // fix ZipPath
            let zipPath = oldZipPath ? fixPath(oldZipPath) : "";

            // p - local file name
            var p = localPath.split("\\").join("/").split("/").pop()!;

            // add file name into zippath
            zipPath += zipName ? zipName : p;

            // read file attributes
            const _attr = fs.statSync(localPath);

            // add file into zip file
            this.addFile(zipPath, fs.readFileSync(localPath), comment, _attr);
        } else {
            throw new Error(Errors.FILE_NOT_FOUND.replace("%s", localPath));
        }
    }

    /**
     * Adds a local directory and all its nested files and directories to the archive
     *
     * @param localPath
     * @param zipPath optional path inside zip
     * @param Filter optional RegExp or Function if files match will
     *               be included.
     */
    addLocalFolder(localPath: string, zipPath?: string, Filter?: RegExp | ((filename: string) => boolean)) {
        // Prepare filter
        let filter: ((filename: string) => boolean) | undefined = undefined;
        if (Filter instanceof RegExp) {
            // if filter is RegExp wrap it
            filter = (function (rx) {
                return function (filename: string) {
                    return rx.test(filename);
                };
            })(Filter);
        } else if ("function" !== typeof Filter) {
            // if filter is not function we will replace it
            filter = function () {
                return true;
            };
        }

        // fix ZipPath
        zipPath = zipPath ? fixPath(zipPath) : "";

        // normalize the path first
        localPath = pth.normalize(localPath);

        if (fs.existsSync(localPath)) {
            const items = findFiles(localPath);
            const self = this;

            if (items.length) {
                items.forEach(function (filepath: string) {
                    var p = pth.relative(localPath, filepath).split("\\").join("/"); //windows fix
                    if (filter?.(p)) {
                        var stats = fs.statSync(filepath);
                        if (stats.isFile()) {
                            self.addFile(zipPath + p, fs.readFileSync(filepath), "", stats);
                        } else {
                            self.addFile(zipPath + p + "/", Buffer.alloc(0), "", stats);
                        }
                    }
                });
            }
        } else {
            throw new Error(Errors.FILE_NOT_FOUND.replace("%s", localPath));
        }
    }

    /**
     * Asynchronous addLocalFile
     * @param localPath
     * @param callback
     * @param zipPath optional path inside zip
     * @param filter optional RegExp or Function if files match will
     *               be included.
     */
    addLocalFolderAsync(localPath: string, callback: (success?: boolean, err?: string | NodeJS.ErrnoException) => void, zipPath?: string, preFilter?: RegExp | ((filename: string) => boolean)) {
        let filter: (filename: string) => boolean;
        if (preFilter instanceof RegExp) {
            filter = (function (rx) {
                return function (filename: string) {
                    return rx.test(filename);
                };
            })(preFilter);
        } else if ("function" !== typeof preFilter) {
            filter = function () {
                return true;
            };
        }

        // fix ZipPath
        zipPath = zipPath ? fixPath(zipPath) : "";

        // normalize the path first
        localPath = pth.normalize(localPath);

        var self = this;
        fs.open(localPath, "r", function (err: any) {
            if (err && err.code === "ENOENT") {
                callback(undefined, Errors.FILE_NOT_FOUND.replace("%s", localPath));
            } else if (err) {
                callback(undefined, err);
            } else {
                var items = findFiles(localPath);
                var i = -1;

                var next = function () {
                    i += 1;
                    if (i < items.length) {
                        var filepath = items[ i ];
                        var p = pth.relative(localPath, filepath).split("\\").join("/"); //windows fix
                        p = p
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^\x20-\x7E]/g, ""); // accent fix
                        if (filter(p)) {
                            fs.stat(filepath, function (er0, stats) {
                                if (er0) callback(undefined, er0);
                                if (stats.isFile()) {
                                    fs.readFile(filepath, function (er1, data) {
                                        if (er1) {
                                            callback(undefined, er1);
                                        } else {
                                            self.addFile(zipPath + p, data, "", stats);
                                            next();
                                        }
                                    });
                                } else {
                                    self.addFile(zipPath + p + "/", Buffer.alloc(0), "", stats);
                                    next();
                                }
                            });
                        } else {
                            next();
                        }
                    } else {
                        callback(true, undefined);
                    }
                };

                next();
            }
        });
    }

    /**
     *
     * @param {string} localPath - path where files will be extracted
     * @param {object} props - optional properties
     * @param {string} props.zipPath - optional path inside zip
     * @param {regexp, function} props.filter - RegExp or Function if files match will be included.
     */
    addLocalFolderPromise(localPath: string, props: { filter?: any, zipPath?: string }) {
        return new Promise((resolve, reject) => {
            const { filter, zipPath } = Object.assign({}, props);
            this.addLocalFolderAsync(
                localPath,
                (done, err) => {
                    if (err) reject(err);
                    if (done) resolve(this);
                },
                zipPath,
                filter
            );
        });
    }

    /**
     * Allows you to create a entry (file or directory) in the zip file.
     * If you want to create a directory the entryName must end in / and a null buffer should be provided.
     * Comment and attributes are optional
     *
     * @param {string} entryName
     * @param {Buffer | string} content - file content as buffer or utf8 coded string
     * @param {string} comment - file comment
     * @param {number | object} attr - number as unix file permissions, object as filesystem Stats object
     */
    addFile(entryName: string, content?: Buffer | string, comment?: string | undefined, attr?: number | any) {
        let entry = this.getEntry(entryName);
        const update = entry != null;

        // prepare new entry
        if (!update) {
            entry = ZipEntry();
            entry.entryName = entryName;
        }
        entry.comment = comment || "";

        const isStat = "object" === typeof attr && attr instanceof fs.Stats;

        // last modification time from file stats
        if (isStat) {
            entry.header.time = attr.mtime;
        }

        // Set file attribute
        var fileattr = entry.isDirectory ? 0x10 : 0; // (MS-DOS directory flag)

        // extended attributes field for Unix
        if (!isWin) {
            // set file type either S_IFDIR / S_IFREG
            let unix = entry.isDirectory ? 0x4000 : 0x8000;

            if (isStat) {
                // File attributes from file stats
                unix |= 0xfff & attr.mode;
            } else if ("number" === typeof attr) {
                // attr from given attr values
                unix |= 0xfff & attr;
            } else {
                // Default values:
                unix |= entry.isDirectory ? 0o755 : 0o644; // permissions (drwxr-xr-x) or (-r-wr--r--)
            }

            fileattr = (fileattr | (unix << 16)) >>> 0; // add attributes
        }

        entry.attr = fileattr;

        entry.setData(content);
        if (!update) this._zip.setEntry(entry);
    }

    /**
     * Returns an array of ZipEntry objects representing the files and folders inside the archive
     *
     * @return Array
     */
    getEntries() {
        return this._zip?.entries ?? [];
    }

    /**
     * Returns a ZipEntry object representing the file or folder specified by ``name``.
     *
     * @param name
     * @return ZipEntry
     */
    getEntry(entry: string | any) {
        if (entry && this._zip) {
            var item;
            // If entry was given as a file name
            if (typeof entry === "string") item = this._zip.getEntry(entry);
            // if entry was given as a ZipEntry object
            else if (typeof entry.entryName !== "undefined" && typeof entry.header !== "undefined") item = this._zip.getEntry(entry.entryName);

            if (item) {
                return item;
            }
        }
        return null;
    }

    getEntryCount() {
        return this._zip.getEntryCount();
    }

    forEach(callback: () => void) {
        return this._zip.forEach(callback);
    }

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
     * @param outFileName String If set will override the filename of the extracted file (Only works if the entry is a file)
     *
     * @return Boolean
     */
    extractEntryTo(entry: string | typeof ZipEntry, targetPath: string, oldMaintainEntryPath?: boolean, Overwrite?: boolean, outFileName?: string) {
        const overwrite = Overwrite ?? false;

        const maintainEntryPath = oldMaintainEntryPath ?? true;

        var item = this.getEntry(entry);
        if (!item) {
            throw new Error(Errors.NO_ENTRY);
        }

        var entryName = canonical(item.entryName);

        var target = sanitize(targetPath, (outFileName && !item.isDirectory ? outFileName : maintainEntryPath) ? entryName : pth.basename(entryName));

        if (item.isDirectory) {
            var children = this._zip.getEntryChildren(item);
            children.forEach(function (child: any) {
                if (child.isDirectory) return;
                var content = child.getData();
                if (!content) {
                    throw new Error(Errors.CANT_EXTRACT_FILE);
                }
                var name = canonical(child.entryName);
                var childName = sanitize(targetPath, maintainEntryPath ? name : pth.basename(name));
                // The reverse operation for attr depend on method addFile()
                var fileAttr = child.attr ? (((child.attr >>> 0) | 0) >> 16) & 0xfff : 0;
                writeFileTo(childName, content, overwrite, fileAttr);
            });
            return true;
        }

        var content = item.getData();
        if (!content) throw new Error(Errors.CANT_EXTRACT_FILE);

        if (fs.existsSync(target) && !overwrite) {
            throw new Error(Errors.CANT_OVERRIDE);
        }
        // The reverse operation for attr depend on method addFile()
        var fileAttr = item.attr ? (((item.attr >>> 0) | 0) >> 16) & 0xfff : 0;
        writeFileTo(target, content, overwrite, fileAttr);

        return true;
    }

    /**
     * Test the archive
     *
     */
    test(pass: any) {
        if (!this._zip) {
            return false;
        }

        for (var entry in this._zip.entries) {
            try {
                if (typeof entry != "string" && (entry as any).isDirectory) {
                    continue;
                }
                var content = this._zip.entries[ entry ].getData(pass);
                if (!content) {
                    return false;
                }
            } catch (err) {
                return false;
            }
        }
        return true;
    }

    /**
     * Extracts the entire archive to the given location
     *
     * @param targetPath Target location
     * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
     *                  Default is FALSE
     */
    extractAllTo(targetPath: string, overwrite?: boolean, pass?: string | Buffer) {
        overwrite = overwrite || false;
        if (!this._zip) {
            throw new Error(Errors.NO_ZIP);
        }
        this._zip.entries.forEach(function (entry: any) {
            var entryName = sanitize(targetPath, canonical(entry.entryName.toString()));
            if (entry.isDirectory) {
                makeDir(entryName);
                return;
            }
            var content = entry.getData(pass);
            if (!content) {
                throw new Error(Errors.CANT_EXTRACT_FILE);
            }
            // The reverse operation for attr depend on method addFile()
            var fileAttr = entry.attr ? (((entry.attr >>> 0) | 0) >> 16) & 0xfff : 0;
            writeFileTo(entryName, content, overwrite ?? false, fileAttr);
            try {
                fs.utimesSync(entryName, entry.header.time, entry.header.time);
            } catch (err) {
                throw new Error(Errors.CANT_EXTRACT_FILE);
            }
        });
    }

    /**
     * Asynchronous extractAllTo
     *
     * @param targetPath Target location
     * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
     *                  Default is FALSE
     * @param callback
     */
    extractAllToAsync(targetPath: string, overwrite: boolean, callback: (err?: Error) => void) {
        if (!callback) {
            callback = function () { };
        }
        overwrite = overwrite || false;
        if (!this._zip) {
            callback(new Error(Errors.NO_ZIP));
            return;
        }

        var entries = this._zip.entries;
        var i = entries.length;
        entries.forEach(function (entry: any) {
            if (i <= 0) return; // Had an error already

            var entryName = pth.normalize(canonical(entry.entryName.toString()));

            if (entry.isDirectory) {
                makeDir(sanitize(targetPath, entryName));
                if (--i === 0) callback(undefined);
                return;
            }
            entry.getDataAsync(function (content: any, err: string) {
                if (i <= 0) return;
                if (err) {
                    callback(new Error(err));
                    return;
                }
                if (!content) {
                    i = 0;
                    callback(new Error(Errors.CANT_EXTRACT_FILE));
                    return;
                }

                // The reverse operation for attr depend on method addFile()
                var fileAttr = entry.attr ? (((entry.attr >>> 0) | 0) >> 16) & 0xfff : 0;
                writeFileToAsync(sanitize(targetPath, entryName), content, overwrite, fileAttr, function (succ: boolean) {
                    try {
                        fs.utimesSync(pth.resolve(targetPath, entryName), entry.header.time, entry.header.time);
                    } catch (er) {
                        callback(new Error("Unable to set utimes"));
                    }
                    if (i <= 0) return;
                    if (!succ) {
                        i = 0;
                        callback(new Error("Unable to write"));
                        return;
                    }
                    if (--i === 0) callback(undefined);
                });
            });
        });
    }

    /**
     * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
     *
     * @param targetFileName
     * @param callback
     */
    writeZip(/**String*/ targetFileName: string, /**Function*/ callback?: (error: Error | null, errormsg: string) => void) {
        if (arguments.length === 1) {
            if (typeof targetFileName === "function") {
                callback = targetFileName;
                targetFileName = "";
            }
        }

        if (!targetFileName && this.opts.filename) {
            targetFileName = this.opts.filename;
        }
        if (!targetFileName) return;

        var zipData = this._zip.compressToBuffer();
        if (zipData) {
            var ok = writeFileTo(targetFileName, zipData, true);
            callback?.(!ok ? new Error("failed") : null, "");
        }
    }

    writeZipPromise(targetFileName: string, props: { perm: any }) {
        const { overwrite, perm } = Object.assign({ overwrite: true }, props);

        return new Promise((resolve, reject) => {
            // find file name
            if (!targetFileName && this.opts.filename) targetFileName = this.opts.filename;
            if (!targetFileName) reject("ADM-ZIP: ZIP File Name Missing");

            this.toBufferPromise().then((zipData) => {
                const ret = (done: boolean) => (done ? resolve(done) : reject("ADM-ZIP: Wasn't able to write zip file"));
                writeFileToAsync(targetFileName, zipData, overwrite, perm, ret);
            }, reject);
        });
    }

    toBufferPromise(): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            this._zip.toAsyncBuffer(resolve, reject);
        });
    }

    /**
     * Returns the content of the entire zip file as a Buffer object
     *
     * @return Buffer
     */
    toBuffer(onSuccess?: () => void, onFail?: () => void, onItemStart?: () => void, onItemEnd?: () => void) {
        //this.valueOf = 2;
        if (typeof onSuccess === "function") {
            this._zip.toAsyncBuffer(onSuccess, onFail, onItemStart, onItemEnd);
            return null;
        }
        return this._zip.compressToBuffer();
    }
};
