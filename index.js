'use strict';

var assert = require('assert');

function HtmlWebpackSlimPlugin (options) {
  assert.equal(options, undefined, 'The HtmlWebpackSlimPlugin does not accept any options');
}

HtmlWebpackSlimPlugin.prototype.apply = function (compiler) {
  var self = this;
  // Hook into the html-webpack-plugin processing
  compiler.plugin('compilation', function (compilation) {
    compilation.plugin('html-webpack-plugin-before-html-processing', function (htmlPluginData, callback) {
      self.preProcessHtml(htmlPluginData, callback);
    });
    compilation.plugin('html-webpack-plugin-after-html-processing', function (htmlPluginData, callback) {
      self.postProcessHtml(htmlPluginData, callback);
    });
  });
};

/**
 * Process the generated HTML（before assets injection）
 */
HtmlWebpackSlimPlugin.prototype.preProcessHtml = function (htmlPluginData, callback) {
  var self = this;
  var options = htmlPluginData.plugin.options;
  // If the plugin configuration set `filename` ends with `.slim` or `filetype` to 'slim'
  if (htmlPluginData.outputName.endsWith('.slim') || options.filetype === 'slim') {
    htmlPluginData.html = self.adjustElementsIndentation(htmlPluginData.html);
  }
  callback(null, htmlPluginData);
};

/**
 * Process the generated HTML（after assets injection）
 */
HtmlWebpackSlimPlugin.prototype.postProcessHtml = function (htmlPluginData, callback) {
  var self = this;
  var options = htmlPluginData.plugin.options;
  // If the plugin configuration set `inject` to true and (set `filename` ends with `.slim` or `filetype` to 'slim')
  if (options.inject && (htmlPluginData.outputName.endsWith('.slim') || options.filetype === 'slim')) {
    if (options.filename === 'index.html') {
      htmlPluginData.outputName = 'index.slim';
      htmlPluginData.plugin.childCompilationOutputName = 'index.slim';
      htmlPluginData.plugin.options.filename = 'index.slim';
    }
    htmlPluginData.html = self.injectAssetsIntoFile(htmlPluginData);
  }
  callback(null, htmlPluginData);
};

/**
 * Adjust elements indentation
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.adjustElementsIndentation = function (html) {
  var self = this;
  html = self.adjustHeadElementsIndentation(html);
  html = self.adjustBodyElementsIndentation(html);
  return html;
};

/**
 * Adjust head elements indentation
 * e.g.
 *  before
 *    html lang="en"
 *      head
 *        meta charset="utf-8"
 *    meta http-equiv="X-UA-Compatible" content="IE=edge"
 *    meta name="viewport" content="width=device-width, initial-scale=1"
 *    meta name="description" content="Webpack App"
 *        title Webpack App
 *  after
 *    html lang="en"
 *      head
 *        meta charset="utf-8"
 *        meta http-equiv="X-UA-Compatible" content="IE=edge"
 *        meta name="viewport" content="width=device-width, initial-scale=1"
 *        meta name="description" content="Webpack App"
 *        title Webpack App
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.adjustHeadElementsIndentation = function (html) {
  var self = this;
  var regExp = /^( *head\n)( *)([\s\S]*)(\n *body)/im;
  var match = regExp.exec(html);
  if (match) {
    var indent = match[2];
    var elements = match[3].split('\n').map(function(v) {
      return indent + v.trim();
    });
    html = html.replace(regExp, match[1] + elements.join('\n') + match[4]);
  }
  return html;
}

/**
 * Adjust body elements indentation
 * !Operation guarantee of this function is limited 
 * e.g.
 *  before
 *    body#body.main
 *      h1 Main
 *      img src="logo.png"
 *      h2 Markup examples
 *
 *  #content
 *    p This example shows you what a basic Slim file looks like.
 *    p
 *      | No items found.  Please add some inventory.
 *        Thank you!
 *
 *  div id="footer"
 *    | Footer content
 *  after
 *    body#body.main
 *      h1 Main
 *      img src="logo.png"
 *      h2 Markup examples
 *
 *      #content
 *        p This example shows you what a basic Slim file looks like.
 *        p
 *          | No items found.  Please add some inventory.
 *            Thank you!
 *
 *      div id="footer"
 *        | Footer content
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.adjustBodyElementsIndentation = function (html) {
  var self = this;
  var regExp = /^( *)(body.*\n)( *[\s\S]*)/im;
  var match = regExp.exec(html);
  if (match) {
    var padding = false;
    var indent = match[1];
    var addIndent = indent.repeat(2);
    var elements = match[3].split('\n');
    var newElements = [];
    for (var i = 0; i < elements.length; i++) {
      var elm = elements[i];
      // Skip first element
      if (i === 0) {
        newElements.push(elm);
        continue;
      }
      // Skip blank element
      if (elm.trim() === '') {
        newElements.push(elm.trim());
        continue;
      }
      var m = /^( *).*$/i.exec(elm);
      // If the indentation is shallower than the body
      if (padding || (m && (m[1].length < indent.length))) {
        // After that, add indentation to all elements
        padding = true;
        elm = addIndent + elm;
      }
      newElements.push(elm);
    }
    html = html.replace(regExp, match[1] + match[2] + newElements.join('\n'));
  }
  return html;
}

/**
 * Injects the assets into the given file string
 */
