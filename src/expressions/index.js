'use strict';

const { DEFINE, REQUIRE } = require('../constants');

const DefineExpression = require('./DefineExpression');
const RequireExpression = require('./RequireExpression');
const NullExpression = require('./NullExpression');

const getExpressionClass = name => {
  const decoders = {
    [DEFINE]: DefineExpression,
    [REQUIRE]: RequireExpression
  };
  return decoders[name] || NullExpression;
};

module.exports = getExpressionClass;
