var forwardCopy = require("./copy").forwardCopy;

module.exports.run = function () {
    var tests = [
        [0, 9, 0, 9, "012345678"],
        [0, 5, 4, 9, "45678"],
        [4, 9, 0, 5, "01230"],
        [1, 6, 3, 8, "34567"],
        [3, 8, 1, 6, "12121"],
        [0, 9, 3, 6, "345"],
        [3, 6, 0, 9, "012"],
        [1, 6, 0, 9, "00000"],
        [0, 4, 7, 8, "7"],
        [0, 1, 6, 8, "6"],
        [4, 4, 6, 9, ""],
        [2, 8, 6, 6, ""],
        [0, 0, 0, 0, ""]
    ];

    for (var i = 0; i < tests.length; i++) {
        var tc = tests[i],
            b = new Buffer("0123456789"),
            n = tc[1] - tc[0];

        if (tc[3] - tc[2] < n) {
            n = tc[3] - tc[2];
        }

        forwardCopy(b, tc[0], tc[2], n);
        var got = b.slice(tc[0], tc[0] + n).toString();
        if (got != tc[4]) {
            console.log("Copy Test: dst=b[%d:%d], src=b[%d:%d]: got %s, want %s", tc[0], tc[1], tc[2], tc[3], got, tc[4])
            return false
        }
        for (var j = 0; j < b.length; j++) {
            var x = String.fromCharCode(b[j]);
            if (j >= tc[0] && j < tc[0] + n) {
                continue
            }
            if (x != j) {
                console.log("Copy Test: dst=b[%d:%d], src=b[%d:%d]: copy overrun at b[%d]: got '%d', want '%d'", tc[0], tc[1], tc[2], tc[3], j, x, j)
                return false
            }
        }
    }

    return true
};
