'use strict';

const {
  REQUIRE,
  MODULE,
  EXPORTS,
  DEFINE,
  AMD_DEFINE_RESULT,
  MAYBE_FUNCTION,
} = require('./constants');
const createHelpers = require('./helpers');

module.exports = ({ types: t }) => {
  const {
    decodeDefineArguments,
    decodeRequireArguments,
    isModuleOrExportsInjected,
    isSimplifiedCommonJSWrapper,
    createDependencyInjectionExpression,
    createRestDependencyInjectionExpression,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    getUniqueIdentifier,
    isFunctionExpression,
    createFactoryReplacementExpression,
    createFunctionCheck,
    isExplicitDependencyInjection,
  } = createHelpers({ types: t });

  const argumentDecoders = {
    [DEFINE]: decodeDefineArguments,
    [REQUIRE]: decodeRequireArguments,
  };

  // Simple version of zip that only pairs elements until the end of the first array
  const zip = (array1, array2) => {
    return array1.map((element, index) => [element, array2[index]]);
  };

  const ExpressionStatement = (path, { opts }) => {
    const { node, parent } = path;

    if (!t.isCallExpression(node.expression)) return;

    const options = Object.assign({ restrictToTopLevelDefine: true }, opts);

    const { name } = node.expression.callee;
    const isDefineCall = name === DEFINE;

    if (isDefineCall && options.restrictToTopLevelDefine && !t.isProgram(parent)) return;

    const argumentDecoder = argumentDecoders[name];

    if (!argumentDecoder) return;

    const { dependencyList, factory } = argumentDecoder(node.expression.arguments);

    if (!t.isArrayExpression(dependencyList) && !factory) return;

    const isFunctionFactory = isFunctionExpression(factory);
    const dependencyInjections = [];

    if (dependencyList) {
      const dependencyParameterPairs = zip(
        dependencyList.elements,
        isFunctionFactory ? factory.params : []
      );

      if (isFunctionFactory) {
        const factoryArity = factory.params.length;
        const lastFactoryParam = factory.params[factoryArity - 1];
        if (t.isRestElement(lastFactoryParam)) {
          const restDependencyNodes = dependencyList.elements.slice(factoryArity - 1);
          const restDependencyInjections =
            createRestDependencyInjectionExpression(restDependencyNodes);
          dependencyParameterPairs.splice(
            factoryArity - 1,
            dependencyParameterPairs.length - factoryArity + 1,
            [restDependencyInjections, lastFactoryParam.argument]
          );
        }
      }

      const dependencyInjectionExpressions = dependencyParameterPairs.map(
        ([dependency, paramName]) => {
          return createDependencyInjectionExpression(dependency, paramName);
        }
      );

      dependencyInjections.push(...dependencyInjectionExpressions);
    }

    const explicitDependencyInjections = dependencyInjections.filter(isExplicitDependencyInjection);

    if (isFunctionFactory) {
      const factoryArity = factory.params.length;
      let replacementFuncExpr = createFactoryReplacementExpression(
        factory,
        explicitDependencyInjections
      );
      let replacementCallExprParams = [];

      if (isSimplifiedCommonJSWrapper(dependencyList, factoryArity)) {
        replacementFuncExpr = factory;

        // Order is important here for the simplified commonjs wrapper
        const amdKeywords = [REQUIRE, EXPORTS, MODULE];

        replacementCallExprParams = amdKeywords
          .slice(0, factoryArity)
          .map((keyword) => t.identifier(keyword));
      }

      const factoryReplacement = t.callExpression(replacementFuncExpr, replacementCallExprParams);

      if (isDefineCall) {
        if (!isModuleOrExportsInjected(dependencyList, factoryArity)) {
          path.replaceWith(createModuleExportsAssignmentExpression(factoryReplacement));
        } else {
          const resultCheckIdentifier = getUniqueIdentifier(path.scope, AMD_DEFINE_RESULT);
          path.replaceWithMultiple(
            createModuleExportsResultCheck(factoryReplacement, resultCheckIdentifier)
          );
        }
      } else {
        path.replaceWith(factoryReplacement);
      }
    } else if (factory && isDefineCall) {
      const functionCheckNodes = createFunctionCheck(
        factory,
        getUniqueIdentifier(path.scope, MAYBE_FUNCTION),
        getUniqueIdentifier(path.scope, AMD_DEFINE_RESULT),
        dependencyInjections
      );
      path.replaceWithMultiple(functionCheckNodes);
    } else {
      path.replaceWithMultiple(explicitDependencyInjections);
    }
  };

  return {
    visitor: {
      ExpressionStatement,
    },
  };
};
