# babel-plugin-transform-amd-to-commonjs

Babel plugin that transforms AMD to CommonJS.

## Usage

```
npm install --save-dev babel-plugin-transform-amd-to-commonjs
```

Add the transform to your .babelrc:

```
{
  "plugins": ["transform-amd-to-commonjs"]
}
```

Input (define):

```javascript
define(['jquery', 'underscore', 'myModule'], function($, _) {
  var $divs = $('div');
  return {
    divs: _.filter($divs, function(div) {
      return div.hasChildNodes();
    });
  };
});
```

Output (define):

```javascript
module.exports = function() {
  var $ = require('jquery');
  var _ = require('underscore');
  require('myModule');
  return {
    divs: _.filter($divs, function(div) {
      return div.hasChildNodes();
    });
  };
}();
```

Input (require):

```javascript
require(['jquery', 'underscore', 'myModule'], function($, _) {
  $(document).append($('<div>').text(_.random(10)));
  require(['anotherModule'], function(anotherModule) {
    anotherModule.doSomeStuff(_.random(10));
  });
});
```

Output (require):

```javascript
(function() {
  var $ = require('jquery');
  var _ = require('underscore');
  require('myModule');
  $(document).append($('<div>').text(_.random(10)));
  (function() {
    var anotherModule = require('anotherModule');
    anotherModule.doSomeStuff(_.random(10));
  })();
})();
```

## Details

AMD is interpreted as described and implemented by [RequireJS](http://requirejs.org/).

- Only **top-level** calls to a `define` function will be transformed.
- **All** calls to `require` where it is given an array of dependencies as its first argument will be transformed.
  - If you would like the option to only transform top-level require calls, please file an issue.
- Explicitly requiring `require`, `module`, and `exports` in an AMD module will not generate a call to require, but instead defer to the global require, module, and exports assumed to be in the CommonJS environment you are transforming to.
  - The same is true for the [simplified CommonJS wrapper](http://requirejs.org/docs/api.html#cjsmodule).
