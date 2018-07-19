'use strict';

const { AMD_DEFINE_RESULT } = require('../src/constants');

describe('Plugin for define blocks with arrow function factories', () => {
  it('transforms anonymous define blocks with one dependency', () => {
    expect(`
      define(['stuff'], donkeys => {
        return {
          llamas: donkeys.version
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var donkeys = require('stuff');
        return {
          llamas: donkeys.version
        };
      })();
    `);
  });

  it('transforms anonymous define blocks with one dependency and implicit return value', () => {
    expect(`
      define(['stuff'], donkeys => ({ llamas: donkeys.version }))
    `).toBeTransformedTo(`
      module.exports = (() => {
            var donkeys = require('stuff');
            return { llamas: donkeys.version };
      })();
    `);
  });

  it('transforms anonymous define blocks with multiple dependencies', () => {
    expect(`
      define(['stuff', 'here'], (donkeys, aruba) => {
        return {
           llamas: donkeys.version,
           cows: aruba.hi
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var donkeys = require('stuff');
        var aruba = require('here');
        return {
          llamas: donkeys.version,
          cows: aruba.hi
        };
      })();
    `);
  });

  it('transforms anonymous define blocks with multiple dependencies and implicit return value', () => {
    expect(`
      define(['stuff', 'here'], (donkeys, aruba) => ({ llamas: donkeys.version, cows: aruba.hi }));
    `).toBeTransformedTo(`
      module.exports = (() => {
            var donkeys = require('stuff');
            var aruba = require('here');
            return { llamas: donkeys.version, cows: aruba.hi };
      })();
    `);
  });

  it('transforms anonymous define blocks with unused dependencies', () => {
    expect(`
      define(['stuff', 'here'], (donkeys) => {
        return {
           llamas: donkeys.version
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var donkeys = require('stuff');
        require('here');
        return {
          llamas: donkeys.version
        };
      })();
    `);
  });

  it('only transforms define blocks at the top level by default', () => {
    const program = `
      if(someDumbCondition) {
        define(['stuff'], (stuff) => {
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
          define(['stuff'], stuff => {
            return { hi: 'world' };
          });
        }
      `
    }).toBeTransformedTo(`
      if(someDumbCondition) {
        module.exports = (() => {
          var stuff = require('stuff');
          return { hi: 'world' };
        })();
      }
    `);
  });

  it('transforms anonymous define blocks with no dependency list', () => {
    expect(`
      define(() => {
        return {
           llamas: 'donkeys'
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        return {
          llamas: 'donkeys'
        };
      })();
    `);
  });

  it('transforms dependencies listed as variables', () => {
    expect(`
      var dependency = 'hey';
      define([dependency], (here) => {
        return {
           llamas: here.hi
        };
      });
    `).toBeTransformedTo(`
      var dependency = 'hey';
      module.exports = (() => {
        var here = require(dependency);
        return {
          llamas: here.hi
        };
      })();
    `);
  });

  it('transforms named define blocks with dependencies', () => {
    expect(`
      define('thismoduletho', ['hi'], (here) => {
        return {
           llamas: here.hi
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var here = require('hi');
        return {
          llamas: here.hi
        };
      })();
    `);
  });

  it('transforms named define blocks with no dependency list', () => {
    expect(`
      define('thismoduletho', () => {
        return {
           llamas: 'they are fluffy'
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        return {
          llamas: 'they are fluffy'
        };
      })();
    `);
  });

  it('does not require a dependency named `require`', () => {
    expect(`
      define(['require'], (require) => {
        var x = require('x');
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var x = require('x');
      })();
    `);
  });

  it('does not require a dependency named `require` which has been renamed', () => {
    expect(`
      define(['require'], (abc) => {
        var x = abc('x');
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var abc = require;
        var x = abc('x');
      })();
    `);
  });

  const checkAmdDefineResult = (value, identifier = AMD_DEFINE_RESULT) => `
    var ${identifier} = ${value};
    typeof ${identifier} !== 'undefined' && (module.exports = ${identifier});
  `;

  it('handles injection of a dependency named `module`', () => {
    expect(`
      define(['module'], (module) => {
        module.exports = { hey: 'boi' };
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (() => {
          module.exports = { hey: 'boi' };
        })()
      `)
    );
  });

  it('handles injection of a dependency named `module` which has been renamed', () => {
    expect(`
      define(['module'], (abc) => {
        abc.exports = { hey: 'boi' };
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (() => {
          var abc = module;
          abc.exports = { hey: 'boi' };
        })()
      `)
    );
  });

  it('handles injection of dependency named `exports`', () => {
    expect(`
      define(['exports'], (exports) => {
        exports.hey = 'boi';
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (() => {
          exports.hey = 'boi';
        })()
      `)
    );
  });

  it('handles injection of dependency named `exports` which has been renamed', () => {
    expect(`
      define(['exports'], (abc) => {
        abc.hey = 'boi';
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        (() => {
          var abc = exports;
          abc.hey = 'boi';
        })()
      `)
    );
  });

  it('transforms the simplified commonjs wrapper', () => {
    expect(`
      define((require, exports, module) => {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        ((require, exports, module) => {
          var stuff = require('hi');
          exports.hey = stuff.boi;
        })(require, exports, module)
      `)
    );
    expect(`
      define((require, exports) => {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        ((require, exports) => {
          var stuff = require('hi');
          exports.hey = stuff.boi;
        })(require, exports)
      `)
    );
    expect(`
      define((require) => {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      module.exports = ((require) => {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      })(require);
    `);
  });

  it('transforms the simplified commonjs wrapper with weird variable names', () => {
    expect(`
      define((llamas, cows, bears) => {
        var stuff = llamas('hi');
        cows.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        ((llamas, cows, bears) => {
          var stuff = llamas('hi');
          cows.hey = stuff.boi;
        })(require, exports, module)
      `)
    );
    expect(`
      define((llamas, cows) => {
        var stuff = llamas('hi');
        cows.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      checkAmdDefineResult(`
        ((llamas, cows) => {
          var stuff = llamas('hi');
          cows.hey = stuff.boi;
        })(require, exports)
      `)
    );
    expect(`
      define((donkeys) => {
        var stuff = donkeys('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      module.exports = ((donkeys) => {
        var stuff = donkeys('hi');
        exports.hey = stuff.boi;
      })(require);
    `);
  });

  it('accounts for variable name conflicts when checking the result of `define`', () => {
    expect(`
      var amdDefineResult = 'for some reason I have this variable declared already';
      define((require, exports, module) => {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(
      `var amdDefineResult = 'for some reason I have this variable declared already';` +
        checkAmdDefineResult(
          `
            ((require, exports, module) => {
              var stuff = require('hi');
              exports.hey = stuff.boi;
            })(require, exports, module)
          `,
          `_${AMD_DEFINE_RESULT}`
        )
    );
  });

  it("lets you declare a dependency as `module` even though that's crazy", () => {
    expect(`
      define(['notmodule'], (module) => {
        return {
          notmodule: module.notmodule
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var module = require('notmodule');
        return {
          notmodule: module.notmodule
        };
      })();
    `);
  });

  it("lets you declare a dependency as `exports` even though that's crazy", () => {
    expect(`
      define(['notexports'], (exports) => {
        return {
          notexports: exports.notexports
        };
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var exports = require('notexports');
        return {
          notexports: exports.notexports
        };
      })();
    `);
  });
});
