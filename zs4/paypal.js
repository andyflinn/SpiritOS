'use strict';

var zs4 = require('./js');
var paypalSDK = require('paypal-rest-sdk');
var debug = require('debug')('zs4paypal');

var paypal = exports;

paypal.schema = function(parent){
  parent._.property(new paypal.create());
};

paypal.create = function(){
  var PAYPAL = this;

  zs4.type.object.call(PAYPAL,new Object({name:'paypal',flags:'authsetself',}));

  PAYPAL._.create = paypal.create;

  PAYPAL._.property(new zs4.type.boolean({name:'configured',flags:'authsetself quickupdate',default:false,}));
  PAYPAL._.property(new zs4.type.boolean({name:'live',flags:'authsetself quickupdate',default:false,}));
  PAYPAL._.property(new zs4.type.string({name:'id',flags:'authsetself quickupdate',}));
  PAYPAL._.property(new zs4.type.string({name:'secret',flags:'authsetself quickupdate',}));
}
