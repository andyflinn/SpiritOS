var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');
var zs4 = require('./zs4utils');
var zs4db = module.exports;

zs4db.conn = mongoose.createConnection(process.env.ZS4_MONGODB_URL);;
zs4db.conn.on('error', console.error.bind(console, 'connection error:'));
zs4db.conn.once('open', function() {
  console.log ('Connected to: ' + process.env.ZS4_MONGODB_URL);
});

zs4db.schema = {};
zs4db.model = {};

zs4db.createSchema = function(object){
  var nu = new mongoose.Schema(object);
  nu.methods.burps = function(){console.log("BURP!!!!!!!!!!!!!" + this);}
  return nu;
};

/////////////////////////////////////////
// identity schema

zs4db.schema.Identity = zs4db.createSchema({
    identity: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true },
})

// User Record.
zs4db.schema.User = zs4db.createSchema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true,  index: { unique: true }},
  pic: { type: String, required: true, trim: true },
  auth:[zs4db.schema.Identity],
});
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
