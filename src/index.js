'use strict';

const { REQUIRE, MODULE, EXPORTS, DEFINE, AMD_DEFINE_RESULT } = require('./constants');
const createHelpers = require('./helpers');

module.exports = ({ types: t }) => {
  const {
    createRequireExpression,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    getUniqueIdentifier
  } = createHelpers({ types: t });

  // Simple version of zip that only pairs elements until the end of the first array
  const zip = (array1, array2) => {
    return array1.map((element, index) => [element, array2[index]]);
  };

  // Order is important here for the simplified commonjs wrapper
  const keywords = [REQUIRE, EXPORTS, MODULE];

  class AMDExpressionTransformer {
    constructor(path) {
      this.path = path;
    }

    isTransformableAMDExpression() {
      return t.isArrayExpression(this.getDependencyList()) || this.getFactory();
    }

    getArguments() {
      return this.path.node.expression.arguments;
    }

    getDependencyList() {}

    getFactory() {}

    hasFunctionFactory() {
      return t.isFunctionExpression(this.getFactory());
    }

    getCommonJSRequireExpressions() {
      const dependencyList = this.getDependencyList();

      if (dependencyList) {
        const dependencyParameterPairs = zip(
          dependencyList.elements,
          this.hasFunctionFactory() ? this.getFactory().params : []
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
    processFunctionFactoryReplacement(factoryReplacement) {}

    getFactoryArity() {
      return this.getFactory().params.length;
    }

    getFunctionFactoryReplacement() {
      const factory = this.getFactory();
      const factoryArity = this.getFactoryArity();
      let replacementFuncExpr = t.functionExpression(
        null,
        [],
        t.blockStatement(this.getCommonJSRequireExpressions().concat(factory.body.body))
      );
      let replacementCallExprParams = [];

      if (this.isSimplifiedCommonJSWrapper()) {
        replacementFuncExpr = factory;
        replacementCallExprParams = keywords.slice(0, factoryArity).map(a => t.identifier(a));
      }

      return this.processFunctionFactoryReplacement(
        t.callExpression(replacementFuncExpr, replacementCallExprParams)
      );
    }

    getNonFunctionFactoryReplacement() {}

    getTransformationToCommonJS() {
      if (this.hasFunctionFactory()) {
        return this.getFunctionFactoryReplacement();
      } else if (this.getFactory()) {
        return this.getNonFunctionFactoryReplacement();
      } else {
        return this.getCommonJSRequireExpressions();
      }
    }

    isModuleOrExportsInDependencyList() {
      const dependencyList = this.getDependencyList();
      return (
        dependencyList &&
        dependencyList.elements.some(
          element =>
            t.isStringLiteral(element) && (element.value === MODULE || element.value === EXPORTS)
        )
      );
    }

    isSimplifiedCommonJSWrapper() {
      return !this.getDependencyList() && this.getFactoryArity() > 0;
    }

    isSimplifiedCommonJSWrapperWithModuleOrExports() {
      return this.isSimplifiedCommonJSWrapper() && this.getFactoryArity() > 1;
    }

    isModuleOrExportsInjected() {
      return (
        this.isModuleOrExportsInDependencyList() ||
        this.isSimplifiedCommonJSWrapperWithModuleOrExports()
      );
    }

    static createExpressionTransformer(path) {
      const decoders = {
        [DEFINE]: DefineExpressionTransformer,
        [REQUIRE]: RequireExpressionTransformer
      };
      const name = t.isCallExpression(path.node.expression) && path.node.expression.callee.name;
      return new (decoders[name] || InvalidAMDExpressionTransformer)(path);
    }
  }

  class RequireExpressionTransformer extends AMDExpressionTransformer {
    getDependencyList() {
      return this.getArguments()[0];
    }

    getFactory() {
      return this.getArguments()[1];
    }

    processFunctionFactoryReplacement(factoryReplacement) {
      return [t.expressionStatement(factoryReplacement)];
    }

    getNonFunctionFactoryReplacement() {
      return this.getCommonJSRequireExpressions();
    }
  }

  class DefineExpressionTransformer extends AMDExpressionTransformer {
    isTransformableAMDExpression() {
      return super.isTransformableAMDExpression() && t.isProgram(this.path.parent);
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

    processFunctionFactoryReplacement(factoryReplacement) {
      if (!this.isModuleOrExportsInjected()) {
        return [createModuleExportsAssignmentExpression(factoryReplacement)];
      } else {
        const resultCheckIdentifier = getUniqueIdentifier(this.path.scope, AMD_DEFINE_RESULT);
        return createModuleExportsResultCheck(factoryReplacement, resultCheckIdentifier);
      }
    }

    getNonFunctionFactoryReplacement() {
      const exportExpression = createModuleExportsAssignmentExpression(this.getFactory());
      return this.getCommonJSRequireExpressions().concat(exportExpression);
    }
  }

  class InvalidAMDExpressionTransformer extends AMDExpressionTransformer {
    isTransformableAMDExpression() {
      return false;
    }
  }

  const ExpressionStatement = path => {
    const transformer = AMDExpressionTransformer.createExpressionTransformer(path);

    if (!transformer.isTransformableAMDExpression()) return;

    path.replaceWithMultiple(transformer.getTransformationToCommonJS());
  };

  return {
    visitor: {
      ExpressionStatement
    }
  };
};
