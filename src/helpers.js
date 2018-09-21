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
    return { dependencyList: argNodes[0], factory: argNodes[1] };
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

  const createDependencyInjectionExpression = (dependencyNode, variableName) => {
    if (
      t.isStringLiteral(dependencyNode) &&
      [MODULE, EXPORTS, REQUIRE].includes(dependencyNode.value)
    ) {
      // In case of the AMD keywords, only create an expression if the variable name
      // does not match the keyword. This to prevent 'require = require' statements.
      if (variableName && variableName.name !== dependencyNode.value) {
        return t.variableDeclaration('var', [
          t.variableDeclarator(variableName, t.identifier(dependencyNode.value))
        ]);
      }
      return undefined;
    }

    let requireCall;

    if (t.isRestElement(variableName)) {
      requireCall = t.arrayExpression(
        dependencyNode.map(node => createDependencyInjectionExpression(node).expression)
      );
      variableName = variableName.argument;
    } else {
      requireCall = t.callExpression(t.identifier(REQUIRE), [dependencyNode]);
    }

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

  const isFunctionExpression = factory => {
    return t.isFunctionExpression(factory) || t.isArrowFunctionExpression(factory);
  };

  const createFactoryReplacementExpression = (factory, dependencyInjections) => {
    if (t.isFunctionExpression(factory)) {
      return t.functionExpression(
        null,
        [],
        t.blockStatement(dependencyInjections.concat(factory.body.body))
      );
    }
    let bodyStatement;
    if (t.isBlockStatement(factory.body)) {
      bodyStatement = factory.body.body;
    } else {
      // implicit return arrow function
      bodyStatement = t.returnStatement(factory.body);
    }
    return t.arrowFunctionExpression(
      [],
      t.blockStatement(dependencyInjections.concat(bodyStatement))
    );
  };

  return {
    decodeDefineArguments,
    decodeRequireArguments,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    createDependencyInjectionExpression,
    isSimplifiedCommonJSWrapper,
    isModuleOrExportsInjected,
    getUniqueIdentifier,
    isFunctionExpression,
    createFactoryReplacementExpression
  };
};
