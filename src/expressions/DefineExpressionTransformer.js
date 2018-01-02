'use strict';

const { MODULE, EXPORTS, AMD_DEFINE_RESULT } = require('../constants');
const {
  createModuleExportsAssignmentExpression,
  createModuleExportsResultCheck,
  getUniqueIdentifier
} = require('../helpers');
const AMDExpressionTransformer = require('./AMDExpressionTransformer');

class DefineExpressionTransformer extends AMDExpressionTransformer {
  _isModuleOrExportsInDependencyList() {
    const dependencyList = this.amdExpression.getDependencyList();
    return (
      dependencyList &&
      dependencyList.elements.some(
        element =>
          this.t.isStringLiteral(element) && (element.value === MODULE || element.value === EXPORTS)
      )
    );
  }

  _isSimplifiedCommonJSWrapperWithModuleOrExports() {
    return (
      this.amdExpression.isSimplifiedCommonJSWrapper() && this.amdExpression.getFactoryArity() > 1
    );
  }

  _isModuleOrExportsInjected() {
    return (
      this._isModuleOrExportsInDependencyList() ||
      this._isSimplifiedCommonJSWrapperWithModuleOrExports()
    );
  }

  processFunctionFactoryReplacement(factoryReplacement) {
    if (!this._isModuleOrExportsInjected()) {
      return [createModuleExportsAssignmentExpression(this.t, factoryReplacement)];
    } else {
      const resultCheckIdentifier = getUniqueIdentifier(
        this.t,
        this.amdExpression.getScope(),
        AMD_DEFINE_RESULT
      );
      return createModuleExportsResultCheck(this.t, factoryReplacement, resultCheckIdentifier);
    }
  }

  getNonFunctionFactoryReplacement() {
    const exportExpression = createModuleExportsAssignmentExpression(
      this.t,
      this.amdExpression.getFactory()
    );
    return this.getCommonJSRequireExpressions().concat(exportExpression);
  }
}

module.exports = DefineExpressionTransformer;
