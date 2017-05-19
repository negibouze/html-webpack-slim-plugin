Slim extension for the HTML Webpack Plugin
========================================

Installation
------------
Install the plugin with npm:

```shell
$ npm install --save-dev html-webpack-slim-plugin
```

Install the plugin with yarn:

```shell
$ yarn add --dev html-webpack-slim-plugin
```

Usage
-----
Require the plugin in your webpack config:

```javascript
var HtmlWebpackSlimPlugin = require('html-webpack-slim-plugin');
```

ES2015

```es2015
import HtmlWebpackSlimPlugin from 'html-webpack-slim-plugin';
```

Add the plugin to your webpack config as follows:

```javascript
// Please specify filetype 'slim' or filename '*.slim'.
plugins: [
  new HtmlWebpackPlugin({
    filetype: 'slim'
  }),
  new HtmlWebpackPlugin({
    filename: 'output.slim'
  }),
  new HtmlWebpackSlimPlugin()
]  
```

Even if you generate multiple files make sure that you add the HtmlWebpackSlimPlugin **only once**:

```javascript
plugins: [
  new HtmlWebpackPlugin({
    template: 'src/views/test.slim',
    filetype: 'slim'
  }),
  new HtmlWebpackPlugin({
    template: 'src/views/test.slim',
    filename: 'test.slim'
  }),
  new HtmlWebpackSlimPlugin()
]  
```

Output Example
--------------

```slim
doctype html
html
  head
    meta charset="utf-8"
    link href="bundle.css" rel="stylesheet"
  body
    script type="text/javascript" src="bundle.js"
```

If you are interested, look at examples.

License
-------

This project is licensed under [MIT](https://github.com/negibouze/html-webpack-slim-plugin/blob/master/LICENSE).
