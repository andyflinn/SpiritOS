var express = require('express');
var mongoose = require('mongoose');
var pager = require('mongoose-paginate');
var zs4 = require('./zs4utils');
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

  if (mods&SCHEMA_PAGED){
    object.tag = [String];
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

  if (mods&SCHEMA_PAGED){
    nu.plugin(pager);
  }
  return nu;
};


/////////////////////////////////////////
// system configuration.

zs4db.schema.zs4 = zs4db.createSchema(zs4.mongoose.schema.zs4,SCHEMA_DATED)
zs4db.schema.zs4.pre('save', function(next) {
  if (this.number == null)this.number = 0;
  if (this.public.name == null)this.name='zs4';
  if (this.public.slogan==null)this.slogan='awesomeness';
  next();
});

zs4db.model.zs4 = zs4db.conn.model('zs4',zs4db.schema.zs4);

zs4db.system = zs4db.model.zs4();

zs4db.model.zs4.findOne({ 'number': 0 }, function (err, system) {
  if (err || system == null ){
    zs4db.system.save(function(err) {
      console.log('inside zs4db.system.initialize()');
      if (err) {
        console.log('ERROR: while zs4db.system.initialize()');
        console.log(zs4db.system);
        return;
      }
      console.log('zs4db.system saved.');
      console.log(zs4db.system);
    });
  }else{
    zs4db.system = system;
    console.log('zs4db.system loaded.');
    console.log(zs4db.system);


  }
})



/////////////////////////////////////////
// User Record.
zs4db.schema.User = zs4db.createSchema(zs4.mongoose.schema.User,SCHEMA_DATED|SCHEMA_PAGED);
zs4db.schema.User.pre('save', function(next) {
  var work = this.email.split('@');
  var tag = work[0].split('.');
  zs4.string.array.trimToArray(this.tag,tag);
  zs4.string.array.addToArray(tag,this.tag);

  next();
});
zs4db.model.User = zs4db.conn.model('User',zs4db.schema.User);
/////////////////////////////////////////
// admin user.

zs4db.admin = zs4db.model.User();
zs4db.admin.email = zs4.env.ZS4_ADMIN_EMAIL;

zs4db.model.User.findOne({ 'email': zs4.env.ZS4_ADMIN_EMAIL }, function (err, admin) {
  if (err || admin == null ){
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
// zs4 user login action
/*
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
         email:xu.email,
         auth:[{identity:xu.identity,provider:xu.provider,name:xu.name,pic:xu.pic}],
       };
       var nu = zs4db.model.User(obj);

       nu.save(function(err) {
         console.log('inside save callback');
         if (err) {
           console.log('ERROR: while db.save.user('+xu.name+'): '+err+obj);
           console.log(obj);
           return;
         }
         console.log('User ' + xu.email + ' created!');
       });

       return;
     };

    console.log('found: '+ dbUser);

    // return if provider exist for this email.
    var nu_provider = true;
    for (var i = 0; i < dbUser.auth.length; i++)
        if (dbUser.auth[i].identity == xu.identity){
          nu_provider = false;
        }

    if (nu_provider){
        console.log('adding '+ xu.identity + ' to ' + xu.email + '...');
        dbUser.auth.push({identity:xu.identity,provider:xu.provider,name:xu.name,pic:xu.pic});
    }

    dbUser.save(function(err) {
      console.log('inside update callback');
      if (err) {
        console.log('ERROR: while db.update.user('+xu.name+'): '+xu.identity);
        console.log(obj);
        return;
      }
      console.log('User ' + xu.email + ' updated!');
    });

  });

}
*/

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
