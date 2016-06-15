var express = require('express');
var mongoose = require('mongoose');
var pager = require('mongoose-paginate');
var zs4 = require('./zs4utils');
var zs4api = require('./zs4api');
var zs4db = module.exports;

var SCHEMA_PLAIN = 0;
var SCHEMA_DATED = 1;
var SCHEMA_DOCUMENT = 2;
var SCHEMA_PAGED = 4;

zs4db.conn = mongoose.createConnection(zs4.env.ZS4_DB);;
zs4db.conn.on('error', console.error.bind(console, 'connection error:'));
zs4db.conn.once('open', function() {
  console.log ('Connected to: ' + zs4.env.ZS4_DB);
});

if (zs4.env.debug){
  pager.paginate.options = {
      lean:  false,
      limit: 3
  };
}else{
  pager.paginate.options = {
      lean:  true,
      leanWithId:true,
      limit: 3
  };

}

zs4db.schema = {};
zs4db.model = {};

zs4db.createSchema = function(object,mods){

  var nu = new mongoose.Schema(object);


  nu.pre('save', function(next) {
    // get the current date
    var currentDate = new Date();

    // change the updated_at field to current date
    this.meta.updated = currentDate;

    next();
  });

  return nu;
};


/////////////////////////////////////////
// system configuration.

for (var i = 0 ; i < zs4api.api.length ; i++){
  zs4.type.Server.schema.api[zs4api.api[i].name]=[zs4.type.Auth.schema];
}


zs4db.schema.Server = zs4db.createSchema(zs4.type.Server.schema,SCHEMA_DATED)
zs4db.model.Server = zs4db.conn.model('zs4',zs4db.schema.Server);
zs4db.system = zs4db.model.Server();

zs4db.model.Server.findOne({ 'number': 0 }, function (err, system) {
  function populate(system){
    zs4.console.log('populating server object');
    zs4.type.Auth.method.set(system.meta.auth.read,{email:zs4.const.SYSTEM.ADMIN});
    zs4.type.Auth.method.set(system.meta.auth.update,{email:zs4.const.SYSTEM.ADMIN});

    //zs4.console.log('zs4api.api.length = '+zs4api.api.length);
    for (var i = 0 ; i < zs4api.api.length ; i++){
      //zs4.console.log('does server have '+zs4api.api[i].name+'?');
      if (system.api[zs4api.api[i].name].length == 0){
        if (zs4api.api[i].name == zs4.const.API.NAME.INITIALIZE)zs4.type.Auth.method.set(system.api[zs4api.api[i].name],{email:zs4.const.SYSTEM.PUBLIC});
        if (zs4api.api[i].name == zs4.const.API.NAME.QUERY)zs4.type.Auth.method.set(system.api[zs4api.api[i].name],{email:zs4.const.SYSTEM.PUBLIC});
      }
    }
    zs4.console.log(system);
  };

  if (err || system == null ){
    populate(zs4db.system);
    zs4db.system.save(function(err) {
      zs4.console.log('inside zs4db.system.initialize()');
      if (err) {
        zs4.console.log('ERROR: while zs4db.system.initialize()');
        zs4.console.log(zs4db.system);
        return;
      }
      zs4.console.log('zs4db.system saved.');
      zs4.console.log(zs4db.system);
    });
  }else{
    zs4db.system = system;
    zs4.console.log('zs4db.system loaded.');
    populate(zs4db.system);
    zs4db.system.save(function(err) {
      zs4.console.log('inside zs4db.system.update()');
      if (err) {
        zs4.console.log('ERROR: while zs4db.system.update()');
        zs4.console.log(zs4db.system);
        return;
      }
      zs4.console.log('zs4db.system updated.');
      zs4.console.log(zs4db.system);
    });


  }
})

/////////////////////////////////////////
// User Record.
zs4db.schema.User = zs4db.createSchema(zs4.type.User.schema,SCHEMA_DATED|SCHEMA_PAGED);
zs4db.model.User = zs4db.conn.model('User',zs4db.schema.User);
zs4.type.Auth.method.set(zs4.type.User.info.auth.create,{email:zs4.const.SYSTEM.ADMIN});
zs4.console.log('updated who can create users');
zs4.console.log(zs4.type.User.info.auth);

/////////////////////////////////////////
// admin user.

zs4db.admin = zs4db.model.User();
zs4db.admin.email = zs4.env.ZS4_ADMIN_EMAIL;

zs4db.model.User.findOne({ 'email': zs4.env.ZS4_ADMIN_EMAIL }, function (err, admin) {
  function setAuths(admin){
    zs4.type.Auth.method.set(admin.meta.auth.read,{email:zs4.const.SYSTEM.ADMIN});
    zs4.type.Auth.method.set(admin.meta.auth.update,{email:zs4.const.SYSTEM.ADMIN});
  };

  if (err || admin == null ){
    setAuths(zs4db.admin);
    zs4db.admin.email = zs4.env.ZS4_ADMIN_EMAIL;
    zs4db.admin.save(function(err) {
      console.log('inside zs4db.admin.initialize()');
      if (err) {
        console.log('ERROR: while zs4db.admin.initialize()');
        console.log(zs4db.admin);
        return;
      }
      console.log('zs4db.admin saved.');
      console.log(zs4db.admin);
    });
  }else{
    zs4db.admin = admin;
    console.log('zs4db.admin loaded.');
    console.log(zs4db.admin);
  }
})




/////////////////////////////////////////
// Document

/*
/////////////////////////////////////////
// Musical Schemas.

zs4db.schema.Chord = zs4db.createSchema({
  // chord root note
  r: { type: Number, required: true, min: 0, max: 11 },
  // chord type
  t: { type: Number, required: true, min: 0, max: (2<<24) },
  // bass note (indicates inversion)
  b: { type: Number, required: true, min: 0, max: 11 },
},SCHEMA_PLAIN);

zs4db.schema.Event = zs4db.createSchema({
  // Events can have chords
  c: { type: zs4db.schema.Chord },
  // timer event: measure, beats, ticks
  t: { type: String, enum: ['m','b','t'] },
  // (lead) voice note
  v: { type: Number, min: 21, max: 108 },
  // word (lyric)
  w: { type: String, minlength: 1, maxlength: 32, trim: true },
  // x-tras: stops, piano, forte, newline
  x: { type: String, enum: ['s','p','f','n'] },
},SCHEMA_PLAIN);

zs4db.schema.Composition = zs4db.createSchema({
  key: { type: Number, required: true, min: 0, max: 11 },
  bpm: { type: Number, min: 30, max: 480, required: true },
  tpb: { type: Number, min: 1, max: 10, required: true },
  event:[zs4db.schema.Event],
},SCHEMA_DOCUMENT);

zs4db.schema.Composition.post('init', function(next) {
  // it's a DRAFT doc first!
  this.key = 0;
  this.bpm = 120;
  this.tpb = 3;
});
zs4db.model.Composition = zs4db.conn.model('Composition',zs4db.schema.Composition);
*/
