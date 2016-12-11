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

  return {
    visitor: {
      ExpressionStatement(path) {
        const { node, parent } = path;
        if(!t.isProgram(parent) || !t.isCallExpression(node.expression)) return;

        const { name } = node.expression.callee;
        if(name !== 'define' && name !== 'require') return;

        const defineArgs = decodeDefineArguments(node.expression.arguments);
        const { dependencyList, factory } = defineArgs;
        if(name === 'require' && !t.isArrayExpression(dependencyList)) return;

        if(dependencyList) {
          dependencyList.elements.forEach((el, i) => {
            const paramName = factory.params[i];
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

        const factoryReplacement = t.callExpression(t.functionExpression(null, [], factory.body), []);
        if(name === 'define') {
          path.replaceWith(
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.memberExpression(t.identifier('module'), t.identifier('exports')),
                factoryReplacement
              )
            )
          );
        } else {
          path.replaceWith(factoryReplacement);
        }
      }
    }
  };
};
