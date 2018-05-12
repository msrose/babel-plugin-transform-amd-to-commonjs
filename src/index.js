'use strict';

const { REQUIRE, MODULE, EXPORTS, DEFINE, AMD_DEFINE_RESULT } = require('./constants');
const createHelpers = require('./helpers');

module.exports = ({ types: t }) => {
  const {
    decodeDefineArguments,
    decodeRequireArguments,
    isModuleOrExportsInjected,
    isSimplifiedCommonJSWrapper,
    createRequireExpression,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    getUniqueIdentifier,
    isFunctionExpression,
    createFactoryReplacementExpression
  } = createHelpers({ types: t });

  const argumentDecoders = {
    [DEFINE]: decodeDefineArguments,
    [REQUIRE]: decodeRequireArguments
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
    const requireExpressions = [];
    // Order is important here for the simplified commonjs wrapper
    const keywords = [REQUIRE, EXPORTS, MODULE];

    if (dependencyList) {
      const dependencyParameterPairs = zip(
        dependencyList.elements,
        isFunctionFactory ? factory.params : []
      );

      const explicitRequires = dependencyParameterPairs
        .filter(([dependency]) => {
          return !t.isStringLiteral(dependency) || !keywords.includes(dependency.value);
        })
        .map(([dependency, paramName]) => {
          return createRequireExpression(dependency, paramName);
        });

      requireExpressions.push(...explicitRequires);
    }

    if (isFunctionFactory) {
      const factoryArity = factory.params.length;
      let replacementFuncExpr = createFactoryReplacementExpression(factory, requireExpressions);
      let replacementCallExprParams = [];

      if (isSimplifiedCommonJSWrapper(dependencyList, factoryArity)) {
        replacementFuncExpr = factory;
        replacementCallExprParams = keywords.slice(0, factoryArity).map(a => t.identifier(a));
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
      const exportExpression = createModuleExportsAssignmentExpression(factory);
      const nodes = requireExpressions.concat(exportExpression);
      path.replaceWithMultiple(nodes);
    } else {
      path.replaceWithMultiple(requireExpressions);
    }
  };

  return {
    visitor: {
      ExpressionStatement
    }
  };
};
