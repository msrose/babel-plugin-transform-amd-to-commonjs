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
      return string.split('\n').filter(line => !!line.length).join('\n');
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
          result.message = `Expected\n${actual}\n\nnot to be transformed ` +
            `to\n${expected}\n\nbut instead they were the same.\n`;
        } else {
          result.message = `Expected\n${actual}\n\nto be transformed ` +
            `to\n${expected}\n\nbut instead got\n\n${transformed}\n`;
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

  it('transforms anonymous define blocks with dependencies', () => {
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
});
