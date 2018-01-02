'use strict';

const AMDExpressionTransformer = require('./AMDExpressionTransformer');

class NullAMDExpressionTransformer extends AMDExpressionTransformer {
  isTransformableAMDExpression() {
    return false;
  }
}

module.exports = NullAMDExpressionTransformer;
