const fsystem = require("fs");
const pth = require("path");
const Constants = require("./constants");
const Errors = require("./errors");
const isWin = typeof process === "object" && "win32" === process.platform;

const is_Obj = (obj) => typeof obj === "object" && obj !== null;

// generate CRC32 lookup table
const crcTable = new Uint32Array(256).map((t, c) => {
    for (let k = 0; k < 8; k++) {
        if ((c & 1) !== 0) {
            c = 0xedb88320 ^ (c >>> 1);
        } else {
            c >>>= 1;
        }
    }
    return c >>> 0;
});

// UTILS functions

function Utils(opts) {
    this.sep = pth.sep;
    this.fs = fsystem;

    if (is_Obj(opts)) {
        // custom filesystem
        if (is_Obj(opts.fs) && typeof opts.fs.statSync === "function") {
            this.fs = opts.fs;
        }
    }
}

module.exports = Utils;

// INSTANTIABLE functions

Utils.prototype.makeDir = function (/*String*/ folder) {
    const self = this;

    // Sync - make directories tree
    function mkdirSync(/*String*/ fpath) {
        let resolvedPath = fpath.split(self.sep)[0];
        fpath.split(self.sep).forEach(function (name) {
            if (!name || name.substr(-1, 1) === ":") return;
            resolvedPath += self.sep + name;
            var stat;
            try {
                stat = self.fs.statSync(resolvedPath);
            } catch (e) {
                if (e.message && e.message.startsWith('ENOENT')) {
                    self.fs.mkdirSync(resolvedPath);
                } else {
                    throw e;
                }
            }
            if (stat && stat.isFile()) throw Errors.FILE_IN_THE_WAY(`"${resolvedPath}"`);
        });
    }

    mkdirSync(folder);
};

Utils.prototype.writeFileTo = function (/*String*/ path, /*Buffer*/ content, /*Boolean*/ overwrite, /*Number*/ attr) {
    const self = this;
    if (self.fs.existsSync(path)) {
        if (!overwrite) return false; // cannot overwrite

        var stat = self.fs.statSync(path);
        if (stat.isDirectory()) {
            return false;
        }
    }
    var folder = pth.dirname(path);
    if (!self.fs.existsSync(folder)) {
        self.makeDir(folder);
    }

    var fd;
    try {
        fd = self.fs.openSync(path, "w", 0o666); // 0666
    } catch (e) {
        self.fs.chmodSync(path, 0o666);
        fd = self.fs.openSync(path, "w", 0o666);
    }
    if (fd) {
        try {
            self.fs.writeSync(fd, content, 0, content.length, 0);
        } finally {
            self.fs.closeSync(fd);
        }
    }
    self.fs.chmodSync(path, attr || 0o666);
    return true;
};

Utils.prototype.writeFileToAsync = function (/*String*/ path, /*Buffer*/ content, /*Boolean*/ overwrite, /*Number*/ attr, /*Function*/ callback) {
    if (typeof attr === "function") {
        callback = attr;
        attr = undefined;
    }

    const self = this;

    self.fs.exists(path, function (exist) {
        if (exist && !overwrite) return callback(false);

        self.fs.stat(path, function (err, stat) {
            if (exist && stat && stat.isDirectory()) {
                return callback(false);
            }

            var folder = pth.dirname(path);
            self.fs.exists(folder, function (exists) {
                if (!exists) {
                    // makeDir is synchronous and can throw (e.g. EACCES); report failure
                    // rather than letting it escape this callback as an uncaught exception
                    try {
                        self.makeDir(folder);
                    } catch (e) {
                        return callback(false);
                    }
                }

                // write the content to an open descriptor, then apply the attributes
                const writeToFd = function (fd) {
                    self.fs.write(fd, content, 0, content.length, 0, function (writeErr) {
                        self.fs.close(fd, function () {
                            // surface write failures instead of silently reporting success (issue #402)
                            if (writeErr) return callback(false);
                            self.fs.chmod(path, attr || 0o666, function () {
                                callback(true);
                            });
                        });
                    });
                };

                self.fs.open(path, "w", 0o666, function (err, fd) {
                    if (err) {
                        // the target may exist but be read-only: make it writable and retry once
                        self.fs.chmod(path, 0o666, function () {
                            self.fs.open(path, "w", 0o666, function (retryErr, fd) {
                                // Previously the retry error was ignored and an undefined fd was
                                // passed to fs.write, throwing an uncaught ERR_INVALID_ARG_TYPE that
                                // crashed the process (issues #470, #459, #402). Report failure instead.
                                if (retryErr || !fd) return callback(false);
                                writeToFd(fd);
                            });
                        });
                    } else if (fd) {
                        writeToFd(fd);
                    } else {
                        callback(false);
                    }
                });
            });
        });
    });
};

