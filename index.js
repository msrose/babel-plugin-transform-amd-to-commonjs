'use strict';

const REQUIRE = 'require';
const MODULE = 'module';
const EXPORTS = 'exports';
const DEFINE = 'define';

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

  const argumentDecoders = {
    [DEFINE]: decodeDefineArguments,
    [REQUIRE]: decodeRequireArguments
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

  // Simple version of zip that only pairs elements until the end of the first array
  const zip = (array1, array2) => {
    return array1.map((element, index) => [element, array2[index]]);
  };

  return {
    visitor: {
      ExpressionStatement(path) {
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

          const factoryReplacement = t.callExpression(
            replacementFuncExpr,
            replacementCallExprParams
          );

          if (isDefineCall && !isModuleOrExportsInjected(dependencyList, factoryArity)) {
            path.replaceWith(createModuleExportsAssignmentExpression(factoryReplacement));
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
      }
    }
  };
};
