'use strict';

const { MODULE, EXPORTS, REQUIRE } = require('./constants');

const createModuleExportsAssignmentExpression = (t, value) => {
  return t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier(MODULE), t.identifier(EXPORTS)),
      value
    )
  );
};

const createModuleExportsResultCheck = (t, value, identifier) => {
  return [
    t.variableDeclaration('var', [t.variableDeclarator(identifier, value)]),
    t.expressionStatement(
      t.logicalExpression(
        '&&',
        t.binaryExpression(
          '!==',
          t.unaryExpression('typeof', identifier),
          t.stringLiteral('undefined')
        ),
        createModuleExportsAssignmentExpression(t, identifier).expression
      )
    )
  ];
};

const createRequireExpression = (t, dependencyNode, variableName) => {
  const requireCall = t.callExpression(t.identifier(REQUIRE), [dependencyNode]);
  if (variableName) {
    return t.variableDeclaration('var', [t.variableDeclarator(variableName, requireCall)]);
  } else {
    return t.expressionStatement(requireCall);
  }
};

const getUniqueIdentifier = (t, scope, name) => {
  return scope.hasOwnBinding(name) ? scope.generateUidIdentifier(name) : t.identifier(name);
};

module.exports = {
  createModuleExportsAssignmentExpression,
  createModuleExportsResultCheck,
  createRequireExpression,
  getUniqueIdentifier
};
