'use strict';

const getExpressionClass = require('./expressions');

module.exports = ({ types: t }) => ({
  visitor: {
    ExpressionStatement: path => {
      const functionName =
        t.isCallExpression(path.node.expression) && path.node.expression.callee.name;

      const AMDExpression = getExpressionClass(functionName);
      const expression = new AMDExpression(t, path);

      if (!expression.isTransformable()) return;

      path.replaceWithMultiple(expression.transformToCommonJS());
    }
  }
});
