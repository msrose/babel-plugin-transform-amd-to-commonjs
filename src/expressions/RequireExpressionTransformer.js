'use strict';

const AMDExpressionTransformer = require('./AMDExpressionTransformer');

class RequireExpressionTransformer extends AMDExpressionTransformer {
  processFunctionFactoryReplacement(factoryReplacement) {
    return [this.t.expressionStatement(factoryReplacement)];
  }

  getNonFunctionFactoryReplacement() {
    return this.getCommonJSRequireExpressions();
  }
}

module.exports = RequireExpressionTransformer;
