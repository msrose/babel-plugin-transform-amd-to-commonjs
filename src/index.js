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

    getRequireExpressions() {
      const dependencyList = this.getDependencyList();
      const factory = this.getFactory();

      const isFunctionFactory = t.isFunctionExpression(factory);

      if (dependencyList) {
        const dependencyParameterPairs = zip(
          dependencyList.elements,
          isFunctionFactory ? factory.params : []
        );

        return dependencyParameterPairs
          .filter(([dependency]) => {
            return !t.isStringLiteral(dependency) || !keywords.includes(dependency.value);
          })
          .map(([dependency, paramName]) => {
            return createRequireExpression(dependency, paramName);
          });
      }

      return [];
    }

    // eslint-disable-next-line no-unused-vars
    processFunctionFactoryReplacement(scope, factoryReplacement) {}

    getNonFunctionFactoryReplacement() {}

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

    getNonFunctionFactoryReplacement() {
      return this.getRequireExpressions();
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

    getNonFunctionFactoryReplacement() {
      const exportExpression = createModuleExportsAssignmentExpression(this.getFactory());
      return this.getRequireExpressions().concat(exportExpression);
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
    const requireExpressions = decoder.getRequireExpressions();

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
      const nonFunctionFactoryReplacement = decoder.getNonFunctionFactoryReplacement();
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
