'use strict';

/* transform-amd-to-commonjs-ignore */

function define(list, func) {
  return list.reduce((sum, val) => sum + val) + func();
}

// Pathological use of a AMD-like define that will cause errors unless we ignore the module
define([1, 2, 3], () => {
  module.exports = 'hello';
  return 123;
});
