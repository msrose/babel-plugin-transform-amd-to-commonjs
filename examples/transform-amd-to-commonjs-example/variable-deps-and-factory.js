'use strict';

const deps = ['dayum'];

const factory = function (dayum) {
  return {
    message: 'variable define deps AND factory! ' + dayum.daaaaayum(),
  };
};

// Not supported by webpack
define(deps, factory);
