'use strict';

const AMDExpression = require('./AMDExpression');
const RequireExpressionTransformer = require('./RequireExpressionTransformer');

class RequireExpression extends AMDExpression {
  getTransformerClass() {
    return RequireExpressionTransformer;
  }

  getDependencyList() {
    return this.getArguments()[0];
  }

  getFactory() {
    return this.getArguments()[1];
  }
}

module.exports = RequireExpression;
