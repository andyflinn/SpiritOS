var zs4 = require('./static/zs4');
var mongoose = require('mongoose');
var randomstring = require('randomstring');

const RANDOMLENGTH = 8;

var token = exports;
token.lastMopUp = 0;

token.password = require('./password');
