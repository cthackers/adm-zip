// node crypt, we use it for generate salt
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { randomFillSync } from "crypto";

// generate CRC32 lookup table
const crctable = new Uint32Array(256).map((_, crc) => {
    for (let j = 0; j < 8; j++) {
        if (0 !== (crc & 1)) {
            crc = (crc >>> 1) ^ 0xedb88320;
        } else {
            crc >>>= 1;
        }
    }
    return crc >>> 0;
});

// C-style uInt32 Multiply (discards higher bits, when JS multiply discards lower bits)
const uMul = (a: number, b: number) => Math.imul(a, b) >>> 0;

// crc32 byte single update (actually same function is part of utils.crc32 function :) )
const crc32update = (pCrc32: number, bval: number) => {
    return crctable[ (pCrc32 ^ bval) & 0xff ] ^ (pCrc32 >>> 8);
};

// function for generating salt for encrytion header
const genSalt = () => {
    if ("function" === typeof randomFillSync) {
        return randomFillSync(Buffer.alloc(12));
    } else {
        // fallback if function is not defined
        return genSalt.node();
    }
};

// salt generation with node random function (mainly as fallback)
genSalt.node = () => {
    const salt = Buffer.alloc(12);
    const len = salt.length;
    for (let i = 0; i < len; i++) salt[ i ] = (Math.random() * 256) & 0xff;
    return salt;
};

// general config
const config: { genSalt: () => Buffer } = {
    genSalt
};
export class Initkeys {
    keys: Uint32Array;

    constructor(pw: any) {
        const pass = Buffer.isBuffer(pw) ? pw : Buffer.from(pw);
        this.keys = new Uint32Array([ 0x12345678, 0x23456789, 0x34567890 ]);
        for (let i = 0; i < pass.length; i++) {
            this.updateKeys(pass[ i ]);
        }
    }
    updateKeys(byteValue: number) {
        const keys = this.keys;
        keys[ 0 ] = crc32update(keys[ 0 ], byteValue);
        keys[ 1 ] += keys[ 0 ] & 0xff;
        keys[ 1 ] = uMul(keys[ 1 ], 134775813) + 1;
        keys[ 2 ] = crc32update(keys[ 2 ], keys[ 1 ] >>> 24);
        return byteValue;
    };
    next() {
        const k = (this.keys[ 2 ] | 2) >>> 0; // key
        return (uMul(k, k ^ 1) >> 8) & 0xff; // decode
    };
}


function make_decrypter(pwd: Buffer | string) {
    // 1. Stage initialize key
    const keys = new Initkeys(pwd);

    // return decrypter function
    return function (data: Buffer) {
        // result - we create new Buffer for results
        const result = Buffer.alloc(data.length);
        let pos = 0;
        // process input data
        for (let c of data) {
            //c ^= keys.next();
            //result[pos++] = c; // decode & Save Value
            result[ pos++ ] = keys.updateKeys(c ^ keys.next()); // update keys with decoded byte
        }
        return result;
    };
}

function make_encrypter(pwd: Buffer | string) {
    // 1. Stage initialize key
    const keys = new Initkeys(pwd);

    // return encrypting function, result and pos is here so we dont have to merge buffers later
    return function (data: Buffer, result: Buffer, /* Number */ pos = 0) {
        // result - we create new Buffer for results
        if (!result) result = Buffer.alloc(data.length);
        // process input data
        for (let c of data) {
            const k = keys.next(); // save key byte
            result[ pos++ ] = c ^ k; // save val
            keys.updateKeys(c); // update keys with decoded byte
        }
        return result;
    };
}

export function decrypt(data: Buffer, header: any, pwd: string | Buffer) {
    if (!data || !Buffer.isBuffer(data) || data.length < 12) {
        return Buffer.alloc(0);
    }

    // 1. We Initialize and generate decrypting function
    const decrypter = make_decrypter(pwd);

    // 2. decrypt salt what is always 12 bytes and is a part of file content
    const salt = decrypter(data.slice(0, 12));

    // 3. does password meet expectations
    if (salt[ 11 ] !== header.crc >>> 24) {
        throw "ADM-ZIP: Wrong Password";
    }

    // 4. decode content
    return decrypter(data.slice(12));
}

// lets add way to populate salt, NOT RECOMMENDED for production but maybe useful for testing general functionality
export function _salter(data: Buffer | "node") {
    if (Buffer.isBuffer(data) && data.length >= 12) {
        // be aware - currently salting buffer data is modified
        config.genSalt = function () {
            return data.slice(0, 12);
        };
    } else if (data === "node") {
        // test salt generation with node random function
        config.genSalt = genSalt.node;
    } else {
        // if value is not acceptable config gets reset.
        config.genSalt = genSalt;
    }
}

export function encrypt(data: Buffer | string, header: any, pwd: string | Buffer, oldlike = false) {
    // 1. test data if data is not Buffer we make buffer from it
    if (data == null) data = Buffer.alloc(0);
    // if data is not buffer be make buffer from it
    if (!Buffer.isBuffer(data)) data = Buffer.from(data.toString());

    // 2. We Initialize and generate encrypting function
    const encrypter = make_encrypter(pwd);

    // 3. generate salt (12-bytes of random data)
    const salt = config.genSalt();
    salt[ 11 ] = (header.crc >>> 24) & 0xff;

    // old implementations (before PKZip 2.04g) used two byte check
    if (oldlike) salt[ 10 ] = (header.crc >>> 16) & 0xff;

    // 4. create output
    const result = Buffer.alloc(data.length + 12);
    encrypter(salt, result);

    // finally encode content
    return encrypter(data, result, 12);
}