import main from '../index';
import variableDeps from '../variableDeps';

describe('Main module', () => {
  it('has a message', () => {
    expect(main.message).toMatch(/da+yum/);
  });

  it('has another message', () => {
    expect(main.otherMessage).toMatch(/da+yum/);
  });

  it('has another another message', () => {
    expect(main.anotherMessage).toMatch(/da+yum/);
  });

  it('has a message from an aliased module', () => {
    expect(main.aliasedMessage).toMatch(/da+yum/);
  });

  it('has a message from a non-function factory module', () => {
    expect(main.config).toBe('This is an AMD module that does not use a function!!!');
  });

  it('has a message from a double-export module', () => {
    expect(main.doubleExport).toBe('RIGHT');
  });

  it('has another message from a double-export module', () => {
    expect(main.otherDoubleExport).toBe('RIGHT');
  });

  it('has another message from an arrow function module', () => {
    expect(main.arrowFunction).toContain('arrow functions');
  });

  it('has another message from implicit return factory', () => {
    expect(main.implicitReturn).toContain('implicit return');
  });

  it('has another message for a factory with rest arguments', () => {
    expect(main.restFactory).toContain('rest factory');
  });

  it('has another message for a module with a variable factory', () => {
    expect(main.variableFactory).toContain('variable factory');
  });

  it('ignores modules with the ignore comment', () => {
    expect(main.commentIgnore).toBe('hello');
  });
});

describe('Variable dependencies module', () => {
  it('has a message from a module with variable dependencies', () => {
    expect(variableDeps.variableDepsDefine).toContain('variable define deps');
  });

  it('has a message from a module with variable dependencies and factory', () => {
    expect(variableDeps.variableDepsAndFactory).toContain('variable define deps AND factory');
  });
});
