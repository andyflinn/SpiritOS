'use strict';

var zs4 = require('./js');
var fs = require('fs');
var debug = require('debug')('zs4require');

var require = exports;

require.schema = function(parent){
  parent._.property(new require.create());
};

require.create = function(){
  var REQUIRE = this;
  var input = new Object({name:'require',flags:'api apiarg nostore nosort',});
  zs4.type.object.call(REQUIRE,input);
  REQUIRE._.create = require.create;

  REQUIRE._.property(new  zs4.type.string({name:'path',flags:'apiarg'}))

  REQUIRE._.transform = (function(req,cb){
    req.setScope(REQUIRE);
    REQUIRE._.transformInternal(req);
    debug('transform('+zs4.json.stringify(req.input)+')');
    if (req.input==null||!zs4.is.string(req.input.path)){
      REQUIRE._.getTree(req);
      cb(); return;
    }
    var a = zs4.string.split.names(req.input.path);
    debug(a);
    if (a.length==0){
      var error = 'no names in path';
      debug('error: '+error);
      req.error(REQUIRE,error);
      REQUIRE._.getTree(req);
      cb(); return;
    }

    var path = './zs4/require/';
    for (var i = 0 ; i < a.length ; i++)path+=(a[i]+'/');
    path += (a[a.length-1]+'.js');
    debug('File Path: \"'+path+'\"');

    fs.readFile(path,'utf8',function(err,data){
      if (err || !data){
        req.error(REQUIRE,err);
        debug('fs.readFile: '+err);
        REQUIRE._.getTree(req);
        cb();return;
      }
      debug('result',data);
      req.result(REQUIRE,data);
      REQUIRE._.getTree(req);
      cb();return;
    });
  }).bind(REQUIRE);

}
