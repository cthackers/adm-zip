import zlib from "zlib";
export class Inflater {
    inbuf: Buffer;

    constructor(inbuf: Buffer) {
        this.inbuf = inbuf;
    }

    inflate() {
        return zlib.inflateRawSync(this.inbuf);
    }

    inflateAsync(/*Function*/ callback: any) {
        const stream = zlib.createDeflateRaw();
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
