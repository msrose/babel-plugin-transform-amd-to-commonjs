'use strict';

const { REQUIRE, EXPORTS, MODULE, AMD_DEFINE_RESULT, MAYBE_FUNCTION } = require('../src/constants');

const checkAmdDefineResult = (value, identifier = AMD_DEFINE_RESULT) => `
  var ${identifier} = ${value};
  typeof ${identifier} !== "undefined" && (module.exports = ${identifier});
`;

const checkMaybeFunction = (factory, dependencies, identifier = MAYBE_FUNCTION) => {
  const amdKeywords = [REQUIRE, EXPORTS, MODULE];
  const requiredDependencies = (dependencies || []).map(d => {
    if (amdKeywords.includes(d)) {
      return d;
    }
    return `require('${d}')`;
  });
  const injectedDependencies = dependencies
    ? requiredDependencies.join(',')
    : amdKeywords.join(',');
  return `
      var ${identifier} = ${factory};
      module.exports = (
        typeof ${identifier} === "function"
          ? ${identifier}(${injectedDependencies})
          : (function() {
            ${requiredDependencies.filter(d => !amdKeywords.includes(d)).join(';\n')}
            return ${identifier};
          })()
      );
    `;
};

module.exports = {
  checkAmdDefineResult,
  checkMaybeFunction
};
