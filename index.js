module.exports = ({ types: t }) => {
  const decodeDefineArguments = ([dependencyList, factory]) => {
    if(t.isFunctionExpression(dependencyList)) {
      return { factory: dependencyList };
    }
    return { dependencyList, factory };
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
