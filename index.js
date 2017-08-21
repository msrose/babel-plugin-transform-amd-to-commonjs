'use strict';

module.exports = ({ types: t }) => {
  const decodeDefineArguments = (argNodes) => {
    if(argNodes.length === 1) {
      return { factory: argNodes[0] };
    } else if(argNodes.length === 2) {
      const decodedArgs = { factory: argNodes[1] };
      if(t.isArrayExpression(argNodes[0])) {
        decodedArgs.dependencyList = argNodes[0];
      }
      return decodedArgs;
    } else {
      return { dependencyList: argNodes[1], factory: argNodes[2] };
    }
  };

  const decodeRequireArguments = (argNodes) => {
    if(argNodes.length === 1) {
      return { dependencyList: argNodes[0] };
    } else {
      return { dependencyList: argNodes[0], factory: argNodes[1] };
    }
  };

  const createModuleExportsAssignmentExpression = (value) => {
    return t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          t.identifier('module'), t.identifier('exports')
        ),
        value
      )
    );
  };

  const createRequireExpression = (dependencyNode, variableName) => {
    const requireCall = t.callExpression(t.identifier('require'), [dependencyNode]);
    if(variableName) {
      return t.variableDeclaration('var', [t.variableDeclarator(variableName, requireCall)]);
    } else {
      return t.expressionStatement(requireCall);
    }
  };

  return {
    visitor: {
      ExpressionStatement(path) {
        const { node, parent } = path;

        if(!t.isCallExpression(node.expression)) return;

        const { name } = node.expression.callee;
        const isDefineCall = name === 'define';

        if(isDefineCall && !t.isProgram(parent)) return;

        const argumentDecoders = {
          define: decodeDefineArguments,
          require: decodeRequireArguments
        };
        const argumentDecoder = argumentDecoders[name];

        if(!argumentDecoder) return;

        const { dependencyList, factory } = argumentDecoder(node.expression.arguments);

        if(!t.isArrayExpression(dependencyList) && !factory) return;

        let injectsModuleOrExports = false;
        const isFunctionFactory = t.isFunctionExpression(factory);
        const requireExpressions = [];

        if(dependencyList) {
          dependencyList.elements.forEach((el, i) => {
            if(t.isStringLiteral(el)) {
              switch(el.value) {
                case 'require':
                  return;
                case 'module':
                case 'exports':
                  injectsModuleOrExports = true;
                  return;
              }
            }
            const paramName = isFunctionFactory && factory.params[i];
            requireExpressions.push(createRequireExpression(el, paramName));
          });
        }

        if(isFunctionFactory) {
          const factoryArity = factory.params.length;
          let replacementFuncExpr = t.functionExpression(null, [], t.blockStatement(
            requireExpressions.concat(factory.body.body)
          ));
          let replacementCallExprParams = [];

          // https://github.com/requirejs/requirejs/wiki/differences-between-the-simplified-commonjs-wrapper-and-standard-amd-define
          const isSimplifiedCommonJSWrapper = !dependencyList && factoryArity > 0;
          if(isSimplifiedCommonJSWrapper) {
            replacementFuncExpr = factory;
            const identifiers = ['require', 'exports', 'module'];
            replacementCallExprParams = identifiers.slice(0, factoryArity).map(a => t.identifier(a));
          }

          const factoryReplacement = t.callExpression(replacementFuncExpr, replacementCallExprParams);

          injectsModuleOrExports = injectsModuleOrExports || !dependencyList && factoryArity > 1;
          if(isDefineCall && !injectsModuleOrExports) {
            path.replaceWith(createModuleExportsAssignmentExpression(factoryReplacement));
          } else {
            path.replaceWith(factoryReplacement);
          }
        } else if(factory && isDefineCall) {
          const exportExpression = createModuleExportsAssignmentExpression(factory);
          const nodes = requireExpressions.concat(exportExpression);
          path.replaceWithMultiple(nodes);
        } else {
          path.replaceWithMultiple(requireExpressions);
        }
      }
    }
  };
};
