import { expect } from "chai";
import { crc32 } from "../util/utils";

describe("crc32 function", () => {
    // tests how crc32 function handles strings as input
    it("handle strings", () => {
        const tests = [
            // basic latin
            { crc: 0x00000000, data: "" },
            { crc: 0xe8b7be43, data: "a" },
            { crc: 0x352441c2, data: "abc" },
            { crc: 0xcbf43926, data: "123456789" },
            { crc: 0x20159d7f, data: "message digest" },
            { crc: 0x4c2750bd, data: "abcdefghijklmnopqrstuvwxyz" },
            { crc: 0x1fc2e6d2, data: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" },
            { crc: 0xf8c05f58, data: "1234567890123456789012345678901234567890123456789" },
            { crc: 0x1f61e4e0, data: "FFFFFFFFFFFFFFFFFFFFFFFFFFF" },
            // Unicode
            { crc: 0x70b5f183, data: "ä" },
            { crc: 0x414fa339, data: "The quick brown fox jumps over the lazy dog" },
            // fox jump in russian
            { crc: 0x7d67cd7a, data: "Быстрая коричневая лиса прыгает через ленивую собаку" },
            // fox jump in german
            { crc: 0x8c3db82b, data: "Der schnelle Braunfuchs springt über den faulen Hund" },
            // fox jump in arabic
            { crc: 0x6d8c0241, data: "الثعلب البني السريع يقفز فوق الكلب الكسول" },
            // fox jump in korean
            { crc: 0x13a25011, data: "빠른 갈색 여우가 게으른 개를 뛰어 넘습니다." }
        ];

        for (let test of tests) {
            expect(crc32(test.data)).to.equal(test.crc);
        }
    });
});