// Guard extraction against writing through a symlink that already exists inside
// the target directory. sanitize() only proves the textual path stays under the
// root; it cannot see that a component on disk is a symlink pointing elsewhere,
// so open()/mkdir() would follow it and write outside the root. Walk every path
// component strictly below root and reject any that is a symlink. Components at
// or above root are the caller's own choice and are left untouched, so a root
// that itself lives under a symlink (e.g. /tmp on macOS) still extracts.
Utils.prototype.assertPathSafe = function (/*String*/ root, /*String*/ target) {
    const self = this;
    if (typeof self.fs.lstatSync !== "function") return;

    const resolvedRoot = pth.resolve(root);
    const resolvedTarget = pth.resolve(target);
    if (resolvedTarget === resolvedRoot) return;

    const rel = pth.relative(resolvedRoot, resolvedTarget);
    // Not under root: sanitize() is responsible for that case; nothing to walk.
    if (!rel || rel === ".." || rel.startsWith(".." + pth.sep) || pth.isAbsolute(rel)) return;

    let cur = resolvedRoot;
    for (const part of rel.split(pth.sep)) {
        if (!part || part === ".") continue;
        cur = pth.join(cur, part);
        let stat;
        try {
            stat = self.fs.lstatSync(cur);
        } catch (e) {
            break; // component does not exist yet: nothing below it can be a symlink
        }
        if (stat.isSymbolicLink()) throw Errors.FILE_IN_THE_WAY(`"${cur}"`);
    }
};

Utils.prototype.findFiles = function (/*String*/ path) {
    const self = this;
    const canLstat = typeof self.fs.lstatSync === "function";
    const rootReal = self.fs.realpathSync(path);

    // A symlink whose target lies outside the folder being archived must not be
    // followed: statSync would dereference it and copy the target's contents into
    // the archive, disclosing files outside the root (GHSA-wx42-xcp7-pgr4). Allow
    // symlinks that resolve to a location inside the root, reject any that escape.
    function escapesRoot(/*String*/ p) {
        if (!canLstat) return false;
        if (!self.fs.lstatSync(p).isSymbolicLink()) return false;
        let real;
        try {
            real = self.fs.realpathSync(p);
        } catch (e) {
            return true; // dangling or unresolvable symlink: do not follow
        }
        return !(real === rootReal || real.startsWith(rootReal + pth.sep));
    }

    function findSync(/*String*/ dir, /*RegExp*/ pattern, /*Boolean*/ recursive, /*Set*/ visited) {
        if (typeof pattern === "boolean") {
            recursive = pattern;
            pattern = undefined;
        }
        let files = [];
        self.fs.readdirSync(dir).forEach(function (file) {
            const path = pth.join(dir, file);

            if (escapesRoot(path)) return;

            const stat = self.fs.statSync(path);

            if (!pattern || pattern.test(path)) {
                files.push(pth.normalize(path) + (stat.isDirectory() ? self.sep : ""));
            }

            if (stat.isDirectory() && recursive) {
                // Descend by resolved real path and skip directories we have already
                // visited. This stops a symlink that points back to an ancestor from
                // recursing forever until the path fails with ELOOP / ENAMETOOLONG
                // (issue #541).
                const realDir = self.fs.realpathSync(path);
                if (!visited.has(realDir)) {
                    visited.add(realDir);
                    files = files.concat(findSync(path, pattern, recursive, visited));
                }
            }
        });
        return files;
    }

    return findSync(path, undefined, true, new Set([rootReal]));
};

