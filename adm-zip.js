const Utils = require("./util");
const pth = require("path");
const ZipEntry = require("./zipEntry");
const ZipFile = require("./zipFile");

const fs = Utils.FileSystem.require();
fs.existsSync = fs.existsSync || pth.existsSync;

const defaultOptions = {
    // read entries during load (initial loading may be slower)
    readEntries: false,
    // default method is none
    method: Utils.Constants.NONE
}

function canonical(p) {
    // trick normalize think path is absolute
    var safeSuffix = pth.posix.normalize("/" + p.split("\\").join("/"));
    return pth.join(".", safeSuffix);
}

module.exports = function (/**String*/input, /** object */options) {
    let inBuffer = null;

    // create object based default options, allowing them to be overwritten
    const opts = Object.assign(Object.create( null ), defaultOptions);

    // test input variable
    if (input && "object" === typeof input){
        // if value is not buffer we accept it to be object with options
        if (!(input instanceof Uint8Array)){
            Object.assign(opts, input);
            input = opts.input ? opts.input : undefined;
            if (opts.input) delete opts.input;
        }

        // if input is buffer
        if (input instanceof Uint8Array){
            inBuffer = input;
            opts.method = Utils.Constants.BUFFER;
            input = undefined;
        }
    }

    // assign options
    Object.assign(opts, options);

    // if input is file name we retrieve its content
    if (input && "string" === typeof input) {
        // load zip file
        if (fs.existsSync(input)) {
            opts.method = Utils.Constants.FILE;
            opts.filename = input;
            inBuffer = fs.readFileSync(input);
        } else {
            throw new Error(Utils.Errors.INVALID_FILENAME);
        }
    }

    // create variable
    const _zip = new ZipFile(inBuffer, opts);

    function sanitize(prefix, name) {
        prefix = pth.resolve(pth.normalize(prefix));
        var parts = name.split('/');
        for (var i = 0, l = parts.length; i < l; i++) {
            var path = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
            if (path.indexOf(prefix) === 0) {
                return path;
            }
        }
        return pth.normalize(pth.join(prefix, pth.basename(name)));
    }

	function getEntry(/**Object*/entry) {
		if (entry && _zip) {
			var item;
			// If entry was given as a file name
			if (typeof entry === "string")
				item = _zip.getEntry(entry);
			// if entry was given as a ZipEntry object
			if (typeof entry === "object" && typeof entry.entryName !== "undefined" && typeof entry.header !== "undefined")
				item = _zip.getEntry(entry.entryName);

			if (item) {
				return item;
			}
		}
		return null;
	}

    function fixPath(zipPath){
        const { join, normalize, sep } = pth.posix;
        // convert windows file separators and normalize
        return join(".", normalize(sep + zipPath.split("\\").join(sep) + sep));
    }

	return {
		/**
		 * Extracts the given entry from the archive and returns the content as a Buffer object
		 * @param entry ZipEntry object or String with the full path of the entry
		 *
		 * @return Buffer or Null in case of error
		 */
		readFile: function (/**Object*/entry, /*String, Buffer*/pass) {
			var item = getEntry(entry);
			return item && item.getData(pass) || null;
		},

		/**
		 * Asynchronous readFile
		 * @param entry ZipEntry object or String with the full path of the entry
		 * @param callback
		 *
		 * @return Buffer or Null in case of error
		 */
		readFileAsync: function (/**Object*/entry, /**Function*/callback) {
			var item = getEntry(entry);
			if (item) {
				item.getDataAsync(callback);
			} else {
				callback(null, "getEntry failed for:" + entry)
			}
		},

		/**
		 * Extracts the given entry from the archive and returns the content as plain text in the given encoding
		 * @param entry ZipEntry object or String with the full path of the entry
		 * @param encoding Optional. If no encoding is specified utf8 is used
		 *
		 * @return String
		 */
		readAsText: function (/**Object*/entry, /**String=*/encoding) {
			var item = getEntry(entry);
			if (item) {
				var data = item.getData();
				if (data && data.length) {
					return data.toString(encoding || "utf8");
				}
			}
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
		readAsTextAsync: function (/**Object*/entry, /**Function*/callback, /**String=*/encoding) {
			var item = getEntry(entry);
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
				})
			} else {
				callback("");
			}
		},

		/**
		 * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
		 *
		 * @param entry
		 */
		deleteFile: function (/**Object*/entry) { // @TODO: test deleteFile
			var item = getEntry(entry);
			if (item) {
				_zip.deleteEntry(item.entryName);
			}
		},

		/**
		 * Adds a comment to the zip. The zip must be rewritten after adding the comment.
		 *
		 * @param comment
		 */
		addZipComment: function (/**String*/comment) { // @TODO: test addZipComment
			_zip.comment = comment;
		},

		/**
		 * Returns the zip comment
		 *
		 * @return String
		 */
		getZipComment: function () {
			return _zip.comment || '';
		},

		/**
		 * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
		 * The comment cannot exceed 65535 characters in length
		 *
		 * @param entry
		 * @param comment
		 */
		addZipEntryComment: function (/**Object*/entry, /**String*/comment) {
			var item = getEntry(entry);
			if (item) {
				item.comment = comment;
			}
		},

		/**
		 * Returns the comment of the specified entry
		 *
		 * @param entry
		 * @return String
		 */
		getZipEntryComment: function (/**Object*/entry) {
			var item = getEntry(entry);
			if (item) {
				return item.comment || '';
			}
			return ''
		},

		/**
		 * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
		 *
		 * @param entry
		 * @param content
		 */
		updateFile: function (/**Object*/entry, /**Buffer*/content) {
			var item = getEntry(entry);
			if (item) {
				item.setData(content);
			}
		},

		/**
		 * Adds a file from the disk to the archive
		 *
		 * @param localPath File to add to zip
		 * @param zipPath Optional path inside the zip
		 * @param zipName Optional name for the file
		 */
		addLocalFile: function (/**String*/localPath, /**String=*/zipPath, /**String=*/zipName, /**String*/comment) {
			if (fs.existsSync(localPath)) {
				// fix ZipPath
				zipPath = (zipPath) ? fixPath(zipPath) : "";

				// p - local file name
				var p = localPath.split("\\").join("/").split("/").pop();

				// add file name into zippath
				zipPath += (zipName) ? zipName : p;

				// read file attributes
				const _attr = fs.statSync(localPath);

				// add file into zip file
				this.addFile(zipPath, fs.readFileSync(localPath), comment, _attr)
			} else {
				throw new Error(Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
			}
		},

		/**
		 * Adds a local directory and all its nested files and directories to the archive
		 *
		 * @param localPath
		 * @param zipPath optional path inside zip
		 * @param filter optional RegExp or Function if files match will
		 *               be included.
		 */
        addLocalFolder: function (/**String*/localPath, /**String=*/zipPath, /**=RegExp|Function*/filter) {
            // Prepare filter
            if (filter instanceof RegExp) {                 // if filter is RegExp wrap it
                filter = (function (rx){
                    return function (filename) {
                        return rx.test(filename);
                    }
                })(filter);
            } else if ('function' !== typeof filter) {       // if filter is not function we will replace it
                filter = function () {
                    return true;
                };
            }

            // fix ZipPath
            zipPath = (zipPath) ? fixPath(zipPath) : "";

            // normalize the path first
            localPath = pth.normalize(localPath);

            if (fs.existsSync(localPath)) {

                var items = Utils.findFiles(localPath),
                    self = this;

                if (items.length) {
                    items.forEach(function (filepath) {
                        var p = pth.relative(localPath, filepath).split("\\").join("/"); //windows fix
                        if (filter(p)) {
                            var stats = fs.statSync(filepath);
                            if (stats.isFile()) {
                                self.addFile(zipPath + p, fs.readFileSync(filepath), "", stats);
                            } else {
                                self.addFile(zipPath + p + '/', Buffer.alloc(0), "", stats);
                            }
                        }
                    });
                }
            } else {
                throw new Error(Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
            }
        },

		/**
		 * Asynchronous addLocalFile
		 * @param localPath
		 * @param callback
		 * @param zipPath optional path inside zip
		 * @param filter optional RegExp or Function if files match will
		 *               be included.
		 */
        addLocalFolderAsync: function (/*String*/localPath, /*Function*/callback, /*String*/zipPath, /*RegExp|Function*/filter) {
            if (filter instanceof RegExp) {
                filter = (function (rx) {
                    return function (filename) {
                        return rx.test(filename);
                    };
                })(filter);
            } else if ("function" !== typeof filter) {
                filter = function () {
                    return true;
                };
            }

            // fix ZipPath
            zipPath = zipPath ? fixPath(zipPath) : "";

            // normalize the path first
            localPath = pth.normalize(localPath);

            var self = this;
            fs.open(localPath, 'r', function (err) {
                if (err && err.code === 'ENOENT') {
                    callback(undefined, Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
                } else if (err) {
                    callback(undefined, err);
                } else {
                    var items = Utils.findFiles(localPath);
                    var i = -1;

                    var next = function () {
                        i += 1;
                        if (i < items.length) {
                            var filepath = items[i];
                            var p = pth.relative(localPath, filepath).split("\\").join("/"); //windows fix
                            p = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '') // accent fix
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
                    }

                    next();
                }
            });
        },

        addLocalFolderPromise: function (/*String*/ localPath, /* object */ options) {
            return new Promise((resolve, reject) => {
                const { filter, zipPath } = Object.assign({}, options);
                this.addLocalFolderAsync(localPath,
                    (done, err) => {
                        if (err) reject(err);
                        if (done) resolve(this);
                    }, zipPath, filter
                );
            });
        },

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
        addFile: function (/**String*/ entryName, /**Buffer*/ content, /**String*/ comment, /**Number*/ attr) {
            let entry = getEntry(entryName);
            const update = entry != null;

            // prepare new entry
            if (!update){
                entry = new ZipEntry();
                entry.entryName = entryName;
            }
            entry.comment = comment || "";

            const isStat = ('object' === typeof attr) && (attr instanceof fs.Stats);

            // last modification time from file stats
            if (isStat){
                entry.header.time = attr.mtime;
            }

            // Set file attribute
            var fileattr = (entry.isDirectory) ? 0x10 : 0;  // (MS-DOS directory flag)

            // extended attributes field for Unix
            if('win32' !== process.platform){
                // set file type either S_IFDIR / S_IFREG
                let unix = (entry.isDirectory) ? 0x4000 : 0x8000;

                if (isStat) {                                       // File attributes from file stats
                    unix |= (0xfff & attr.mode);
                }else if ('number' === typeof attr){                // attr from given attr values
                    unix |= (0xfff & attr);
                }else{                                              // Default values:
                    unix |= (entry.isDirectory) ? 0o755 : 0o644;    // permissions (drwxr-xr-x) or (-r-wr--r--)
                }

                fileattr = (fileattr | (unix << 16)) >>> 0;         // add attributes
            }

            entry.attr = fileattr;

            entry.setData(content);
            if (!update) _zip.setEntry(entry);
        },

		/**
		 * Returns an array of ZipEntry objects representing the files and folders inside the archive
		 *
		 * @return Array
		 */
		getEntries: function () {
			if (_zip) {
				return _zip.entries;
			} else {
				return [];
			}
		},

		/**
		 * Returns a ZipEntry object representing the file or folder specified by ``name``.
		 *
		 * @param name
		 * @return ZipEntry
		 */
		getEntry: function (/**String*/name) {
			return getEntry(name);
		},

		getEntryCount: function() {
			return _zip.getEntryCount();
		},

		forEach: function(callback) {
			return _zip.forEach(callback);
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
         * @param outFileName String If set will override the filename of the extracted file (Only works if the entry is a file)
		 *
		 * @return Boolean
		 */
		extractEntryTo: function (/**Object*/entry, /**String*/targetPath, /**Boolean*/maintainEntryPath, /**Boolean*/overwrite, /**String**/outFileName) {
			overwrite = overwrite || false;
			maintainEntryPath = typeof maintainEntryPath === "undefined" ? true : maintainEntryPath;

			var item = getEntry(entry);
			if (!item) {
				throw new Error(Utils.Errors.NO_ENTRY);
			}

			var entryName = canonical(item.entryName);

			var target = sanitize(targetPath,outFileName && !item.isDirectory ? outFileName : (maintainEntryPath ? entryName : pth.basename(entryName)));

			if (item.isDirectory) {
				target = pth.resolve(target, "..");
				var children = _zip.getEntryChildren(item);
				children.forEach(function (child) {
					if (child.isDirectory) return;
					var content = child.getData();
					if (!content) {
						throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
					}
					var name = canonical(child.entryName)
					var childName = sanitize(targetPath, maintainEntryPath ? name : pth.basename(name));
					// The reverse operation for attr depend on method addFile()
					var fileAttr = child.attr ? (((child.attr >>> 0) | 0) >> 16) & 0xfff : 0;
					Utils.writeFileTo(childName, content, overwrite, fileAttr);
				});
				return true;
			}

			var content = item.getData();
			if (!content) throw new Error(Utils.Errors.CANT_EXTRACT_FILE);

			if (fs.existsSync(target) && !overwrite) {
				throw new Error(Utils.Errors.CANT_OVERRIDE);
			}
			// The reverse operation for attr depend on method addFile()
			var fileAttr = item.attr ? (((item.attr >>> 0) | 0) >> 16) & 0xfff : 0;
			Utils.writeFileTo(target, content, overwrite, fileAttr);

			return true;
		},

		/**
		 * Test the archive
		 *
		 */
		test: function (pass) {
			if (!_zip) {
				return false;
			}

			for (var entry in _zip.entries) {
				try {
					if (entry.isDirectory) {
						continue;
					}
					var content = _zip.entries[entry].getData(pass);
					if (!content) {
						return false;
					}
				} catch (err) {
					return false;
				}
			}
			return true;
		},

		/**
		 * Extracts the entire archive to the given location
		 *
		 * @param targetPath Target location
		 * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
		 *                  Default is FALSE
		 */
		extractAllTo: function (/**String*/targetPath, /**Boolean*/overwrite, /*String, Buffer*/pass) {
			overwrite = overwrite || false;
			if (!_zip) {
				throw new Error(Utils.Errors.NO_ZIP);
			}
			_zip.entries.forEach(function (entry) {
				var entryName = sanitize(targetPath, canonical(entry.entryName.toString()));
				if (entry.isDirectory) {
					Utils.makeDir(entryName);
					return;
				}
				var content = entry.getData(pass);
				if (!content) {
					throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
				}
				// The reverse operation for attr depend on method addFile()
				var fileAttr = entry.attr ? (((entry.attr >>> 0) | 0) >> 16) & 0xfff : 0;
				Utils.writeFileTo(entryName, content, overwrite, fileAttr);
				try {
					fs.utimesSync(entryName, entry.header.time, entry.header.time)
				} catch (err) {
					throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
				}
			})
		},

		/**
		 * Asynchronous extractAllTo
		 *
		 * @param targetPath Target location
		 * @param overwrite If the file already exists at the target path, the file will be overwriten if this is true.
		 *                  Default is FALSE
		 * @param callback
		 */
		extractAllToAsync: function (/**String*/targetPath, /**Boolean*/overwrite, /**Function*/callback) {
			if (!callback) {
				callback = function() {}
			}
			overwrite = overwrite || false;
			if (!_zip) {
				callback(new Error(Utils.Errors.NO_ZIP));
				return;
			}

			var entries = _zip.entries;
			var i = entries.length;
			entries.forEach(function (entry) {
				if (i <= 0) return; // Had an error already

				var entryName = pth.normalize(canonical(entry.entryName.toString()));

				if (entry.isDirectory) {
					Utils.makeDir(sanitize(targetPath, entryName));
					if (--i === 0)
						callback(undefined);
					return;
				}
				entry.getDataAsync(function (content, err) {
					if (i <= 0) return;
					if (err) {
						callback(new Error(err));
						return;
					}
					if (!content) {
						i = 0;
						callback(new Error(Utils.Errors.CANT_EXTRACT_FILE));
						return;
					}

					// The reverse operation for attr depend on method addFile()
					var fileAttr = entry.attr ? (((entry.attr >>> 0) | 0) >> 16) & 0xfff : 0;
					Utils.writeFileToAsync(sanitize(targetPath, entryName), content, overwrite, fileAttr, function (succ) {
						try {
							fs.utimesSync(pth.resolve(targetPath, entryName), entry.header.time, entry.header.time);
						} catch (err) {
							callback(new Error('Unable to set utimes'));
						}
						if (i <= 0) return;
						if (!succ) {
							i = 0;
							callback(new Error('Unable to write'));
							return;
						}
						if (--i === 0)
							callback(undefined);
					});
				});
			})
		},

		/**
		 * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
		 *
		 * @param targetFileName
		 * @param callback
		 */
		writeZip: function (/**String*/targetFileName, /**Function*/callback) {
			if (arguments.length === 1) {
				if (typeof targetFileName === "function") {
					callback = targetFileName;
					targetFileName = "";
				}
			}

			if (!targetFileName && opts.filename) {
				targetFileName = opts.filename;
			}
			if (!targetFileName) return;

			var zipData = _zip.compressToBuffer();
			if (zipData) {
				var ok = Utils.writeFileTo(targetFileName, zipData, true);
				if (typeof callback === 'function') callback(!ok ? new Error("failed") : null, "");
			}
		},

        writeZipPromise: function (/**String*/ targetFileName, /* object */ options) {
            const { overwrite, perm } = Object.assign({ overwrite: true }, options);

            return new Promise((resolve, reject) => {
                // find file name
                if (!targetFileName && opts.filename) targetFileName = opts.filename;
                if (!targetFileName) reject("ADM-ZIP: ZIP File Name Missing");

                this.toBufferPromise().then((zipData) => {
                    const ret = (done) => (done ? resolve(done) : reject("ADM-ZIP: Wasn't able to write zip file"));
                    Utils.writeFileToAsync(targetFileName, zipData, overwrite, perm, ret);
                }, reject);
            });
        },

        toBufferPromise: function () {
            return new Promise((resolve, reject) => {
                _zip.toAsyncBuffer(resolve, reject);
            });
        },

		/**
		 * Returns the content of the entire zip file as a Buffer object
		 *
		 * @return Buffer
		 */
		toBuffer: function (/**Function=*/onSuccess, /**Function=*/onFail, /**Function=*/onItemStart, /**Function=*/onItemEnd) {
			this.valueOf = 2;
			if (typeof onSuccess === "function") {
				_zip.toAsyncBuffer(onSuccess, onFail, onItemStart, onItemEnd);
				return null;
			}
			return _zip.compressToBuffer()
		}
	}
};
