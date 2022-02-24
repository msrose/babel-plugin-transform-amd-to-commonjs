'use strict';

const { MODULE, EXPORTS, REQUIRE, TRANSFORM_AMD_TO_COMMONJS_IGNORE } = require('./constants');

// A factory function is exported in order to inject the same babel-types object
// being used by the plugin itself
module.exports = ({ types: t }) => {
  const decodeDefineArguments = (argNodes) => {
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

  const decodeRequireArguments = (argNodes) => {
    return { dependencyList: argNodes[0], factory: argNodes[1] };
  };

  const createModuleExportsAssignmentExpression = (value) => {
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
      ),
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
          t.variableDeclarator(variableName, t.identifier(dependencyNode.value)),
        ]);
      }
      return t.identifier(dependencyNode.value);
    }

    const requireCall = t.isArrayExpression(dependencyNode)
      ? dependencyNode
      : t.callExpression(t.identifier(REQUIRE), [dependencyNode]);

    if (variableName) {
      return t.variableDeclaration('var', [t.variableDeclarator(variableName, requireCall)]);
    } else {
      return t.expressionStatement(requireCall);
    }
  };

  const isExplicitDependencyInjection = (dependencyInjection) => {
    return (
      !t.isIdentifier(dependencyInjection) ||
      ![REQUIRE, EXPORTS, MODULE].includes(dependencyInjection.name)
    );
  };

  const createRestDependencyInjectionExpression = (dependencyNodes) => {
    return t.arrayExpression(
      dependencyNodes.map((node) => {
        const dependencyInjection = createDependencyInjectionExpression(node);
        if (isExplicitDependencyInjection(dependencyInjection)) {
          return dependencyInjection.expression;
        }
        return t.identifier(node.value);
      })
    );
  };

  const isModuleOrExportsInDependencyList = (dependencyList) => {
    return (
      dependencyList &&
      dependencyList.elements.some(
        (element) =>
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

  const isFunctionExpression = (factory) => {
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

  const createFunctionCheck = (
    factory,
    functionCheckIdentifier,
    resultCheckIdentifier,
    dependencyInjections
  ) => {
    const factoryCallExpression = t.callExpression(
      functionCheckIdentifier,
      dependencyInjections.length > 0
        ? dependencyInjections.map((e) => (isExplicitDependencyInjection(e) ? e.expression : e))
        : [REQUIRE, EXPORTS, MODULE].map((a) => t.identifier(a))
    );
    const isModuleOrExportsInjected =
      dependencyInjections.length === 0 ||
      dependencyInjections.find(
        (d) => !isExplicitDependencyInjection(d) && [EXPORTS, MODULE].includes(d.name)
      );
    return [
      t.variableDeclaration('var', [t.variableDeclarator(functionCheckIdentifier, factory)]),
      t.ifStatement(
        t.binaryExpression(
          '===',
          t.unaryExpression('typeof', functionCheckIdentifier),
          t.stringLiteral('function')
        ),
        t.blockStatement(
          isModuleOrExportsInjected
            ? createModuleExportsResultCheck(factoryCallExpression, resultCheckIdentifier)
            : [createModuleExportsAssignmentExpression(factoryCallExpression)]
        ),
        t.blockStatement([
          ...dependencyInjections.filter(isExplicitDependencyInjection),
          createModuleExportsAssignmentExpression(functionCheckIdentifier),
        ])
      ),
    ];
  };

  const hasIgnoreComment = (node) => {
    const leadingComments = node.body?.[0]?.leadingComments || [];
    return leadingComments.some(
      ({ value }) => String(value).trim() === TRANSFORM_AMD_TO_COMMONJS_IGNORE
    );
  };

  return {
    decodeDefineArguments,
    decodeRequireArguments,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    createDependencyInjectionExpression,
    createRestDependencyInjectionExpression,
    isSimplifiedCommonJSWrapper,
    isModuleOrExportsInjected,
    getUniqueIdentifier,
    isFunctionExpression,
    createFactoryReplacementExpression,
    createFunctionCheck,
    isExplicitDependencyInjection,
    hasIgnoreComment,
  };
};
