'use strict';

const AMDExpressionTransformer = require('./AMDExpressionTransformer');

class RequireExpressionTransformer extends AMDExpressionTransformer {
  getDependencyList() {
    return this.getArguments()[0];
  }

  getFactory() {
    return this.getArguments()[1];
  }

  processFunctionFactoryReplacement(factoryReplacement) {
    return [this.t.expressionStatement(factoryReplacement)];
  }

  getNonFunctionFactoryReplacement() {
    return this.getCommonJSRequireExpressions();
  }
}

module.exports = RequireExpressionTransformer;
