'use strict';

const { MODULE, EXPORTS, REQUIRE } = require('./constants');

// A factory function is exported in order to inject the same babel-types object
// being used by the plugin itself
module.exports = ({ types: t }) => {
  const createModuleExportsAssignmentExpression = value => {
    return t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(t.identifier(MODULE), t.identifier(EXPORTS)),
        value
      )
    );
  };

  const createModuleExportsResultCheck = (value, identifier) => {
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
          createModuleExportsAssignmentExpression(identifier).expression
        )
      )
    ];
  };

  const createRequireExpression = (dependencyNode, variableName) => {
    const requireCall = t.callExpression(t.identifier(REQUIRE), [dependencyNode]);
    if (variableName) {
      return t.variableDeclaration('var', [t.variableDeclarator(variableName, requireCall)]);
    } else {
      return t.expressionStatement(requireCall);
    }
  };

  const isModuleOrExportsInDependencyList = dependencyList => {
    return (
      dependencyList &&
      dependencyList.elements.some(
        element =>
          t.isStringLiteral(element) && (element.value === MODULE || element.value === EXPORTS)
      )
    );
  };

  // https://github.com/requirejs/requirejs/wiki/differences-between-the-simplified-commonjs-wrapper-and-standard-amd-define
  const isSimplifiedCommonJSWrapper = (dependencyList, factoryArity) => {
    return !dependencyList && factoryArity > 0;
  };

  const isSimplifiedCommonJSWrapperWithModuleOrExports = (dependencyList, factoryArity) => {
    return isSimplifiedCommonJSWrapper(dependencyList, factoryArity) && factoryArity > 1;
  };

  const isModuleOrExportsInjected = (dependencyList, factoryArity) => {
    return (
      isModuleOrExportsInDependencyList(dependencyList) ||
      isSimplifiedCommonJSWrapperWithModuleOrExports(dependencyList, factoryArity)
    );
  };

  const getUniqueIdentifier = (scope, name) => {
    return scope.hasOwnBinding(name) ? scope.generateUidIdentifier(name) : t.identifier(name);
  };

  return {
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    createRequireExpression,
    isSimplifiedCommonJSWrapper,
    isModuleOrExportsInjected,
    getUniqueIdentifier
  };
};
