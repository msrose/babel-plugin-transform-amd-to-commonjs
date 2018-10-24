# babel-plugin-transform-amd-to-commonjs

[![npm version](https://img.shields.io/npm/v/babel-plugin-transform-amd-to-commonjs.svg)](https://www.npmjs.com/package/babel-plugin-transform-amd-to-commonjs)
[![npm downloads](https://img.shields.io/npm/dm/babel-plugin-transform-amd-to-commonjs.svg)](https://npm-stat.com/charts.html?package=babel-plugin-transform-amd-to-commonjs)
[![Build Status](https://travis-ci.org/msrose/babel-plugin-transform-amd-to-commonjs.svg?branch=master)](https://travis-ci.org/msrose/babel-plugin-transform-amd-to-commonjs)
[![codecov](https://codecov.io/gh/msrose/babel-plugin-transform-amd-to-commonjs/branch/master/graph/badge.svg)](https://codecov.io/gh/msrose/babel-plugin-transform-amd-to-commonjs)
[![devDependencies Status](https://david-dm.org/msrose/babel-plugin-transform-amd-to-commonjs/dev-status.svg)](https://david-dm.org/msrose/babel-plugin-transform-amd-to-commonjs?type=dev)
[![Greenkeeper badge](https://badges.greenkeeper.io/msrose/babel-plugin-transform-amd-to-commonjs.svg)](https://greenkeeper.io/)

Babel plugin that transforms AMD to CommonJS.
[Check out the example project](https://github.com/msrose/babel-plugin-transform-amd-to-commonjs/tree/master/examples/transform-amd-to-commonjs-example#transform-amd-to-commonjs-example), which uses this plugin to allow [jest](https://facebook.github.io/jest/) to synchronously `require` AMD modules.

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

## Options 

Specify options in your .babelrc:

```
{
  "plugins": [
    ["transform-amd-to-commonjs", { "restrictToTopLevelDefine": true }]
  ]
}
```

- `restrictToTopLevelDefine`: (default: `true`) When `true`, only transform `define` calls that appear at the top-level of a program. Set to `false` to transform _all_ calls to `define`.

## Details

### Supported Versions

Only Node.js >= 6 is supported. For Node.js 4, please use version 0.2.2:

```
npm install --save-dev babel-plugin-transform-amd-to-commonjs@0.2.2
```

While this plugin lists @babel/core@^7.0.0 as a peer dependency, it should still work fine with babel-core@^6.0.0.
Listing this peer dependency aligns with [what is done by the core babel plugins](https://babeljs.io/docs/en/v7-migration#versioning-dependencies-blog-2017-12-27-nearing-the-70-releasehtml-peer-dependencies-integrations).

### AMD

AMD is interpreted as described by the [AMD specification](https://github.com/amdjs/amdjs-api/blob/master/AMD.md).

- By default, only _top-level_ calls to a `define` function will be transformed. Use the `restrictToTopLevelDefine` option to transform calls that are not at the top-level.
- _All_ calls to `require` where it is given an array of dependencies as its first argument will be transformed.
- Explicitly requiring `require`, `module`, and `exports` in an AMD module will not generate a call to require, but instead defer to the global require, module, and exports assumed to be in the CommonJS environment you are transforming to.
  - The same is true for the [simplified CommonJS wrapper](http://requirejs.org/docs/api.html#cjsmodule).
- The module name (optional first argument to `define`) is ignored, since the module ID in CommonJS is determined by the resolved filename.

### Upgrading Versions

#### 1.0.0

- Versions >= 0.2.1 and &lt; 1.0.0 support Node.js 4.
  1.0.0 and above only support Node.js 6 and above.
  To upgrade to >= 1.0.0, first upgrade to Node.js >= 6.
- If everything works fine with &lt; 1.0.0, you should just be able to drop in >= 1.0.0 after upgrading Node.js.
  If you have any issues, there is one more edge-case breaking change that _might_ be affecting you (but probably is not):
  - &gt;= 1.0.0 accounts for the case where you're using a combination of return statements and module/exports to define the exports of your AMD modules.
    Earlier versions don't account for this case, so if you're upgrading, make sure that each AMD module only uses either return statements _or_ module/exports to define its exports.
    See [#26](https://github.com/msrose/babel-plugin-transform-amd-to-commonjs/pull/26) and the [caveats](#injecting-require-module-or-exports-as-dependencies) section of the README for more details.

## Caveats

### One module per file

Make sure that you have only one AMD module defined per file, otherwise you'll experience strange results once transformed to the CommonJS format.

### Listing module dependencies inline

The following will _not_ be transformed, since the plugin only accounts for dependencies that are specified using an inline array literal:

```javascript
// DON'T DO THIS! It won't be transformed correctly.
var dependencies = ['one', 'two'];
define(dependencies, function(one, two) {
  one.doStuff();
  return two.doStuff();
});
```

If you want to be able to define your dependencies as above, please submit an issue. Otherwise, please define your modules as:

```javascript
define(['one', 'two'], function(one, two) {
  one.doStuff();
  return two.doStuff();
});
```

However, specifying the factory as a variable _is_ supported (but only for calls to `define`):

```javascript
// All's good! Transforming this code is supported
var factory = function(one, two) {
  one.doStuff();
  return two.doStuff();
};
define(['one', 'two'], factory);
```

A runtime check has to be done to determine what to export, so the transformed code looks like this:

```javascript
var factory = function(one, two) {
  one.doStuff();
  return two.doStuff();
};
var maybeFactory = factory;
if (typeof maybeFactory === 'function') {
  module.exports = factory(require('one'), require('two'));
} else {
  require('one');
  require('two');
  module.exports = maybeFactory;
};
```

It looks a bit weird, but it's all necessary.
Keep in mind that everything is done with static analysis, so if the factory isn't specified as an inline function literal, it's impossible to tell exactly what value it will take until runtime.

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

  Note that `{ value: 22 }` is correctly exported in both cases.
  Without the `typeof amdDefineResult !== 'undefined'` check in place, `{ hey: 'boi' }` would have been erroneously exported once transformed to CommonJS, since the plugin would otherwise transform this module to just:

  ```javascript
  (function() {
    module.exports = { hey: 'boi' };
    return { value: 22 };
  })()
  ```

  This pattern is only used if necessary. The variable `amdDefineResult` is generated to be unique in its scope.
