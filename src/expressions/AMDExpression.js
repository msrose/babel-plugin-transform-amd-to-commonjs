'use strict';

class AMDExpression {
  constructor(t, path) {
    this.t = t;
    this.path = path;
  }

  isTransformable() {
    return this.t.isArrayExpression(this.getDependencyList()) || this.getFactory();
  }

  getTransformerClass() {}

  transformToCommonJS() {
    const Transformer = this.getTransformerClass();
    return new Transformer(this.t, this).getTransformationToCommonJS();
  }

  getArguments() {
    return this.path.node.expression.arguments;
  }

  getDependencyList() {}

  getFactory() {}

  getFactoryArity() {
    return this.getFactory().params.length;
  }

  hasFunctionFactory() {
    return this.t.isFunctionExpression(this.getFactory());
  }

  // https://github.com/requirejs/requirejs/wiki/differences-between-the-simplified-commonjs-wrapper-and-standard-amd-define
  isSimplifiedCommonJSWrapper() {
    return !this.getDependencyList() && this.getFactoryArity() > 0;
  }

  getScope() {
    return this.path.scope;
  }
}

module.exports = AMDExpression;
