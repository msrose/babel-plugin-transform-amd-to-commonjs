'use strict';

const createExpressionTransformer = require('./transformers');

module.exports = ({ types: t }) => {
  const ExpressionStatement = path => {
    const transformer = createExpressionTransformer(t, path);

    if (!transformer.isTransformableAMDExpression()) return;

    path.replaceWithMultiple(transformer.getTransformationToCommonJS());
  };

  return {
    visitor: {
      ExpressionStatement
    }
  };
};
