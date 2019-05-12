'use strict';

var assert = require('assert');

function HtmlWebpackSlimPlugin (options) {
  assert.equal(options, undefined, 'The HtmlWebpackSlimPlugin does not accept any options');
}

HtmlWebpackSlimPlugin.prototype.apply = function (compiler) {
  var pluginName = 'HtmlWebpackSlimPlugin';
  var self = this;
  // Hook into the html-webpack-plugin processing
  var beforeAssetsInjection = function (htmlPluginData, callback) {
    self.preProcessHtml(htmlPluginData, callback);
  }
  var afterAssetsInjection = function (htmlPluginData, callback) {
    self.postProcessHtml(htmlPluginData, callback);
  }
  // Webpack 4+
  if (compiler.hooks) {
    compiler.hooks.compilation.tap(pluginName, function (compilation) {
      var myHooks = (function (comp) {
        if (comp.hooks.htmlWebpackPluginBeforeHtmlGeneration) {
          // HtmlWebPackPlugin 3.x
          return [
            { hook: comp.hooks.htmlWebpackPluginBeforeHtmlProcessing, func: beforeAssetsInjection},
            { hook: comp.hooks.htmlWebpackPluginAfterHtmlProcessing, func: afterAssetsInjection},
          ];
        } else {
          // HtmlWebPackPlugin 4.x
          var HtmlWebpackPlugin = require('html-webpack-plugin');
          var hooks = HtmlWebpackPlugin.getHooks(comp);
          return [
            { hook: hooks.afterTemplateExecution, func: beforeAssetsInjection},
            { hook: hooks.beforeEmit, func: afterAssetsInjection},
          ];
        }
      })(compilation);
      myHooks.forEach(function (v) {
        v.hook.tapAsync(pluginName, v.func);
      })
    });
  } else {
    compiler.plugin('compilation', function (compilation) {
      compilation.plugin('html-webpack-plugin-before-html-processing', beforeAssetsInjection);
      compilation.plugin('html-webpack-plugin-after-html-processing', afterAssetsInjection);
    });
  }
};

// HtmlWebpackSlimPlugin.prototype.apply = function (compiler) {
//   var self = this;
//   // Hook into the html-webpack-plugin processing
//   var beforeProcessing = {
//     name: 'html-webpack-plugin-before-html-processing',
//     cb: function (htmlPluginData, callback) {
//       self.preProcessHtml(htmlPluginData, callback);
//     }
//   }
//   var afterProcessing = {
//     name: 'html-webpack-plugin-after-html-processing',
//     cb: function (htmlPluginData, callback) {
//       self.postProcessHtml(htmlPluginData, callback);
//     }
//   }
//   if (compiler.hooks) {
//     // setup hooks for webpack 4
//     compiler.hooks.compilation.tap('HtmlWebpackSlimPlugin', function (compilation) {
//       compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tapAsync(beforeProcessing.name, beforeProcessing.cb);
//       compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tapAsync(afterProcessing.name, afterProcessing.cb);
//     });
//   } else {
//     compiler.plugin('compilation', function (compilation) {
//       compilation.plugin(beforeProcessing.name, beforeProcessing.cb);
//       compilation.plugin(afterProcessing.name, afterProcessing.cb);
//     });
//   }
// };

/**
 * Is it processing target
 * @param htmlPluginData
 * @return bool processing target -> true
 */
HtmlWebpackSlimPlugin.prototype.isProcessingTarget = function (htmlPluginData) {
  var target = ['slim'];
  var ext = htmlPluginData.outputName.split('.').pop();
  var fileType = htmlPluginData.plugin.options.filetype;
  // If the plugin configuration set `filename` extension or `filetype` to 'slim'
  return target.indexOf(ext) >= 0 || target.indexOf(fileType) >= 0;
};

/**
 * Process the generated HTML（before assets injection）
 */
