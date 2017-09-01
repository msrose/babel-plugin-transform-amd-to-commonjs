'use strict';

module.exports = {
  env: {
    node: true
  },
  plugins: [
    'prettier'
  ],
  extends: ['msrose', 'prettier'],
  rules: {
    'prettier/prettier': ['error', {printWidth: 100}]
  }
};
