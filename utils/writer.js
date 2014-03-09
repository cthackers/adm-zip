module.exports = function() {
    var w = this;

    this.Write = function(b) {
        w.buffer = Buffer.concat([w.buffer, new Buffer(b)]);
        return b.length
    };

    this.buffer = new Buffer(0);

    this.__defineGetter__("length", function() {
        return w.buffer.length
    });

    this.write = w.Write;
};