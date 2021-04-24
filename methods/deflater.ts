import zlib from "zlib";
export class Deflater {
    inbuf: Buffer;
    opts: any;

    constructor(inbuf: Buffer) {
        this.inbuf = inbuf;
        this.opts = { chunkSize: (inbuf.length / 1024 + 1) * 1024 };
    }

    deflate() {
        return zlib.deflateRawSync(this.inbuf, this.opts);
    }

    deflateAsync(callback: any) {
        const stream = zlib.createDeflateRaw(this.opts);
        const parts: Buffer[] = [];
        let total: number = 0;
        stream.on("data", function (data: Buffer) {
            parts.push(data);
            total += data.length;
        });
        stream.on("end", function () {
            if (typeof callback === "function") {
                const result: Buffer = Buffer.alloc(total);
                let written: number = 0;
                for (const part of parts) {
                    part.copy(result, written);
                    written += part.length;
                }
                callback(result);
            }
        });
        stream.end(this.inbuf);
    }
}
