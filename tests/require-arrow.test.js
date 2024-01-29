'use strict';

const { TRANSFORM_AMD_TO_COMMONJS_IGNORE } = require('../src/constants');

describe('Plugin for require blocks with arrow function callbacks', () => {
  it('transforms require blocks with one dependency', () => {
    expect(`
      require(['llamas'], (llama) => {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (() => {
        var llama = require('llamas');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks with one dependency and implicit return', () => {
    expect(`
      require(['llamas'], (llama) => llama.doSomeStuff());
    `).toBeTransformedTo(`
      (() => {
            var llama = require('llamas');
            return llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks with multiple dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], (llama, frog) => {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `).toBeTransformedTo(`
      (() => {
        var llama = require('llamas');
        var frog = require('frogs');
        llama.doSomeStuff();
        frog.sayRibbit();
      })();
    `);
  });

  it('transforms require blocks with multiple dependencies and implicit return', () => {
    expect(`
      require(['llamas', 'frogs'], (llama, frog) => llama.doSomeStuff(frog));
    `).toBeTransformedTo(`
      (() => {
            var llama = require('llamas');
            var frog = require('frogs');
            return llama.doSomeStuff(frog);
      })();
    `);
  });

  it('transforms require blocks with unused dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], (llama) => {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (() => {
        var llama = require('llamas');
        require('frogs');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms nested require blocks that have no factory function', () => {
    expect(`
      require(['here', 'is', 'i'], (here) => {
        here.doStuff();
        require(['yep', 'that', 'me']);
      });
    `).toBeTransformedTo(`
      (() => {
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
      require(['here', 'is', 'i'], (here) => {
        here.doStuff();
        require(['yep', 'that', 'me'], (yep) => {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      (() => {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        (() => {
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
      define(['here', 'is', 'i'], (here) => {
        here.doStuff();
        require(['yep', 'that', 'me'], (yep) => {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        (() => {
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
      require(['dep1', 'dep2', 'dep3'], (dep, ...rest) => {
        dep.doStuff();
      });
    `).toBeTransformedTo(`
      (() => {
        var dep = require('dep1');
        var rest = [require('dep2'), require('dep3')];
        dep.doStuff();
      })();
    `);
  });

  it('transforms factories that use the rest operator including AMD keywords', () => {
    expect(`
      require(['dep1', 'dep2', 'module', 'exports', 'require'], (dep, ...rest) => {
        dep.doStuff();
      });
    `).toBeTransformedTo(`
      (() => {
        var dep = require('dep1');
        var rest = [require('dep2'), module, exports, require];
        dep.doStuff();
      })();
    `);
  });

  it('transforms factories that use the rest operator when there are no rest arguments', () => {
    expect(`
      require(['dep1'], (dep, ...rest) => {
        dep.doStuff();
      });
    `).toBeTransformedTo(`
      (() => {
        var dep = require('dep1');
        var rest = [];
        dep.doStuff();
      })();
    `);
  });

  it('ignores modules that have been excluded by block comments', () => {
    const program = `
      /* ${TRANSFORM_AMD_TO_COMMONJS_IGNORE} */
      require(['llamas', 'frogs'], (llama, frog) => {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `;
    expect(program).toBeTransformedTo(program);
  });

  it('ignores modules that have been excluded by line comments', () => {
    const program = `
      // ${TRANSFORM_AMD_TO_COMMONJS_IGNORE}
      require(['llamas', 'frogs'], (llama, frog) => {
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
        require(['llamas', 'frogs'], (llama, frog) => {
          /* ${comment} */
          llama.doSomeStuff();
          frog.sayRibbit();
        });
      `).toBeTransformedTo(`
        (() => {
          var llama = require('llamas');
          var frog = require('frogs');
          /* ${comment} */
          llama.doSomeStuff();
          frog.sayRibbit();
        })();
      `);
    },
  );

  it.each([TRANSFORM_AMD_TO_COMMONJS_IGNORE, 'a really nice comment'])(
    'transforms normally with non-top-level line comments',
    (comment) => {
      expect(`
        require(['llamas', 'frogs'], (llama, frog) => {
          // ${comment}
          llama.doSomeStuff();
          frog.sayRibbit();
        });
      `).toBeTransformedTo(`
        (() => {
          var llama = require('llamas');
          var frog = require('frogs');
          // ${comment}
          llama.doSomeStuff();
          frog.sayRibbit();
        })();
      `);
    },
  );

  it.each(['random comment', 'transform-amd-to-commonjs'])(
    'transforms normally with random top-level comments',
    (comment) => {
      expect(`
        /* ${comment} */
        // ${comment}
        require(['llamas', 'frogs'], (llama, frog) => {
          llama.doSomeStuff();
          frog.sayRibbit();
        });
      `).toBeTransformedTo(`
        /* ${comment} */
        // ${comment}
        (() => {
          var llama = require('llamas');
          var frog = require('frogs');
          llama.doSomeStuff();
          frog.sayRibbit();
        })();
      `);
    },
  );
});
