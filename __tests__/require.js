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
      var llama = require('llamas');
      (function() {
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
      var llama = require('llamas');
      var frog = require('frogs');
      (function() {
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
      var llama = require('llamas');
      require('frogs');
      (function() {
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

  it('transforms nested require blocks that have no factory function', () => {
    expect(`
      require(['here', 'is', 'i'], function(here) {
        here.doStuff();
        require(['yep', 'that', 'me']);
      });
    `).toBeTransformedTo(`
      var here = require('here');
      require('is');
      require('i');
      (function() {
        here.doStuff();
        require('yep');
        require('that');
        require('me');
      })();
    `);
  });

  it('transforms nested require blocks that have a factory function', () => {
    expect(`
      require(['here', 'is', 'i'], function(here) {
        here.doStuff();
        require(['yep', 'that', 'me'], function(yep) {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      var here = require('here');
      require('is');
      require('i');
      (function() {
        here.doStuff();
        var yep = require('yep');
        require('that');
        require('me');
        (function() {
          yep.doStuff();
        })();
      })();
    `);
  });

  it('transforms a require block that is within a define block', () => {
    expect(`
      define(['here', 'is', 'i'], function(here) {
        here.doStuff();
        require(['yep', 'that', 'me'], function(yep) {
          yep.doStuff();
        });
      });
    `).toBeTransformedTo(`
      var here = require('here');
      require('is');
      require('i');
      module.exports = (function() {
        here.doStuff();
        var yep = require('yep');
        require('that');
        require('me');
        (function() {
          yep.doStuff();
        })();
      })();
    `);
  });
});
