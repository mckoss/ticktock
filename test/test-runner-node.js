#!/usr/bin/env node
global.namespace = require('../src/namespace.js').namespace;

require('../ticktock-all.js');
require('./qunit-node.js');
require('./test-tasks.js');
