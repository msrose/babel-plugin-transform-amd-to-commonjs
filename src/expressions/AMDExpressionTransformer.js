'use strict';

const { REQUIRE, MODULE, EXPORTS } = require('../constants');
const { createRequireExpression } = require('../helpers');

// Simple version of zip that only pairs elements until the end of the first array
const zip = (array1, array2) => {
  return array1.map((element, index) => [element, array2[index]]);
};

// Order is important here for the simplified commonjs wrapper
const keywords = [REQUIRE, EXPORTS, MODULE];

class AMDExpressionTransformer {
  constructor(t, amdExpression) {
    this.t = t;
    this.amdExpression = amdExpression;
  }

  getCommonJSRequireExpressions() {
    const dependencyList = this.amdExpression.getDependencyList();

    if (dependencyList) {
      const dependencyParameterPairs = zip(
        dependencyList.elements,
        this.amdExpression.hasFunctionFactory() ? this.amdExpression.getFactory().params : []
      );

      return dependencyParameterPairs
        .filter(([dependency]) => {
          return !this.t.isStringLiteral(dependency) || !keywords.includes(dependency.value);
        })
        .map(([dependency, paramName]) => {
          return createRequireExpression(this.t, dependency, paramName);
        });
    }

    return [];
  }

  // eslint-disable-next-line no-unused-vars
  processFunctionFactoryReplacement(factoryReplacement) {}

  getFunctionFactoryReplacement() {
    const factory = this.amdExpression.getFactory();
    const factoryArity = this.amdExpression.getFactoryArity();
    let replacementFuncExpr = this.t.functionExpression(
      null,
      [],
      this.t.blockStatement(this.getCommonJSRequireExpressions().concat(factory.body.body))
    );
    let replacementCallExprParams = [];

    if (this.amdExpression.isSimplifiedCommonJSWrapper()) {
      replacementFuncExpr = factory;
      replacementCallExprParams = keywords.slice(0, factoryArity).map(a => this.t.identifier(a));
    }

    return this.processFunctionFactoryReplacement(
      this.t.callExpression(replacementFuncExpr, replacementCallExprParams)
    );
  }

  getNonFunctionFactoryReplacement() {}

  getTransformationToCommonJS() {
    if (this.amdExpression.hasFunctionFactory()) {
      return this.getFunctionFactoryReplacement();
    } else if (this.amdExpression.getFactory()) {
      return this.getNonFunctionFactoryReplacement();
    } else {
      return this.getCommonJSRequireExpressions();
    }
  }
}

module.exports = AMDExpressionTransformer;
