var submodules = [
    './utils',

    // test methods
    // flate
    './methods/flate',

    // test archive
    './archive/zip'
];

submodules.forEach(function (importPath) {
    var time = new Date().getTime(),
        tests = require(importPath).unitTests(),
        results = {
            total : 0,
            failed : 0,
            success : 0
        };

    console.log("-- Testing lib " + importPath + " ---");
    for (var name in tests) {
        if (!tests.hasOwnProperty(name)) return;
        var test = tests[name];

        var t = new Date().getTime();
        try {
            var status = test.run();
        } catch (e) {
            console.log("Error: ", e.message)
            status = false;
        }
        if (status) {
            results.success++
        } else {
            results.failed++;
        }
        console.log(name, "(" + (new Date().getTime() - t) + "ms) " + (status ? "✓" : "✗"));
        results.total++;
    }

    if (!results.total) {
        console.log("--- NO TESTS ---")
    } else {
        console.log("--- Tests " + (results.failed > 0 ? "FAILED" : "OK") + ". Total : " + results.total + ", Success: " + results.success + ", Failed: " + results.failed + " ---- ");
    }
});
