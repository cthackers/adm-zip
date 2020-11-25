// generate CRC32 lookup table
var crctable = (new Uint32Array(256)).map((t,crc)=>{
    for(var j=0;j<8;j++){
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
    function uMul(a,b) {
        return Math.imul(a, b) >>> 0;
    }
    // Initialize keys with default values
    var keys = new Uint32Array([0x12345678, 0x23456789, 0x34567890]);
    // crc32 byte update
    function crc32update (pCrc32, bval) {
        return crctable[(pCrc32 ^ bval) & 0xff] ^ (pCrc32 >>> 8);
    }
    // update keys with byteValues
    function updateKeys(byteValue) {
        keys[0] = crc32update(keys[0], byteValue);
        keys[1] += keys[0] & 0xff;
        keys[1] = uMul(keys[1], 134775813) + 1;
        keys[2] = crc32update(keys[2], keys[1] >>> 24);
    }

    // 1. Stage initialize key
    var pass = (Buffer.isBuffer(pwd)) ? pwd :  Buffer.from(pwd);
    for(var pos=0; pos < pass.length; pos++){
        updateKeys(pass[pos]);
    }

    // return decrypter function
    return function (/*Buffer*/data){
        if (!Buffer.isBuffer(data)){
            throw 'decrypter needs Buffer'
        }
        // result - we create new Buffer for results
        var result = Buffer.alloc(data.length);
        // process input data
        for(var pos=0; pos < data.length; pos++){
            var c = data[pos];
            var k = (keys[2] | 2) >>> 0;        // key
            c ^= (uMul(k, k^1) >> 8) & 0xff;    // decode
            result[pos] = c;                    // Save Value
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
    var decrypter = make_decrypter(pwd);

    // check - for testing password
    var check = header.crc >>> 24;
    // decrypt salt what is always 12 bytes and is a part of file content
    var testbyte = decrypter(data.slice(0, 12))[11];

    // does password meet expectations
    if (check !== testbyte){
        throw 'ADM-ZIP: Wrong Password';
    }

    // decode content
    return decrypter(data.slice(12));
}

module.exports = {decrypt};
