'use strict';

const { TRANSFORM_AMD_TO_COMMONJS_IGNORE } = require('../src/constants');

describe('Plugin for require blocks', () => {
  it('transforms require blocks with one dependency', () => {
    expect(`
      require(['llamas'], function(llama) {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (function() {
        var llama = require('llamas');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks with multiple dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], function(llama, frog) {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `).toBeTransformedTo(`
      (function() {
        var llama = require('llamas');
        var frog = require('frogs');
        llama.doSomeStuff();
        frog.sayRibbit();
      })();
    `);
  });

  it('transforms require blocks with unused dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], function(llama) {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (function() {
        var llama = require('llamas');
        require('frogs');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks that have no factory function', () => {
    expect(`
      require(['here', 'are', 'some', 'deps']);
    `).toBeTransformedTo(`
      require('here');
      require('are');
      require('some');
      require('deps');
    `);
  });

  it('transforms nested require blocks that have no factory function', () => {
    expect(`
      require(['here', 'is', 'i'], function(here) {
        here.doStuff();
        require(['yep', 'that', 'me']);
      });
    `).toBeTransformedTo(`
      (function() {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        require('yep');
        require('that');
        require('me');
      })();
    `);
  });

  it('transforms nested require blocks that have a factory function', () => {
    expect(`
      require(['here', 'is', 'i'], function(here) {
        here.doStuff();
        require(['yep', 'that', 'me'], function(yep) {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      (function() {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        (function() {
          var yep = require('yep');
          require('that');
          require('me');
          yep.doStuff();
        })();
      })();
    `);
  });

  it('transforms a require block that is within a define block', () => {
    expect(`
      define(['here', 'is', 'i'], function(here) {
        here.doStuff();
        require(['yep', 'that', 'me'], function(yep) {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      module.exports = (function() {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        (function() {
          var yep = require('yep');
          require('that');
          require('me');
          yep.doStuff();
        })();
      })();
    `);
  });

  it('transforms factories that use the rest operator', () => {
    expect(`
      require(['dep1', 'dep2', 'dep3'], function(dep, ...rest) {
        dep.doStuff()
      })
    `).toBeTransformedTo(`
      (function() {
        var dep = require('dep1');
        var rest = [require('dep2'), require('dep3')];
        dep.doStuff();
      })();
    `);
  });

  it('transforms factories that use the rest operator including AMD keywords', () => {
    expect(`
      require(['dep1', 'dep2', 'module', 'exports', 'require'], function(dep, ...rest) {
        dep.doStuff();
      });
    `).toBeTransformedTo(`
      (function() {
        var dep = require('dep1');
        var rest = [require('dep2'), module, exports, require];
        dep.doStuff();
      })();
    `);
  });

  it('transforms factories that use the rest operator when there are no rest arguments', () => {
    expect(`
      require(['dep1'], function(dep, ...rest) {
        dep.doStuff();
      });
    `).toBeTransformedTo(`
      (function() {
        var dep = require('dep1');
        var rest = [];
        dep.doStuff();
      })();
    `);
  });

  it('ignores modules that have been excluded by block comments', () => {
    const program = `
      /* ${TRANSFORM_AMD_TO_COMMONJS_IGNORE} */
      require(['llamas', 'frogs'], function(llama, frog) {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `;
    expect(program).toBeTransformedTo(program);
  });

  it('ignores modules that have been excluded by line comments', () => {
    const program = `
      // ${TRANSFORM_AMD_TO_COMMONJS_IGNORE}
      require(['llamas', 'frogs'], function(llama, frog) {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `;
    expect(program).toBeTransformedTo(program);
  });

  it.each([TRANSFORM_AMD_TO_COMMONJS_IGNORE, 'a really nice comment'])(
    'transforms normally with non-top-level block comments',
    (comment) => {
      expect(`
        require(['llamas', 'frogs'], function(llama, frog) {
          /* ${comment} */
          llama.doSomeStuff();
          frog.sayRibbit();
        });
      `).toBeTransformedTo(`
        (function() {
          var llama = require('llamas');
          var frog = require('frogs');
          /* ${comment} */
          llama.doSomeStuff();
          frog.sayRibbit();
        })();
      `);
    }
  );

  it.each([TRANSFORM_AMD_TO_COMMONJS_IGNORE, 'a really nice comment'])(
    'transforms normally with non-top-level line comments',
    (comment) => {
      expect(`
        require(['llamas', 'frogs'], function(llama, frog) {
          // ${comment}
          llama.doSomeStuff();
          frog.sayRibbit();
        });
      `).toBeTransformedTo(`
        (function() {
          var llama = require('llamas');
          var frog = require('frogs');
          // ${comment}
          llama.doSomeStuff();
          frog.sayRibbit();
        })();
      `);
    }
  );

  it.each(['random comment', 'transform-amd-to-commonjs'])(
    'transforms normally with random top-level comments',
    (comment) => {
      expect(`
        /* ${comment} */
        // ${comment}
        require(['llamas', 'frogs'], function(llama, frog) {
          llama.doSomeStuff();
          frog.sayRibbit();
        });
      `).toBeTransformedTo(`
        /* ${comment} */
        // ${comment}
        (function() {
          var llama = require('llamas');
          var frog = require('frogs');
          llama.doSomeStuff();
          frog.sayRibbit();
        })();
      `);
    }
  );

  it('transforms require with non-array dependency list', () => {
    expect(`
      require(deps, function(foo, bar) {
        foo.doSomething();
        bar.doSomethingElse();
      });
    `).toBeTransformedTo(`
      (function () {
        var maybeFunction = function (foo, bar) {
          foo.doSomething();
          bar.doSomethingElse();
        };
        var amdDeps = deps;
        if (amdDeps === null || typeof amdDeps !== "object" || isNaN(amdDeps.length)) {
          return require(amdDeps);
        }
        amdDeps = [].slice.call(amdDeps);
        maybeFunction.apply(void 0, amdDeps.map(function (dep) {
          return {
            require: require,
            module: module,
            exports: module.exports
          }[dep] || require(dep);
        }));
      }).apply(this);
    `);
  });

  it('transforms require with non-function factory', () => {
    expect(`
      require(['dep1', 'dep2'], factory);
    `).toBeTransformedTo(`
      (function () {
        var maybeFunction = factory;
        var amdDeps = ['dep1', 'dep2'];
        if (typeof maybeFunction !== "function") {
          maybeFunction = function () {};
        }
        maybeFunction.apply(void 0, amdDeps.map(function (dep) {
          return {
            require: require,
            module: module,
            exports: module.exports
          }[dep] || require(dep);
        }));
      }).apply(this);
    `);
  });

  it('transforms require with non-array dependencies and non-function factory', () => {
    expect(`
      require(deps, factory);
    `).toBeTransformedTo(`
      (function () {
        var maybeFunction = factory;
        var amdDeps = deps;
        if (amdDeps === null || typeof amdDeps !== "object" || isNaN(amdDeps.length)) {
          return require(amdDeps);
        }
        amdDeps = [].slice.call(amdDeps);
        if (typeof maybeFunction !== "function") {
          maybeFunction = function () {};
        }
        maybeFunction.apply(void 0, amdDeps.map(function (dep) {
          return {
            require: require,
            module: module,
            exports: module.exports
          }[dep] || require(dep);
        }));
      }).apply(this);
    `);
  });
});
