import pth from "path";
import * as fs from "fs";
import { Constants } from "./constants";
import { Errors } from "./errors";

export const isWin = typeof process === "object" && "win32" === process.platform;
var crcTable: number[] = [];
const PATH_SEPARATOR = pth.sep;

function genCRCTable() {
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 8; --k >= 0; )
            if ((c & 1) !== 0) {
                c = 0xedb88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        crcTable[n] = c >>> 0;
    }
}

function mkdirSync(/*String*/ path: string) {
    var resolvedPath = path.split(PATH_SEPARATOR)[0];
    path.split(PATH_SEPARATOR).forEach(function (name) {
        if (!name || name.substr(-1, 1) === ":") return;
        resolvedPath += PATH_SEPARATOR + name;
        var stat;
        try {
            stat = fs.statSync(resolvedPath);
        } catch (e) {
            fs.mkdirSync(resolvedPath);
        }
        if (stat && stat.isFile()) throw Errors.FILE_IN_THE_WAY.replace("%s", resolvedPath);
    });
}

function findSync(dir: string, pattern?: RegExp | boolean, recoursive?: boolean) {
    if (typeof pattern === "boolean") {
        recoursive = pattern;
        pattern = undefined;
    }
    var files: string[] = [];
    fs.readdirSync(dir).forEach(function (file: string) {
        var path = pth.join(dir, file);

        if (fs.statSync(path).isDirectory() && recoursive) files = files.concat(findSync(path, pattern, recoursive));

        if (!pattern || (typeof pattern == "boolean" ? pattern : pattern.test(path))) {
            files.push(pth.normalize(path) + (fs.statSync(path).isDirectory() ? PATH_SEPARATOR : ""));
        }
    });
    return files;
}

export function readBigUInt64LE(buffer: Buffer, index: number) {
    var slice = Buffer.from(buffer.slice(index, index + 8));
    slice.swap64();

    return parseInt(`0x${slice.toString("hex")}`);
}

export function makeDir(path: string) {
    mkdirSync(path);
}

export function crc32(buf: string | Buffer) {
    if (typeof buf === "string") {
        buf = Buffer.from(buf, "utf8");
    }
    // Generate crcTable
    if (!crcTable.length) genCRCTable();

    var off = 0,
        len = buf.length,
        crc = ~0;
    while (--len >= 0) crc = crcTable[(crc ^ buf[off++]) & 0xff] ^ (crc >>> 8);
    // xor and cast as uint32 number
    return ~crc >>> 0;
}

export function methodToString(method: number) {
    switch (method) {
        case Constants.STORED:
            return "STORED (" + method + ")";
        case Constants.DEFLATED:
            return "DEFLATED (" + method + ")";
        default:
            return "UNSUPPORTED (" + method + ")";
    }
}

export function writeFileTo(path: string, content: Buffer, overwrite: Boolean, attr?: number) {
    if (fs.existsSync(path)) {
        if (!overwrite) return false; // cannot overwrite

        var stat = fs.statSync(path);
        if (stat.isDirectory()) {
            return false;
        }
    }
    var folder = pth.dirname(path);
    if (!fs.existsSync(folder)) {
        mkdirSync(folder);
    }

    var fd;
    try {
        fd = fs.openSync(path, "w", 438); // 0666
    } catch (e) {
        fs.chmodSync(path, 438);
        fd = fs.openSync(path, "w", 438);
    }
    if (fd) {
        try {
            fs.writeSync(fd, content, 0, content.length, 0);
        } finally {
            fs.closeSync(fd);
        }
    }
    fs.chmodSync(path, attr || 438);
    return true;
}

export function writeFileToAsync(path: string, content: Buffer, overwrite: boolean, attr: number | undefined, callback: (resolve: boolean) => void) {
    if (typeof attr === "function") {
        callback = attr;
        attr = undefined;
    }

    fs.access(path, function (exist) {
        if (exist && !overwrite) return callback(false);

        fs.stat(path, function (_, stat) {
            if (exist && stat.isDirectory()) {
                return callback(false);
            }

            var folder = pth.dirname(path);
            fs.access(folder, function (exists) {
                if (!exists) mkdirSync(folder);

                fs.open(path, "w", 438, function (err, fd) {
                    if (err) {
                        fs.chmod(path, 438, function () {
                            fs.open(path, "w", 438, function (_, fd) {
                                fs.write(fd, content, 0, content.length, 0, function () {
                                    fs.close(fd, function () {
                                        fs.chmod(path, attr || 438, function () {
                                            callback(true);
                                        });
                                    });
                                });
                            });
                        });
                    } else if (fd) {
                        fs.write(fd, content, 0, content.length, 0, function () {
                            fs.close(fd, function () {
                                fs.chmod(path, attr || 438, function () {
                                    callback(true);
                                });
                            });
                        });
                    } else {
                        fs.chmod(path, attr || 438, function () {
                            callback(true);
                        });
                    }
                });
            });
        });
    });
}

export function findFiles(path: string) {
    return findSync(path, true);
}

export function toBuffer(input: Buffer | string | Uint8Array) {
    if (Buffer.isBuffer(input)) {
        return input;
    } else if (input instanceof Uint8Array) {
        return Buffer.from(input);
    } else {
        // expect string all other values are invalid and return empty buffer
        return typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.alloc(0);
    }
}
