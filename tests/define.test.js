'use strict';

const {
  AMD_DEFINE_RESULT,
  MAYBE_FUNCTION,
  TRANSFORM_AMD_TO_COMMONJS_IGNORE,
} = require('../src/constants');
const { checkAmdDefineResult, checkMaybeFunction, checkVarArgsResult } = require('./test-helpers');

describe('Plugin for define blocks', () => {
  it('transforms anonymous define blocks with one dependency', () => {
    expect(`
      define(['stuff'], function(donkeys) {
        return {
          llamas: donkeys.version
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var donkeys = require('stuff');
        return {
          llamas: donkeys.version
        };
      }();
    `);
  });

  it('transforms anonymous define blocks with multiple dependencies', () => {
    expect(`
      define(['stuff', 'here'], function(donkeys, aruba) {
        return {
           llamas: donkeys.version,
           cows: aruba.hi
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var donkeys = require('stuff');
        var aruba = require('here');
        return {
          llamas: donkeys.version,
          cows: aruba.hi
        };
      }();
    `);
  });

  it('transforms anonymous define blocks with unused dependencies', () => {
    expect(`
      define(['stuff', 'here'], function(donkeys) {
        return {
           llamas: donkeys.version
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var donkeys = require('stuff');
        require('here');
        return {
          llamas: donkeys.version
        };
      }();
    `);
  });

  it('only transforms define blocks at the top level by default', () => {
    const program = `
      if(someDumbCondition) {
        define(['stuff'], function(stuff) {
          return { hi: 'world' };
        });
      }
    `;
    expect(program).toBeTransformedTo(program);
  });

  it('transforms non-top-level define blocks when the option is specified', () => {
    expect({
      options: { restrictToTopLevelDefine: false },
      program: `
        if(someDumbCondition) {
          define(['stuff'], function(stuff) {
            return { hi: 'world' };
          });
        }
      `,
    }).toBeTransformedTo(`
      if(someDumbCondition) {
        module.exports = (function() {
          var stuff = require('stuff');
          return { hi: 'world' };
        })();
      }
    `);
  });

  it('transforms anonymous define blocks with no dependency list', () => {
    expect(`
      define(function() {
        return {
           llamas: 'donkeys'
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        return {
          llamas: 'donkeys'
        };
      }();
    `);
  });

  it('transforms dependencies listed as variables', () => {
    expect(`
      var dependency = 'hey';
      define([dependency], function(here) {
        return {
           llamas: here.hi
        };
      });
    `).toBeTransformedTo(`
      var dependency = 'hey';
      module.exports = function() {
        var here = require(dependency);
        return {
          llamas: here.hi
        };
      }();
    `);
  });

  it('transforms named define blocks with dependencies', () => {
    expect(`
      define('thismoduletho', ['hi'], function(here) {
        return {
           llamas: here.hi
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var here = require('hi');
        return {
          llamas: here.hi
        };
      }();
    `);
  });

  it('transforms named define blocks with no dependency list', () => {
    expect(`
      define('thismoduletho', function() {
        return {
           llamas: 'they are fluffy'
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        return {
          llamas: 'they are fluffy'
        };
      }();
    `);
  });

  it('does not require a dependency named `require`', () => {
    expect(`
      define(['require'], function(require) {
        var x = require('x');
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var x = require('x');
      }();
    `);
  });

  it('does not require a dependency named `require` which has been renamed', () => {
    expect(`
      define(['require'], function(abc) {
        var x = abc('x');
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var abc = require;
        var x = abc('x');
      }();
    `);
  });

  it('handles injection of a dependency named `module`', () => {
    expect(`
      define(['module'], function(module) {
        module.exports = { hey: 'boi' };
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        function() {
          module.exports = { hey: 'boi' };
        }()
      `)
    );
  });

  it('handles injection of dependency named `module` which has been renamed', () => {
    expect(`
      define(['module'], function(abc) {
        abc.exports.hey = 'boi';
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        function() {
          var abc = module;
          abc.exports.hey = 'boi';
        }()
      `)
    );
  });

  it('handles injection of dependency named `exports`', () => {
    expect(`
      define(['exports'], function(exports) {
        exports.hey = 'boi';
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        function() {
          exports.hey = 'boi';
        }()
      `)
    );
  });

  it('handles injection of dependency named `exports` which has been renamed', () => {
    expect(`
      define(['exports'], function(abc) {
        abc.hey = 'boi';
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        function() {
          var abc = exports;
          abc.hey = 'boi';
        }()
      `)
    );
  });

  it('transforms the simplified commonjs wrapper', () => {
    expect(`
      define(function(require, exports, module) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (function(require, exports, module) {
          var stuff = require('hi');
          exports.hey = stuff.boi;
        })(require, exports, module)
      `)
    );
    expect(`
      define(function(require, exports) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (function(require, exports) {
          var stuff = require('hi');
          exports.hey = stuff.boi;
        })(require, exports)
      `)
    );
    expect(`
      define(function(require) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      module.exports = function(require) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      }(require);
    `);
  });

  it('transforms the simplified commonjs wrapper with weird variable names', () => {
    expect(`
      define(function(llamas, cows, bears) {
        var stuff = llamas('hi');
        cows.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (function(llamas, cows, bears) {
          var stuff = llamas('hi');
          cows.hey = stuff.boi;
        })(require, exports, module)
      `)
    );
    expect(`
      define(function(llamas, cows) {
        var stuff = llamas('hi');
        cows.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (function(llamas, cows) {
          var stuff = llamas('hi');
          cows.hey = stuff.boi;
        })(require, exports)
      `)
    );
    expect(`
      define(function(donkeys) {
        var stuff = donkeys('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      module.exports = function(donkeys) {
        var stuff = donkeys('hi');
        exports.hey = stuff.boi;
      }(require);
    `);
  });

  it('accounts for variable name conflicts when checking the result of `define`', () => {
    expect(`
      var ${AMD_DEFINE_RESULT} = 'for some reason I have this variable declared already';
      define(function(require, exports, module) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      var ${AMD_DEFINE_RESULT} = 'for some reason I have this variable declared already';
      ${checkAmdDefineResult(
        `
          (function(require, exports, module) {
            var stuff = require('hi');
            exports.hey = stuff.boi;
          })(require, exports, module)
        `,
        `_${AMD_DEFINE_RESULT}`
      )}
    `);
  });

  it("lets you declare a dependency as `module` even though that's crazy", () => {
    expect(`
      define(['notmodule'], function(module) {
        return {
          notmodule: module.notmodule
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var module = require('notmodule');
        return {
          notmodule: module.notmodule
        };
      }();
    `);
  });

  it("lets you declare a dependency as `exports` even though that's crazy", () => {
    expect(`
      define(['notexports'], function(exports) {
        return {
          notexports: exports.notexports
        };
      });
    `).toBeTransformedTo(`
      module.exports = function() {
        var exports = require('notexports');
        return {
          notexports: exports.notexports
        };
      }();
    `);
  });

  it('transforms non-function modules exporting objects with no dependencies', () => {
    expect(`
      define({ thismodule: 'is an object' });
    `).toBeTransformedTo(checkMaybeFunction("{ thismodule: 'is an object' }"));
  });

  it('transforms non-function modules exporting objects with dependencies', () => {
    expect(`
      define(['side-effect'], { thismodule: 'is an object' });
    `).toBeTransformedTo(checkMaybeFunction("{ thismodule: 'is an object' }", ['side-effect']));
  });

  it('transforms non-function modules exporting arrays with no dependencies', () => {
    expect(`
      define(['this', 'module', 'is', 'an', 'array']);
    `).toBeTransformedTo(checkMaybeFunction("['this', 'module', 'is', 'an', 'array']"));
  });

  it('transforms non-function modules exporting arrays with dependencies', () => {
    expect(`
      define(['side-effect'], ['this', 'module', 'is', 'an', 'array']);
    `).toBeTransformedTo(
      checkMaybeFunction("['this', 'module', 'is', 'an', 'array']", ['side-effect'])
    );
  });

  it('transforms non-function modules exporting primitives with no dependencies', () => {
    const primitives = ["'a string'", '33', 'true', 'false', 'null', 'undefined'];
    primitives.forEach((primitive) => {
      expect(`
        define(${primitive});
      `).toBeTransformedTo(checkMaybeFunction(primitive));
    });
  });

  it('handles non-function modules exporting primitives with dependencies', () => {
    const primitives = ["'a string'", '33', 'true', 'false', 'null', 'undefined'];
    primitives.forEach((primitive) => {
      expect(`
        define(['side-effect'], ${primitive});
      `).toBeTransformedTo(checkMaybeFunction(primitive, ['side-effect']));
    });
  });

  it('transforms non-function modules requiring `require` for some reason', () => {
    expect(`
      define(['require'], { some: 'stuff' });
    `).toBeTransformedTo(checkMaybeFunction("{ some: 'stuff' }", ['require']));
    expect(`
      define(['sup', 'require'], { some: 'stuff' });
    `).toBeTransformedTo(checkMaybeFunction("{ some: 'stuff' }", ['sup', 'require']));
  });

  it('transforms non-function modules requiring `exports` for some reason', () => {
    expect(`
      define(['exports'], { some: 'stuff' });
    `).toBeTransformedTo(checkMaybeFunction("{ some: 'stuff' }", ['exports']));
    expect(`
      define(['exports', 'dawg'], { some: 'stuff' });
    `).toBeTransformedTo(checkMaybeFunction("{ some: 'stuff' }", ['exports', 'dawg']));
  });

  it('transforms non-function modules requiring `module` for some reason', () => {
    expect(`
      define(['module'], { some: 'stuff' });
    `).toBeTransformedTo(checkMaybeFunction("{ some: 'stuff' }", ['module']));
    expect(`
      define(['module', 'lemon'], { some: 'stuff' });
    `).toBeTransformedTo(checkMaybeFunction("{ some: 'stuff' }", ['module', 'lemon']));
  });

  it('transforms named non-function modules with no dependencies', () => {
    expect(`
      define('auselessname', { thismodule: 'is an object' });
    `).toBeTransformedTo(checkMaybeFunction("{ thismodule: 'is an object' }"));
    expect(`
      define('auselessname', ['an', 'array', 'factory']);
    `).toBeTransformedTo(checkMaybeFunction("['an', 'array', 'factory']"));
  });

  it('transforms named non-function modules with dependencies', () => {
    expect(`
      define('auselessname', ['side-effect'], { thismodule: 'is an object' });
    `).toBeTransformedTo(checkMaybeFunction("{ thismodule: 'is an object' }", ['side-effect']));
    expect(`
      define('auselessname', ['side-effect'], ['an', 'array', 'factory']);
    `).toBeTransformedTo(checkMaybeFunction("['an', 'array', 'factory']", ['side-effect']));
  });

  it('checks non function-literal factories to see if they are actually functions', () => {
    const variableFactory = `
      var myVariableFactory = function(stuff, hi) {
        stuff.what(hi)
        return { great: 'stuff' };
      }
    `;
    expect(`
      ${variableFactory}
      define(['stuff', 'hi'], myVariableFactory)
    `).toBeTransformedTo(`
      ${variableFactory}
      ${checkMaybeFunction('myVariableFactory', ['stuff', 'hi'])}
    `);
  });

  it('accounts for the simplified commonjs wrapper when checking for functions', () => {
    const variableFactory = `
      var myVariableFactory = function(require, exports, module) {
        var stuff = require('stuff')
        module.exports = { stuff: stuff.stuff }
      }
    `;
    expect(`
      ${variableFactory}
      define(myVariableFactory)
    `).toBeTransformedTo(`
      ${variableFactory}
      ${checkMaybeFunction('myVariableFactory')}
    `);
  });

  it('gets a unique variable name if needed when checking for functions', () => {
    expect(`
      var ${MAYBE_FUNCTION} = 'forsomereasonthisexistsinscope'
      define({ my: 'config', object: 'lol' })
    `).toBeTransformedTo(`
      var ${MAYBE_FUNCTION} = 'forsomereasonthisexistsinscope'
      ${checkMaybeFunction("{ my: 'config', object: 'lol' }", null, `_${MAYBE_FUNCTION}`)}
    `);
  });

  it('transforms factories that use the rest operator', () => {
    expect(`
      define(['dep1', 'dep2', 'dep3'], function(dep, ...rest) {
        dep.doStuff();
      });
    `).toBeTransformedTo(`
      module.exports = (function() {
        var dep = require('dep1');
        var rest = [require('dep2'), require('dep3')];
        dep.doStuff();
      })();
    `);
  });

  it('transforms factories that use the rest operator including AMD keywords', () => {
    expect(`
      define(['dep1', 'dep2', 'module', 'exports', 'require'], function(dep, ...rest) {
        dep.doStuff();
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (function() {
          var dep = require('dep1');
          var rest = [require('dep2'), module, exports, require];
          dep.doStuff();
        })()
      `)
    );
  });

  it('transforms factories that use the rest operator when there are no rest arguments', () => {
    expect(`
      define(['dep1'], function(dep, ...rest) {
        dep.doStuff();
      });
    `).toBeTransformedTo(`
      module.exports = (function() {
        var dep = require('dep1');
        var rest = [];
        dep.doStuff();
      })();
    `);
  });

  it('ignores modules that have been excluded by block comments', () => {
    const program = `
      /* ${TRANSFORM_AMD_TO_COMMONJS_IGNORE} */
      define(['stuff', 'here'], function(donkeys, aruba) {
        return {
           llamas: donkeys.version,
           cows: aruba.hi
        };
      });
    `;
    expect(program).toBeTransformedTo(program);
  });

  it('ignores modules that have been excluded by line comments', () => {
    const program = `
      // ${TRANSFORM_AMD_TO_COMMONJS_IGNORE}
      define(['stuff', 'here'], function(donkeys, aruba) {
        return {
           llamas: donkeys.version,
           cows: aruba.hi
        };
      });
    `;
    expect(program).toBeTransformedTo(program);
  });

  it.each([TRANSFORM_AMD_TO_COMMONJS_IGNORE, 'a really nice comment'])(
    'transforms normally with non-top-level block comments',
    (comment) => {
      expect(`
        define(['stuff', 'here'], function(donkeys, aruba) {
          /* ${comment} */
          return {
            llamas: donkeys.version,
            cows: aruba.hi
          };
        });
      `).toBeTransformedTo(`
        module.exports = function() {
          var donkeys = require('stuff');
          var aruba = require('here');
          /* ${comment} */
          return {
            llamas: donkeys.version,
            cows: aruba.hi
          };
        }();
      `);
    }
  );

  it.each([TRANSFORM_AMD_TO_COMMONJS_IGNORE, 'a really nice comment'])(
    'transforms normally with non-top-level line comments',
    (comment) => {
      expect(`
        define(['stuff', 'here'], function(donkeys, aruba) {
          // ${comment}
          return {
            llamas: donkeys.version,
            cows: aruba.hi
          };
        });
      `).toBeTransformedTo(`
        module.exports = function() {
          var donkeys = require('stuff');
          var aruba = require('here');
          // ${comment}
          return {
            llamas: donkeys.version,
            cows: aruba.hi
          };
        }();
      `);
    }
  );

  it.each(['random comment', 'transform-amd-to-commonjs'])(
    'transforms normally with random top-level comments',
    (comment) => {
      expect(`
        /* ${comment} */
        // ${comment}
        define(['stuff', 'here'], function(donkeys, aruba) {
          return {
            llamas: donkeys.version,
            cows: aruba.hi
          };
        });
      `).toBeTransformedTo(`
        /* ${comment} */
        // ${comment}
        module.exports = function() {
          var donkeys = require('stuff');
          var aruba = require('here');
          return {
            llamas: donkeys.version,
            cows: aruba.hi
          };
        }();
      `);
    }
  );

  it('transforms define call that use var args dependency list and factory', () => {
    expect(`
      define(deps, factory);
    `).toBeTransformedTo(
      checkVarArgsResult({
        factory: 'factory',
        dependencies: 'deps',
        checkDeps: true,
        checkFactory: true,
        isDefineCall: true,
        checkForModuleName: true,
      })
    );
  });

  it('transforms named define call that uses var args dependency list and factory', () => {
    expect(`
      define('somename', deps, factory);
    `).toBeTransformedTo(
      checkVarArgsResult({
        factory: 'factory',
        dependencies: 'deps',
        checkDeps: true,
        checkFactory: true,
        isDefineCall: true,
      })
    );
  });

  it('transforms named define call that use var args for all three arguments', () => {
    expect(`
      define(name, deps, factory);
    `).toBeTransformedTo(
      checkVarArgsResult({
        factory: 'factory',
        dependencies: 'deps',
        checkDeps: true,
        checkFactory: true,
        isDefineCall: true,
      })
    );
  });

  it('transforms define with var arg dependency list', () => {
    expect(`
      define(deps, function(foo, bar) {
        foo.doSomething();
        bar.doSomethingElse();
      });
    `).toBeTransformedTo(
      checkVarArgsResult({
        factory: `function(foo, bar) {
          foo.doSomething();
          bar.doSomethingElse();
        }`,
        dependencies: 'deps',
        checkDeps: true,
        checkFactory: false,
        isDefineCall: true,
        checkForModuleName: true,
      })
    );
  });
});
