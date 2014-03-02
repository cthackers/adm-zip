var submodules = [
    './utils',

    // test methods
    // flate
    './methods/flate',

    // test archive
    './archive/zip'
];

var results = {
    total : 0,
    failed : 0,
    success : 0
};

var to_test = ""

submodules.forEach(function (importPath) {
    var tests = require(importPath).unitTests();

    for (var name in tests) {
        if (to_test && name != to_test) continue;
        if (tests.hasOwnProperty(name)) {
            var test = tests[name];

            var t = new Date().getTime();
            try {
                var status = test.run();
            } catch (e) {
                console.log("Error: ", e.message);
                status = false;
            }
            if (status) {
                results.success++
            } else {
                results.failed++;
            }
            console.log(importPath + "/" + name, "(" + (new Date().getTime() - t) + "ms) " + (status ? "✓" : "✗"));
            results.total++;
        }
    }
});

console.log("--- Tests " + (results.failed > 0 ? "FAILED" : "OK") + ". Total : " + results.total + ", Success: " + results.success + ", Failed: " + results.failed + " ---- ");