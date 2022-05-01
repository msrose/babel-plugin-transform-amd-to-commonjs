'use strict';

const deps = ['dayum'];

// Not supported by webpack
require(deps, function (dayum) {
  console.log('variable require deps!', dayum.daaaaayum());
});
