#!/usr/bin/env node
global.namespace = require('../scripts/namespace.js').namespace;

require('../scripts/pandatask-all.js');
require('../scripts/format-extra.js');
require('./qunit-node.js');
require('./test-tasks.js');
