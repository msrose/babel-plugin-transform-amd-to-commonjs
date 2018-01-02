'use strict';

const AMDExpression = require('./AMDExpression');
const DefineExpressionTransformer = require('./DefineExpressionTransformer');

class DefineExpression extends AMDExpression {
  isTransformable() {
    return super.isTransformable() && this.t.isProgram(this.path.parent);
  }

  getTransformerClass() {
    return DefineExpressionTransformer;
  }

  getDependencyList() {
    const args = this.getArguments();
    if (args.length === 2) {
      if (this.t.isArrayExpression(args[0])) {
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
}

module.exports = DefineExpression;
