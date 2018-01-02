'use strict';

const { DEFINE, REQUIRE } = require('../constants');

const DefineExpressionTransformer = require('./DefineExpressionTransformer');
const RequireExpressionTransformer = require('./RequireExpressionTransformer');
const NullAMDExpressionTransformer = require('./NullExpressionTransformer');

const createExpressionTransformer = (t, path) => {
  const decoders = {
    [DEFINE]: DefineExpressionTransformer,
    [REQUIRE]: RequireExpressionTransformer
  };
  const name = t.isCallExpression(path.node.expression) && path.node.expression.callee.name;
  return new (decoders[name] || NullAMDExpressionTransformer)(t, path);
};

module.exports = createExpressionTransformer;
