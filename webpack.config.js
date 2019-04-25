const path = require('path');

module.exports = {
  module: {
    rules: [
      {
        test: /\.node$/,
        use: 'node-loader'
      }
    ]
  },
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'ergo.js',
    library: 'ergo',
  }
};