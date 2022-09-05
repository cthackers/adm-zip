const path = require('path');
console.log()

module.exports = {
  entry: path.resolve(__dirname, 'adm-zip.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'adm-zip.js',
		library: {
			name: "admZip",
			type: "commonjs"
		}
  },
	target: 'node',
};