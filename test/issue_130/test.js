(function() {

'use strict';

var fs = require('fs');
var path = require('path');
var Zip = require('../../adm-zip');

// init the final zip file
var writeZip = new Zip();

// file in root folder
writeZip.addFile('root_file.txt', 'root');

// add folder
writeZip.addFile('sub/', Buffer.alloc(0));

// file in sub folder
writeZip.addFile('sub/sub_file.txt', 'sub');

// files from local folder
writeZip.addLocalFolder('nested', 'nested');

// write to disk
writeZip.writeZip('test.zip');

// read zip from disk
var readZip = new Zip('test.zip');

// unpack everything
readZip.extractAllTo('unzipped', true);

// assert the files
var assert = function(content, expectedContent, errMsg) {
    if (content != expectedContent) {
        throw errMsg;
    }
}

var fileRoot = fs.readFileSync(path.join('unzipped', 'root_file.txt'), 'utf8');
assert(fileRoot, 'root', 'root file not correct');

var fileSub = fs.readFileSync(path.join('unzipped', 'sub', 'sub_file.txt'), 'utf8');
assert(fileSub, 'sub', 'sub file not correct');

var fileNested = fs.readFileSync(path.join('unzipped', 'nested', 'nested_file.txt'), 'utf8');
assert(fileNested, 'nested', 'nested file not correct');

var fileDeeper = fs.readFileSync(path.join('unzipped', 'nested', 'deeper', 'deeper_file.txt'), 'utf8');
assert(fileDeeper, 'deeper', 'deeper file not correct');

})();
