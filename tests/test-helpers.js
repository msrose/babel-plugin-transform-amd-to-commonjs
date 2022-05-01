'use strict';

const { REQUIRE, EXPORTS, MODULE, AMD_DEFINE_RESULT, MAYBE_FUNCTION } = require('../src/constants');

const checkAmdDefineResult = (value, identifier = AMD_DEFINE_RESULT) => `
  var ${identifier} = ${value};
  typeof ${identifier} !== "undefined" && (module.exports = ${identifier});
`;

const checkMaybeFunction = (factory, dependencies, identifier = MAYBE_FUNCTION) => {
  const amdKeywords = [REQUIRE, EXPORTS, MODULE];
  const requiredDependencies = (dependencies || []).map((d) => {
    if (amdKeywords.includes(d)) {
      return d;
    }
    return `require('${d}')`;
  });
  const isModuleOrExportsInjected =
    !dependencies || requiredDependencies.find((d) => [MODULE, EXPORTS].includes(d));
  const injectedDependencies = dependencies
    ? requiredDependencies.join(',')
    : amdKeywords.join(',');
  const factoryCallExpression = `${identifier}(${injectedDependencies})`;
  return `
      var ${identifier} = ${factory};
      if (typeof ${identifier} === "function") {
        ${
          isModuleOrExportsInjected
            ? checkAmdDefineResult(factoryCallExpression)
            : `module.exports = ${factoryCallExpression}`
        }
      } else {
        ${requiredDependencies.filter((d) => !amdKeywords.includes(d)).join(';\n')}
        module.exports = ${identifier};
      }
    `;
};

const checkVariableDepAndFactoryResult = ({
  factory,
  dependencies,
  checkDeps,
  checkFactory,
  isDefineCall,
  checkForModuleName,
}) => {
  const requireFactoryResult = `
    maybeFunction = function() {};
  `;
  const defineFactoryResult = `
    var amdFactoryResult = maybeFunction;
    maybeFunction = function () {
      return amdFactoryResult;
    };
  `;
  let factoryCheck = '';
  if (checkFactory) {
    factoryCheck = `
    if (typeof maybeFunction !== "function") {
      ${isDefineCall ? defineFactoryResult : requireFactoryResult}
    }
    `;
  }
  let depsCheck = '';
  if (checkDeps) {
    if (isDefineCall) {
      if (checkForModuleName) {
        depsCheck = `
        if (typeof amdDeps === "string") {
          amdDeps = ["require", "exports", "module"];
        }
        `;
      }
    } else {
      depsCheck = `
      if (!Array.isArray(amdDeps)) {
        return require(amdDeps);
      }
      `;
    }
  }

  return `
  (function () {
    var maybeFunction = ${factory};
    var amdDeps = ${dependencies};
    ${depsCheck}${factoryCheck}
    ${
      isDefineCall ? 'var amdDefineResult = ' : ''
    }maybeFunction.apply(void 0, amdDeps.map(function (dep) {
      return {
        require: require,
        module: module,
        exports: module.exports
      }[dep] || require(dep);
    }));
    ${
      isDefineCall
        ? 'typeof amdDefineResult !== "undefined" && (module.exports = amdDefineResult);'
        : ''
    }
  }).apply(this);
  `;
};

module.exports = {
  checkAmdDefineResult,
  checkMaybeFunction,
  checkVariableDepAndFactoryResult,
};
