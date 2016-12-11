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
        if(!t.isProgram(parent) || !t.isCallExpression(node.expression)) return;

        const argumentDecoders = {
          define: decodeDefineArguments,
          require: decodeRequireArguments
        };

        const { name } = node.expression.callee;
        const argumentDecoder = argumentDecoders[name];

        if(!argumentDecoder) return;

        const { dependencyList, factory } = argumentDecoder(node.expression.arguments);

        if(!t.isArrayExpression(dependencyList) && !t.isFunctionExpression(factory)) return;

        let injectsModuleOrExports = false;

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
              path.insertBefore(t.variableDeclaration('var', [
                t.variableDeclarator(paramName, requireCall)
              ]));
            } else {
              path.insertBefore(t.expressionStatement(requireCall));
            }
          });
        }

        if(factory) {
          injectsModuleOrExports = injectsModuleOrExports ||
            !dependencyList && factory.params.filter(
              (node) => ['module', 'exports'].includes(node.name)
            ).length;
          const factoryReplacement = t.callExpression(
            t.functionExpression(null, [], factory.body), []
          );
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
          path.remove();
        }
      }
    }
  };
};
