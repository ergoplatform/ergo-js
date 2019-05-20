const path = require('path');

const buildFile = Object.assign({}, {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'ergo.js',
    library: 'ergo',
  },
});

const npmFile = Object.assign({}, {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, './'),
    filename: 'index.js',
    library: 'ergo',
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
});

// Return Array of Configurations
module.exports = [
  buildFile, npmFile,
];
