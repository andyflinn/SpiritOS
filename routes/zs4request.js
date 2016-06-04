var express = require('express');
var passport = require('passport');
var zs4 = require('./zs4utils');
var zs4db = require('./zs4mongoose');
var router = express.Router();

var env = {
  ZS4_ADMIN_EMAIL: process.env.ZS4_ADMIN_EMAIL,
};

router.post('/', function(req, res){
  console.log('zs4request');
  console.log(req.body);

  var response = zs4.createResponseFrame(req);

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(response));
});


module.exports = router;
