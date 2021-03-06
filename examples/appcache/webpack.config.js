var path = require('path');
var AppCachePlugin = require('appcache-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var HtmlWebpackSlimPlugin = require('../..');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var webpackMajorVersion = require('webpack/package.json').version.split('.')[0];

module.exports = {
  entry: './example.js',
  output: {
    path: path.join(__dirname, 'dist/webpack-' + webpackMajorVersion),
    publicPath: '',
    filename: 'bundle.js'
  },
  module: {
    rules: [
      { test: /\.css$/, use: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' }) },
      { test: /\.png$/, use: 'file-loader?name=[name].[ext]' },
      { test: /\.html$/, use: 'html-loader?-removeOptionalTags' }
    ]
  },
  plugins: [
    new AppCachePlugin(),
    new ExtractTextPlugin('styles.css'),
    new HtmlWebpackPlugin({
      template: 'template.html'
    }),
    new HtmlWebpackPlugin({
      template: 'template.slim',
      filename: 'index.slim'
    }),
    new HtmlWebpackSlimPlugin()
  ]
};
