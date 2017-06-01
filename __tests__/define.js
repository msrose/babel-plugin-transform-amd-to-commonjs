const customMatchers = require('./custom-matchers');

describe('Plugin for define blocks', () => {
  beforeEach(() => {
    jasmine.addMatchers(customMatchers);
  });

  it('transforms anonymous define blocks with one dependency', () => {
    expect(`
      define(['stuff'], function(donkeys) {
        return {
          llamas: donkeys.version
        };
      });
    `).toBeTransformedTo(`
      var donkeys = require('stuff');
      module.exports = function() {
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
      var donkeys = require('stuff');
      var aruba = require('here');
      module.exports = function() {
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
      var donkeys = require('stuff');
      require('here');
      module.exports = function() {
        return {
          llamas: donkeys.version
        };
      }();
    `);
  });

  it('only transforms define blocks at the top level', () => {
    const program = `
      if(someDumbCondition) {
        define(['stuff'], function(stuff) {
          return { hi: 'world' };
        });
      }
    `;
    expect(program).toBeTransformedTo(program);
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
      var here = require(dependency);
      module.exports = function() {
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
      var here = require('hi');
      module.exports = function() {
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

  it('handles injection of a dependency named `module`', () => {
    expect(`
      define(['module'], function(module) {
        module.exports = { hey: 'boi' };
      });
    `).toBeTransformedTo(`
      (function() {
        module.exports = { hey: 'boi' };
      })();
    `);
  });

  it('handles injection of dependency name `exports`', () => {
    expect(`
      define(['exports'], function(exports) {
        exports.hey = 'boi';
      });
    `).toBeTransformedTo(`
      (function() {
        exports.hey = 'boi';
      })();
    `);
  });

  it('transforms the simplified commonjs wrapper', () => {
    expect(`
      define(function(require, exports, module) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      (function(require, exports, module) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      })(require, exports, module);
    `);
    expect(`
      define(function(require, exports) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      (function(require, exports) {
        var stuff = require('hi');
        exports.hey = stuff.boi;
      })(require, exports);
    `);
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
    `).toBeTransformedTo(`
      (function(llamas, cows, bears) {
        var stuff = llamas('hi');
        cows.hey = stuff.boi;
      })(require, exports, module);
    `);
    expect(`
      define(function(llamas, cows) {
        var stuff = llamas('hi');
        cows.hey = stuff.boi;
      });
    `).toBeTransformedTo(`
      (function(llamas, cows) {
        var stuff = llamas('hi');
        cows.hey = stuff.boi;
      })(require, exports);
    `);
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

  it("lets you declare a dependency as `module` even though that's crazy", () => {
    expect(`
      define(['notmodule'], function(module) {
        return {
          notmodule: module.notmodule
        };
      });
    `).toBeTransformedTo(`
      var module = require('notmodule');
      module.exports = function() {
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
      var exports = require('notexports');
      module.exports = function() {
        return {
          notexports: exports.notexports
        };
      }();
    `);
  });
});
