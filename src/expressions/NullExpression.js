'use strict';

const AMDExpression = require('./AMDExpression');

class NullExpression extends AMDExpression {
  isTransformable() {
    return false;
  }
}

module.exports = NullExpression;
