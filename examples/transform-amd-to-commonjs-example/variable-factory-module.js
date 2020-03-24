'use strict';

const factory = function (dayum) {
  return {
    message: 'variable factory! ' + dayum.daaaaaaaaaaayum(),
  };
};

define(['dayum'], factory);
