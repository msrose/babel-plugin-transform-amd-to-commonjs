'use strict';

const { DEFINE, REQUIRE } = require('../constants');

const DefineExpressionTransformer = require('./DefineExpressionTransformer');
const RequireExpressionTransformer = require('./RequireExpressionTransformer');
const NullAMDExpressionTransformer = require('./NullExpressionTransformer');

const getExpressionTransformerClass = name => {
  const decoders = {
    [DEFINE]: DefineExpressionTransformer,
    [REQUIRE]: RequireExpressionTransformer
  };
  return decoders[name] || NullAMDExpressionTransformer;
};

module.exports = getExpressionTransformerClass;
