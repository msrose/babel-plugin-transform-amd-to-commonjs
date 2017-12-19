'use strict';

const { REQUIRE, MODULE, EXPORTS, DEFINE, AMD_DEFINE_RESULT } = require('./constants');
const createHelpers = require('./helpers');

module.exports = ({ types: t }) => {
  const {
    decodeDefineArguments,
    decodeRequireArguments,
    isModuleOrExportsInjected,
    createRequireExpression,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck
  } = createHelpers({ types: t });

  const argumentDecoders = {
    [DEFINE]: decodeDefineArguments,
    [REQUIRE]: decodeRequireArguments
  };

  // Simple version of zip that only pairs elements until the end of the first array
  const zip = (array1, array2) => {
    return array1.map((element, index) => [element, array2[index]]);
  };

  const ExpressionStatement = path => {
    const { node, parent } = path;

    if (!t.isCallExpression(node.expression)) return;

    const { name } = node.expression.callee;
    const isDefineCall = name === DEFINE;

    if (isDefineCall && !t.isProgram(parent)) return;

    const argumentDecoder = argumentDecoders[name];

    if (!argumentDecoder) return;

    const { dependencyList, factory } = argumentDecoder(node.expression.arguments);

    if (!t.isArrayExpression(dependencyList) && !factory) return;

    const isFunctionFactory = t.isFunctionExpression(factory);
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
          return !t.isStringLiteral(dependency) || keywords.indexOf(dependency.value) === -1;
        })
        .map(([dependency, paramName]) => {
          return createRequireExpression(dependency, paramName);
        });

      requireExpressions.push(...explicitRequires);
    }

    if (isFunctionFactory) {
      const factoryArity = factory.params.length;
      let replacementFuncExpr = t.functionExpression(
        null,
        [],
        t.blockStatement(requireExpressions.concat(factory.body.body))
      );
      let replacementCallExprParams = [];

      // https://github.com/requirejs/requirejs/wiki/differences-between-the-simplified-commonjs-wrapper-and-standard-amd-define
      const isSimplifiedCommonJSWrapper = !dependencyList && factoryArity > 0;
      if (isSimplifiedCommonJSWrapper) {
        replacementFuncExpr = factory;
        replacementCallExprParams = keywords.slice(0, factoryArity).map(a => t.identifier(a));
      }

      const factoryReplacement = t.callExpression(replacementFuncExpr, replacementCallExprParams);

      if (isDefineCall) {
        if (!isModuleOrExportsInjected(dependencyList, factoryArity)) {
          path.replaceWith(createModuleExportsAssignmentExpression(factoryReplacement));
        } else {
          const resultCheckIdentifier = path.scope.hasOwnBinding(AMD_DEFINE_RESULT)
            ? path.scope.generateUidIdentifier(AMD_DEFINE_RESULT)
            : t.identifier(AMD_DEFINE_RESULT);
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
