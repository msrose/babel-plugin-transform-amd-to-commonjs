'use strict';

const babel = require('@babel/core');
const { diff } = require('jest-diff');

const transformAmdToCommonJS = (code, options = {}) => {
  return babel.transform(code, { plugins: [['./src/index', options]], babelrc: false }).code;
};

const normalize = (program) => {
  const transformTrivial = (code) => {
    return babel.transform(code).code;
  };

  const removeBlankLines = (string) => {
    return string
      .split('\n')
      .filter((line) => !!line.trim().length)
      .join('\n');
  };

  return removeBlankLines(transformTrivial(program));
};

const customMatchers = {
  toBeTransformedTo(actual, expected) {
    let options = {};

    if (typeof actual !== 'string') {
      options = actual.options;
      actual = actual.program;
    }

    actual = normalize(actual);
    expected = normalize(expected);
    const transformed = normalize(transformAmdToCommonJS(actual, options));

    const result = {
      pass: transformed === expected,
    };

    if (result.pass) {
      result.message = () =>
        `Expected\n\n` +
        `${actual}\n\n` +
        `not to be transformed to\n\n` +
        `${this.utils.printExpected(expected)}\n\n` +
        `but it was transformed to exactly that\n`;
    } else {
      result.message = () =>
        `Expected\n\n${actual}\n\nto be transformed to\n\n` +
        `${this.utils.printExpected(expected)}\n\n` +
        `but instead got\n\n` +
        `${this.utils.printReceived(transformed)}\n\n` +
        `Difference:\n\n${diff(expected, transformed)}\n`;
    }

    return result;
  },
};

module.exports = customMatchers;
