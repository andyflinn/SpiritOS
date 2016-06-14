var dotenv = require('dotenv');

var zs4 = module.exports;

// load objects common to client and serve3r
var shared = require('../public/js/zs4-shared');
shared.install(shared,zs4);

// load the environment
dotenv.load();
zs4.env = {
  debug:true,
}

if (process.env.ZS4_DEBUG != null && process.env.ZS4_DEBUG.trim() == 'false' ){
  zs4.env.debug = false;
}

zs4.console = {
  log:function(arg){
    if (zs4.env.debug)
      console.log(arg);
  }
};

// default-able environment variables....
if (process.env.ZS4_HOST == null){zs4.env.ZS4_HOST='localhost'}
else {zs4.env.ZS4_HOST=process.env.ZS4_HOST}

if (process.env.ZS4_PORT == null){if(zs4.env.ZS4_HOST=='localhost'){zs4.env.ZS4_PORT=8443;}else{zs4.env.ZS4_PORT=443;}}
else {zs4.env.ZS4_PORT=parseInt(process.env.ZS4_PORT);}

if (process.env.ZS4_KEY_FILE == null){zs4.env.ZS4_KEY_FILE='./ssl/localhost.key'}
else {zs4.env.ZS4_KEY_FILE=process.env.ZS4_KEY_FILE}

if (process.env.ZS4_CERT_FILE == null){zs4.env.ZS4_CERT_FILE='./ssl/localhost.cert'}
else {zs4.env.ZS4_CERT_FILE=process.env.ZS4_CERT_FILE}

if (process.env.ZS4_DB == null){zs4.env.ZS4_DB='mongodb://127.0.0.1/test'}
else {zs4.env.ZS4_DB=process.env.ZS4_DB}

if (process.env.ZS4_TOKEN_DB == null){zs4.env.ZS4_TOKEN_DB='mongodb://127.0.0.1/test'}
else {zs4.env.ZS4_TOKEN_DB=process.env.ZS4_TOKEN_DB}

if (process.env.ZS4_SESSION_DB == null){zs4.env.ZS4_SESSION_DB='mongodb://127.0.0.1/test'}
else {zs4.env.ZS4_SESSION_DB=process.env.ZS4_SESSION_DB}

if (process.env.ZS4_SESSION_SECRET == null){zs4.env.ZS4_SESSION_SECRET='Vhat effer u vant'}
else {zs4.env.ZS4_SESSION_SECRET=process.env.ZS4_SESSION_SECRET;}

if (process.env.ZS4_SMTP_SSL == null){zs4.env.ZS4_SMTP_SSL=false}
else {if (process.env.ZS4_SMTP_SSL != null && process.env.ZS4_SMTP_SSL.trim() == 'true3' ){
  zs4.env.ZS4_SMTP_SSL = true;
}}

// required .env file entries!
if (process.env.ZS4_ADMIN_EMAIL==null){console.log('.env.ZS4_ADMIN_EMAIL missing.');exit(1);}
zs4.env.ZS4_ADMIN_EMAIL=process.env.ZS4_ADMIN_EMAIL;

if (process.env.ZS4_SMTP_SERVER==null){console.log('.env.ZS4_SMTP_SERVER missing.');exit(1);}
zs4.env.ZS4_SMTP_SERVER=process.env.ZS4_SMTP_SERVER;

if (process.env.ZS4_SMTP_PORT==null){console.log('.env.ZS4_SMTP_PORT missing.');exit(1);}
zs4.env.ZS4_SMTP_PORT=parseInt(process.env.ZS4_SMTP_PORT);

if (process.env.ZS4_SMTP_USER==null){console.log('.env.ZS4_SMTP_USER missing.');exit(1);}
zs4.env.ZS4_SMTP_USER=process.env.ZS4_SMTP_USER;

if (process.env.ZS4_SMTP_PASS==null){console.log('.env.ZS4_SMTP_PASS missing.');exit(1);}
zs4.env.ZS4_SMTP_PASS=process.env.ZS4_SMTP_PASS;

zs4.console.log(zs4.env);

zs4.getRequestUser = function(req,res){

  if (req.user == null){
    zs4.console.log('getRequestUser(): req.user ==null');
    return null;
  }

  zs4.console.log('getRequestUser()');
  zs4.console.log(req.user);

  var nam = req.user;
  var i = nam.indexOf('@');
  if (i>0)nam = nam.substr(0,i);

  return {
    email:req.user,
    name:nam,
  };
}
