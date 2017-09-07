'use strict';

const { MODULE, EXPORTS, REQUIRE } = require('./constants');

// A factory function is exported in order to inject the same babel-types object
// being used by the plugin itself
module.exports = ({ types: t }) => {
  const decodeDefineArguments = argNodes => {
    if (argNodes.length === 1) {
      return { factory: argNodes[0] };
    } else if (argNodes.length === 2) {
      const decodedArgs = { factory: argNodes[1] };
      if (t.isArrayExpression(argNodes[0])) {
        decodedArgs.dependencyList = argNodes[0];
      }
      return decodedArgs;
    } else {
      return { dependencyList: argNodes[1], factory: argNodes[2] };
    }
  };

  const decodeRequireArguments = argNodes => {
    if (argNodes.length === 1) {
      return { dependencyList: argNodes[0] };
    } else {
      return { dependencyList: argNodes[0], factory: argNodes[1] };
    }
  };

  const createModuleExportsAssignmentExpression = value => {
    return t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(t.identifier(MODULE), t.identifier(EXPORTS)),
        value
      )
    );
  };

  const RESULT_CHECK = t.expressionStatement(
    t.logicalExpression(
      '&&',
      t.binaryExpression(
        '!==',
        t.unaryExpression('typeof', t.identifier('amdDefineResult')),
        t.stringLiteral('undefined')
      ),
      createModuleExportsAssignmentExpression(t.identifier('amdDefineResult')).expression
    )
  );

  const createModuleExportsResultCheckExpression = value => {
    return [
      t.variableDeclaration('var', [t.variableDeclarator(t.identifier('amdDefineResult'), value)]),
      RESULT_CHECK
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

  const isSimplifiedCommonJSWrapperWithModuleOrExports = (dependencyList, factoryArity) => {
    return !dependencyList && factoryArity > 1;
  };

  const isModuleOrExportsInjected = (dependencyList, factoryArity) => {
    return (
      isModuleOrExportsInDependencyList(dependencyList) ||
      isSimplifiedCommonJSWrapperWithModuleOrExports(dependencyList, factoryArity)
    );
  };

  return {
    decodeDefineArguments,
    decodeRequireArguments,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheckExpression,
    createRequireExpression,
    isModuleOrExportsInjected
  };
};
