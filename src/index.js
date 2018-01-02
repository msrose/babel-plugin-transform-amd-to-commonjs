'use strict';

const getExpressionTransformerClass = require('./transformers');

module.exports = ({ types: t }) => {
  const ExpressionStatement = path => {
    const name = t.isCallExpression(path.node.expression) && path.node.expression.callee.name;
    const AMDExpressionTransformer = getExpressionTransformerClass(name);
    const transformer = new AMDExpressionTransformer(t, path);

    if (!transformer.isTransformableAMDExpression()) return;

    path.replaceWithMultiple(transformer.getTransformationToCommonJS());
  };

  return {
    visitor: {
      ExpressionStatement
    }
  };
};
