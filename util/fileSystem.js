exports.require = function() {
    if (process && process.versions && process.versions['electron']) {
        try {
            originalFs = require("original-fs");
            if (Object.keys(originalFs).length > 0) {
                return originalFs;
            }
        } catch (e) {}
    }
    // fs require is called only if needed
    return require("fs");
};
