const path = require('path');
const MODE =
  process.env.NODE_ENV === 'development' ? 'development' : 'production';

module.exports = {
  mode: MODE,
  entry: './index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
      test: /\.elm$/,
      exclude: [/elm-stuff/, /node_modules/],
      use: {
        loader: 'elm-webpack-loader',
        options:
          MODE === 'development' ?  {debug: true} : {optimize: true}
      }
    }
  ]
  }
};
