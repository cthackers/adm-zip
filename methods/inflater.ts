import zlib from "zlib";
export class Inflater {
    inbuf: Buffer
    constructor(inbuf: Buffer) {
        this.inbuf = inbuf;
    }
    inflate() {
        return zlib.inflateRawSync(this.inbuf);
    };

    inflateAsync(/*Function*/ callback: any) {
        var tmp = zlib.createInflateRaw(),
            parts: any[] = [],
            total = 0;
        tmp.on("data", function (data: string) {
            parts.push(data);
            total += data.length;
        });
        tmp.on("end", function () {
            var buf = Buffer.alloc(total),
                written = 0;
            buf.fill(0);
            for (var i = 0; i < parts.length; i++) {
                var part = parts[ i ];
                part.copy(buf, written);
                written += part.length;
            }
            callback && callback(buf);
        });
        tmp.end(this.inbuf);
    }

};
