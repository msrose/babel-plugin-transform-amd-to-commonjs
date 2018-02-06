'use strict';

describe('Plugin for require blocks', () => {
  it('transforms require blocks with one dependency', () => {
    expect(`
      require(['llamas'], (llama) => {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (() => {
        var llama = require('llamas');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks with one dependency and implicit return', () => {
    expect(`
      require(['llamas'], (llama) => llama.doSomeStuff());
    `).toBeTransformedTo(`
      (() => {
            var llama = require('llamas');
            return llama.doSomeStuff();
      })();
    `);
  });

  it('transforms require blocks with multiple dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], (llama, frog) => {
        llama.doSomeStuff();
        frog.sayRibbit();
      });
    `).toBeTransformedTo(`
      (() => {
        var llama = require('llamas');
        var frog = require('frogs');
        llama.doSomeStuff();
        frog.sayRibbit();
      })();
    `);
  });

  it('transforms require blocks with multiple dependencies and implicit return', () => {
    expect(`
      require(['llamas', 'frogs'], (llama, frog) => llama.doSomeStuff(frogs));
    `).toBeTransformedTo(`
      (() => {
            var llama = require('llamas');
            var frog = require('frogs');
            return llama.doSomeStuff(frogs);
      })();
    `);
  });

  it('transforms require blocks with unused dependencies', () => {
    expect(`
      require(['llamas', 'frogs'], (llama) => {
        llama.doSomeStuff();
      });
    `).toBeTransformedTo(`
      (() => {
        var llama = require('llamas');
        require('frogs');
        llama.doSomeStuff();
      })();
    `);
  });

  it('transforms nested require blocks that have no factory function', () => {
    expect(`
      require(['here', 'is', 'i'], (here) => {
        here.doStuff();
        require(['yep', 'that', 'me']);
      });
    `).toBeTransformedTo(`
      (() => {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        require('yep');
        require('that');
        require('me');
      })();
    `);
  });

  it('transforms nested require blocks that have a factory function', () => {
    expect(`
      require(['here', 'is', 'i'], (here) => {
        here.doStuff();
        require(['yep', 'that', 'me'], (yep) => {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      (() => {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        (() => {
          var yep = require('yep');
          require('that');
          require('me');
          yep.doStuff();
        })();
      })();
    `);
  });

  it('transforms a require block that is within a define block', () => {
    expect(`
      define(['here', 'is', 'i'], (here) => {
        here.doStuff();
        require(['yep', 'that', 'me'], (yep) => {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      module.exports = (() => {
        var here = require('here');
        require('is');
        require('i');
        here.doStuff();
        (() => {
          var yep = require('yep');
          require('that');
          require('me');
          yep.doStuff();
        })();
      })();
    `);
  });
});
