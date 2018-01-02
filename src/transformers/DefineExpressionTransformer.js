'use strict';

const AMDExpressionTransformer = require('./AMDExpressionTransformer');
const {
  createModuleExportsAssignmentExpression,
  createModuleExportsResultCheck,
  getUniqueIdentifier
} = require('../helpers');
const { AMD_DEFINE_RESULT } = require('../constants');

class DefineExpressionTransformer extends AMDExpressionTransformer {
  isTransformableAMDExpression() {
    return super.isTransformableAMDExpression() && this.t.isProgram(this.path.parent);
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

  processFunctionFactoryReplacement(factoryReplacement) {
    if (!this.isModuleOrExportsInjected()) {
      return [createModuleExportsAssignmentExpression(this.t, factoryReplacement)];
    } else {
      const resultCheckIdentifier = getUniqueIdentifier(this.t, this.path.scope, AMD_DEFINE_RESULT);
      return createModuleExportsResultCheck(this.t, factoryReplacement, resultCheckIdentifier);
    }
  }

  getNonFunctionFactoryReplacement() {
    const exportExpression = createModuleExportsAssignmentExpression(this.t, this.getFactory());
    return this.getCommonJSRequireExpressions().concat(exportExpression);
  }
}

module.exports = DefineExpressionTransformer;
