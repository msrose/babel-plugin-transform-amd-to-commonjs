'use strict';

const { REQUIRE, MODULE, EXPORTS, DEFINE, AMD_DEFINE_RESULT } = require('./constants');
const createHelpers = require('./helpers');

module.exports = ({ types: t }) => {
  const {
    decodeDefineArguments,
    isModuleOrExportsInjected,
    isSimplifiedCommonJSWrapper,
    createRequireExpression,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    getUniqueIdentifier
  } = createHelpers({ types: t });

  class AMDExpressionDecoder {
    constructor(path) {
      this.path = path;
    }

    isAMDExpression() {
      return t.isArrayExpression(this.getDependencyList()) || this.getFactory();
    }

    getDependencyList() {}

    getFactory() {}

    isDefineCall() {
      return this.path.node.expression.callee.name === DEFINE;
    }

    static createExpressionDecoder(path) {
      const decoders = {
        [DEFINE]: DefineExpressionDecoder,
        [REQUIRE]: RequireExpressionDecoder
      };
      const name = t.isCallExpression(path.node.expression) && path.node.expression.callee.name;
      return new (decoders[name] || InvalidAMDExpressionDecoder)(path);
    }
  }

  class RequireExpressionDecoder extends AMDExpressionDecoder {
    getDependencyList() {
      return this.path.node.expression.arguments[0];
    }

    getFactory() {
      return this.path.node.expression.arguments[1];
    }
  }

  class DefineExpressionDecoder extends AMDExpressionDecoder {
    isAMDExpression() {
      return super.isAMDExpression() && t.isProgram(this.path.parent);
    }

    getDependencyList() {
      return decodeDefineArguments(this.path.node.expression.arguments).dependencyList;
    }

    getFactory() {
      return decodeDefineArguments(this.path.node.expression.arguments).factory;
    }
  }

  class InvalidAMDExpressionDecoder extends AMDExpressionDecoder {
    isAMDExpression() {
      return false;
    }
  }

  // Simple version of zip that only pairs elements until the end of the first array
  const zip = (array1, array2) => {
    return array1.map((element, index) => [element, array2[index]]);
  };

  const ExpressionStatement = path => {
    const decoder = AMDExpressionDecoder.createExpressionDecoder(path);

    if (!decoder.isAMDExpression()) return;

    const dependencyList = decoder.getDependencyList();
    const factory = decoder.getFactory();
    const isDefineCall = decoder.isDefineCall();

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
          return !t.isStringLiteral(dependency) || !keywords.includes(dependency.value);
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
