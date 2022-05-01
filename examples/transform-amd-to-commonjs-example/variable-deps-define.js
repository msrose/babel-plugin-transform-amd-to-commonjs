'use strict';

const deps = ['dayum'];

// Not supported by webpack
define(deps, function (dayum) {
  return {
    message: 'variable define deps! ' + dayum.daaaaayum(),
  };
});
