const babel = require('babel-core');

const customMatchers = {
  toBeTransformedTo: () => {
    const transformAmdToCommonJS = (code) => {
      return babel.transform(code, { plugins: ['./index'] }).code;
    };

    const transformTrivial = (code) => {
      return babel.transform(code).code;
    };

    const removeBlankLines = (string) => {
      return string.split('\n').filter(line => !!line.trim().length).join('\n');
    };

    return {
      compare(actual, expected) {
        const transformed = transformAmdToCommonJS(actual);
        actual = removeBlankLines(transformTrivial(actual));
        expected = removeBlankLines(transformTrivial(expected));
        const result = {
          pass: removeBlankLines(transformed) === expected
        };
        if(result.pass) {
          result.message = `Expected\n\n${actual}\n\nnot to be transformed ` +
            `to\n\n${expected}\n\nbut instead they were the same.\n`;
        } else {
          result.message = `Expected\n\n${actual}\n\nto be transformed ` +
            `to\n\n${expected}\n\nbut instead got\n\n${transformed}\n`;
        }
        return result;
      }
    };
  }
};

describe('Plugin', () => {
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

  it('transforms require blocks with one dependency', () => {
    expect(`
      require(['llamas'], function(llama) {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      var llama = require('llamas');
      (function() {
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
      var llama = require('llamas');
      var frog = require('frogs');
      (function() {
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
      var llama = require('llamas');
      require('frogs');
      (function() {
        llama.doSomeStuff();
      })();
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
      var here = require(dependency);
      module.exports = function() {
        return {
          llamas: here.hi
        };
      }();
    `);
  });
});
