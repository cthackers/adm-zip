// generate CRC32 lookup table
const crctable = (new Uint32Array(256)).map((t,crc)=>{
    for(let j=0;j<8;j++){
        if (0 !== (crc & 1)){
            crc = (crc >>> 1) ^ 0xEDB88320
        }else{
            crc >>>= 1    
        }
    }
    return crc>>>0;
});

function make_decrypter(/*Buffer*/pwd){
    // C-style uInt32 Multiply
    const uMul = (a,b) => Math.imul(a, b) >>> 0;
    // Initialize keys with default values
    const keys = new Uint32Array([0x12345678, 0x23456789, 0x34567890]);
    // crc32 byte update 
    const crc32update = (pCrc32, bval) => {
        return crctable[(pCrc32 ^ bval) & 0xff] ^ (pCrc32 >>> 8);
    }
    // update keys with byteValues
    const updateKeys = (byteValue) => {
        keys[0] = crc32update(keys[0], byteValue);
        keys[1] += keys[0] & 0xff; 
        keys[1] = uMul(keys[1], 134775813) + 1;
        keys[2] = crc32update(keys[2], keys[1] >>> 24);
    }

    // 1. Stage initialize key
    const pass = (Buffer.isBuffer(pwd)) ? pwd :  Buffer.from(pwd);
    for(let i=0; i< pass.length; i++){
        updateKeys(pass[i]);
    }

    // return decrypter function
    return function (/*Buffer*/data){
        if (!Buffer.isBuffer(data)){
            throw 'decrypter needs Buffer'
        }
        // result - we create new Buffer for results
        const result = Buffer.alloc(data.length);
        let pos = 0;
        // process input data
        for(let c of data){
            const k = (keys[2] | 2) >>> 0;      // key
            c ^= (uMul(k, k^1) >> 8) & 0xff;    // decode
            result[pos++] = c;                  // Save Value
            updateKeys(c);                      // update keys with decoded byte
        }
        return result;
    }
}

function decrypt(/*Buffer*/ data, /*Object*/header, /*String, Buffer*/ pwd){
    if (!data || !Buffer.isBuffer(data) || data.length < 12) {
        return Buffer.alloc(0);
    }
    
    // We Initialize and generate decrypting function
    const decrypter = make_decrypter(pwd);

    // check - for testing password
    const check = header.crc >>> 24;
    // decrypt salt what is always 12 bytes and is a part of file content
    const testbyte = decrypter(data.slice(0, 12))[11];

    // does password meet expectations
    if (check !== testbyte){
        throw 'ADM-ZIP: Wrong Password';
    }

    // decode content
    return decrypter(data.slice(12));
}

module.exports = {decrypt};
