'use strict';

var zs4 = require('./js/js');
var fs = require('fs');
var path = require('path');
var debug = require('debug')('zs4jsondb');

var jsondb = exports;

var DATA_DIR = './data';

function ensureDataDir(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
}

function arrayFile(ARRAY){
  return path.join(DATA_DIR, ARRAY.template.zs4.head.typename._.value + '.json');
}

var cache = {};

function loadCache(ARRAY){
  var name = ARRAY.template.zs4.head.typename._.value;
  if (cache[name]) return cache[name];
  var file = arrayFile(ARRAY);
  try { cache[name] = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { cache[name] = {_meta:{lastid:0}}; }
  if (!cache[name]._meta) cache[name]._meta = {lastid:0};
  return cache[name];
}

function saveCache(ARRAY){
  var name = ARRAY.template.zs4.head.typename._.value;
  ensureDataDir();
  fs.writeFileSync(path.join(DATA_DIR, name+'.json'), JSON.stringify(cache[name], null, 2));
}

function docs(data){
  return Object.keys(data).filter(function(k){ return k !== '_meta'; }).map(function(k){ return data[k]; });
}

jsondb.schema = function(parent){};

jsondb.create = function(input){
  var JSONDB = this;
  if (!zs4.is.object(input)) input = {name:'jsondb'};
  zs4.type.object.call(JSONDB, input);
  JSONDB._.create = jsondb.create;

  JSONDB.initializeArray = function(ARRAY){
    loadCache(ARRAY);
  };

  JSONDB.query = function(arg, cb){
    var ARRAY = this;
    var data = loadCache(ARRAY);
    var list = docs(data);

    list.sort(function(a, b){
      var au = (a.zs4 && a.zs4.head && a.zs4.head.updated) || 0;
      var bu = (b.zs4 && b.zs4.head && b.zs4.head.updated) || 0;
      return bu - au;
    });

    var type = ARRAY.template._.new();
    for (var i = 0; i < list.length; i++){
      type._.name = list[i]._id;
      ARRAY._.array.elementConnect(ARRAY.array, type);
      type._.load(list[i]);

      if (arg.select != null){
        arg.select._.inscopeTree(type);
        if (!arg.select._.select.check()) continue;
      }

      if (zs4.is.string(arg.search) && arg.search !== ''){
        if (!type._.search(arg.search)) continue;
      }

      type._.getTree(arg.request);
    }
    cb();
  };

  JSONDB.getOne = function(req, cb){
    var ARRAY = this;
    var list = docs(loadCache(ARRAY));
    debug('JSONDB.getOne(' + req.input.item + '=' + req.input.eq + ')');

    var parts = req.input.item.split('.');
    var found = null;
    for (var i = 0; i < list.length; i++){
      var val = list[i];
      for (var j = 0; j < parts.length; j++){
        if (val == null) break;
        val = val[parts[j]];
      }
      if (val == req.input.eq){ found = list[i]; break; }
    }

    if (found == null){ cb(null); return; }

    var type = ARRAY.template._.new();
    type._.name = found._id;
    type._.load(found);
    ARRAY._.array.elementConnect(ARRAY.array, type);
    type._.getTree(req);
    cb(type);
  };

  JSONDB.getID = function(id, cb){
    var data = loadCache(this);
    var found = data[id];
    if (!found){ cb(null); return; }
    cb(found);
  };

  JSONDB.updateID = function(id, newdata, cb){
    var ARRAY = this;
    var data = loadCache(ARRAY);
    if (!data[id]){ cb(null); return; }
    newdata._id = id;
    if (zs4.is.function(ARRAY._.onUpdate)) ARRAY._.onUpdate(id, newdata);
    data[id] = newdata;
    saveCache(ARRAY);
    debug('JSONDB.updateID(' + id + ')');
    cb(newdata);
  };

  JSONDB.deleteID = function(id, cb){
    var ARRAY = this;
    var data = loadCache(ARRAY);
    var item = data[id];
    if (!item){ cb(null); return; }
    delete data[id];
    saveCache(ARRAY);
    debug('JSONDB.deleteID(' + id + ')');
    cb(item);
  };

  JSONDB.new = function(nu, cb){
    var ARRAY = this;
    var data = loadCache(ARRAY);
    var id = zs4.integer.to.name(data._meta.lastid++);
    debug('JSONDB.new(' + ARRAY._.path + ') id=' + id);

    var stored = nu._.store();
    stored._id = id;
    data[id] = stored;
    saveCache(ARRAY);

    nu._.load(stored);
    nu._.name = id;
    cb(nu);
  };

  JSONDB.find = function(typename, fieldPath, value){
    var data = cache[typename];
    if (!data){
      try { data = cache[typename] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, typename+'.json'), 'utf8')); }
      catch(e) { data = {}; }
      if (!data._meta) data._meta = {lastid:0};
    }
    var list = docs(data);
    var parts = fieldPath.split('.');
    for (var i = 0; i < list.length; i++){
      var val = list[i];
      for (var j = 0; j < parts.length; j++){
        if (val == null) break;
        val = val[parts[j]];
      }
      if (val === value) return list[i];
    }
    return null;
  };

  JSONDB.connect = (function(input, cb){
    ensureDataDir();
    debug('JSONDB: file-based storage ready at ' + DATA_DIR);
    cb();
  }).bind(JSONDB);

  zs4.boot.call(JSONDB, JSONDB.connect, JSONDB);
};