HtmlWebpackSlimPlugin.prototype.preProcessHtml = function (htmlPluginData, callback) {
  var self = this;
  if (self.isProcessingTarget(htmlPluginData)) {
    // do not minify
    htmlPluginData.plugin.options.minify = false;
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
  // If the plugin configuration set `inject` to true and (set `filename` extension or `filetype` to 'slim')
  if (options.inject && self.isProcessingTarget(htmlPluginData)) {
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
  html = self.deleteExtraNewlines(html);
  html = self.adjustHeadElementsIndentation(html);
  html = self.adjustBodyElementsIndentation(html);
  return html;
};

/**
 * Delete trailing extra newlines
 * e.g.
 *  before
 *   %div{ :id =>'footer' }
 *     Footer content
 *
 *
 *  after
 *   %div{ :id =>'footer' }
 *     Footer content
 *
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.deleteExtraNewlines = function (html) {
  return html.replace(/(\r?\n){2,}$/im, '$1');
}

/**
 * Adjust head elements indentation
 * e.g.
 *  before
 *    html lang="en"
 *      head
 *        meta charset="utf-8"
 *        meta http-equiv="X-UA-Compatible" content="IE=edge"
 *    meta name="viewport" content="width=device-width, initial-scale=1"
 *    meta name="description" content="Webpack App"
 *        title
 *          - if i.odd?
 *            HtmlWebpackPlugin example
 *          - else
 *            Webpack App
 *  after
 *    html lang="en"
 *      head
 *        meta charset="utf-8"
 *        meta http-equiv="X-UA-Compatible" content="IE=edge"
 *        meta name="viewport" content="width=device-width, initial-scale=1"
 *        meta name="description" content="Webpack App"
 *        title
 *          - if i.odd?
 *            HtmlWebpackPlugin example
 *          - else
 *            Webpack App
 * @param html htmlPluginData.html (Slim)
 */
HtmlWebpackSlimPlugin.prototype.adjustHeadElementsIndentation = function (html) {
  var self = this;
  var regExp = /^([ |\t]*head\n)([ |\t]*)([\s\S]*)(\n[ |\t]*body)/im;
  var match = regExp.exec(html);
  if (match) {
    var indent = match[2];
    var elements = match[3].split('\n').map(function(v) {
      var m = /^([\s]*).*$/g.exec(v);
      return (m[1] === '' ? indent : '') + v.replace(/[ 　]+$/, '');
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
  var regExp = function(html) {
    var h = /^([ |\t]*)head/im.exec(html);
    var topSpace = h ? h[1] : '[ |\t]*';
    return new RegExp('^(' + topSpace + ')(body.*\\n)([ |\t]*[\\s\\S]*)', 'im');;
  }(html);
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
      var m = /^([ |\t]*).*$/i.exec(elm);
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
  var assets = self.getAssets(htmlPluginData);
  var html = htmlPluginData.html;
  var hasTemplate = ('templateContent' in options && options.filetype === 'slim') || self.hasTemplate(options.template);
  if (!hasTemplate) {
    html = html.replace(/\r?\n[ ]*/g, '');
  }

  var styles = self.headExtraction(html).map(function (e) {
    return e.match(/title>.*<\/title/i) ? 'title ' + options.title : e;
  });
  var scripts = htmlPluginData.plugin.options.inject !== 'head' ? self.bodyExtraction(html) : [];
  var file = hasTemplate ? self.removeUnnecessaryTags(html) : self.defaultTemplate();

  return self.injectAssets(file, styles, scripts, assets);
};

/**
 * Is a valid template file set?
 * @param filename template file name
 */
HtmlWebpackSlimPlugin.prototype.hasTemplate = function (filename) {
  var ext = filename.split('.').pop();
  return ['slim', 'js'].indexOf(ext) >= 0;
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
 * Get Assets
 * @param html htmlPluginData
 */
HtmlWebpackSlimPlugin.prototype.getAssets = function (htmlPluginData) {
  if (htmlPluginData.assets) {
    return htmlPluginData.assets;
  }
  return (function (str) {
    var regExp = /([\w-]*\.appcache)/i;
    var match = regExp.exec(str);
    if (!match || match.length < 2) {
      return undefined;
    }
    return { manifest: match[1] };
  })(htmlPluginData.plugin.assetJson);
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
  return match[1].split('><').filter(function(v) { return !v.startsWith('/') });
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
  var regExp = function(html) {
    var h = /^([ |\t]*)head/im.exec(html);
    var topSpace = h ? h[1] : '[ |\t]*';
    return new RegExp('^(' + topSpace + ')(body)\\b', 'im');;
  }(html);
  var match = regExp.exec(html);
  if (match) {
    var headSpace = match[1];
    var hlSpace = function(space, html) {
      // delete extra space (left space of html tag)
      var m = /^([ |\t]*)html/im.exec(html);
      return m ? space.replace(m[1], '') : space;
    }(headSpace.repeat(2), html);
    if (head.length) {
      head = head.map(function(v) {
        return hlSpace + v;
      });
      if (!/head/.test(html)) {
        head = [headSpace + 'head'].concat(head)
      }
      // Append assets to head element
      html = html.replace(regExp, head.join('\n') + '\n' + match[0]);
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
  if (assets) {
    html = self.injectManifest(html, assets.manifest);
  }
  return html;
};

/**
 * Inject manifest into the opening html tag
 * @param html htmlPluginData.html (Slim)
 * @param manifest
 */
HtmlWebpackSlimPlugin.prototype.injectManifest = function (html, manifest) {
  if (!manifest) {
    return html;
  }
  return html.replace(/^([ |\t]*html.*)$/im, function (match, start) {
    // Append the manifest only if no manifest was specified
    if (/\smanifest\s*=/.test(match)) {
      return match;
    }
    return start + ' manifest="' + manifest + '"';
  });
};

module.exports = HtmlWebpackSlimPlugin;
