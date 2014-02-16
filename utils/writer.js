module.exports = function() {
    var bytes = new Buffer(0);
    return {
        write : function (b) {
            bytes = Buffer.concat([bytes, new Buffer(b)]);
            return b.length
        },
        get buffer () {
            return bytes
        },
        get length () {
            return bytes.length;
        }
    }
};