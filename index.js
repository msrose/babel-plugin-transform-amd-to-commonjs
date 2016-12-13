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

  return {
    visitor: {
      ExpressionStatement(path) {
        const { node, parent } = path;

        if(!t.isCallExpression(node.expression)) return;

        const { name } = node.expression.callee;

        if(name === 'define' && !t.isProgram(parent)) return;

        const argumentDecoders = {
          define: decodeDefineArguments,
          require: decodeRequireArguments
        };
        const argumentDecoder = argumentDecoders[name];

        if(!argumentDecoder) return;

        const { dependencyList, factory } = argumentDecoder(node.expression.arguments);

        if(!t.isArrayExpression(dependencyList) && !t.isFunctionExpression(factory)) return;

        let injectsModuleOrExports = false;
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
            const paramName = factory && factory.params[i];
            const requireCall = t.callExpression(t.identifier('require'), [el]);
            if(paramName) {
              requireExpressions.push(t.variableDeclaration('var', [
                t.variableDeclarator(paramName, requireCall)
              ]));
            } else {
              requireExpressions.push(t.expressionStatement(requireCall));
            }
          });
        }

        if(factory) {
          const factoryArity = factory.params.length;
          const hasParamsForInjection = !dependencyList && factoryArity > 0;
          injectsModuleOrExports = injectsModuleOrExports || hasParamsForInjection;

          const replacementFuncExpr = hasParamsForInjection ?
            factory : t.functionExpression(null, [], t.blockStatement(
              requireExpressions.concat(factory.body.body)
            ));
          const replacementCallExprParams = hasParamsForInjection ?
            ['require', 'exports', 'module'].slice(0, factoryArity).map(a => t.identifier(a)) : [];

          const factoryReplacement = t.callExpression(replacementFuncExpr, replacementCallExprParams);

          if(name === 'define' && !injectsModuleOrExports) {
            path.replaceWith(
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(
                    t.identifier('module'), t.identifier('exports')
                  ),
                  factoryReplacement
                )
              )
            );
          } else {
            path.replaceWith(factoryReplacement);
          }
        } else {
          path.replaceWithMultiple(requireExpressions);
        }
      }
    }
  };
};
