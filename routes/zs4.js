var express = require('express');
var passport = require('passport');

//var zs4 = require('./zs4utils');
//var zs4db = require('./zs4mongoose');
var zs4api = require('./zs4api');

var router = express.Router();

var env = {
  ZS4_ADMIN_EMAIL: process.env.ZS4_ADMIN_EMAIL,
};

router.post('/', function(req, res){
  zs4api.respond(req, res);
});

module.exports = router;
