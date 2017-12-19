# babel-plugin-transform-amd-to-commonjs

[![npm version](https://img.shields.io/npm/v/babel-plugin-transform-amd-to-commonjs.svg)](https://www.npmjs.com/package/babel-plugin-transform-amd-to-commonjs)
[![npm downloads](https://img.shields.io/npm/dm/babel-plugin-transform-amd-to-commonjs.svg)](https://npm-stat.com/charts.html?package=babel-plugin-transform-amd-to-commonjs)
[![Build Status](https://travis-ci.org/msrose/babel-plugin-transform-amd-to-commonjs.svg?branch=master)](https://travis-ci.org/msrose/babel-plugin-transform-amd-to-commonjs)
[![codecov](https://codecov.io/gh/msrose/babel-plugin-transform-amd-to-commonjs/branch/master/graph/badge.svg)](https://codecov.io/gh/msrose/babel-plugin-transform-amd-to-commonjs)
[![devDependencies Status](https://david-dm.org/msrose/babel-plugin-transform-amd-to-commonjs/dev-status.svg)](https://david-dm.org/msrose/babel-plugin-transform-amd-to-commonjs?type=dev)
[![Greenkeeper badge](https://badges.greenkeeper.io/msrose/babel-plugin-transform-amd-to-commonjs.svg)](https://greenkeeper.io/)

Babel plugin that transforms AMD to CommonJS.
[Check out the example project](https://github.com/msrose/transform-amd-to-commonjs-example), which uses this plugin to allow [jest](https://facebook.github.io/jest/) to synchronously `require` AMD modules.

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

## Examples

### Define

Input:

```javascript
define(['jquery', 'underscore', 'myModule'], function($, _) {
  // ...
  return {
    // ...
  };
});
```

Output:

```javascript
module.exports = function() {
  var $ = require('jquery');
  var _ = require('underscore');
  require('myModule');
  // ...
  return {
    // ...
  };
}();
```

### Require

Input:

```javascript
// Nested requires
require(['jquery', 'underscore', 'myModule'], function($, _) {
  // ...
  require(['anotherModule'], function(anotherModule) {
    // ...
  });
});
```

Output:

```javascript
(function() {
  var $ = require('jquery');
  var _ = require('underscore');
  require('myModule');
  // ...
  (function() {
    var anotherModule = require('anotherModule');
    // ...
  })();
})();
```

## Details

Only Node.js >= 6 is supported. For Node.js 4, please use version 0.2.2:

```
npm install --save-dev babel-plugin-transform-amd-to-commonjs@0.2.2
```

AMD is interpreted as described and implemented by [RequireJS](http://requirejs.org/).

- Only _top-level_ calls to a `define` function will be transformed.
- _All_ calls to `require` where it is given an array of dependencies as its first argument will be transformed.
  - If you would like the option to only transform top-level require calls, please file an issue.
- Explicitly requiring `require`, `module`, and `exports` in an AMD module will not generate a call to require, but instead defer to the global require, module, and exports assumed to be in the CommonJS environment you are transforming to.
  - The same is true for the [simplified CommonJS wrapper](http://requirejs.org/docs/api.html#cjsmodule).
- The module name (optional first argument to `define`) is ignored, since the module ID in CommonJS is determined by the resolved filename.

## Caveats

### One module per file

Make sure that you have only one AMD module defined per file, otherwise you'll experience strange results once transformed to the CommonJS format.

### Listing module dependencies and callbacks inline

The following will _not_ be transformed, since the plugin does not traverse the arguments to define or require:

```javascript
// DON'T DO THIS! It won't be transformed.
var dependencies = ['one', 'two'];
var factory = function(one, two) {
  one.doStuff();
  return two.doStuff();
};
define(dependencies, factory);
```

If you want to be able to define your modules as above, please submit an issue. Otherwise, please define your modules as:

```javascript
define(['one', 'two'], function(one, two) {
  one.doStuff();
  return two.doStuff();
});
```

### Injecting `require`, `module`, or `exports` as dependencies

It is strongly advised to simply use return statements to define your AMD module's exports.
That being said, the plugin takes into account the cases where you may have injected them as dependencies.
Beware of the following gotchas when using this pattern:

- If you're injecting `module`, `exports`, and/or `require` as dependencies, they must be injected as string literals,
otherwise you'll end up with things like `require('module')`.
- Returning any value other than `undefined` from a factory function will override anything you assign to `module` or `exports`.
  This behaviour is in accordance with the AMD specification.
  Unless you're doing something really weird in your modules, you don't have to worry about this case, but the plugin handles it by performing a check as needed on the return value of the factory function.
  For example:

  Input (AMD):
  ```javascript
  define(['module'], function(module) {
    module.exports = { hey: 'boi' };
    return { value: 22 };
  });
  ```

  Output (CommonJS):
  ```javascript
  var amdDefineResult = function() {
    module.exports = { hey: 'boi' };
    return { value: 22 };
  }();
  typeof amdDefineResult !== 'undefined' && (module.exports = amdDefineResult);
  ```

  Note that `{ value: 22 }` is correctly exported in both cases. Without the `typeof amdDefineResult !== 'undefined'` check in place, `{ hey: 'boi' }` would have been erroneously exported once transformed to CommonJS.

  This pattern is only used if necessary. The variable `amdDefineResult` is generated to be unique in its scope.
