const customMatchers = require('./custom-matchers');

describe('Plugin for require blocks', () => {
  beforeEach(() => {
    jasmine.addMatchers(customMatchers);
  });

  it('transforms require blocks with one dependency', () => {
    expect(`
      require(['llamas'], function(llama) {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (function() {
        var llama = require('llamas');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks with multiple dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], function(llama, frog) {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `).toBeTransformedTo(`
      (function() {
        var llama = require('llamas');
        var frog = require('frogs');
        llama.doSomeStuff();
        frog.sayRibbit();
      })();
    `);
  });

  it('transforms require blocks with unused dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], function(llama) {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (function() {
        var llama = require('llamas');
        require('frogs');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks that have no factory function', () => {
    expect(`
      require(['here', 'are', 'some', 'deps']);
    `).toBeTransformedTo(`
      require('here');
      require('are');
      require('some');
      require('deps');
    `);
  });
});