/**
 * Callback for showing if everything was done.
 *
 * @callback filelistCallback
 * @param {Error} err - Error object
 * @param {string[]} list - was request fully completed
 */

/**
 *
 * @param {string} dir
 * @param {filelistCallback} cb
 */
Utils.prototype.findFilesAsync = function (dir, cb) {
    const self = this;
    const results = [];
    let finished = false;
    const finish = function (err) {
        if (finished) return;
        finished = true;
        cb(err, err ? undefined : results);
    };

    const canLstat = typeof self.fs.lstat === "function";
    let rootReal = null;

    // Reject a symlink whose target escapes the root being archived, so its
    // contents are not dereferenced and copied into the archive
    // (GHSA-wx42-xcp7-pgr4). A symlink resolving to a location inside the root is
    // allowed; a dangling or escaping one is skipped. Calls back (err, escapes).
    const escapesRoot = function (file, cb) {
        if (!canLstat) return cb(null, false);
        self.fs.lstat(file, function (err, lst) {
            if (err) return cb(err);
            if (!lst || !lst.isSymbolicLink()) return cb(null, false);
            self.fs.realpath(file, function (err, real) {
                if (err) return cb(null, true); // dangling: do not follow
                cb(null, !(real === rootReal || real.startsWith(rootReal + pth.sep)));
            });
        });
    };

    // Descend by resolved real path and skip directories already visited, so a
    // symlink pointing back to an ancestor cannot recurse forever (issue #541).
    const walk = function (dir, visited, done) {
        self.fs.readdir(dir, function (err, list) {
            if (err) return done(err);
            let pending = list.length;
            if (!pending) return done();
            list.forEach(function (name) {
                const file = pth.join(dir, name);
                escapesRoot(file, function (err, escapes) {
                    if (err) return done(err);
                    if (escapes) {
                        if (!--pending) done();
                        return;
                    }
                    self.fs.stat(file, function (err, stat) {
                        if (err) return done(err);
                        if (!stat) {
                            if (!--pending) done();
                            return;
                        }
                        results.push(pth.normalize(file) + (stat.isDirectory() ? self.sep : ""));
                        if (!stat.isDirectory()) {
                            if (!--pending) done();
                            return;
                        }
                        self.fs.realpath(file, function (err, realDir) {
                            if (err) return done(err);
                            if (visited.has(realDir)) {
                                if (!--pending) done();
                                return;
                            }
                            visited.add(realDir);
                            walk(file, visited, function (err) {
                                if (err) return done(err);
                                if (!--pending) done();
                            });
                        });
                    });
                });
            });
        });
    };

    self.fs.realpath(dir, function (err, realDir) {
        if (err) return finish(err);
        rootReal = realDir;
        walk(dir, new Set([realDir]), finish);
    });
};

Utils.prototype.getAttributes = function () {};

Utils.prototype.setAttributes = function () {};

// STATIC functions

// crc32 single update (it is part of crc32)
Utils.crc32update = function (crc, byte) {
    return crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
};

Utils.crc32 = function (buf) {
    if (typeof buf === "string") {
        buf = Buffer.from(buf, "utf8");
    }

    let len = buf.length;
    let crc = ~0;
    for (let off = 0; off < len; ) crc = Utils.crc32update(crc, buf[off++]);
    // xor and cast as uint32 number
    return ~crc >>> 0;
};

Utils.methodToString = function (/*Number*/ method) {
    switch (method) {
        case Constants.STORED:
            return "STORED (" + method + ")";
        case Constants.DEFLATED:
            return "DEFLATED (" + method + ")";
        default:
            return "UNSUPPORTED (" + method + ")";
    }
};

