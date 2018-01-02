'use strict';

const { REQUIRE, MODULE, EXPORTS, DEFINE, AMD_DEFINE_RESULT } = require('./constants');
const createHelpers = require('./helpers');

module.exports = ({ types: t }) => {
  const {
    isModuleOrExportsInjected,
    isSimplifiedCommonJSWrapper,
    createRequireExpression,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    getUniqueIdentifier
  } = createHelpers({ types: t });

  // Order is important here for the simplified commonjs wrapper
  const keywords = [REQUIRE, EXPORTS, MODULE];

  class AMDExpressionDecoder {
    constructor(path) {
      this.path = path;
    }

    isAMDExpression() {
      return t.isArrayExpression(this.getDependencyList()) || this.getFactory();
    }

    getArguments() {
      return this.path.node.expression.arguments;
    }

    getDependencyList() {}

    getFactory() {}

    // eslint-disable-next-line no-unused-vars
    processFunctionFactoryReplacement(scope, factoryReplacement) {}

    // eslint-disable-next-line no-unused-vars
    processNonFunctionFactoryReplacement(factory, requireExpressions) {}

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
      return this.getArguments()[0];
    }

    getFactory() {
      return this.getArguments()[1];
    }

    processFunctionFactoryReplacement(scope, factoryReplacement) {
      return [t.expressionStatement(factoryReplacement)];
    }

    processNonFunctionFactoryReplacement(factory, requireExpressions) {
      return requireExpressions;
    }
  }

  class DefineExpressionDecoder extends AMDExpressionDecoder {
    isAMDExpression() {
      return super.isAMDExpression() && t.isProgram(this.path.parent);
    }

    getDependencyList() {
      const args = this.getArguments();
      if (args.length === 2) {
        if (t.isArrayExpression(args[0])) {
          return args[0];
        }
      } else if (args.length !== 1) {
        return args[1];
      }
    }

    getFactory() {
      const args = this.getArguments();
      if (args.length === 1) {
        return args[0];
      } else if (args.length === 2) {
        return args[1];
      } else {
        return args[2];
      }
    }

    processFunctionFactoryReplacement(scope, factoryReplacement) {
      if (!isModuleOrExportsInjected(this.getDependencyList(), this.getFactory().params.length)) {
        return [createModuleExportsAssignmentExpression(factoryReplacement)];
      } else {
        const resultCheckIdentifier = getUniqueIdentifier(scope, AMD_DEFINE_RESULT);
        return createModuleExportsResultCheck(factoryReplacement, resultCheckIdentifier);
      }
    }

    processNonFunctionFactoryReplacement(factory, requireExpressions) {
      const exportExpression = createModuleExportsAssignmentExpression(factory);
      return requireExpressions.concat(exportExpression);
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

    const isFunctionFactory = t.isFunctionExpression(factory);
    const requireExpressions = [];

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

      path.replaceWithMultiple(
        decoder.processFunctionFactoryReplacement(path.scope, factoryReplacement)
      );
    } else if (factory) {
      const nonFunctionFactoryReplacement = decoder.processNonFunctionFactoryReplacement(
        factory,
        requireExpressions
      );
      path.replaceWithMultiple(nonFunctionFactoryReplacement);
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
