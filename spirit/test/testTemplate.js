'use strict';

const spirit = require('../run/spirit/kernel.js');
const test = require('./testSupport.js');

test.startTest('Template Test');

test.check('how to call a successful test unit');

test.fail('how to log a failure');

test.reportSuccessFailureCount();