/**
 * removes ".." style path elements
 * @param {string} path - fixable path
 * @returns string - fixed filepath
 */
Utils.canonical = function (/*string*/ path) {
    if (!path) return "";
    // trick normalize think path is absolute
    const safeSuffix = pth.posix.normalize("/" + path.split("\\").join("/"));
    return pth.join(".", safeSuffix);
};

/**
 * fix file names in achive
 * @param {string} path - fixable path
 * @returns string - fixed filepath
 */

Utils.zipnamefix = function (path) {
    if (!path) return "";
    // trick normalize think path is absolute
    const safeSuffix = pth.posix.normalize("/" + path.split("\\").join("/"));
    return pth.posix.join(".", safeSuffix);
};

/**
 *
 * @param {Array} arr
 * @param {function} callback
 * @returns
 */
Utils.findLast = function (arr, callback) {
    if (!Array.isArray(arr)) throw new TypeError("arr is not array");

    const len = arr.length >>> 0;
    for (let i = len - 1; i >= 0; i--) {
        if (callback(arr[i], i, arr)) {
            return arr[i];
        }
    }
    return void 0;
};

// make absolute paths taking prefix as root folder
Utils.sanitize = function (/*string*/ prefix, /*string*/ name) {
    prefix = pth.resolve(pth.normalize(prefix));
    var parts = name.split("/");
    for (var i = 0, l = parts.length; i < l; i++) {
        var path = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
        if (path === prefix || path.startsWith(prefix + pth.sep)) {
            return path;
        }
    }
    return pth.normalize(pth.join(prefix, pth.basename(name)));
};

// converts buffer, Uint8Array, string types to buffer
Utils.toBuffer = function toBuffer(/*buffer, Uint8Array, string*/ input, /* function */ encoder) {
    if (Buffer.isBuffer(input)) {
        return input;
    } else if (input instanceof Uint8Array) {
        return Buffer.from(input);
    } else {
        // expect string all other values are invalid and return empty buffer
        return typeof input === "string" ? encoder(input) : Buffer.alloc(0);
    }
};

Utils.readBigUInt64LE = function (/*Buffer*/ buffer, /*int*/ index) {
    const lo = buffer.readUInt32LE(index);
    const hi = buffer.readUInt32LE(index + 4);
    const value = hi * 0x100000000 + lo;
    // The result is a JS number, so values above 2^53 - 1 cannot be represented
    // exactly. These are zip64 sizes/offsets/counts used as buffer indices; a
    // silently rounded value would misparse the archive. Reject instead.
    if (value > Number.MAX_SAFE_INTEGER) {
        throw Errors.ZIP64_VALUE_TOO_LARGE();
    }
    return value;
};

Utils.writeBigUInt64LE = function (/*Buffer*/ buffer, /*Number*/ value, /*int*/ index) {
    const lo = value >>> 0;
    const hi = Math.floor(value / 0x100000000) >>> 0;
    buffer.writeUInt32LE(lo, index);
    buffer.writeUInt32LE(hi, index + 4);
};

Utils.fromDOS2Date = function (val) {
    return new Date(((val >> 25) & 0x7f) + 1980, Math.max(((val >> 21) & 0x0f) - 1, 0), Math.max((val >> 16) & 0x1f, 1), (val >> 11) & 0x1f, (val >> 5) & 0x3f, (val & 0x1f) << 1);
};

Utils.fromDate2DOS = function (val) {
    let date = 0;
    let time = 0;
    if (val.getFullYear() > 1979) {
        date = (((val.getFullYear() - 1980) & 0x7f) << 9) | ((val.getMonth() + 1) << 5) | val.getDate();
        time = (val.getHours() << 11) | (val.getMinutes() << 5) | (val.getSeconds() >> 1);
    }
    return (date << 16) | time;
};

Utils.isWin = isWin; // Do we have windows system
Utils.crcTable = crcTable;
