'use strict';

const getExpressionTransformerClass = require('./transformers');

module.exports = ({ types: t }) => ({
  visitor: {
    ExpressionStatement: path => {
      const functionName =
        t.isCallExpression(path.node.expression) && path.node.expression.callee.name;

      const AMDExpressionTransformer = getExpressionTransformerClass(functionName);
      const transformer = new AMDExpressionTransformer(t, path);

      if (!transformer.isTransformableAMDExpression()) return;

      path.replaceWithMultiple(transformer.getTransformationToCommonJS());
    }
  }
});
