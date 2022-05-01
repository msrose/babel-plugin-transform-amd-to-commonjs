'use strict';

// For cases not supported by webpack that we still want to test
define([
  './variable-deps-define',
  './variable-deps-and-factory',
  './variable-deps-require',
], function (variableDepsDefine, variableDepsAndFactory) {
  return {
    variableDepsDefine: variableDepsDefine.message,
    variableDepsAndFactory: variableDepsAndFactory.message,
  };
});
