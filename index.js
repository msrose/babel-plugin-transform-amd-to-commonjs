module.exports = ({ types: t }) => ({
  visitor: {
    ExpressionStatement(path) {
      const { node, parent } = path;
      // Only transform top-level define calls
      if(!t.isProgram(parent) ||
         !t.isCallExpression(node.expression) ||
         node.expression.callee.name !== 'define') {
        return;
      }
      const [dependencyList, factory] = node.expression.arguments;
      dependencyList.elements.forEach((el, i) => {
        const paramName = factory.params[i];
        const requireCall = t.callExpression(
          t.identifier('require'),
          [t.stringLiteral(el.value)]
        );
        if(paramName) {
          path.insertBefore(t.variableDeclaration('var', [
            t.variableDeclarator(paramName, requireCall)
          ]));
        } else {
          path.insertBefore(t.expressionStatement(requireCall));
        }
      });
      path.replaceWith(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.identifier('module'), t.identifier('exports')),
            t.callExpression(t.functionExpression(null, [], factory.body), [])
          )
        )
      );
    }
  }
});
