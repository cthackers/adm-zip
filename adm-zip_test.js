var submodules = [
    // test methods
    // flate
    './methods/flate',

    // test archive
    './archive/zip'
];

submodules.forEach(function (importPath) {
    var time = new Date().getTime(),
        status = require(importPath).test();
    console.log("-", importPath, "(" + (new Date().getTime() - time) + "ms) : " + (status ? 'OK' : 'FAIL'),"----------");
});