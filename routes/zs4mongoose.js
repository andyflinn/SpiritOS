var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');
var zs4 = require('./zs4utils');
var zs4db = module.exports;

var SCHEMA_PLAIN = 0;
var SCHEMA_DATED = 1;
var SCHEMA_DOCUMENT = (2|SCHEMA_DATED);

zs4db.conn = mongoose.createConnection(process.env.ZS4_MONGODB_URL);;
zs4db.conn.on('error', console.error.bind(console, 'connection error:'));
zs4db.conn.once('open', function() {
  console.log ('Connected to: ' + process.env.ZS4_MONGODB_URL);
});

zs4db.schema = {};
zs4db.model = {};

zs4db.createSchema = function(object,mods){
  if (mods&SCHEMA_DATED){
    object.created = Date;
    object.updated = Date;
  }

  if (mods&SCHEMA_DOCUMENT){
    object.doc_owner = {
      type: String,
      required: true,
      trim: true,
      minlength:5,
      maxlength:64,
      index:true,
    };
    object.doc_status = {
      type: String,
      enum: ['d','p','t','x'], //draft, public, trash, x-terminated
      required: true,
    };
    object.doc_title = {
      type: String,
      minlength:1,
      maxlength:128,
      required: true,
      trim: true,
    };
  }

  var nu = new mongoose.Schema(object);

  if (mods&SCHEMA_DATED){
    nu.pre('save', function(next) {
      // get the current date
      var currentDate = new Date();

      // change the updated_at field to current date
      this.updated = currentDate;

      // if created_at doesn't exist, add to that field
      if (!this.created)
        this.created = currentDate;

      next();
    });
  }

  if (mods&SCHEMA_DOCUMENT){
    nu.post('init', function(next) {
      // it's a DRAFT doc first!
      this.doc_status = 'd';
      this.doc_title = 'untitled';
    });
  }

  return nu;
};


/////////////////////////////////////////
// identity schema

zs4db.schema.Identity = zs4db.createSchema({
    identity: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true },
},SCHEMA_PLAIN)

/////////////////////////////////////////
// User Record.
zs4db.schema.User = zs4db.createSchema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, minlength:5, maxlength:64, index: { unique: true }},
  pic: { type: String, required: true, trim: true },
  auth:[zs4db.schema.Identity],
},SCHEMA_DATED);
zs4db.model.User = zs4db.conn.model('User',zs4db.schema.User);

zs4db.login = function(req,res){

  var xu = zs4.getRequestUser(req,res);
  if (xu == null){
    console.log('zs4db.login() invalid express user.')
    return;
  }

  zs4db.model.User.findOne({ email:xu.email }, function(err, dbUser) {
    console.log('searching db for '+ xu.email);
    if (err || dbUser==null){
       console.log(xu.email + ' not in db. creating....');
       var obj = {
         name:xu.name,
         email:xu.email,
         pic:xu.pic,
         auth:[{identity:xu.identity,provider:xu.provider}],
       };
       var nu = zs4db.model.User(obj);

       nu.save(function(err) {
         console.log('inside save callback');
         if (err) {
           console.log('ERROR: while db.save.user('+xu.name+'): '+err+obj);
           console.log(obj);
           return;
         }
         console.log('User' + xu.email + ' created!');
       });

       return;
     };

    console.log('found: '+ dbUser);

    // return if provider exist for this email.
    for (var i = 0; i < dbUser.auth.length; i++)
        if (dbUser.auth[i].identity == xu.identity)
          return;

        console.log('adding '+ xu.identity + ' to ' + xu.email + '...');
        dbUser.auth.push({identity:xu.identity,provider:xu.provider});
        dbUser.save(function(err) {
          console.log('inside update callback');
          if (err) {
            console.log('ERROR: while db.update.user('+xu.name+'): '+xu.identity);
            console.log(obj);
            return;
          }
          console.log('User' + xu.email + ' updated!');
        });

  });

}
zs4db.dumpAllUsers = function(){
  console.log('dumping all users:');
  zs4db.model.User.find({}, function(err, users) {
    if (err)  return console.error.err;
    console.log(users);
  });
}

/////////////////////////////////////////
// Document


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
