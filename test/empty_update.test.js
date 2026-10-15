const { expect } = require("chai");
const Zip = require("../adm-zip");

describe("replacing file content with an empty buffer", () => {
    for (const loaded of [false, true]) {
        for (const replace of ["updateFile", "addFile"]) {
            for (const async of [false, true]) {
                it(`${replace}, loaded=${loaded}, async=${async}`, async () => {
                    let zip = new Zip();
                    zip.addFile("file.txt", Buffer.from("previous content"));
                    zip.addFile("keep.txt", Buffer.from("keep"));
                    if (loaded) zip = new Zip(zip.toBuffer());

                    zip[replace]("file.txt", Buffer.alloc(0));
                    expect(zip.readFile("file.txt")).to.deep.equal(Buffer.alloc(0));
                    await new Promise((resolve, reject) => {
                        zip.readFileAsync("file.txt", (data, err) => {
                            if (err) return reject(err);
                            expect(data).to.deep.equal(Buffer.alloc(0));
                            resolve();
                        });
                    });

                    const output = async ? await zip.toBufferPromise() : zip.toBuffer();
                    const result = new Zip(output);
                    const entry = result.getEntry("file.txt");
                    expect(entry.header.size).to.equal(0);
                    expect(entry.header.compressedSize).to.equal(0);
                    expect(entry.header.crc).to.equal(0);
                    expect(result.readFile("file.txt")).to.deep.equal(Buffer.alloc(0));
                    expect(result.readAsText("keep.txt")).to.equal("keep");
                    expect(result.test()).to.equal(true);
                    expect(new Zip(result.toBuffer()).readFile("file.txt")).to.deep.equal(Buffer.alloc(0));
                });
            }
        }
    }
});
