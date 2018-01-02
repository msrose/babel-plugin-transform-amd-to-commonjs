'use strict';

const AMDExpressionTransformer = require('./AMDExpressionTransformer');

class NullExpressionTransformer extends AMDExpressionTransformer {
  isTransformableAMDExpression() {
    return false;
  }
}

module.exports = NullExpressionTransformer;