HtmlWebpackSlimPlugin.prototype.injectAssetsIntoFile = function (htmlPluginData) {
  var self = this;
  var options = htmlPluginData.plugin.options;
  var assets = htmlPluginData.assets
  var html = htmlPluginData.html;
  var hasTemplate = self.hasTemplate(options.template);
  if (!hasTemplate) {
    html = html.replace(/\r?\n[ ]*/g, '');
  }

  var styles = self.headExtraction(html).map(function (e) {
    return e.match(/title>.*<\/title/i) ? 'title ' + options.title : e;
  });
  var scripts = self.bodyExtraction(html);
  var file = hasTemplate ? self.removeUnnecessaryTags(html) : self.defaultTemplate();

  return self.injectAssets(file, styles, scripts, assets);
};

/**
 * Default template
 */
HtmlWebpackSlimPlugin.prototype.hasTemplate = function (filename) {
  var ext = filename.split('.').pop();
  return ext === 'slim' || ext === 'js';
};

/**
 * Default template
 */
HtmlWebpackSlimPlugin.prototype.defaultTemplate = function () {
  return '\
doctype html\n\
html\n\
  head\n\
  body';
};

/**
 * Extract the style tags from head
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.headExtraction = function (html) {
  var regExp = /<head><(.*)><\/head>/i;
  var match = regExp.exec(html);
  if (!match || match.length < 2) {
    return [];
  }
  return match[1].split('><');
};

/**
 * Extract the script tags from body
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.bodyExtraction = function (html) {
  var regExp = /<(script.*)><\/script>/i;
  var match = regExp.exec(html);
  if (!match || match.length < 2) {
    return [];
  }
  return match[1].split('></script><');
};

/**
 * Remove html format tags
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.removeUnnecessaryTags = function (html) {
  var headRegExp = /<head><(.*)><\/head>/i;
  var bodyRegExp = /<(script.*)><\/script>/i;
  return html.replace(headRegExp, '').replace(bodyRegExp, '');
};

/**
 * Injects the assets into the given string
 * @param html htmlPluginData.html (Slim)
 * @param head inject in the head tag (e.g. style tag)
 * @param body inject in the body tag (e.g. script tag)
 * @param assets
 */
HtmlWebpackSlimPlugin.prototype.injectAssets = function (html, head, body, assets) {
  var self = this;
  var bodyRegExp = /^( *)(body)\b/im;
  var match = bodyRegExp.exec(html);
  if (match) {
    var headSpace = match[1];
    var hlSpace = headSpace.repeat(2);
    if (head.length) {
      head = head.map(function(v) {
        return hlSpace + v;
      });
      if (!/head/.test(html)) {
        head = [headSpace + 'head'].concat(head)
      }
      // Append assets to head element
      html = html.replace(bodyRegExp, head.join('\n') + '\n' + match[0]);
    }

    if (body.length) {
      body = body.map(function(v) {
        return hlSpace + v;
      });
      // Append scripts to the end of the html:
      if (html[html.length-1] != '\n') {
        html += '\n'
      }
      html += body.join('\n');
    }
  }

  // Inject manifest into the opening html tag
  if (assets.manifest) {
    html = html.replace(/^(html.*)$/im, function (match, start) {
      // Append the manifest only if no manifest was specified
      if (/\smanifest\s*=/.test(match)) {
        return match;
      }
      return start + ' manifest="' + assets.manifest + '"';
    });
  }
  return html;
};

module.exports = HtmlWebpackSlimPlugin;
