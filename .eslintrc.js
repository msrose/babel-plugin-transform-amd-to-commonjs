'use strict';

module.exports = {
  env: {
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  plugins: ['prettier'],
  extends: ['msrose', 'prettier'],
  rules: {
    'prettier/prettier': ['error', { printWidth: 100, singleQuote: true }],
  },
};
