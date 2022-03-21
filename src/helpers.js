'use strict';

const {
  MODULE,
  EXPORTS,
  REQUIRE,
  TRANSFORM_AMD_TO_COMMONJS_IGNORE,
  MAYBE_FUNCTION,
  AMD_DEPS,
} = require('./constants');

// A factory function is exported in order to inject the same babel-types object
// being used by the plugin itself
module.exports = ({ types: t }) => {
  const decodeDefineArguments = (argNodes) => {
    if (argNodes.length === 1) {
      return { factory: argNodes[0] };
    } else if (argNodes.length === 2) {
      const decodedArgs = { factory: argNodes[1] };
      if (t.isArrayExpression(argNodes[0])) {
        decodedArgs.dependencyList = argNodes[0];
      }
      return decodedArgs;
    } else {
      return { dependencyList: argNodes[1], factory: argNodes[2] };
    }
  };

  const decodeRequireArguments = (argNodes) => {
    return { dependencyList: argNodes[0], factory: argNodes[1] };
  };

  const createModuleExportsAssignmentExpression = (value) => {
    return t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(t.identifier(MODULE), t.identifier(EXPORTS)),
        value
      )
    );
  };

  const createModuleExportsResultCheck = (value, identifier) => {
    return [
      t.variableDeclaration('var', [t.variableDeclarator(identifier, value)]),
      t.expressionStatement(
        t.logicalExpression(
          '&&',
          t.binaryExpression(
            '!==',
            t.unaryExpression('typeof', identifier),
            t.stringLiteral('undefined')
          ),
          createModuleExportsAssignmentExpression(identifier).expression
        )
      ),
    ];
  };

  const createDependencyInjectionExpression = (dependencyNode, variableName) => {
    if (
      t.isStringLiteral(dependencyNode) &&
      [MODULE, EXPORTS, REQUIRE].includes(dependencyNode.value)
    ) {
      // In case of the AMD keywords, only create an expression if the variable name
      // does not match the keyword. This to prevent 'require = require' statements.
      if (variableName && variableName.name !== dependencyNode.value) {
        return t.variableDeclaration('var', [
          t.variableDeclarator(variableName, t.identifier(dependencyNode.value)),
        ]);
      }
      return t.identifier(dependencyNode.value);
    }

    const requireCall = t.isArrayExpression(dependencyNode)
      ? dependencyNode
      : t.callExpression(t.identifier(REQUIRE), [dependencyNode]);

    if (variableName) {
      return t.variableDeclaration('var', [t.variableDeclarator(variableName, requireCall)]);
    } else {
      return t.expressionStatement(requireCall);
    }
  };

  const isExplicitDependencyInjection = (dependencyInjection) => {
    return (
      !t.isIdentifier(dependencyInjection) ||
      ![REQUIRE, EXPORTS, MODULE].includes(dependencyInjection.name)
    );
  };

  const createRestDependencyInjectionExpression = (dependencyNodes) => {
    return t.arrayExpression(
      dependencyNodes.map((node) => {
        const dependencyInjection = createDependencyInjectionExpression(node);
        if (isExplicitDependencyInjection(dependencyInjection)) {
          return dependencyInjection.expression;
        }
        return t.identifier(node.value);
      })
    );
  };

  const isModuleOrExportsInDependencyList = (dependencyList) => {
    return (
      dependencyList &&
      dependencyList.elements.some(
        (element) =>
          t.isStringLiteral(element) && (element.value === MODULE || element.value === EXPORTS)
      )
    );
  };

  // https://github.com/requirejs/requirejs/wiki/differences-between-the-simplified-commonjs-wrapper-and-standard-amd-define
  const isSimplifiedCommonJSWrapper = (dependencyList, factoryArity) => {
    return !dependencyList && factoryArity > 0;
  };

  const isSimplifiedCommonJSWrapperWithModuleOrExports = (dependencyList, factoryArity) => {
    return isSimplifiedCommonJSWrapper(dependencyList, factoryArity) && factoryArity > 1;
  };

  const isModuleOrExportsInjected = (dependencyList, factoryArity) => {
    return (
      isModuleOrExportsInDependencyList(dependencyList) ||
      isSimplifiedCommonJSWrapperWithModuleOrExports(dependencyList, factoryArity)
    );
  };

  const getUniqueIdentifier = (scope, name) => {
    return scope.hasOwnBinding(name) ? scope.generateUidIdentifier(name) : t.identifier(name);
  };

  const isFunctionExpression = (factory) => {
    return t.isFunctionExpression(factory) || t.isArrowFunctionExpression(factory);
  };

  const createFactoryReplacementExpression = (factory, dependencyInjections) => {
    if (t.isFunctionExpression(factory)) {
      return t.functionExpression(
        null,
        [],
        t.blockStatement(dependencyInjections.concat(factory.body.body))
      );
    }
    let bodyStatement;
    if (t.isBlockStatement(factory.body)) {
      bodyStatement = factory.body.body;
    } else {
      // implicit return arrow function
      bodyStatement = t.returnStatement(factory.body);
    }
    return t.arrowFunctionExpression(
      [],
      t.blockStatement(dependencyInjections.concat(bodyStatement))
    );
  };

  const createFunctionCheck = (
    factory,
    functionCheckIdentifier,
    resultCheckIdentifier,
    dependencyInjections
  ) => {
    const factoryCallExpression = t.callExpression(
      functionCheckIdentifier,
      dependencyInjections.length > 0
        ? dependencyInjections.map((e) => (isExplicitDependencyInjection(e) ? e.expression : e))
        : [REQUIRE, EXPORTS, MODULE].map((a) => t.identifier(a))
    );
    const isModuleOrExportsInjected =
      dependencyInjections.length === 0 ||
      dependencyInjections.find(
        (d) => !isExplicitDependencyInjection(d) && [EXPORTS, MODULE].includes(d.name)
      );
    return [
      t.variableDeclaration('var', [t.variableDeclarator(functionCheckIdentifier, factory)]),
      t.ifStatement(
        t.binaryExpression(
          '===',
          t.unaryExpression('typeof', functionCheckIdentifier),
          t.stringLiteral('function')
        ),
        t.blockStatement(
          isModuleOrExportsInjected
            ? createModuleExportsResultCheck(factoryCallExpression, resultCheckIdentifier)
            : [createModuleExportsAssignmentExpression(factoryCallExpression)]
        ),
        t.blockStatement([
          ...dependencyInjections.filter(isExplicitDependencyInjection),
          createModuleExportsAssignmentExpression(functionCheckIdentifier),
        ])
      ),
    ];
  };

  const hasIgnoreComment = (node) => {
    const leadingComments = node.body?.[0]?.leadingComments || [];
    return leadingComments.some(
      ({ value }) => String(value).trim() === TRANSFORM_AMD_TO_COMMONJS_IGNORE
    );
  };

  const getAmdFactoryArgsMapper = () => {
    // Returns the factory args genrator function.
    //
    // function(dep) {
    //   return {
    //     require: require,
    //     module: module,
    //     exports: module.exports
    //   }[dep] || require(dep);
    // }
    const moduleIdent = t.identifier(MODULE);
    const requireIdent = t.identifier(REQUIRE);
    const exportsIdent = t.identifier(EXPORTS);
    const DEP = 'dep';
    return t.functionExpression(
      null,
      [t.identifier(DEP)],
      t.blockStatement([
        t.returnStatement(
          t.logicalExpression(
            '||',
            t.memberExpression(
              t.objectExpression([
                t.objectProperty(requireIdent, requireIdent),
                t.objectProperty(moduleIdent, moduleIdent),
                t.objectProperty(exportsIdent, t.memberExpression(moduleIdent, exportsIdent)),
              ]),
              t.identifier(DEP),
              true
            ),
            t.callExpression(t.identifier(REQUIRE), [t.identifier(DEP)])
          )
        ),
      ])
    );
  };

  const createRequireReplacementWithUnknownVarTypes = (path, opts, dependencyList, factory) => {
    const factoryIdentifier = getUniqueIdentifier(path.scope, MAYBE_FUNCTION);
    const depsIdentifier = getUniqueIdentifier(path.scope, AMD_DEPS);
    const blockStatements = [];

    // Define block scoped variables 'maybeFunction' and 'amdDeps'.
    blockStatements.push(
      t.variableDeclaration('var', [t.variableDeclarator(factoryIdentifier, factory)])
    );
    blockStatements.push(
      t.variableDeclaration('var', [t.variableDeclarator(depsIdentifier, dependencyList)])
    );

    // If we don't know that the dependency list is an array, then we need to check
    // the type at runtime.
    if (!t.isArrayExpression(dependencyList)) {
      // if (!Array.isArray(amdDeps)) {
      //   return require(amdDeps);
      // }
      blockStatements.push(
        t.ifStatement(
          t.unaryExpression(
            '!',
            t.callExpression(t.memberExpression(t.identifier('Array'), t.identifier('isArray')), [
              depsIdentifier,
            ])
          ),
          t.blockStatement([
            t.returnStatement(t.callExpression(t.identifier(REQUIRE), [depsIdentifier])),
          ])
        )
      );
    }

    // If we don't know that the factory is a function, the we need to check the type
    // at runtime.
    if (!isFunctionExpression(factory)) {
      // if (typeof maybeFunction !== 'function') {
      //   maybeFunction = function () {};
      // }
      blockStatements.push(
        t.ifStatement(
          t.binaryExpression(
            '!==',
            t.unaryExpression('typeof', factoryIdentifier),
            t.stringLiteral('function')
          ),
          t.blockStatement([
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                factoryIdentifier,
                t.functionExpression(null, [], t.blockStatement([]))
              )
            ),
          ])
        )
      );
    }
    // Invoke the factory function.
    blockStatements.push(
      t.expressionStatement(
        t.callExpression(t.memberExpression(factoryIdentifier, t.identifier('apply')), [
          /*
           * The 'this' argument for the factory function.
           * 'void 0'
           */
          t.unaryExpression('void', t.numericLiteral(0)),

          /*
           * The arguments to the factory function as an array.
           * 'deps.map(amdFactoryArgsGenerator)''
           */
          t.callExpression(t.memberExpression(depsIdentifier, t.identifier('map')), [
            getAmdFactoryArgsMapper(path, opts),
          ]),
        ])
      )
    );
    // Wrap it all up in an IIF, being sure to preserve the 'this' reference from
    // outer scope.
    return t.callExpression(
      t.memberExpression(
        t.parenthesizedExpression(
          t.functionExpression(null, [], t.blockStatement(blockStatements))
        ),
        t.identifier('apply')
      ),
      [t.thisExpression()]
    );
  };

  return {
    decodeDefineArguments,
    decodeRequireArguments,
    createModuleExportsAssignmentExpression,
    createModuleExportsResultCheck,
    createDependencyInjectionExpression,
    createRestDependencyInjectionExpression,
    isSimplifiedCommonJSWrapper,
    isModuleOrExportsInjected,
    getUniqueIdentifier,
    isFunctionExpression,
    createFactoryReplacementExpression,
    createFunctionCheck,
    isExplicitDependencyInjection,
    hasIgnoreComment,
    getAmdFactoryArgsMapper,
    createRequireReplacementWithUnknownVarTypes,
  };
};
