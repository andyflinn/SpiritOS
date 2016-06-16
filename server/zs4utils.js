var dotenv = require('dotenv');

var zs4 = module.exports;
zs4.instance = {server:true,client:false,};
console.log('initializing module zs4utils');

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

//zs4.console.log(process);

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

if (process.env.ZS4_SMTP_HOST==null){console.log('.env.ZS4_SMTP_HOST missing.');exit(1);}
zs4.env.ZS4_SMTP_HOST=process.env.ZS4_SMTP_HOST;

if (process.env.ZS4_SMTP_PORT==null){console.log('.env.ZS4_SMTP_PORT missing.');exit(1);}
zs4.env.ZS4_SMTP_PORT=parseInt(process.env.ZS4_SMTP_PORT);

if (process.env.ZS4_SMTP_USER==null){console.log('.env.ZS4_SMTP_USER missing.');exit(1);}
zs4.env.ZS4_SMTP_USER=process.env.ZS4_SMTP_USER;

if (process.env.ZS4_SMTP_PASSWORD==null){console.log('.env.ZS4_SMTP_PASSWORD missing.');exit(1);}
zs4.env.ZS4_SMTP_PASSWORD=process.env.ZS4_SMTP_PASSWORD;

zs4.console.log(zs4.env);

zs4.authorized = function(arr,user){
  if (user==null){
    for (var i = 0 ; i < arr.length ; i++){if (arr[i].email == zs4.const.SYSTEM.PUBLIC)return true;}
    return false;
  }
  if (user==zs4.env.ZS4_ADMIN_EMAIL)return true;
  for (var i = 0 ; i < arr.length ; i++){if (arr[i].email == user || arr[i].email == zs4.const.SYSTEM.USER)return true;}
  return false;
};

zs4.html = function(path){
  var html = '<html>\n';
    html += ' <head>\n';
      html += '  <base href="' + path + '">\n';
      html += '  <link rel="stylesheet" href="/css/style.css">\n';
      html += '  <script>var exports = {};</script>\n'
      html += '  <script src="/js/zs4-shared.js"></script>\n';
      html += '  <script src="/js/zs4-browser.js"></script>\n';
    html += ' </head>\n';
    if (req.path==='/'){
      html += ' <body onload="zs4.ui.initialize(document.body)">\n';

      html += ' </body>\n';
    }
  html += '</html>\n';
  return(html);
};
