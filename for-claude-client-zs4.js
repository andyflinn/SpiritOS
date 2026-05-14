
/*!
 * Bowser - a browser detector
 * https://github.com/ded/bowser
 * MIT License | (c) Dustin Diaz 2015
 */
!function(e,t,n){typeof module!="undefined"&&module.exports?module.exports=n():typeof define=="function"&&define.amd?define(t,n):e[t]=n()}(this,"bowser",function(){function t(t){function n(e){var n=t.match(e);return n&&n.length>1&&n[1]||""}function r(e){var n=t.match(e);return n&&n.length>1&&n[2]||""}function N(e){switch(e){case"NT":return"NT";case"XP":return"XP";case"NT 5.0":return"2000";case"NT 5.1":return"XP";case"NT 5.2":return"2003";case"NT 6.0":return"Vista";case"NT 6.1":return"7";case"NT 6.2":return"8";case"NT 6.3":return"8.1";case"NT 10.0":return"10";default:return undefined}}var i=n(/(ipod|iphone|ipad)/i).toLowerCase(),s=/like android/i.test(t),o=!s&&/android/i.test(t),u=/nexus\s*[0-6]\s*/i.test(t),a=!u&&/nexus\s*[0-9]+/i.test(t),f=/CrOS/.test(t),l=/silk/i.test(t),c=/sailfish/i.test(t),h=/tizen/i.test(t),p=/(web|hpw)os/i.test(t),d=/windows phone/i.test(t),v=/SamsungBrowser/i.test(t),m=!d&&/windows/i.test(t),g=!i&&!l&&/macintosh/i.test(t),y=!o&&!c&&!h&&!p&&/linux/i.test(t),b=r(/edg([ea]|ios)\/(\d+(\.\d+)?)/i),w=n(/version\/(\d+(\.\d+)?)/i),E=/tablet/i.test(t)&&!/tablet pc/i.test(t),S=!E&&/[^-]mobi/i.test(t),x=/xbox/i.test(t),T;/opera/i.test(t)?T={name:"Opera",opera:e,version:w||n(/(?:opera|opr|opios)[\s\/](\d+(\.\d+)?)/i)}:/opr\/|opios/i.test(t)?T={name:"Opera",opera:e,version:n(/(?:opr|opios)[\s\/](\d+(\.\d+)?)/i)||w}:/SamsungBrowser/i.test(t)?T={name:"Samsung Internet for Android",samsungBrowser:e,version:w||n(/(?:SamsungBrowser)[\s\/](\d+(\.\d+)?)/i)}:/coast/i.test(t)?T={name:"Opera Coast",coast:e,version:w||n(/(?:coast)[\s\/](\d+(\.\d+)?)/i)}:/yabrowser/i.test(t)?T={name:"Yandex Browser",yandexbrowser:e,version:w||n(/(?:yabrowser)[\s\/](\d+(\.\d+)?)/i)}:/ucbrowser/i.test(t)?T={name:"UC Browser",ucbrowser:e,version:n(/(?:ucbrowser)[\s\/](\d+(?:\.\d+)+)/i)}:/mxios/i.test(t)?T={name:"Maxthon",maxthon:e,version:n(/(?:mxios)[\s\/](\d+(?:\.\d+)+)/i)}:/epiphany/i.test(t)?T={name:"Epiphany",epiphany:e,version:n(/(?:epiphany)[\s\/](\d+(?:\.\d+)+)/i)}:/puffin/i.test(t)?T={name:"Puffin",puffin:e,version:n(/(?:puffin)[\s\/](\d+(?:\.\d+)?)/i)}:/sleipnir/i.test(t)?T={name:"Sleipnir",sleipnir:e,version:n(/(?:sleipnir)[\s\/](\d+(?:\.\d+)+)/i)}:/k-meleon/i.test(t)?T={name:"K-Meleon",kMeleon:e,version:n(/(?:k-meleon)[\s\/](\d+(?:\.\d+)+)/i)}:d?(T={name:"Windows Phone",osname:"Windows Phone",windowsphone:e},b?(T.msedge=e,T.version=b):(T.msie=e,T.version=n(/iemobile\/(\d+(\.\d+)?)/i))):/msie|trident/i.test(t)?T={name:"Internet Explorer",msie:e,version:n(/(?:msie |rv:)(\d+(\.\d+)?)/i)}:f?T={name:"Chrome",osname:"Chrome OS",chromeos:e,chromeBook:e,chrome:e,version:n(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)}:/edg([ea]|ios)/i.test(t)?T={name:"Microsoft Edge",msedge:e,version:b}:/vivaldi/i.test(t)?T={name:"Vivaldi",vivaldi:e,version:n(/vivaldi\/(\d+(\.\d+)?)/i)||w}:c?T={name:"Sailfish",osname:"Sailfish OS",sailfish:e,version:n(/sailfish\s?browser\/(\d+(\.\d+)?)/i)}:/seamonkey\//i.test(t)?T={name:"SeaMonkey",seamonkey:e,version:n(/seamonkey\/(\d+(\.\d+)?)/i)}:/firefox|iceweasel|fxios/i.test(t)?(T={name:"Firefox",firefox:e,version:n(/(?:firefox|iceweasel|fxios)[ \/](\d+(\.\d+)?)/i)},/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(t)&&(T.firefoxos=e,T.osname="Firefox OS")):l?T={name:"Amazon Silk",silk:e,version:n(/silk\/(\d+(\.\d+)?)/i)}:/phantom/i.test(t)?T={name:"PhantomJS",phantom:e,version:n(/phantomjs\/(\d+(\.\d+)?)/i)}:/slimerjs/i.test(t)?T={name:"SlimerJS",slimer:e,version:n(/slimerjs\/(\d+(\.\d+)?)/i)}:/blackberry|\bbb\d+/i.test(t)||/rim\stablet/i.test(t)?T={name:"BlackBerry",osname:"BlackBerry OS",blackberry:e,version:w||n(/blackberry[\d]+\/(\d+(\.\d+)?)/i)}:p?(T={name:"WebOS",osname:"WebOS",webos:e,version:w||n(/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i)},/touchpad\//i.test(t)&&(T.touchpad=e)):/bada/i.test(t)?T={name:"Bada",osname:"Bada",bada:e,version:n(/dolfin\/(\d+(\.\d+)?)/i)}:h?T={name:"Tizen",osname:"Tizen",tizen:e,version:n(/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i)||w}:/qupzilla/i.test(t)?T={name:"QupZilla",qupzilla:e,version:n(/(?:qupzilla)[\s\/](\d+(?:\.\d+)+)/i)||w}:/chromium/i.test(t)?T={name:"Chromium",chromium:e,version:n(/(?:chromium)[\s\/](\d+(?:\.\d+)?)/i)||w}:/chrome|crios|crmo/i.test(t)?T={name:"Chrome",chrome:e,version:n(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)}:o?T={name:"Android",version:w}:/safari|applewebkit/i.test(t)?(T={name:"Safari",safari:e},w&&(T.version=w)):i?(T={name:i=="iphone"?"iPhone":i=="ipad"?"iPad":"iPod"},w&&(T.version=w)):/googlebot/i.test(t)?T={name:"Googlebot",googlebot:e,version:n(/googlebot\/(\d+(\.\d+))/i)||w}:T={name:n(/^(.*)\/(.*) /),version:r(/^(.*)\/(.*) /)},!T.msedge&&/(apple)?webkit/i.test(t)?(/(apple)?webkit\/537\.36/i.test(t)?(T.name=T.name||"Blink",T.blink=e):(T.name=T.name||"Webkit",T.webkit=e),!T.version&&w&&(T.version=w)):!T.opera&&/gecko\//i.test(t)&&(T.name=T.name||"Gecko",T.gecko=e,T.version=T.version||n(/gecko\/(\d+(\.\d+)?)/i)),!T.windowsphone&&(o||T.silk)?(T.android=e,T.osname="Android"):!T.windowsphone&&i?(T[i]=e,T.ios=e,T.osname="iOS"):g?(T.mac=e,T.osname="macOS"):x?(T.xbox=e,T.osname="Xbox"):m?(T.windows=e,T.osname="Windows"):y&&(T.linux=e,T.osname="Linux");var C="";T.windows?C=N(n(/Windows ((NT|XP)( \d\d?.\d)?)/i)):T.windowsphone?C=n(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i):T.mac?(C=n(/Mac OS X (\d+([_\.\s]\d+)*)/i),C=C.replace(/[_\s]/g,".")):i?(C=n(/os (\d+([_\s]\d+)*) like mac os x/i),C=C.replace(/[_\s]/g,".")):o?C=n(/android[ \/-](\d+(\.\d+)*)/i):T.webos?C=n(/(?:web|hpw)os\/(\d+(\.\d+)*)/i):T.blackberry?C=n(/rim\stablet\sos\s(\d+(\.\d+)*)/i):T.bada?C=n(/bada\/(\d+(\.\d+)*)/i):T.tizen&&(C=n(/tizen[\/\s](\d+(\.\d+)*)/i)),C&&(T.osversion=C);var k=!T.windows&&C.split(".")[0];if(E||a||i=="ipad"||o&&(k==3||k>=4&&!S)||T.silk)T.tablet=e;else if(S||i=="iphone"||i=="ipod"||o||u||T.blackberry||T.webos||T.bada)T.mobile=e;return T.msedge||T.msie&&T.version>=10||T.yandexbrowser&&T.version>=15||T.vivaldi&&T.version>=1||T.chrome&&T.version>=20||T.samsungBrowser&&T.version>=4||T.firefox&&T.version>=20||T.safari&&T.version>=6||T.opera&&T.version>=10||T.ios&&T.osversion&&T.osversion.split(".")[0]>=6||T.blackberry&&T.version>=10.1||T.chromium&&T.version>=20?T.a=e:T.msie&&T.version<10||T.chrome&&T.version<20||T.firefox&&T.version<20||T.safari&&T.version<6||T.opera&&T.version<10||T.ios&&T.osversion&&T.osversion.split(".")[0]<6||T.chromium&&T.version<20?T.c=e:T.x=e,T}function r(e){return e.split(".").length}function i(e,t){var n=[],r;if(Array.prototype.map)return Array.prototype.map.call(e,t);for(r=0;r<e.length;r++)n.push(t(e[r]));return n}function s(e){var t=Math.max(r(e[0]),r(e[1])),n=i(e,function(e){var n=t-r(e);return e+=(new Array(n+1)).join(".0"),i(e.split("."),function(e){return(new Array(20-e.length)).join("0")+e}).reverse()});while(--t>=0){if(n[0][t]>n[1][t])return 1;if(n[0][t]!==n[1][t])return-1;if(t===0)return 0}}function o(e,r,i){var o=n;typeof r=="string"&&(i=r,r=void 0),r===void 0&&(r=!1),i&&(o=t(i));var u=""+o.version;for(var a in e)if(e.hasOwnProperty(a)&&o[a]){if(typeof e[a]!="string")throw new Error("Browser version in the minVersion map should be a string: "+a+": "+String(e));return s([u,e[a]])<0}return r}function u(e,t,n){return!o(e,t,n)}var e=!0,n=t(typeof navigator!="undefined"?navigator.userAgent||"":"");return n.test=function(e){for(var t=0;t<e.length;++t){var r=e[t];if(typeof r=="string"&&r in n)return!0}return!1},n.isUnsupportedBrowser=o,n.compareVersions=s,n.check=u,n._detect=t,n.detect=t,n})

'use strict';

var isWindow = new Function("try {return this===window;}catch(e){ return false;}");
var isNode = new Function("try {return this===global;}catch(e){return false;}");

var zs4;
zs4 = new Object();
if (isNode()) {
    zs4 = exports;
    zs4.debug = require('debug')('zs4');
}
else {
    zs4 = new Object();
    //zs4.debug = function(){};
    zs4.debug = function(v){console.log(v);};
}

zs4.const = {
  API:{
    NAME:{
      MINLENGTH:2,
      MAXLENGTH:32,
      ADMIN:'admin',
      FS:'fs',
      INITIALIZE:'initialize',
      QUERY:'query',
    },
  },
  DEFAULT:{
    MESSAGE:{
      EXPIRY:{
        MS:1000,
      },
    },
  },
  EMAIL:{
    MINLENGTH:5,
    MAXLENGTH:64,
    ROOT:'root@zs4.zs4',
    PUBLIC:'public@zs4.zs4',
  },
  MS:{
    SECOND:1000,
    MINUTE:(1000*60),
    HOUR:(1000*60*60),
    DAY:(1000*60*60*24),
    WEEK:(1000*60*60*24*7),
    YEAR:(1000*60*60*24*365.25),
  },
  OBJECT:{
    OWNER:'owner@zs4.zs4',
  },
  PATH:{
    MINLENGTH:1,
    MAXLENGTH:255,
  },
  NAME:{
    MINLENGTH:1,
    MAXLENGTH:32,
  },
  STRING:{
    MINLENGTH:0,
    MAXLENGTH:255,
  },
  TEXT:{
    DFTLENGTH:((8*1024)-1),
    MINLENGTH:0,
    MAXLENGTH:((256*256)-1),
  },
  SPACECHARS:' \n\r\t',
  SPECIALCHARS:' \n\r\t\"\'\\/,.?<>[]=-_+()*&^%$#@!0123456789;:',
  NOATTRCHARS:'\n\r\t\"\'',
  MAXLENGTH:{
    META:160,
    TITLE:70,
    LANG:10,
  },
};

zs4.is = {
  array:function (a){
    if	(a==null)return false;
    return (a instanceof Array);
  },
  boolean:function(b){
    if	(b==null)return false;
    if	(typeof(b)!='boolean')return false;
    return true;
  },
  function:function(f){
    if (f==null)return false;
    return (f instanceof Function);
  },
  string:function(s){
    if	(s==null)return false;
    if	(typeof(s)!='string')return false;
    return true;
  },
  email:function(str){
    if (!zs4.is.string(str)||str.length<zs4.const.EMAIL.MINLENGTH||str.length>zs4.const.EMAIL.MAXLENGTH)return false;
    var at = str.indexOf('@');
    if (at < 1 || at > (str.length-(zs4.const.EMAIL.MINLENGTH-1)) || str.lastIndexOf('@') != at)return false;
    var nam = str.substr(0,at);
    var dom = str.substr((at+1),(str.length-at-1));
    var dot = dom.indexOf('.');
    if (dot < 1 || dot > (dom.length-2))return false;
    dot = dom.lastIndexOf('.');
    if (dot > (dom.length-2))return false;
    return true;
  },
  password:function(s){
    if	(!zs4.is.string(s) || s.trim()!=s || s.length < 4)return false;
    return true;
  },
  number:function(b){
    if	(b==null)return false;
    if	(typeof(b)!='number')return false;
    return true;
  },
  object:function(o){
    //debugger;
    if	(o==null)return false;
    if	(o instanceof Object){
      if (typeof(o)=='function')return false;
      if	(typeof(o.length)=='number' || (o instanceof Array)==true)return false;
      return true;
    }
    return false;
  },
  error:function(o){if (!zs4.is.object(o) || !zs4.is.object(o.error))return false;return true;},
  done:function(o){if (!zs4.is.object(o) || !zs4.is.object(o.done))return false;return true;},
  name:function(n){
    if	(!zs4.is.string(n))return false;
    if	(n=="zs4")return true;
    var l=n.length;
    if	(l<1)return false;
    for (var i=0;i<l;i++){
      if(n.charAt(i)<'a'||n.charAt(i)>'z')return false;
    }
    return true;
  },
  objectProperty:function(o,p){
    if(!zs4.is.object(o)||!zs4.is.string(p))return null;
    var a = p.split('.');
    var l = a.length;
    var p = '';
    if (l<1)return null;
    if ((l>=2)&&(a[0]=='zs4')&&(a[1]=='zs4'))return null;

    for (var i = 0 ; i < l ; i++){
      if (p!='')p+='.'; p+=a[i];

      if (!o.hasOwnProperty(a[i])){return null;}
      o=o[a[i]];
    }
    return o;
  },
  space:function(ch){
    if (ch=='\n'||ch=='\r'||ch=='\t'||ch==' ')return true;
    return false;
  },
  numchar:function(ch){
    if (ch>='0'&&ch<='9')return true;
    return false;
  },
  type:function(o){
    if (!zs4.is.object(o)
    || !zs4.is.object(o._)
    || !zs4.is.name(o._.name)
    || !zs4.is.name(o._.typename)
    //|| !zs4.is.function(o.type)
    )return false;
    return true;
  },
  domelement:function(o){
    if (!zs4.is.object(o)
    || !zs4.is.object(o.style)
    //|| !zs4.is.string(o.className)
    )return false;
    return true;
  },
};

if (isNode()){
  zs4.is.node = function(){return true;}
  zs4.is.window = function(){return false;}
}
else {
  zs4.is.node = function(){return false;}
  zs4.is.window = function(){return true;}
}

zs4.string = {
  addKeyWord:function(o,n,k){
    k = zs4.string.to.lower(k);
    if (!zs4.is.name(k))return;
    if ((o[n].length + k.length + 1)>zs4.const.MAXLENGTH.META){
      return;
    }
    if (o[n]==''){
      o[n] = k;
    }
    else {
      o[n]+= ','+k;
    }
  },
  startsWith:function(s,w){
    if (!zs4.is.string(s) || !zs4.is.string(w))return false;
    var b = s.substr(0,w.length);
    if (b == w)return true;
    return false;
  },
  endsWith:function(s,w){
    if (!zs4.is.string(s) || !zs4.is.string(w) || w.length<s.length)return false;
    var b = s.substr(s.length-w.length,w.length);
    if (b == w)return true;
    return false;
  },
  split:{
    names:function(str){
      var arr = []; var buf = '';
      for (var i = 0; i < str.length ;i++){
        var c = str.charAt(i);
        if ((c >= 'a' && c <= 'z')){
          buf+=c;
        }else{
          if (buf!=''){
            arr.push(buf);
            buf = '';
          }
        }
      }
      if (buf!=''){
        arr.push(buf);
      }
      return arr;
    },
    words:function(str){
      var arr = []; var buf = '';
      for (var i = 0; i < str.length ;i++){
        var c = str.charAt(i);
        if ((c >= 'a' && c <= 'z')||(c >= 'A' && c <= 'Z')){
          buf+=c;
        }else{
          if (buf!=''){
            arr.push(buf);
            buf = '';
          }
        }
      }
      if (buf!=''){
        arr.push(buf);
      }
      return arr;
    },
    separators:function(str,sep){
      str = new String(str);
      var arr = []; var buf = '';
      for (var i = 0; i < str.length ;i++){
        var c = str.charAt(i);
        if (sep.indexOf(c)== -1){
          buf+=c;
        }else{
          if (buf!=''){
            arr.push(buf);
            buf = '';
          }
        }
      }
      if (buf!=''){
        arr.push(buf);
      }
      return arr;
    },
    spaces:function(str){
      return zs4.string.split.separators(str,zs4.const.SPACECHARS);
    }
  },
  strip:{
    chars:function(s,x){
      var r='';
      for (var i=0;i<s.length;i++){
        var c = s.charAt(i);
        if (x.indexOf(c)== -1)r+=c;
      }
      return r;
    },
  },
  to:{
    lower:function(str){return str.toLowerCase();},
    upper:function(str){return str.toUpperCase();},
  },
  array:{
    is:{
      element:function(arr,str){
        var trimmed = str.trim();
        for (var i = 0 ; i < arr.length ; i++){
          if (arr[i] == trimmed)return true;
        }
        return false;
      },
    },
    add:{
      new:function(arr,str){
        if (zs4.string.array.is.element(arr,str.trim()))return arr;
        arr.push(str.trim());
        return arr;
      },
    },
    remove:{
      string:function(arr,str){
        var trimmed = str.trim();
        for (var i = (arr.length-1) ; i >= 0 ; i--){
          if (arr[i]==trimmed)
            arr.splice(i,1);
        }
      },
    },
    trimToArray:function (arr,to){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        if (!zs4.string.array.is.element(to,arr[i]))
          arr.splice(i,1);
      }
    },
    addToArray:function(arr,to){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        zs4.string.array.add.new(to,arr[i]);
      }
    },
    sort:{
      value:{
        ascend:function(arr){
          arr.sort(function(a,b){
            return a.localeCompare(b);
          });
        },
        descend:function(arr){
          arr.sort(function(a,b){
            return b.localeCompare(a);
          });
        },
      },
      length:{
        ascend:function(arr){
          arr.sort(function(a,b){
            return a.length - b.length;
          });
        },
        descend:function(arr){
          arr.sort(function(a,b){
            return b.length - a.length;
          });
        },
      },
    },
  },
  search:function(s,f){
    var a = zs4.string.split.spaces(f);
    if (a.length==0)return true;
    for (var i = 0 ; i < a.length;i++){
      if (s.toLowerCase().search(a[i].toLowerCase())>=0)return true;
    }
    return false;
  },
  escape:{
    html:function(plain){
      var html = ''
      for (var i = 0; i < plain.length; i++){
        var ch = plain.charAt(i);
        if (ch=='\n'){ html += '<br>\n';}
        else if (ch=='&'){html += '&amp;'}
        else if (ch=='<'){html += '&lt;'}
        else if (ch=='>'){html += '&gt;'}
        else if (ch=='&'){html += '&quot;'}
        else if (ch=='"'){html += '&amp;'}
        else if (ch=='\''){html += '&apos;'}
        else {html += ch;}
      }

      return html;
    },
  },
  from:{
    date:function(time){
      var d = new Date(time);
      return ( d.toLocaleDateString() + ' ' + d.toLocaleTimeString() );
    }
  },
};

zs4.parse = {
  int:function(v){
    var n = parseInt(v);
    if (n==NaN)return 0;
    return n;
  },
  float:function(v){
    var n = parseFloat(v);
    if (n==NaN)return 0;
    return n;
  },

};
zs4.count = {
    object:{
      properties:function(o){
        if (!zs4.is.object(o))return 0;
        var count = 0;
        for (var n in o)count++;
        return count;
      },
    },
    type:{
      members:function(o){
        if (!zs4.is.type(o))return 0;
        var count = 0;
        for (var n in o)if(zs4.is.type(o[n]))count++;
        return count;
      },
    },
};

zs4.copy = {
    noncircular:function(from,limit,functions){
      if (!zs4.is.object(from))return null;

      if (!zs4.is.number(limit))limit = 0;
      limit = parseInt(limit);
      if (limit>10)limit = 10;

      var a = [from];
      function c(o){
        for (var i = 0 ; i < a.length ; i++){
          if (a[i]==o)return true;return false;
        }
      }

      function recurse(f,t,level){
        for (var n in f){
          if (zs4.is.function(f[n])){
            if (functions)t[n] = f[n];
            //zs4.debug(n+' is function.');
            continue;
          }
          if (zs4.is.object(f[n])){
            if(c(f[n]))continue;
            //zs4.debug(n+' is object.');
            a.push(f[n]);
            if (level<limit){
              var nu = new Object();
              recurse(f[n],nu,level+1);
              if (zs4.count.object.properties(nu)>0)t[n] = nu;
            }
          }
          else{
            t[n] = f[n];
          }
        }
        return t;
      };
      return recurse(from,new Object(),0);
    },
    schemabasics:function(from,to){
      if (!zs4.is.type(from)||!zs4.is.type(to))return;

      if (zs4.is.number(from._.min))to._.min=from._.min;
      if (zs4.is.number(from._.max))to._.max=from._.max;

      if (zs4.is.number(from._.minlength))to._.minlength=from._.minlength;
      if (zs4.is.number(from._.maxlength))to._.maxlength=from._.maxlength;
      if (zs4.is.array(from._.enum)&&from._.enum.length>0)to._.enum = from._.enum;

    },
    trim:function(f,t){
      //debugger;
      for (var n in f){
        if (zs4.is.object(f[n])){
          if (!zs4.is.object(t[n])){
            t[n] = new Object();
          }
          zs4.copy.trim(f[n],t[n]);
        }
        else {
          t[n] = f[n];
        }
      }

      for (var n in t){
        if (!f.hasOwnProperty(n))
          t[n] = null;
      }
    },
};

zs4.json =  {
  stringify:function(o){return JSON.stringify(zs4.copy.noncircular(o,15));},
  textify:function(o){
    o = zs4.copy.noncircular(o,15);

    var text = ''; var level = 0; var ipl = 2;
    function recurse(o){
      var indent = ''; for (var i = 0;i<level;i++){indent += ' ';}
      if (zs4.is.object(o)){
        text += '{'
        var count = 0; for (var n in o){count += 1;}
        if (count>0)text+='\r\n';
        var c2 = 0;
        for (var n in o){
          c2 += 1;
          text += indent + '\"'+ n + '\":';

          if (zs4.is.object(o[n])||zs4.is.array(o[n])){
            level += ipl;
            recurse(o[n]);
            level -= ipl;
          }
          else {
            text += JSON.stringify(o[n]);
          }
          if (c2 < count)text += ',';
          text += '\r\n';
        }
        text += indent+'}';
      }
      else if (zs4.is.array(o)){
        text += '['
        if (o.length>0)text+='\r\n';
        for (var i = 0; i<o.length; i++){
          text += indent; // + '\"'+ n + '\":';

          if (zs4.is.object(o[i])||zs4.is.array(o[i])){
            level += ipl;
            recurse(o[i]);
            level -= ipl;
          }
          else {
            text += JSON.stringify(o[i]);
          }
          if (i < (o.length-1))text += ',';
          text += '\r\n';
        }
        text += indent+']';
      }
      else {
        text += JSON.stringify(o);
      }
    }

    recurse(o);
    return text;
  },
  parse:function(string,output){
    try {
      var r = JSON.parse(string);
      if (zs4.is.function(output))output(null,r);
      return r;
    }
    catch(err) {
        if (zs4.is.function(output))output(err,null);
        return null;
    }
  },
};

zs4.path = {
  resolve:function(obj,path){
    var ret = obj;
    if (path == null || path.length == 0)return ret;
    var a = zs4.string.split.separators(path,'./\\_-');
    if (a == null || a.length == 0)return ret;
    for (var i = 0 ; i < a.length ; i++){
      if (!zs4.is.name(a[i])||!ret.hasOwnProperty(a[i])) return null;
      ret = ret[a[i]];
    }
    return ret;
  },
};

zs4.error = function(o){
  this.error = {
    text:'unknown error',
    data:null,
  }
  if (zs4.is.object(o)){
    if (zs4.is.string(o.text)){this.error.text = o.text.trim();}
    this.error.data = o.data;
  }
  else if (zs4.is.string(o)){
    this.error.text = o;
  }
}

zs4.done = function(o){
  if (zs4.is.object(o))this.done=o;
  else this.done={};
}

zs4.integer = {
  to:{
    name:function(i){
      if (!zs4.is.number(i))return null;
      var s = parseInt(i).toString();
      var r = '';
      for (var i=0;i<s.length;i++){
        if(s.charAt(i)=='0')r+='a';
        if(s.charAt(i)=='1')r+='b';
        if(s.charAt(i)=='2')r+='c';
        if(s.charAt(i)=='3')r+='d';
        if(s.charAt(i)=='4')r+='e';
        if(s.charAt(i)=='5')r+='f';
        if(s.charAt(i)=='6')r+='g';
        if(s.charAt(i)=='7')r+='h';
        if(s.charAt(i)=='8')r+='i';
        if(s.charAt(i)=='9')r+='j';
      }
      return r;
    },
  },
};

zs4.name = {
  to:{
    integer:function(n){
      if (!zs4.is.name(i))return null;
      r = '';
      for (var i=0;i<s.length;i++){
        if(n.charAt(i)=='a')r+='0';
        if(n.charAt(i)=='b')r+='1';
        if(n.charAt(i)=='c')r+='2';
        if(n.charAt(i)=='d')r+='3';
        if(n.charAt(i)=='e')r+='4';
        if(n.charAt(i)=='f')r+='5';
        if(n.charAt(i)=='g')r+='6';
        if(n.charAt(i)=='h')r+='7';
        if(n.charAt(i)=='i')r+='8';
        if(n.charAt(i)=='j')r+='9';
      }
      return parseInt(r);
    },
  },
};

zs4.time = {
  driver:{
    ticks:{
      now:0,
    },
  },

};

zs4.processor = {
  sequential:function(){
    this.count = 0;
    //this.run = 0;
    this.call = function(THIS,foo,arg){
      var foo_this = 'foo'+this.count;
      var foo_next = 'foo'+(this.count+1);
      var cb_this = 'cb'+this.count;
      var cb_next = 'cb'+(this.count+1);
      this[cb_this] = (function(){
        //zs4.debug('inside '+cb_this);
        this[foo_next](this[cb_next]);
      }).bind(this);

      this[foo_this] = function(cb){foo.call(THIS,arg,cb);};
      this.count++;
    };
    this.run = function(cb){
      if (this.count==0){cb(this);return;}
      var cb_end = 'cb'+(this.count-1);
      this[cb_end] = (function(){
        //zs4.debug('inside '+cb_end);
        cb(this);
      }).bind(this);

      this.foo0(this.cb0);
    };
  },
  parallel:function(){
    this.callback = (function(){
      //zs4.debug('parallel callback '+this.count);
      this.count--;
      if (this.count==0){
        //zs4.debug('all parallels ('+this.arr.length+') complete');
        this.cb();
      }
    }).bind(this);
    this.arr = [];
    this.count = 0;
    this.call = function(THIS,foo,arg){
      this.arr.push({t:THIS,f:foo,a:arg});
      this.count++;
    };
    this.run = function(cb){
      //zs4.debug('running parallel');
      if (this.count==0){
        cb();
      }
      else{
        var limit = this.count;
        this.cb = cb;
        for (var i = 0 ; i < limit ; i++){
          this.arr[i].f.call(this.arr[i].t,this.arr[i].a,this.callback);
        }
      }
    }
  },
}

zs4.sequence = function(){
  var SEQ = this;
  SEQ.eventype = new Object({
    text:function(){
      var TEXT = this;
      TEXT.string = new String();
      TEXT.load = function(input){
        if (zs4.is.string(input))TEXT.string = input;
        else TEXT.string = '';
      }
      TEXT.save = function(){
        if (TEXT.string=='')return null;
        else return TEXT.string;
      }
    }
  });
  SEQ.util = new Object();
  SEQ.data = new Object({head:{},event:[]});

  SEQ.util.bits = 0;
  SEQ.util.bit = new zs4.util.bits(SEQ.util,'bits');
  SEQ.util.bit.addBit('running',0);
  SEQ.util.bit.addBit('paused',0);
  SEQ.util.position = 0;

  SEQ.compile = function(){
    for (var i = 0 ; i < SEQ.data.event.length; i++){
      var e = SEQ.data.event[i];
      e.sequence = i;
    }
  }

  SEQ.load = function(input){
    if (!zs4.is.object(input))return;

    if (zs4.is.object(input.head)){

    }
    if (zs4.is.array(input.event)){
      for (var i = 0 ; i < input.event.length; i++){
        var e = new SEQ.event();
        e.load(input.event[i]);
      }
    }
    SEQ.compile();
    return SEQ;
  }
  SEQ.save = function(){
      var ret = new Object({head:{},event:[]});

      for (var i = 0 ; i < SEQ.data.event.length; i++){
        ret.event.push(SEQ.data.event[i].save());
      }

      return ret;
  }

  SEQ.event = function(){
    var EVENT = this;
    EVENT.bits = 0;
    EVENT.bit = new zs4.util.bits(EVENT,'bits');
    EVENT.bit.addBit('bar',0);
    EVENT.bit.addBit('beat',1);
    EVENT.bit.addBit('tick',2);

    EVENT.payload = new Object();

    EVENT.sequence = 0;
    EVENT.time = 0;
    if (SEQ.util.position==SEQ.data.event.length){
      SEQ.data.event.push(this);
      SEQ.util.position++;
    }
    else {
      SEQ.data.event.splice(SEQ.util.position++,0,this);
    }

    EVENT.load = (function(input){
      EVENT.bits = input.bits;
      EVENT.sequence = input.sequence;
      if (input.hasOwnProperty('payload')){
        for (var n in input.payload){
          if (SEQ.eventype.hasOwnProperty(n)&&zs4.is.function(SEQ.eventype[n])){
            EVENT.payload[n] = new SEQ.eventype[n]();
            EVENT.payload[n].load(input.payload[n]);
          }
        }
      }
      return EVENT;
    }).bind(EVENT);

    EVENT.save = (function(input){
      var ret = new Object();
      ret.bits = EVENT.bits;
      ret.sequence = EVENT.sequence;
      if (EVENT.hasOwnProperty('payload')){
        for (var n in EVENT.payload){
          if (!ret.hasOwnProperty('payload'))ret.payload=new Object();
          ret.payload[n] = EVENT.payload[n].save();
        }
      }
      return ret;
    }).bind(EVENT);
  };

};

zs4.location = {
  get:function(){
    var ret = zs4.THIS;

    if (!zs4.is.string(zs4.location.path)||zs4.location.path.length==0) return ret;
    var a = zs4.string.split.separators(zs4.location.path,'.');
    if (a.length == 0)return ret;

    for (var i = 0 ; i < a.length ;i++){
      if (!ret.hasOwnProperty(a[i])||!zs4.is.type(ret[a[i]]))break;
      ret = ret[a[i]];
    }

    if (zs4.is.type(ret._.scope))return ret._.scope;
    return ret;
  }
}
// Create base64 Object
zs4.base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=zs4.base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9\+\/\=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=zs4.base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/\r\n/g,"\n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}

zs4.util = {
  flags:function(){
    this.value = 0;
    this.set = new Object();
    this.get = new Object();
    this.nodeflags = 0x0ffffffffffff;

    this.addFlag = function(flagname,value){
      this[flagname] = value;

      this.set[flagname] = (function(tof){
        if (tof==true)this.value |= this[flagname];
        else if (tof==false)this.value &= (~(this[flagname]));
        return this.value;
      }).bind(this);
      this.get[flagname] = (function(){
        if ((this.value & this[flagname])==this[flagname])return true; return false;
      }).bind(this);

    }

    this.addFlag('trim',0x0001); // this value will be trimmed of leading and trailing whitespace on the client and server.
    this.addFlag('nosort',0x0002);
    this.addFlag('notrans',0x0004); 
    this.addFlag('scope',0x0008);

    this.addFlag('noset',0x0010); // this value cannot be set by the client, but can be set by the server.
    this.addFlag('api',0x0020); 
    this.addFlag('required',0x0040); // this value is required to pass automated validation.
    this.addFlag('nostore',0x0080); // this value wil not be stored in the database, but will be used in the API, to trasport data between client and server.

    this.addFlag('noget',0x0100); // this value will never be sent to the client.
    this.addFlag('am',0x0200);
    this.addFlag('own',0x0400);
    this.addFlag('noprune',0x0800);

    this.addFlag('nodisplay',0x1000); // this value will not be displayed in the client, even if sent to the client. 
    this.addFlag('index',0x2000); // this value will be indexed for faster searching.
    this.addFlag('unique',0x4000); // this value will be unique across all instances.
    this.addFlag('authgetpublic',0x8000);

    this.addFlag('authget',0x10000);
    this.addFlag('authset',0x20000);
    this.addFlag('authgetauth',0x40000);
    this.addFlag('authsetauth',0x80000);

    this.addFlag('authsetself',0x100000);
    this.addFlag('authsetpublic',0x200000);
    this.addFlag('deletable',0x400000);
    this.addFlag('textsearch',0x800000);

    this.addFlag('local',0x1000000);
    this.addFlag('authroot',0x2000000);
    this.addFlag('quickupdate',0x4000000);
    this.addFlag('prune',0x8000000);

    this.addFlag('authgetuser',0x10000000);
    this.addFlag('authsetuser',0x20000000);
    this.addFlag('nogetall',0x40000000);
    this.addFlag('priced',0x80000000);

    //combo flags
    this.addFlag('authuser',this.authgetuser|this.authsetuser);
    this.addFlag('apiarg',this.authgetpublic|this.authsetpublic);

    this.getString = function(mask){
      var int = mask;
      if (!zs4.is.number(int))int=this.value;
      var ret = '';
      function addFlag(s){
        if (ret.length == 0) ret = s; else ret += (' '+s);
      }
      if (int & this.trim) addFlag('trim');
      if (int & this.nosort) addFlag('nosort');
      if (int & this.notrans) addFlag('notrans');
      if (int & this.scope) addFlag('scope');

      if (int & this.noset) addFlag('noset');
      if (int & this.api) addFlag('api');
      if (int & this.required) addFlag('required');
      if (int & this.nostore) addFlag('nostore');

      if (int & this.noget) addFlag('noget');
      if (int & this.am) addFlag('am');
      if (int & this.own) addFlag('own');
      if (int & this.noprune) addFlag('noprune');

      if (int & this.nodisplay) addFlag('nodisplay');
      if (int & this.index) addFlag('index');
      if (int & this.unique) addFlag('unique');
      if (int & this.authgetpublic) addFlag('authgetpublic');

      if (int & this.authget) addFlag('authget');
      if (int & this.authset) addFlag('authset');
      if (int & this.authgetauth) addFlag('authgetauth');
      if (int & this.authsetauth) addFlag('authsetauth');

      if (int & this.authsetself) addFlag('authsetself');
      if (int & this.authsetpublic) addFlag('authsetpublic');
      if (int & this.deletable) addFlag('deletable');
      if (int & this.textsearch) addFlag('textsearch');

      if (int & this.local) addFlag('local');
      if (int & this.authroot) addFlag('authroot');
      if (int & this.quickupdate) addFlag('quickupdate');
      if (int & this.prune) addFlag('prune');

      if (int & this.authgetuser) addFlag('authgetuser');
      if (int & this.authsetuser) addFlag('authsetuser');
      if (int & this.nogetall) addFlag('nogetall');
      if (int & this.priced) addFlag('priced');


      return ret;
    };

    this.setString = function(s){
      //zs4.debug(this.value);
      var a = zs4.string.split.words(s)
      for (var i = 0 ; i < a.length ; i++){
        //zs4.debug(a[i]+': ');
        if (zs4.is.function(this.set[a[i]])){
          //zs4.debug('  ...is a function');
          this.set[a[i]](true);
        }
      }
      return this.value;
    };

  },
  bits:function(po,name){
    const BITLIMIT = 32;
    const BITMASK = 0x0ffffffff;

    var THIS = this;
    if (po==null)po=THIS;
    if (name==null)name='bits';
    THIS._ = new Object({po:po,n:name});

    this.addBit = (function(n,v){
      if (!zs4.is.name(n) || v < 0 || v >= BITLIMIT)return null;
      this[n] = new Object({v:v,m:(1<<v),});
      this[n].true = (function(){THIS._.po[THIS._.n] |= (this[n].m);}).bind(this);
      this[n].false = (function(){THIS._.po[THIS._.n] &= (~(this[n].m));}).bind(this);
      this[n].get = (function(){if(THIS._.po[THIS._.n] & this[n].m)return true;return false;}).bind(this);
      return this[n];
    }).bind(this);

    this.getString = (function(v){
      var ret = ''
      if (v == null)v = THIS._.po[THIS._.n];
      for (var n in this)if(zs4.is.object(this[n])&&zs4.is.number(this[n].m)){
        if (v & this[n].m){
          if (ret == '')ret += n;
          else ret += (' '+n);
        }
      }
      return ret;
    }).bind(this);

    this.setString = (function(s){
      var a = zs4.string.split.words(s)
      for (var i = 0 ; i < a.length ; i++){
        //zs4.debug(a[i]+': ');
        if (zs4.is.object(this[a[i]])&&zs4.is.number(this[a[i]].m)){
          //zs4.debug('  ...is a function');
          this[a[i]].true();
        }
      }
      return THIS._.po[THIS._.n];

    }).bind(this);
    return this;
  },
  select:function(){
    this.sc = 'all';
    this.itemConstant = function(){

    };

  },
};

zs4.scope = {
  /*
  doctype:function(){
    var APP = this;
    zs4.type.scope.call(APP);
    APP._.create = zs4.scope.doctype;
    APP.zs4.head.typename._.value = 'doctype';
    APP.zs4.head.typename._.default = 'doctype';
    APP._.name = 'doctype';

    APP._.property(new zs4.type.object({name:'document',flags:'apiarg',}));
    APP.document._.property(new zs4.type.object({name:'new',flags:'api',}));
    APP.document._.property(new zs4.type.object({name:'list',flags:'api apiarg',}));
  },
  document:function(){
    var DOCUMENT = this;
    zs4.type.scope.call(DOCUMENT);
    DOCUMENT._.create = zs4.scope.document;
    DOCUMENT.zs4.head.typename._.value = 'document';
    DOCUMENT.zs4.head.typename._.default = 'document';
    DOCUMENT._.name = 'document';

  },
  */
};

zs4.folder = new Object();
zs4.array = new Object();

zs4.lang = [
  'ab','aa','af','ak','sq','am','ar','an','hy','as',
  'av','ae','ay','az','bm','ba','eu','be','bn','bh',
  'bi','bs','br','bg','my','ca','ch','ce','ny','zh',
  'cv','kw','co','cr','hr','cs','da','dv','nl','en',
  'eo','et','ee','fo','fj','fi','fr','ff','gl','ka',
  'de','el','gn','gu','ht','ha','he','hz','hi','ho',
  'hu','ia','id','ie','ga','ig','ik','io','is','it',
  'iu','ja','jv','kl','kn','kr','ks','kk','km','ki',
  'rw','ky','kv','kg','ko','ku','kj','la','lb','lg',
  'li','ln','lo','lt','lu','lv','gv','mk','mg','ms',
  'ml','mt','mi','mr','mh','mn','na','nv','nb','nd',
  'ne','ng','nn','no','ii','nr','oc','oj','cu','om',
  'or','os','pa','pi','fa','pl','ps','pt','qu','rm',
  'rn','ro','ru','sa','sc','sd','se','sm','sg','sr',
  'gd','sn','si','sk','sl','so','st','es','su','sw',
  'ss','sv','ta','te','tg','th','ti','bo','tk','tl',
  'tn','to','tr','ts','tt','tw','ty','ug','uk','ur',
  'uz','ve','vi','vo','wa','cy','wo','fy','xh','yi',
  'yo','za',
];

zs4.type = {

  unknown:function(input){
    if (input == null || !zs4.is.object(input) || !zs4.is.name(input.name)){
      return new zs4.error({text:'bad input',data:input});
    }

    this._ = new Object();
    this._.path = '';
    this._.name = input.name;
    this._.price = new Array();

    //if (input.value != null)this._.value=input.value;

    this._.flags = new zs4.util.flags();
    if (zs4.is.string(input.flags))this._.flags.setString(input.flags);

    if (zs4.is.type(input.inscope)&&input.inscope._.flags.get.scope())this._.inscope = input.inscope;

    if (zs4.is.array(input.authGet)){
      this._.authGet = input.authGet;
    }
    else {
      this._.authGet = new Array();
    }
    if (zs4.is.array(input.authSet)){
      this._.authSet = input.authSet;
    }
    else {
      this._.authSet = new Array();
    }
    if (zs4.is.array(input.authGetAuth)){
      this._.authGetAuth = input.authGetAuth;
    }
    else {
      this._.authGetAuth = new Array();
    }
    if (zs4.is.array(input.authSetAuth)){
      this._.authSetAuth = input.authSetAuth;
    }
    else {
      this._.authSetAuth = new Array();
    }

    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else {
      this._.enum = new Array();
    }

    if (zs4.is.array(input.addTypes)){
      this._.addTypes = input.addTypes;
    }
    else {
      this._.addTypes = new Array();
    }
    this._.addId = 0;

    if (zs4.is.window()){
      this._.cbarr = new Array();
    }

    this._.onchange_call = (function(){
      if (!zs4.is.array(this._.onchange_arr))return;
      for (var i = 0; i < this._.onchange_arr.length; i++){
        this._.onchange_arr[i](this);
      }
    }).bind(this);
    this._.onchange = (function(f){
      if (!zs4.is.array(this._.onchange_arr))this._.onchange_arr = new Array();
      this._.onchange_arr.push(f);
    }).bind(this);

    this._.localRefresh = (function(){
      for (var n in this)if (zs4.is.type(this[n])){
        this[n]._.localRefresh();
      }
      if (zs4.is.function(this._.onLocalChange)){
        this._.onLocalChange();
      }
    }).bind(this);
    //if (zs4.is.number(input.min))this._.min = input.min;
    //if (zs4.is.number(input.max))this._.max = input.max;
    //if (zs4.is.number(input.minlength))this._.minlength = input.minlength;
    //if (zs4.is.number(input.maxlength))this._.maxlength = input.maxlength;
    this._.parseInt = (function(v){
      var n = parseInt(v);
      if (n==NaN){
        if (zs4.is.number(this._.default))n = this._.default;
        else n = 0;
      }
      return n;
    }).bind(this);
    this._.parseFloat = (function(v){
      var n = parseFloat(v);
      if (n==NaN){
        if (zs4.is.number(this._.default))n = this._.default;
        else n = 0;
      }
      return n;
    }).bind(this);

    this._.zs4checkfail = (function(req,text){
      if (req != null)req.error(this,text);
      zs4.debug('ZS4 CHECK FAIL!!!: '+ this._.path+' error:'+text);
      return false;
    }).bind(this);
    this._.zs4checkinit = (function(req,input){
      if (this._.flags.get.notrans()){
        return this._.zs4checkfail(req,'notrans');
      }
      if (this._.flags.get.required()&&input==null){
        return this._.zs4checkfail(req,'required');
      }
      return true;
    }).bind(this);

    this._.zs4check = (function(req,input){return this._.zs4checkinit(req,input);}).bind(this);

    this._.console = new Object({switch:false,})

    this._.wrapRequest = (function(r){
      var patharr = zs4.string.split.separators(this._.path,'.');
      if (patharr.length>0)for (var i = 0 ; i < patharr.length ; i++){
        var n = patharr[patharr.length-1-i];
        var w = new Object();
        w[n] = r;
        r = w;
      }
      return r;
    }).bind(this);

    this._.store = (function(){

      //zs4.debug(this._.path+'.store()');
      if (this._.flags.get.nostore()){
        //zs4.debug(this._.path+'.NO_store()');
        return null;
      }
      //zs4.debug(this._.path+'.actually_store()');

      //zs4.debug(this._.path+'value_store('+this._.typename +')');
      return this._.value;
    }).bind(this);

    this._.elementConnect = (function(p,e){
      if (p==null)e._.path = e._.name;
      else e._.path = p._.path +'.'+e._.name;
      if (e._.type == Object){
          for (var n in e){
            if (!zs4.is.type(e[n]))continue;
            this._.elementConnect(e,e[n]);
          }
      }
      return e;
    }).bind(this);

    this._.new = (function(){
      if (zs4.is.function(this._.create)){
        //zs4.debug('FROM CONSTRUCTIST!!!!');
        var r = new this._.create(this._);
        return r;
      }
      var ret = new zs4.type[this._.typename](this._);
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;
        var prop = this[n]._.new(this);
        if (prop != null) ret._.property(prop);
      }
      return ret;
    }).bind(this);

    this._.clone = (function(parent){
      var ret = this._.new();
      if (this._.type == Object){
        ret._.load(this._.store());
      }
      return ret;
    }).bind(this);

    this._.zs4Parent = (function(){
      var arr = zs4.string.split.separators(this._.path,'.');
      var result = zs4.THIS;
      var scan = zs4.THIS;
      for (var i = 0; i < arr.length ; i++){
        if (!scan.hasOwnProperty(arr[i])
        ||!zs4.is.type(scan[arr[i]]))
        return result;
        scan = scan[arr[i]];

        if (
            scan.hasOwnProperty('zs4')
          && zs4.is.type(scan.zs4)
          && scan.zs4._.type == Object
        )result = scan;
      }
      return result;
    }).bind(this);
    this._.shouldBeSaved = (function(req){
      //zs4.debug('this.shouldBeSaved()');
      if (this._.flags.get.nostore()||req.noneedsaving==true)return;
      zs4.debug('this.shouldBeSaved('+this._.path+')');
      req.request.needsSaving = true;
      this._.scope.zs4.head.updated._.value = Date.now();
      if (this._.scope._.path != '')this._.scope._.getTree(req);
    }).bind(this);

    this._.getInitialize = (function(req){

      if (this._.flags.get.noget())return null;
      //zs4.debug('ialize() req.flags=\''+req.flags.getString()+'\'');

      //if (!req.flags.get.authgetpublic()&&!req.flags.get.authsetself()&&!req.flags.get.authget())return null;
      if (!req.flags.get.authget())return null;

      var get = req.get(this);
      get._.name = this._.name;
      get._.typename = this._.typename;
      zs4.copy.schemabasics(this,get);

      if (this._.typename=='enum'&&zs4.is.array(this._.enum)&&this._.enum.length>0)get._.enum = this._.enum;

      if (zs4.is.type(this._.inscope)&&this._.inscope._.flags.get.scope()){
        get._.inscope = this._.inscope._.path;
      }

      if (this._.flags.get.noprune())req.flags.set.prune(false);
      if (this._.price.length>0)req.flags.set.priced(true);
      else req.flags.set.priced(false);

      get._.flags = req.flags.value;

      if (this._.flags.get.api())get._.flags |= req.flags.api;
      if (this._.flags.get.scope())get._.flags |= req.flags.scope;
      if (this._.flags.get.noset())get._.flags |= req.flags.noset;
      if (this._.flags.get.index())get._.flags |= req.flags.index;
      if (this._.flags.get.unique())get._.flags |= req.flags.unique;
      if (this._.flags.get.notrans())get._.flags |= req.flags.notrans;
      if (this._.flags.get.authgetpublic())get._.flags |= req.flags.authgetpublic;
      if (this._.flags.get.authsetpublic())get._.flags |= req.flags.authsetpublic;
      if (this._.flags.get.authsetself())get._.flags |= req.flags.authsetself;
      if (this._.flags.get.local())get._.flags |= req.flags.local;
      if (this._.flags.get.required())get._.flags |= req.flags.required;
      if (this._.flags.get.authroot())get._.flags |= req.flags.authroot;
      if (this._.flags.get.quickupdate())get._.flags |= req.flags.quickupdate;
      if (this._.flags.get.nosort())get._.flags |= req.flags.nosort;
      if (this._.flags.get.textsearch())get._.flags |= req.flags.textsearch;
      if (this._.flags.get.priced())get._.flags |= req.flags.priced;

      if (!req.flags.get.authset()
      ||  this._.flags.get.noset()
      ){
        get._.flags |= req.flags.noset;
        get._.flags &= (~(req.flags.api));
      }

      if (this._.price.length>0){
        get._.flags |= req.flags.priced;
        zs4.debug('PRICED: '+this._.flags.getString(get._.flags));
      }
      else {
        get._.flags &= (~(req.flags.priced));
      }

      return get;

    }).bind(this);
    this._.getValue = (function(){ return this._.value;}).bind(this);
    this._.get = (function(req,po){
      var get = this._.getInitialize(req);
      if (get == null) return null;
      if (this._.type != Object){
        get._.value = this._.getValue();

      }
      return get;
    }).bind(this);
    this._.getTree = (function(req){
      req.setScope(this);
      var get = this._.get(req);
      if (get == null) return null;

      for (var n in this)if (zs4.is.type(this[n])){
        this[n]._.getTree(req);
      }

      return get;
    }).bind(this);

    this._.got = (function(req,o){
      //zs4.debug(this);
      if (!zs4.is.type(o))return;

      if ( this._.name != o._.name
        || this._.typename != o._.typename
      ){
        zs4.debug('this._.name:'+this._.name+',o._.name: '+o._.name);
        zs4.debug('this._.typename:'+this._.typename+',o._.typename: '+o._.typename);
        zs4.debug('missmatching type or name');
      }

      this._.name = o._.name;
      this._.typename = o._.typename;

      if (zs4.is.array(o._.enum))this._.enum = o._.enum;

      zs4.copy.schemabasics(o,this);
      this._.flags.value = o._.flags;// & (~(this._.flags.nodisplay));

      if (zs4.is.string(o._.inscope)){// &&this._.inscope._.flags.get.scope()){
        var is = this._.scope._.resolvePath(o._.inscope);
        if (is != null  && is._.flags.get.scope()) {
          this._.inscope = is;
        }
      }
      if (this._.flags.get.nosort())this._.sortDefault = this._.sortNot;

      if (this._.type==Object){

        for (var n in o){
          if (!zs4.is.type(o[n]))continue;

          if (!this.hasOwnProperty(n)||!zs4.is.type(this[n])){
            var nu =new zs4.type[o[n]._.typename](o[n]._);
            nu._.name = o[n]._.name;
            nu._.typename = o[n]._.typename;
            this._.property(nu);
          }

          this[n]._.got(req,o[n]);//,this);
        }

        if (this._.flags.get.prune()&&!this._.flags.get.local()){
          //zs4.debug('pruning '+this._.path);

          for (var n in this){
            if (!zs4.is.type(this[n]))continue;

            //this[n]._.flags.set.nodisplay(false);

            if (zs4.is.type(o[n]))continue;

            if (!this[n]._.flags.get.noprune()){
              //zs4.debug('pruning '+this[n]._.path);
              if (zs4.is.function(this[n]._.cleanup))this[n]._.cleanup();
              this._.value[n]==null;
              this[n]==null;
            }
            else if (!this[n]._.flags.get.local()){
              this[n]._.flags.set.nodisplay(true);
            }
          }
        }
      }
      else {
        this._.value = o._.value;

        this._.onchange_call();
      }

    }).bind(this);

    this._.dcb = (function(req,input){
      this._.cberror = null;
      this._.cbresult = null;

      if (zs4.is.object(input)){
        if (zs4.is.object(input)&&zs4.is.object(input._)){
          for (var n in input._){
            if (n=='auth'){
              if (input._.auth.type == 'getauth' && zs4.is.array(input._.auth.arr)){
                this._.authGet = input._.auth.arr;
              }
              else if (input._.auth.type == 'setauth' && zs4.is.array(input._.auth.arr)){
                this._.authSet = input._.auth.arr;
              }
              else if (input._.auth.type == 'authgetauth' && zs4.is.array(input._.auth.arr)){
                this._.authGetAuth = input._.auth.arr;
              }
              else if (input._.auth.type == 'authsetauth' && zs4.is.array(input._.auth.arr)){
                this._.authSetAuth = input._.auth.arr;
              }
            }
            else if (n=='console'){
              this._.console.switch = input._.console.switch;
              if (zs4.is.array(input._.console.output)){
                for (var i = 0 ; i < input._.console.output.length ; i++){
                  zs4.zs4.debug(input._.console.output[i]);
                }
              }
            }
          }

        }
        if (zs4.is.object(input.error)){
          this._.cberror = input.error;
        }
        if (input.result != null){
          this._.cbresult = input.result;
        }
      }

      if (this._.flags.value & this._.flags.notrans)return;

      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (zs4.is.object(input)&&zs4.is.object(input[n])) this[n]._.dcb(req,input[n]);
        else this[n]._.dcb(req,null);
      }

      if (zs4.is.object(input)){
        if (zs4.is.function(this._.callback)){
          this._.callback(input);
        }
        else if (zs4.is.object(input.result)){
          if (zs4.is.string(input.result.goscope)){
            //zs4.debug('NAV: '+input.result.goscope);
            zs4.navigate(input.result.goscope);
          }
        }
      }
    }).bind(this);

    this._.resolvePath = (function(path){
      var arr = zs4.string.split.separators(path,'./\\-_');
      if (arr.length == 0)return this;
      var ret = this;
      for (var i = 0 ; i < arr.length; i++){
        if (!zs4.is.type(ret[arr[i]]))return null;
        ret = ret[arr[i]];
      }
      return ret;
    }).bind(this);

    this._.flagTree = (function(flag,tof){
      if (tof)this._.flags.value |= flag;
      else this._.flags.value &= (~(flag));
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;
        this[n]._.flagTree(flag,tof);
      }
    }).bind(this);

    this._.inscopeTree = (function(is){
      this._.inscope = is;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;
        this[n]._.inscopeTree(is);
      }
    }).bind(this);

    this._.search = (function(s){

      if (this._.type==Object){
        for (var n in this)if (zs4.is.type(this[n])){
          var ret = this[n]._.search(s);
          if (ret==true)return true;
        }
        return false;
      }
      else if (this._.type==String){
        if (!this._.flags.get.textsearch())return false;
        if (s==null||s=='')return true;
        return zs4.string.search(this._.value,s);
        //var a = zs4.string.split.spaces(s);
        //if (a.length==0)return true;
        //for (var i = 0 ; i < a.length;i++){
        //  if (this._.value.toLowerCase().search(a[i].toLowerCase())>=0)return true;
        //}
        return false;
      }

      return false;
    }).bind(this);

    this._.transformValue = (function(req,cb){
      req.setScope(this);
      if (req.input==null){this._.get(req,req.parent);cb();return;}

      if (req.flags.get.authset()){
        if (!this._.zs4check(req,req.input)){
          this._.get(req,req.parent);cb();return;
        }
        //zs4.debug(this._.path+'._.transform(\''+req.input+'\')');
        if (zs4.is.object(this._.opcode)&&zs4.is.function(this._.opcode.convert)){
          var v = this._.opcode.convert(req.input);
          if (v!=null && v != this._.value){
            if (zs4.is.function(req.request.unique)
            &&!req.request.unique(this,v)){
              req.error(THIS,'already exists');
              this._.get(req,req.parent);cb();return;
            }
            this._.value=v;
            this._.shouldBeSaved(req);
            req.result(this,v);
          }
        }
      }
      else{
        zs4.debug('returning error (not authorized)')
        req.error(this._.scope,'not authorized');
        this._.get(req,req.parent);cb();return;
      }

      this._.get(req,req.parent);
      cb();
    }).bind(this);

    this._.transform = (function(req,cb){
      this._.transformValue(req,cb);
    }).bind(this);

    if (zs4.is.node()){
      const fs = require('fs');
      this._.getScript = (function(req,cb){
        zs4.debug('default getScript() called');
        cb('');
      }).bind(this);
      this._.getStyle = (function(req,cb){
        zs4.debug('default getStyle() called');
        cb('');
      }).bind(this);
      this._.getZS4js = (function(req,cb){
        var SCOPE = this;
        var js = '';

        function script(name){
          if (!zs4.is.string(zs4.THIS.zs4.js._.js[name])){
            zs4.THIS.zs4.js._.js[name] = fs.readFileSync('./zs4/js/'+name+'.js','utf8');
          }
          js += '\n';
          if ((name!='bowser.min')&&(name!='js'))js += '\n{\n';
          if (zs4.THIS.zs4.js.debug._.value==true){
            js += fs.readFileSync('./zs4/js/'+name+'.js','utf8');
            zs4.debug('reloading \"'+'./zs4/js/'+name+'.js'+'\"');
          }
          else {
            js += zs4.THIS.zs4.js._.js[name];
          }
          if ((name!='bowser.min')&&(name!='js'))js += '\n}\n';
          js += '\n';
        };

        script('bowser.min');
        script('js');
        script('meaning');
        script('um');
        script('color');
        script('style');

        //js += 'zs4.meaning.import('+zs4.meaning.exportJSON(req.request.lang)+');\n';

        if (req.request.token&&req.request.payload){
          js += 'zs4.window.token=\''+req.request.token+'\'\n';
        }
        js += 'zs4.location.path = \"'+this._.path+'\"\n';
        js += 'zs4.style.sheet = '+zs4.THIS.zs4.css._.css.css+';\n';
        zs4.debug('calling getStyle('+SCOPE._.path+')');
        this._.getStyle(req,function(style){

          js += 'zs4.style.sheet += '+JSON.stringify(style)+';\n'

          js += 'zs4.style.refresh();\n\n';

          script('admin');
          script('onwindow');

          zs4.debug('calling getScript('+SCOPE._.path+')');
          SCOPE._.getScript(req,function(Skript){

            js += '\n{\n';
            js += Skript;
            js += '\n}\n';

            req.request.html = js;
            cb();
          });

        });
      }).bind(this);
      this._.getHTML = (function(req){
        zs4.debug('getHTML('+this._.path+')');
        var title = this._.path;
        var description = '';
        var keywords = '';
        var lang = 'en';
        if (title=='')title = 'zs4 web app';
        if (this._.flags.get.scope()&&zs4.is.object(this.zs4.head)){
          //zs4.debug('gettin scope.head html...');
          // title
          if (this.zs4.head.title._.value!=''){
            title = zs4.string.strip.chars(this.zs4.head.title._.value,zs4.const.NOATTRCHARS);
          }
          if (this.zs4.head.lang._.value!='')lang = this.zs4.head.lang._.value;
          // description
          if (this.zs4.head.title._.description!=''){
            description = zs4.string.strip.chars(this.zs4.head.description._.value,zs4.const.NOATTRCHARS);
          }

          // keywords
          var arr = this._.getKeyWordArray();
          zs4.string.array.sort.length.descend(arr);
          var o = {k:''};
          for (var i = 0; i < arr.length;i++){zs4.string.addKeyWord(o,'k',arr[i]);}
          keywords = o.k;

        }
        var ampath = this._.path; if (ampath!='')ampath+='.';ampath+='amp';
        var html = '<!DOCTYPE html>\n';
        html += '<html lang="'+lang+'">\n';
          html += ' <head>\n';
            html += '<meta charset="UTF-8">\n';
            html += '  <title>'+title+'</title>\n';
            html += '  <link rel="amphtml" href="https://'+zs4.THIS.zs4.express.host._.value+'/'+ampath+'">\n';
            if (description != ''){
              html+= '  <meta name="description" content="'+description+'">\n';
            }
            if (keywords != ''){
              html+= '  <meta name="keywords" content="'+keywords+'">\n';
            }
            var js = this._.path; if (js!='')js+='.';
            html += '  <script src="/'+js+'zs4.js"></script>\n';
          html += ' </head>\n';
          if (true){
            //html += ' <body onload="zs4.admin()">\n';
            html += ' <body>\n';
            html += ' </body>\n';
          }
        html += '</html>\n';
        req.request.html = html;

        return(html);
      }).bind(this);
      this._.getAmpPlainTextDecorated= (function(req,plain,cb){
        return cb(zs4.string.escape.html(plain));
      }).bind(this);
      this._.getAmpStyle= (function(req,cb){
        return cb('');
      }).bind(this);
      this._.getAmpBody= (function(req,cb){
        var SCOPE = this;
        var query = new Object({
          path:'zs4.search',
          input:{
            value:'',
            type:'',
            owner:'',
          },
          wantreply:true,
        });

        var OWNER = '';
        if (this.zs4.head.typename._.value=='user'){
          query.input.owner = OWNER = this._.path;
        }
        zs4.debug('AMP query',query);
        req.call(query,function(r){
          var r = req.getReply().reply;
          //zs4.debug('AMP result',zs4.json.textify(r));

          var arr = new Array();

          for (var type in r.zs4.type){
            if (!zs4.is.type(r.zs4.type[type]))continue;

            zs4.debug('collecting '+type)
            for (var scope in r.zs4.type[type].array){
              if (!zs4.is.type(r.zs4.type[type].array[scope]))continue;
              zs4.debug('zs4.type.'+type+'.array.'+scope);
              r.zs4.type[type].array[scope]._.path = 'zs4.type.'+type+'.array.'+scope;
              arr.push(r.zs4.type[type].array[scope]);
            }
          }

          arr.sort(function(a,b){
            return b.zs4.head.updated._.value-a.zs4.head.updated._.value;
          });

          zs4.debug('collected '+arr.length+' items');
          for (var i = 0 ; i < arr.length; i++){
            zs4.debug(arr[i].zs4.head.title._.value);
          }

          zs4.debug(arr[0]);
          var html = '<h3>The Newest Items for '+SCOPE.zs4.head.title._.value+'</h3>\n';
          html += '<table>\n';
          for (var i = 0 ; i < arr.length; i++){
            html+='<tr>';

            html+='<td><amp-img src="/gfx/icons/'+arr[i].zs4.head.typename._.value+'.svg" alt="Welcome" height="1em" width="1em"></amp-img></td>\n';
            html+='<td><a href="/'+arr[i]._.path+'.amp">'+arr[i].zs4.head.title._.value+'</a></td>\n';

            html+='</tr>';
          }
          html += '</table>\n';

          return cb(html);
        });
      }).bind(this);
      this._.getAMP = (function(req,cb){
        zs4.debug('getAMP('+this._.path+')');
        var title = this._.path;
        var description = '';
        var keywords = '';
        var lang = 'en';
        const BODY_WIDTH = 800;
        var TABINDEX = 0;
        if (title=='')title = 'zs4 web app';

        if (this._.flags.get.scope()&&zs4.is.object(this.zs4.head)){
          var SCOPE = this;
          //zs4.debug('gettin scope.head html...');
          // title
          if (this.zs4.head.title._.value!=''){
            title = zs4.string.strip.chars(this.zs4.head.title._.value,zs4.const.NOATTRCHARS);
          }
          if (this.zs4.head.lang._.value!='')lang = this.zs4.head.lang._.value;

          // description
          if (this.zs4.head.title._.description!=''){
            description = zs4.string.strip.chars(this.zs4.head.description._.value,zs4.const.NOATTRCHARS);
          }

          // keywords
          var arr = this._.getKeyWordArray();
          zs4.string.array.sort.length.descend(arr);
          var o = {k:''};
          for (var i = 0; i < arr.length;i++){zs4.string.addKeyWord(o,'k',arr[i]);}
          keywords = o.k;

          var html = '<!DOCTYPE html>\n';
          html += '<html amp lang="'+lang+'">\n';

          html += ' <head>\n';

          html += '  <meta charset="UTF-8">\n';
          html += '  <script async src="https://cdn.ampproject.org/v0.js"></script>\n';
          html += '  <script async custom-element="amp-sidebar" src="https://cdn.ampproject.org/v0/amp-sidebar-0.1.js"></script>\n';
          html += '  <script async custom-element="amp-accordion" src="https://cdn.ampproject.org/v0/amp-accordion-0.1.js"></script>\n';
          html += '  <script async custom-element="amp-fit-text" src="https://cdn.ampproject.org/v0/amp-fit-text-0.1.js"></script>\n';
          html += '  <title>'+title+'</title>\n';
          html += '  <link rel="canonical" href="https://'+zs4.THIS.zs4.express.host._.value+'/'+this._.path+'">\n';
          html += '  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">\n';

          var dateCreated = new Date(this.zs4.head.created._.value);
          var datePublished = new Date(this.zs4.head.updated._.value);
          var author = this.zs4.head.author._.value;
          if (description=='')description = 'zs4 AMP page';

          if (author=='')author = 'zs4 User';
          var ld = new Object({
            '@context':'http://schema.org',
            '@type':'Webpage',
            url:'https://'+zs4.THIS.zs4.express.host._.value+'/'+this._.path,
            headline:title,
            datePublished:dateCreated.toJSON(),
            dateModified:datePublished.toJSON(),
            author:{
              '@type':'Person',
              name:author,
            },
            mainEntityOfPage:{
              '@type':'Webpage',
              '@id':'https://'+zs4.THIS.zs4.express.host._.value+'/'+this._.path,
            },
            publisher:{
              '@type':'Organization',
              name:'zs4 Project',
              logo:{
                '@type':'ImageObject',
                url:'https://'+zs4.THIS.zs4.express.host._.value+'/gfx/icons/zs4.svg',
                width:132,
                height:132,
              },
            },
            image:{
              '@type':'ImageObject',
              url:'https://'+zs4.THIS.zs4.express.host._.value+'/gfx/icons/zs4.svg',
              width:132,
              height:132,
            },
            description:description,
          });

          html += '  <script type="application/ld+json">\n';
          html += zs4.json.textify(ld);
          html += '  </script>\n';

          html += '  <style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>\n';
          html += '  \n';

          html += '<style amp-custom>\n';
          html += 'h1{}';
          html += 'body{background-color:white;color:black;padding:0;border:0;margin:0px;background-image:url("/gfx/images/winterfooter.svg");background-repeat:no-repeat;background-position:bottom;background-attachment:fixed;background-size:100%;}';
          html += 'amp-sidebar{width:"'+(BODY_WIDTH*3/4)+'px";padding:0em;border:2px solid black;margin:0px;background-image:url("/gfx/images/winterpattern.jpg");} ';
          //html += 'amp-fit-text.sidebar{background-color:black;display:block;color:white;padding:0px;border:0px;margin:0px;}';
          html += 'div.sidebar{display:block;font-size:2em;color:black;padding:10px;border:0px;margin:0px;}';
          html += 'div.sidebarcontent{display:block;color:black;padding:10px;border:0px;margin:0px;}';
          html += 'amp-accordion section[expanded] .show-more {display:none}';
          html += 'amp-accordion section:not([expanded]) .show-less {display:none}';
          html += 'div.titlebar{background-color:darkblue;display:block;font-size:2em;color:white;padding:0px;border:0px;margin:0px;}';
          html += 'ul.docinfo{background-color:lightblue;}';
          html += 'div.scope{padding:2em;border:0px;margin:0px;} ';
          html += 'div.footer{margin-top:2em;}';
          html += 'a.footer{text-decoration:none;}';

          SCOPE._.getAmpStyle(req,function(style){
            html += style;
            html += '</style>\n';

            html += ' </head>\n';

            html += ' <body>\n';
            html += '  <amp-sidebar id="sidebar" layout="nodisplay" side="left">\n';
            html += '   <div class="sidebar"><amp-img tabindex='+(TABINDEX++)+' role="button" on="tap:sidebar.toggle" src="/gfx/icons/prev.svg" alt="Welcome" height="1em" width="1em"></amp-img>options</div>\n';
            html += '   <div class="sidebarcontent">\n';
            html += '   <h3>More from '+zs4.THIS.zs4.express.host._.value+'</h3>\n';
            html += '   <ul>\n';
            if (SCOPE._.path!='')html += '    <li><a href="/amp">Home</a></li>\n';
            else html += '    <li>Home (You are here now)</li>\n';
            html += '    <li><a href="/'+SCOPE._.path+'">Interactive Version of this Page</a></li>\n';
            html += '    \n';
            html += '    \n';
            html += '   </ul>\n';
            html += '   \n';
            html += '  </div>\n';
            html += '  </amp-sidebar>\n';
            html += '  <div class="titlebar"><amp-img tabindex='+(TABINDEX++)+' role="button" on="tap:sidebar.toggle" src="/gfx/icons/zs4.svg" alt="Welcome" height="1em" width="1em"></amp-img>'+title+'</div>\n';
            html += '  <amp-accordion><section>\n';
                        html += '<h4>';
                        html += '<span class="show-more"><amp-img src="/gfx/icons/info.svg" alt="image" height="1em" width="1em"></amp-img></span>';
                        html += '<span class="show-less"><amp-img src="/gfx/icons/prev.svg" alt="image" height="1em" width="1em"></amp-img></span>';
                        html += 'Document Information</h4>\n';
            html += '   <ul class="docinfo">\n';
            html += '    <li><b>Language:</b> '+SCOPE.zs4.head.lang._.value+'</li>\n';
            if (author!='')html += '    <li><b>Author:</b> '+author+'</li>\n';
            if (description!='')html += '    <li><b>Description:</b> '+description+'</li>\n';
            html += '    <li><b>Created:</b> '+zs4.string.from.date(SCOPE.zs4.head.created._.value)+'</li>\n';
            html += '    <li><b>Last Update:</b> '+zs4.string.from.date(SCOPE.zs4.head.updated._.value)+'</li>\n';
            html += '   \n';
            html += '   \n';
            html += '   \n';
            html += '   </ul>\n';
            html += '   \n';
            html += '  </section></amp-accordion>\n';

            html += '  <amp-accordion><section expanded>\n';
            html += '<h4>';
            html += '<span class="show-more"><amp-img src="/gfx/icons/toonsmith.svg" alt="image" height="1em" width="1em"></amp-img></span>';
            html += '<span class="show-less"><amp-img src="/gfx/icons/toonsmith.svg" alt="image" height="1em" width="1em"></amp-img></span>';
            html += 'Document Content</h4>\n';
            html += ' <div class="scope">\n';

            SCOPE._.getAmpBody(req,function(body){
              html += body;
              //html += '  <amp-img layout="responsive" src="/gfx/icons/zs4.svg" alt="Welcome" height="400" width="400"></amp-img>\n';
              html += ' </div>\n';
              html += '  </section></amp-accordion>\n';

              html += ' <div class="footer">\n';
              //html += '  <a  class="footer" href="/'+SCOPE._.path+'">See full zs4 version of this page</a>\n';
              html += ' </div>\n';

              html += ' </body>\n';
              html += '</html>\n';

              req.request.html = html;

              return cb();
            });
          });
        }

      }).bind(this);
      this._.call = (function(req,input,cb){
        req.call({path:this._.path,input:input},cb);
      }).bind(this);
    }
    if (zs4.is.window()){
      this._.call = (function(input,cb){
        var reqinp = this._.wrapRequest(input);
        zs4.post(reqinp,cb);
      }).bind(this);
    }
  },

  array:function(input){
    zs4.type.object.call(this,input);
    this._.typename = 'array';

    //if (zs4.is.window())return;

    if (!zs4.is.type(input.template))input.template = new zs4.type.scope({name:'template'});

    var THIS = this;

    THIS._.array = new Object();
    THIS._.array.elementConnect = this._.elementConnect;

    if (zs4.is.node()){
      THIS._.property(new zs4.type.object({name:'config',flags:'noprune',authSet:['zs4.owner'],}));
      THIS.config._.property(new zs4.type.integer({name:'maxlength',flags:'noprune quickupdate',authSet:['zs4.owner'],}));
      THIS.config._.property(new zs4.type.integer({name:'lastid',flags:'noset noprune',}));
      THIS.config._.property(new zs4.type.enum({name:'driver',flags:'noprune quickupdate',}));
      THIS.config.driver._.get = (function(req){
        var arr = new Array();
        arr.push('');
        for (var n in zs4.array){
          arr.push((' '+n+' ').trim());
        }
        this._.enum = arr;
        var get = this._.getInitialize(req);
        if (get == null) return null;
        if (this._.type != Object){
          get._.value = this._.value;
        }
        return get;

      }).bind(THIS.config.driver);
    }

    var template = input.template._.new();
    template._.name = 'template'
    template._.flags.set.notrans(true);
    THIS._.property(template);
    THIS.template._.flagTree((
      this._.flags.authgetpublic
      |this._.flags.notrans
      |this._.flags.noprune
      |this._.flags.nostore
      |this._.flags.local
    ),true);

    THIS._.property(new zs4.type.object({name:'array',flags:'noprune authgetpublic nogetall',}));
    THIS.array._.load = (function(input){
      //zs4.debug('loading '+this._.path);
      if (!zs4.is.object(input))return;
      for (var id in input)if(zs4.is.object(input[id])){

        var nu = THIS.template._.new();
        nu._.name = id; nu._.flags.set.notrans(false);
        nu._.flags.set.scope(true);

        THIS.array._.property(nu);

        THIS.array[id]._.load(input[id]);

        //zs4.debug('load('+THIS.array[id]._.path+')')
      }
    }).bind(THIS.array);

    THIS.array._.sortArray = (function(a,b){
      var va = a._.resolvePath(THIS.method.query.sort.item._.value);
      var vb = b._.resolvePath(THIS.method.query.sort.item._.value);
      if (va == null){
        if (vb == null)return 0;
        return -1;
      }
      else if (vb == null){
        return 1;
      }

      if (THIS.method.query.sort.descend._.value==true){
        var swap = va; va = vb; vb = swap;
      }
      if (va._.opcode.eq(vb._.value))return 0;
      if (va._.opcode.lt(vb._.value))return -1;
      return 1;
    }).bind(this);

    THIS.array._.sortDefault = THIS.array._.sortArray;

    THIS.array._.elementLoad = (function(req,cb){
      //zs4.debug('elementLoad '+this._.path+'.'+req.elenam);

      if (THIS.array._.value.hasOwnProperty(req.elenam)){
        var ret = new Object();
        zs4.copy.trim(THIS.array._.value[req.elenam],ret);
        cb(ret);return;
      }
      cb(null);
    }).bind(THIS.array);
    THIS.array._.elementSave = (function(req,cb){
      //zs4.debug('elementSave '+this._.path+'.'+req.elenam);
      THIS.array._.value[req.elenam] = req.elesav;
      THIS.array._.shouldBeSaved(req);
      cb();
    }).bind(THIS.array);
    THIS.array._.driverTransform = (function(req,cb){
      var starttime = Date.now();

      zs4.debug(req.elenam);
      zs4.array[THIS.config.driver._.value].getID.call(THIS,req.elenam,function(ret){
        if (ret == null){
          req.error(THIS.array,req.elenam+' not found');cb();return;
        }

        var item = THIS.template._.new();
        item._.name = req.elenam;
        item._.load(ret);
        THIS._.array.elementConnect(THIS.array,item);

        item._.transform(req,function(){
          var now = Date.now();
          item.zs4.head.updated._.value = Date.now();

          zs4.array[THIS.config.driver._.value].updateID.call(
          THIS,req.elenam,item._.store(),
          function(ret){
            if (ret == null){
              req.error(THIS.array,req.elenam+' update fail');cb();return;
            }
            req.result(item,true);
            cb();
          });
        });
      });
    }).bind(THIS.array);

    THIS.array._.findOne = (function(path,value){
      var arr = THIS.array._.value;
      for (var n in arr){
        var prop = zs4.path.resolve(arr[n],path);
        if (prop == null || zs4.is.object(prop))continue;
        if (prop == value)return ((' '+n+' ').trim());
      }
      return null;
    }).bind(THIS.array);

    THIS.array._.unique = function(type,value){
      //zs4.debug('checking uniqueness of: '+type._.path+':'+value);
        if  (!type._.flags.get.unique()){
          //zs4.debug('not a unique property: '+type._.name);
          return true;
        }

        var spath = type._.scope._.path;
        var tpath = type._.path;
        var vpath = tpath.substring((spath.length+1),(tpath.length));
        //zs4.debug('checking uniqueness of: '+vpath);
        var arr = THIS.array._.value;
        for (var n in arr){
          var v = zs4.path.resolve(arr[n],vpath);
          if (v == null){
            //zs4.debug(n+'.'+vpath+' NOT FOUND!!!!!');
            continue;
          }
          if (v==value){
            //zs4.debug(n+'.'+vpath+' MATCH '+v+' and '+value);
            if (n!=type._.name)return false;

          }
        }
        return true;
    };

    THIS.array._.callback = (function(o){
      //zs4.debug('THIS.array._.callback()');
      //zs4.debug(o);
      if (zs4.is.object(o.result)){
        if (o.result.deleteall==true){
          for (var n in THIS.array){
            if (!zs4.is.type(THIS.array[n]))continue;
            zs4.debug('deleting '+THIS.array[n]._.path);

            if (zs4.is.function(THIS.array[n]._.cleanup))THIS.array[n]._.cleanup();
            delete THIS.array[n];
          }

        }
        if (zs4.is.array(o.result.deletearr)){
          for (var n in THIS.array){
            if (!zs4.is.type(THIS.array[n]))continue;
            if (!zs4.string.array.is.element(o.result.deletearr,n))continue;
            zs4.debug('deleting '+THIS.array[n]._.path);

            if (zs4.is.function(THIS.array[n]._.cleanup))THIS.array[n]._.cleanup();
            delete THIS.array[n];
          }

        }
        if (zs4.is.function(THIS._.refresh)){
          THIS._.refresh();
        }
      }
    }).bind(THIS.array);

    if (zs4.is.node()){

      THIS.array._.oldTransform = this.array._.transform;

      THIS.array._.transform = (function(req,cb){

        var TABLE = this;

        if (THIS.config.driver._.value == ''){
          THIS.array._.oldTransform(req,cb);
          return;
        }

        req.setScope(TABLE);

        if (!zs4.is.object(req.input)
        ||  zs4.count.object.properties(req.input)==0
        ){
          TABLE._.get(req); cb(); return;
        }

        var parallel = new zs4.processor.parallel();
        var input = req.input;
        for (var n in input){
          if (!zs4.is.object(input[n]))continue;

          var name = (' '+n+' ').trim();
          var request = req.create({input:input[name],});
          request.elenam = name;
          request.noneedsaving = true;

          parallel.call(TABLE,THIS.array._.driverTransform,request);
        }

        parallel.run(function(){

          TABLE._.get(req);
          cb();
        });

      }).bind(THIS.array);


      THIS._.property(new zs4.type.object({name:'method',flags:'noprune nostore authgetpublic',}));

      THIS.method._.property(new zs4.type.object({name:'new',flags:'api noprune nostore authuser authsetself',}));
      this.method.new._.transform = (function(req,cb){
        var REQUEST = req;
        var NEW = THIS.method.new;
        req.setScope(this);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(THIS.method.new,err);
          this._.get(req); cb(); return;
        }
        if (!req.tokenExists()&&!req.userIsRoot()){
          var err = 'not logged in';
          req.error(THIS.method.new,err);
          this._.get(req); cb(); return;
        }

        if (zs4.is.object(req.input)){
          if (THIS.config.driver._.value != ''){
            var nu = THIS.template._.new();
            nu._.load(req.input);
            nu._.flags.set.notrans(false);
            nu._.flags.set.scope(true);
            //nu.zs4.head.title._.value = '(untitled)';
            nu.zs4.head.created._.value = nu.zs4.head.updated._.value = Date.now();
            if (!req.userIsRoot()){
              nu.zs4.head.owner._.value = req.request.payload.scope;
              var creatorObj = zs4.THIS._.resolvePath(req.request.payload.scope);
              if (creatorObj) nu.zs4.head.author._.value = creatorObj.zs4.email._.value;
            } else {
              var rootEmail = zs4.THIS.zs4.email.smtp.from._.value;
              nu.zs4.head.author._.value = rootEmail;
              var ownerPath = '';
              if (zs4.is.object(zs4.array.jsondb)){
                var rootDoc = zs4.array.jsondb.find('user','zs4.email',rootEmail);
                if (rootDoc) ownerPath = 'zs4.type.user.array.'+rootDoc._id;
              }
              nu.zs4.head.owner._.value = ownerPath;
            }

            zs4.array[THIS.config.driver._.value].new.call(THIS,nu,function(ret){
              if (zs4.is.type(ret)){
                THIS._.array.elementConnect(THIS.array,ret);

                ret._.transform(REQUEST.create({input:{}}),function(){

                  REQUEST.result(NEW,ret._.path);
                  zs4.debug('DB CREATED ',ret._.path);

                  NEW._.get(REQUEST);

                  REQUEST.setScope(THIS.array);
                  THIS.array._.get(REQUEST);

                  cb(); return;
                });
              }
              else {
                NEW._.get(REQUEST);
                cb(); return;
              }
            });

            zs4.debug('END DB DRIVER NEW FUNCTION');
            return;
          }
          else {
            var length = zs4.count.object.properties(THIS.array._.value);
            if (THIS.config.maxlength._.value > 0 && length >= THIS.config.maxlength._.value){
              req.error(this,{text:'array limit reached'})
              this._.get(req); cb(); return;
            }

            var id = zs4.integer.to.name(THIS.config.lastid._.value++);
            var nu = THIS.template._.new();
            nu._.load(req.input);
            nu._.name = id; nu._.flags.set.notrans(false);
            nu._.flags.set.scope(true);
            nu.zs4.head.created._.value = nu.zs4.head.updated._.value = Date.now();
            nu.zs4.head.owner._.value = req.request.payload.scope;
            //nu.zs4.email._.value = id+'@zs4.zs4';
            THIS.array._.property(nu);
            nu._.transform(REQUEST.create({input:{}}),function(){
              THIS._.shouldBeSaved(REQUEST);
              REQUEST.result(THIS.method.new,nu._.path);

              NEW._.get(REQUEST);
              REQUEST.setScope(THIS.array);
              THIS.array._.get(REQUEST);
              cb(); return;
            });

          }
        }
        else {
          this._.get(req); cb(); return;
        }
      }).bind(this.method.new);

      THIS.method._.property(new zs4.type.object({name:'query',flags:'api noprune nostore apiarg',}));
      THIS.method.query._.property(new zs4.type.string({name:'search',flags:'apiarg'}));
      THIS.method.query._.property(new zs4.type.select());
      THIS.method.query.select._.flags.value |= (THIS._.flags.nostore);
      THIS.method.query.select._.inscope = THIS.template;
      THIS.method.query._.property(new zs4.type.object({name:'sort',flags:'noprune nostore authgetpublic local nosort',}));
      THIS.method.query.sort._.property(new zs4.type.scopeindex({name:'item',flags:'required nostore noprune apiarg local',inscope:THIS.template,default:'zs4.head.updated'}));
      THIS.method.query.sort._.property(new zs4.type.boolean({name:'descend',flags:'required nostore noprune apiarg local',default:true,}));
      THIS.method.query._.flagTree((
        this._.flags.apiarg
        |this._.flags.nostore
      ),true);
      THIS.method.query._.transform = (function(req,cb){
        var QUERY = this;
        var REQUEST = req;
        req.setScope(QUERY);
        if (req.getall){
          QUERY._.get(req); cb(); return;
        }
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(THIS.method.query,err);
          QUERY._.get(req); cb(); return;
        }

        if (zs4.is.object(req.input)){
          //zs4.debug(QUERY._.path+'.transform()',req.input);

          if (zs4.count.object.properties(req.input)==0){
            //zs4.debug(QUERY._.path+'.transform(no select input)',req.input);
            this._.get(req); cb(); return;
          }

          var sel = null;
          if (zs4.is.object(REQUEST.input.select)){
            //zs4.debug('QUERY-SELECT: ',JSON.stringify(REQUEST.input.select,null,1));
            sel = new zs4.type.select();
            sel._.parse(REQUEST.input.select);
          }
          else {
            //zs4.debug(QUERY._.path+'.transform(no select input)',req.input);
            this._.get(req); cb(); return;
          }
          var search = null;
          if (zs4.is.string(REQUEST.input.search)&&REQUEST.input.search!=''){
            search = REQUEST.input.search;
          }

          //zs4.debug(QUERY._.path+'.transform()',REQUEST.input);

          if (THIS.config.driver._.value != ''){
            var args = new Object({request:req,select:sel,search:search,sort:REQUEST.input.sort,});
            zs4.array[THIS.config.driver._.value].query.call(THIS,args,function(ret){
              if (!zs4.is.array(ret)){

              }
              else {
                //zs4.debug(ret);
              }

              QUERY._.get(req);
              THIS.array._.get(req);
              cb();
            });

            return;
          }
          else {
            for (var n in THIS.array)if (zs4.is.type(THIS.array[n])){
              //zs4.debug(this._.path+'.'+n+'.query()');
              if (sel!= null){
                sel._.inscopeTree(THIS.array[n]);
                if (!sel._.select.check())continue;
              }

              if (search != null){
                if (!THIS.array[n]._.search(REQUEST.input.search))continue;
              }

              req.setScope(THIS.array[n]);
              THIS.array[n]._.getTree(req);
            }

            req.setScope(this);
            this._.get(req);
            req.setScope(THIS.array);
            THIS.array._.get(req);
            cb();
            return;
          }
        }

        req.setScope(this);
        this._.get(req);
        cb(); return;
      }).bind(THIS.method.query);
      THIS.method.query._.get = (function(req,cb){
        var QUERY = this;
        req.setScope(this);
        var get = this._.getInitialize(req);
        if (get == null)return null;
        this.search._.get(req);
        this.select._.get(req);
        this.sort._.get(req);
        this.sort.item._.get(req);
        this.sort.descend._.get(req);
      }).bind(THIS.method.query);

      THIS.method._.property(new zs4.type.object({name:'deleteall',flags:'api noprune nostore',}));
      THIS.method.deleteall._.property(new zs4.type.boolean({name:'sure',flags:'required nostore noprune',}));
      THIS.method.deleteall.sure._.zs4check = THIS.method.deleteall.sure._.zs4checkTrue;
      THIS.method.deleteall._.transform = (function(req,cb){
        var DELETEALL = this;
        req.setScope(this);
        function get(){
          req.setScope(DELETEALL);
          DELETEALL._.get(req);

          req.setScope(DELETEALL.sure);
          DELETEALL.sure._.get(req,DELETEALL);

          var ga = THIS.array._.get(req);
          if (ga != null)ga._.flags != THIS._.flags.prune;
          cb();
          return;
        }
        if (!req.flags.value & req.flags.authset){
          req.error(THIS.method.deleteall,{text:'not authorized'});
          return get();
        }
        if (zs4.is.object(req.input)){
          //zs4.debug(this._.path+'.transform('+JSON.stringify(req.input)+')');
          if (req.input.sure!=true){
            req.error(this,{text:'not sure'});
            return get();
          }
          //zs4.debug(this.sure);

          for (var n in THIS.array)if (zs4.is.type(THIS.array[n])){
            delete THIS.array[n];
          }

          req.result(this,true);
          THIS._.shouldBeSaved(req);

          //req.setScope(THIS.array);
          //req.result(THIS.array,{deleteall:true,})
          //THIS.array._.get(req);
        }
        return get();
      }).bind(this.method.deleteall);

      var arr = THIS.template._.getScopeItems(THIS.template,THIS._.flags.index|THIS._.flags.unique);
      THIS.method._.property(new zs4.type.object({name:'getone',flags:'api noprune nostore noprune apiarg',}));
      THIS.method.getone._.property(new zs4.type.scopeindexunique({name:'item',flags:'required nostore noprune apiarg',inscope:THIS.template,}));
      THIS.method.getone._.property(new zs4.type.string({name:'eq',flags:'required nostore noprune apiarg',}));
      this.method.getone._.transform = (function(req,cb){
        var REQUEST = req;
        var GETONE = this;
        req.setScope(this);
        function get(){
          GETONE._.get(req);
          GETONE.item._.get(req,GETONE);
          GETONE.eq._.get(req,GETONE);
          THIS.array._.get(req);
          cb();
          return;
        }
        if (!req.flags.value & req.flags.authset){
          req.error(this.method.getone,{text:'not authorized'});
          return get();
        }

        if (!zs4.is.object(req.input)){
          return get();
        }

        if (!zs4.is.string(req.input.item)||req.input.item.length==0){
          var err = 'no item specified'
          req.error(this,err);
          return get();
        }
        if (!zs4.is.string(req.input.eq)||req.input.eq.length==0){
          var err = 'no eq value'
          req.error(this,err);
          return get();
        }
        var item = THIS.template._.resolvePath(req.input.item);
        if (item==null){
          var err = 'template has no '+req.input.item;
          req.error(this,err);
          return get();
        }

        if (THIS.config.driver._.value != ''){
          var args = new Object({request:req,});
          zs4.array[THIS.config.driver._.value].getOne.call(THIS,req,function(ret){
            if (ret == null){
              REQUEST.error(GETONE,'not found');
              return get();
            }
            REQUEST.result(GETONE,ret._.path);
            return get();
          });
        }
        else {
          var item = req.input.item;
          var eq = req.input.eq;

          for (var n in THIS.array)if (zs4.is.type(THIS.array[n])){
            var val = THIS.array[n]._.resolvePath(item);
            if (val == null){
              continue;
            }
            if (val._.opcode.eq(eq)){
              REQUEST.result(GETONE,THIS.array[n]._.path);
              THIS.array[n]._.getTree(req);
              THIS.array._.get(req);
              return get();
            }
          }

          REQUEST.error(GETONE,'not found');
          return get();
        }

      }).bind(this.method.getone);

      THIS.method._.property(new zs4.type.object({name:'deleteone',flags:'api noprune nostore noprune',}));
      THIS.method.deleteone._.property(new zs4.type.string({name:'id',flags:'apiarg required nostore noprune apiarg',}));
      this.method.deleteone._.transform = (function(req,cb){
        var DELONE = this;
        var DELREQ = req;
        req.setScope(this);
        function get(){
          DELONE._.get(req);
          DELONE.id._.get(req,DELONE);
          THIS.array._.get(req);

          cb();
          return;
        }
        if (!req.flags.value & req.flags.authset){
          req.error(this.method.deleteone,{text:'not authorized'});
          return get();
        }

        if (!zs4.is.object(req.input)){
          return get();
        }

        if (!zs4.is.name(req.input.id)){
          var err = 'no valid id';
          req.error(this,err);
          return get();
        }

        var id = req.input.id;

        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(this,err);
          return get();
        }

        if (THIS.config.driver._.value != ''){
          zs4.array[THIS.config.driver._.value].getID.call(THIS,id,function(ret){
            if (ret==null){
              var err = id+' not found';
              req.error(DELONE,err);
              return get();
            }

            if (!req.flags.get.authroot()){
              if (req.request.payload.scope != ret.zs4.head.owner){
                var err = 'not authorized';
                req.error(DELONE,err);
                return get();
              }
            }
            zs4.array[THIS.config.driver._.value].deleteID.call(THIS,id,function(ret){
              if (ret==null){
                var err = 'not authorized';
                req.error(DELONE,err);
              }
              else{
                req.result(THIS.array,new Object({deletearr:[id,]}));
              }
              return get();
            });

          });
        }
        else {
          if (!THIS.array.hasOwnProperty(id)){
            var err = id+' not found';
            req.error(this,err);
            return get();
          }

          if (!req.flags.get.authroot()){
            if (!req.request.payload.scope != THIS.array[id].zs4.head.owner._.value){
              var err = 'not authorized';
              req.error(this,err);
              return get();
            }
          }

          delete THIS.array[id];

          req.result(THIS.array,new Object({deletearr:[id,]}));
          THIS._.shouldBeSaved(req);
          return get();
        }

      }).bind(this.method.deleteone);

    }
  },
  bits:function(input){
    var THIS = this;
    zs4.type.integer.call(this,input);
    this._.typename = 'bits';
    THIS._.bits = new zs4.util.bits(THIS._,'value');
  },
  boolean:function(input){
    var THIS = this;
    zs4.type.unknown.call(this,input);
    this._.type = Boolean;
    this._.typename = 'boolean';
    this._.default = new Boolean();
    if (zs4.is.boolean(input.default))this._.default = input.default; else this._.default = false;
    this._.value = this._.default;
    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.boolean(input)) return this._.zs4checkfail(req,'not boolean');

      return true;
    }).bind(this);
    this._.zs4checkTrue = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.boolean(input)||input!=true) return this._.zs4checkfail(req,'not '+this._.name);

      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (zs4.is.boolean(v))return v;
        if (zs4.is.string(v)){
          if (v=='true')return true;
          if (v=='false')return false;
        }
        return null;
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value==true && v==false)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value==false && v==true)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==false)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==true)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);
      if (v==null){
          if (zs4.is.boolean(this._.default))this._.value=this._.default;
          else this._.value=new Boolean(false);
      }
      else {
        this._.value = v;
      }
    }).bind(this);

  },
  bye:function(input){
    var THIS = this;
    zs4.type.object.call(this,{name:'bye',flags:'api nostore apiarg',})
    this._.typename = 'bye';
    this._.create = zs4.type.bye;
    this._.property(new zs4.type.boolean({name:'sure',flags:'required noprune',}));
    this.sure._.zs4check = this.sure._.zs4checkTrue;

    this._.transform = (function(req,cb){
      zs4.debug('bye.transform('+zs4.json.textify(req.input)+')');
      req.setScope(this);
      if (req.input == null || (!zs4.is.boolean(req.input.sure))){
        this._.get(req); cb(); return;
      }
      zs4.debug('bye('+THIS._.path+')');
      if (!(req.flags.value & req.flags.authset)){
        req.error(THIS,'not authorized.');
        THIS._.get(req); cb(); return;
      }

      if (req.input.sure != true){
        req.error(THIS,'not sure');
        this._.get(req); cb(); return;
      }

      req.tokenDelete();
      req.result(THIS,true);
      THIS._.get(req); cb(); return;
    }).bind(this);

    this._.callback = (function(o){
      //zs4.debug('deleteall._.callback()');
      //zs4.debug(o);
      if (zs4.is.boolean(o.result)&&o.result==true){
        zs4.navigate('/');
      }
    }).bind(this);

    THIS._.get = (function(req,po){
      //zs4.debug('password.get'+ JSON.stringify(this._.authGet));
      if (!req.tokenExists())return null;
      var get = this._.getInitialize(req);
      if (get==null){
        zs4.debug(this._.path+'.get() NOT AUTHORIZED!?!?!?');
        //zs4.debug(this._.authGet);
        return null;
      }

      get.sure = new Object({_:{}});
      get.sure._.name = 'sure';
      get.sure._.typename = 'boolean';
      get.sure._.value = false;
      get.sure._.flags = THIS._.flags.apiarg|THIS._.flags.required;

      return get;
    }).bind(THIS);

  },
  date:function(input){
    zs4.type.integer.call(this,input);
    this._.typename = 'date';
    var d = new Date();
    this._.value = this._.default = d.getTime();
  },
  download:function(input){
    zs4.type.object.call(this,input)
    this._.typename = 'download';
    this._.create = zs4.type.download;
    this._.flags.set.api();
  },
  email:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'email';
    this._.minlength = zs4.const.EMAIL.MINLENGTH;
    this._.maxlength = zs4.const.EMAIL.MAXLENGTH;
    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.email(input)) return this._.zs4checkfail(req,'not email');

      return true;
    }).bind(this);
  },
  enum:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'enum';
  },
  file:function(input){
    var FILE = this;
    zs4.type.object.call(this,input);
    this._.typename = 'file';
    this._.flags.set.nosort(true);
    //if (zs4.is.node()){
      this._.property(new zs4.type.download({name:'download',flags:'api noprune nostore',}));
      this.download._.transform = (function(req,cb){
        var REQUEST = req;
        var DOWNLOAD = this;
        req.setScope(this);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(DOWNLOAD,err);
          this._.get(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(DOWNLOAD,err);
          this._.get(req); cb(); return;
        }


        this._.get(req);
        FILE.content._.get(req);
        FILE._.get(req); cb(); return;

      }).bind(this.download);

      this._.property(new zs4.type.filecontent({name:'content',flags:'noprune quickupdate',}));
    //}
  },
  app:function(input){
    zs4.type.scope.call(this);
    if (zs4.is.node()){
      this.zs4.head.typename._.value = 'app';
      this.zs4.head.typename._.default = 'app';
      this._.property(new zs4.type.string({name:'icon',flags:'authgetpublic authsetself quickupdate',maxlength:64,}));
      this._.property(new zs4.type.text({name:'code',flags:'authsetself quickupdate',maxlength:65536,}));
      this._.property(new zs4.type.string({name:'gitstatus',flags:'noset authgetpublic',maxlength:128,}));
    }
    this._.name = 'app';
    this._.create = zs4.type.app;
  },
  filecontent:function(input){
    zs4.type.text.call(this,input);
    this._.typename = 'filecontent';
    this._.maxlength = zs4.const.TEXT.MAXLENGTH;
  },
  media:function(input){
    var MEDIA = this;
    zs4.type.scope.call(this);
    if (zs4.is.node()){
      this.zs4.head.typename._.value = 'media';
      this.zs4.head.typename._.default = 'media';
      this._.property(new zs4.type.string({name:'originalname',flags:'index authgetpublic authsetself',maxlength:255,}));
      this._.property(new zs4.type.string({name:'mimetype',flags:'authgetpublic authsetself',maxlength:128,}));
      this._.property(new zs4.type.integer({name:'size',flags:'authgetpublic authsetself',}));
      this._.property(new zs4.type.string({name:'path',flags:'authgetpublic authsetself',maxlength:255,}));
    }
    this._.name = 'media';
    this._.create = zs4.type.media;
  },
  folder:function(input){
    var DRIVE = this;
    zs4.type.object.call(DRIVE,input);

    DRIVE._.typename = 'folder';
    DRIVE._.flags.set.nogetall(true);

    DRIVE._.folder = new Object();

    DRIVE._.load = (function(input){
      //zs4.debug('loading '+this._.path,input);
      if (!zs4.is.object(input))return;
      for (var n in input){
        var name = (' '+n+' ').trim();

        if (input[name].hasOwnProperty('content')&&zs4.is.string(input[name].content)){
          zs4.debug('   FILE: \''+name+'\'')
          DRIVE._.property(new zs4.type.file({name:name}));
          DRIVE[name]._.load(input[n]);
        }
        else if (zs4.is.object(input[name].zs4)&&input[name].zs4.hasOwnProperty('driver')){
          zs4.debug('   FOLDER: \''+name+'\'')
          DRIVE._.property(new zs4.type.folder({name:name}));
          DRIVE[name]._.load(input[n]);
        }

        this[n]._.load(input[n]);
      }
    }).bind(DRIVE);

    DRIVE._.callback = (function(o){
      zs4.debug('DRIVE._.callback()');
      zs4.debug(o);
      if (zs4.is.object(o.result)){
        if (zs4.is.string(o.result.delete)){
          if (DRIVE.hasOwnProperty(o.result.delete)){
            if (zs4.is.type(DRIVE[o.result.delete])){
              zs4.debug('deleting '+o.result.delete);

              if (zs4.is.function(DRIVE[o.result.delete]._.cleanup))DRIVE[o.result.delete]._.cleanup();
              delete DRIVE[o.result.delete];
            }
          }
        }
        if (zs4.is.function(DRIVE._.refresh)){
          DRIVE._.refresh();
        }
      }
    }).bind(DRIVE);

    if (zs4.is.node()){
      DRIVE._.get = (function(req){
        var get = this._.getInitialize(req);
        if (get==null)return null;
        DRIVE.zs4._.getTree(req);
        return get;
      }).bind(DRIVE);

      DRIVE._.property(new zs4.type.object({name:'zs4',flags:'noprune'}));

      DRIVE.zs4._.property(new zs4.type.integer({name:'maxsize',flags:'noprune quickupdate'}));
      DRIVE.zs4._.property(new zs4.type.enum({name:'driver',flags:'noprune quickupdate',}));
      DRIVE.zs4.driver._.get = (function(req){
        var arr = new Array();
        arr.push('');
        for (var n in zs4.folder){
          arr.push((' '+n+' ').trim());
        }
        this._.enum = arr;
        return this._.getInitialize(req);
      }).bind(DRIVE.zs4.driver);

      DRIVE.zs4._.property(new zs4.type.object({name:'list',flags:'noprune api nostore',}));
      DRIVE.zs4.list._.transform = (function(req,cb){
        var REQUEST = req;
        var LIST = DRIVE.zs4.list;
        req.setScope(this);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(LIST,err);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(LIST,err);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            for (var n in DRIVE)if (n!='zs4'&&zs4.is.type(DRIVE[n])){
              if (DRIVE[n]._.typename=='file'){
                DRIVE[n]._.get(req);
              }
              else if (DRIVE[n]._.typename=='folder'){
                DRIVE[n]._.get(req);
                DRIVE[n].zs4._.getTree(req);
              }
            }
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.list);

      DRIVE.zs4._.property(new zs4.type.object({name:'newfile',flags:'noprune api nostore',}));
      DRIVE.zs4.newfile._.property(new zs4.type.name({name:'name',flags:'noprune required apiarg'}));
      DRIVE.zs4.newfile._.property(new zs4.type.text({name:'data',flags:'noprune apiarg'}));
      DRIVE.zs4.newfile._.transform = (function(req,cb){
        var REQUEST = req;
        var NEW = DRIVE.zs4.newfile;
        req.setScope(this);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(NEW,err);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(NEW,err);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (!zs4.is.name(req.input.name)){
            req.error(NEW,'bad name');
            this._.getTree(req); cb(); return;
          }

          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            if (DRIVE.hasOwnProperty(req.input.name)){
              req.error(NEW,'already exists');
              this._.getTree(req); cb(); return;
            }

            DRIVE._.shouldBeSaved(req);
            DRIVE._.property(new zs4.type.file({name:req.input.name,}));
            DRIVE[req.input.name].content._.value = req.input.data;
            DRIVE[req.input.name]._.getTree(req);
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.newfile);

      DRIVE.zs4._.property(new zs4.type.object({name:'newdir',flags:'noprune api nostore',}));
      DRIVE.zs4.newdir._.property(new zs4.type.name({name:'name',flags:'noprune required apiarg'}));
      DRIVE.zs4.newdir._.transform = (function(req,cb){
        var REQUEST = req;
        var NEW = DRIVE.zs4.newdir;
        req.setScope(this);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(NEW,err);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(NEW,err);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (!zs4.is.name(req.input.name)){
            req.error(NEW,'bad name');
            this._.getTree(req); cb(); return;
          }

          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            if (DRIVE.hasOwnProperty(req.input.name)){
              req.error(NEW,'already exists');
              this._.getTree(req); cb(); return;
            }
            DRIVE._.shouldBeSaved(req);
            DRIVE._.property(new zs4.type.folder({name:req.input.name,}));
            DRIVE[req.input.name]._.getTree(req);
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.newdir);

      DRIVE.zs4._.property(new zs4.type.object({name:'delete',flags:'noprune api nostore',}));
      DRIVE.zs4.delete._.property(new zs4.type.name({name:'name',flags:'noprune required apiarg'}));
      DRIVE.zs4.delete._.transform = (function(req,cb){
        var REQUEST = req;
        var DELETE = DRIVE.zs4.delete;
        req.setScope(this);
        if (!(req.flags.value & req.flags.authset)){
          var err = 'not authorized';
          req.error(DELETE,err);
          this._.getTree(req); cb(); return;
        }
        if (!req.tokenExists()){
          var err = 'not logged in';
          req.error(DELETE,err);
          this._.getTree(req); cb(); return;
        }
        if (zs4.is.object(req.input)){
          if (!zs4.is.name(req.input.name)||req.input.name=='zs4'){
            req.error(DELETE,'bad name');
            this._.getTree(req); cb(); return;
          }

          if (DRIVE.zs4.driver._.value != ''){
            this._.getTree(req); cb(); return;
          }
          else {
            if (!DRIVE.hasOwnProperty(req.input.name)
            ||  !zs4.is.type(DRIVE[req.input.name])){
              req.error(DELETE,'not found');
              this._.getTree(req); cb(); return;
            }

            DRIVE._.shouldBeSaved(req);
            delete DRIVE[req.input.name];
            req.result(DRIVE,{delete:req.input.name})
            req.result(this,true);
            this._.getTree(req);
            cb(); return;
          }
        }
        else {
          this._.getTree(req); cb(); return;
        }
      }).bind(DRIVE.zs4.newdir);
    }
  },
  head:function(){
    zs4.type.object.call(this,{name:'head',flags:'authgetpublic authsetself nosort',})
    this._.typename = 'head';
    this._.create = zs4.type.head;

    if (zs4.is.node()){
      this._.property(new zs4.type.string({name:'title',maxlength:zs4.const.MAXLENGTH.TITLE,flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.string({name:'author',flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.text({name:'description',maxlength:zs4.const.MAXLENGTH.META,flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.lang({name:'lang',flags:'index noprune authgetpublic authsetself quickupdate textsearch',}));
      this._.property(new zs4.type.string({name:'owner',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.string({name:'typename',flags:'noset index noprune authgetpublic nostore',}));
      this._.property(new zs4.type.date({name:'created',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.date({name:'updated',flags:'noset index noprune authgetpublic',}));
      this._.property(new zs4.type.string({name:'doctype',flags:'index noprune quickupdate authgetpublic',}));
      this._.property(new zs4.type.scopebits({name:'bits',flags:'index noprune quickupdate authgetpublic authsetself',}));
    }

  },
  hi:function(){
    var THIS = this;
    zs4.type.object.call(this,{name:'hi',flags:'api apiarg nostore nosort',})
    this._.typename = 'hi';
    this._.create = zs4.type.hi;

    if (zs4.is.node()){
      this._.property(new zs4.type.email({name:'email',flags:'apiarg noprune required',}));
      this._.property(new zs4.type.password({name:'password',flags:'apiarg noprune required',}));
      this._.property(new zs4.type.boolean({name:'sendtoken',flags:'apiarg noprune',}));

      this._.transform = (function(req,cb){
        var REQUEST = req;
        req.setScope(this);

        zs4.debug(req.input);

        if (!zs4.is.object(req.input)){
          req.error(this,'input is not an object');
          THIS._.get(req); cb(); return;
        }

        if (!zs4.is.email(req.input.email)){
          req.error(this,'no email');
          THIS._.get(req); cb(); return;
        }

        if (!zs4.is.password(req.input.password)){
          if (zs4.is.boolean(req.input.sendtoken)&&req.input.sendtoken==true){
            zs4.debug('attempting to email token to address '+req.input.email);
            if (zs4.THIS.zs4.email.smtp.configured._.value!=true){
              req.error(THIS,'internal configuration error');
              THIS._.get(req); cb(); return;
            }

            function sendEmailToken(email,scope){
              var token = zs4.THIS.zs4.token.encode({iss:'zs4.email.message',scope:scope,});
              var hosturl = zs4.THIS.zs4.express.getHostURL(req);
              hosturl += '/'+scope;
              var message = new Object({
                to:email,
                subject:zs4.THIS.zs4.express.host._.value+' access token for '+email,
                text:'Click here to automatically log in '+email+': '+hosturl+'?token='+token});

              req.call({path:'zs4.email.message',input:message,},function(backcall){
                zs4.debug('response from zs4.email.message',backcall);
                if (backcall.error != null){
                  req.error(THIS,'');
                  THIS._.get(req); cb(); return;
                };

                if (backcall.result != null){
                  var path = scope;
                  if (path!='')path+='.';
                  path+='zs4.password';
                  req.call({path:path,input:{reset:true}},function(resetcb){
                    zs4.debug(path+': RESET!!!');
                    req.result(THIS,backcall.result);
                    THIS._.get(req); cb(); return;
                  });
                }
                else {
                  req.error(THIS,'send message failure');
                  THIS._.get(req); cb(); return;
                }
              },true);
            };

            if (req.input.email==zs4.THIS.zs4.email.smtp.from._.value){
              sendEmailToken(req.input.email,'');
              return;
            }

            req.call({path:'zs4.type.user.method.getone',input:{item:'zs4.email',eq:req.input.email}},function(callback){
              zs4.debug(callback);
              if (callback.error != null){
                req.error(THIS,'');
                THIS._.get(req); cb(); return;
              };
              if (!zs4.is.string(callback.result)||!zs4.string.startsWith(callback.result,'zs4.type.user.array')){
                req.error(THIS,'');
                THIS._.get(req); cb(); return;
              }
              var USERPATH = callback.result;
              sendEmailToken(req.input.email,callback.result);
              return;
            },true);
            return;
          }
          else {
            req.error(this,'no password');
            THIS._.get(req); cb(); return;
          }
        }

        if (req.input.email==zs4.THIS.zs4.email.smtp.from._.value){
          req.call({path:'zs4.password',input:{vfy:req.input.password,}},function(callback){
            if (callback.error != null){
              zs4.debug('zs4.password root login attempt failed');
              req.error(THIS,'');
              THIS._.get(req); cb(); return;
            };

            if (!req.tokenExists()){
              req.error(THIS,'login failed');
              THIS._.get(req); cb(); return;
            }

            zs4.debug('GOSCOPE ROOTSCOPE');
            req.result(THIS,{goscope:''});
            THIS._.get(req); cb(); return;
          });
          return;
        }

        req.call({path:'zs4.type.user.method.getone',input:{item:'zs4.email',eq:req.input.email}},function(callback){
          //zs4.debug(callback);
          if (callback.error != null){
            zs4.debug('zs4.type.user.method.getone('+req.input.email+') failed: ',callback);
            req.error(THIS,req.input.email+' not found.');
            THIS._.get(req); cb(); return;
          };
          if (!zs4.is.string(callback.result)||!zs4.string.startsWith(callback.result,'zs4.type.user.array')){
            req.error(THIS,'not found');
            THIS._.get(req); cb(); return;
          }

          zs4.debug('calling: '+callback.result+'.zs4.password');
          var userpath = callback.result;
          req.call({path:callback.result+'.zs4.password',input:{vfy:req.input.password}},function(callback){
            if (callback.error != null){
              req.error(THIS,'password incorrect');
              THIS._.get(req); cb(); return;
            };

            if (!req.tokenExists()){
              req.error(THIS,'login failed');
              THIS._.get(req); cb(); return;
            }

            zs4.debug('GOSCOPE '+userpath);
            req.result(THIS,{goscope:userpath});
            THIS._.get(req); cb(); return;
          });
        },true);
      }).bind(this);
    }

    THIS._.get = (function(req,po){
      //zs4.debug('password.get'+ JSON.stringify(this._.authGet));
      if (req.tokenExists())return null;
      var get = this._.getInitialize(req);
      if (get==null){
        zs4.debug(this._.path+'.get() NOT AUTHORIZED!?!?!?');
        //zs4.debug(this._.authGet);
        return null;
      }

      req.setScope(THIS.email);
      THIS.email._.get(req);

      req.setScope(THIS.password);
      THIS.password._.get(req);

      return get;
    }).bind(THIS);
  },
  integer:function(input){
    var THIS = this;
    zs4.type.unknown.call(this,input);
    this._.type = Number;
    this._.typename = 'integer';
    this._.default = new Number();

    if (zs4.is.number(input.default))this._.default = this._.parseInt(input.default);
    else this._.default = 0;
    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.min))this._.min = this._.parseInt(input.min);
      if (zs4.is.number(input.max))this._.max = this._.parseInt(input.max);
    }
    this._.value = this._.default;

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.number(input)){
        var int = parseInt(input);
        if (int==NaN) return this._.zs4checkfail(req,'not integer');
        input = int;
      }

      if (zs4.is.number(this._.min)&&input<this._.min)return this._.zs4checkfail(req,'min='+this._.min);
      if (zs4.is.number(this._.max)&&input>this._.max)return this._.zs4checkfail(req,'max='+this._.max);
      if (zs4.is.array(this._.enum)&&this._.enum.length>0){
        for (var i = 0 ; i < this._.enum.length ; i++){if (this._.enum[i]==input)return true;}
        return this._.zs4checkfail(req,'enum');
      }
      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (zs4.is.number(v)){
          return this._.parseInt(v);
        }
        if (zs4.is.string(v)){
          try{
            return this._.parseInt(v);
          }
          catch(err){}
          return null;
        }
        if (zs4.is.boolean(v)){
          if (v) return 1;
          else return 0;
        }
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value > v)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value < v)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value >= v)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value <= v)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);

      if (v==null){
        if (zs4.is.number(this._.default))this._.value = this._.parseInt(this._.default);
        else this._.value = new Number(0);
      }
      else {
        this._.value=v;
      }
    }).bind(this);
  },
  lang:function(input){
    zs4.type.string.call(this,input);
    this._.maxlength = zs4.const.MAXLENGTH.LANG;
    this._.typename = 'lang';
    this._.default = 'en';
    this._.enum = zs4.lang;
  },
  name:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'name';
    this._.minlength = zs4.const.NAME.MINLENGTH;
    this._.maxlength = zs4.const.NAME.MAXLENGTH;
  },
  names:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'names';
    this._.minlength = 0;
    this._.maxlength = zs4.const.STRING.MAXLENGTH;
  },
  number:function(input){
    var THIS = this;
    //req.setScope(this);
    zs4.type.unknown.call(this,input);
    this._.type = Number;
    this._.typename = 'number';
    this._.default = new Number();
    if (zs4.is.number(input.default))this._.default = input.default;
    else this._.default = 0;
    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.min))this._.min = input.min;
      if (zs4.is.number(input.max))this._.max = input.max;
    }
    this._.value = this._.default;

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      if (!zs4.is.number(input)){
        var num = parseFloat(input);
        if (num==NaN) return this._.zs4checkfail(req,'not number');
        input = num;
      }
      if (zs4.is.number(this._.min)&&input<this._.min)return this._.zs4checkfail(req,'min='+this._.min);
      if (zs4.is.number(this._.max)&&input>this._.max)return this._.zs4checkfail(req,'max='+this._.max);
      if (zs4.is.array(this._.enum)&&this._.enum.length>0){
        for (var i = 0 ; i < this._.enum.length ; i++){if (this._.enum[i]==input)return true;}
        return this._.zs4checkfail(req,'enum');
      }
      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (zs4.is.number(v))return v;
        if (zs4.is.string(v)){
          var x = parseFloat(v);
          if (x==NaN)return null;
          return x;
        }
        if (zs4.is.boolean(v)){
          if (v) return 1;
          else return 0;
        }
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value > v)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value < v)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value >= v)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value <= v)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);
      //zs4.debug(this.path+'.load(\''+input+'\')');

      if (v==null){
        if (zs4.is.number(this._.default))this._.value=this._.default;
        else this._.value=new Number(0);
      }
      else {
        this._.value=v;
      }
    }).bind(this);
  },
  object:function(input){
    zs4.type.unknown.call(this,input);

    this._.property = (function(ns){
      if (!zs4.is.type(ns)){

        zs4.debug('ADD SCHEMA FAILURE!!!!!  ');
        zs4.debug(ns);
        return null;
      }
      //zs4.debug('adding '+ns._.name+' to '+this._.path);
      this[ns._.name] = ns;
      if (this._.path.length>0)ns._.path = this._.path +'.'+ns._.name;
      else ns._.path = ns._.name;

      if (!zs4.is.type(ns._.scope))ns._.scope = this._.scope;

      if (this._.scope != null && !ns._.flags.get.scope()){
        ns._.scope = this._.scope;
        //ns._.flags.value = this._.flags.value;
      };

      if (this._.inscope != null){
        ns._.inscope = this._.inscope;
        ns._.flags.value = this._.flags.value;
        this._.inscope._.localRefresh();
      };


      if (ns._.type == Object){

          //debug += ' Object';
          this._.value[ns._.name] = ns._.value;

          for (var n in ns){
            if (!zs4.is.type(ns[n]))continue;
            //zs4.debug(ns._.name+'.'+n);
            ns._.property(ns[n]);
          }
      }
      //else {
        //this._.value[ns._.name] = new ns._.type();
        //this._.value[ns._.name] = ns._.default;
      //}

    }).bind(this);

    this._.type = Object;
    this._.typename = 'object';
    this._.value = new Object();
    this._.path = '';

    this._.countProperties = (function(){
      var count = 0;
      for (var n in this){if (zs4.is.type(this[n])){count++;}}
      return count;
    }).bind(this);

    this._.transform = (function(req,cb){
      var THIS = this;
      req.setScope(this);

      var starttime = Date.now();

      if (zs4.is.object(req.input)&&zs4.is.object(req.input.getHTML)){
        this._.getHTML(req);
        cb(); return;
      }
      if (this._.flags.get.scope()){
        if (zs4.is.object(req.input)
        && zs4.is.object(req.input.zs4)
        && zs4.is.object(req.input.zs4.js)
        && zs4.is.object(req.input.zs4.js.getHTML)){
          this._.getZS4js(req,cb);
          return;
        }
        if (zs4.is.object(req.input)
        && zs4.is.object(req.input.amp)
        && zs4.is.object(req.input.amp.getHTML)){
          this._.getAMP(req,cb);
          return;
        }
      }

      if (this._.flags.get.nogetall()){
        //zs4.debug(this._.path+' NOGETALL');
      }

      var empty_input_object = false;
      if (zs4.is.object(req.input)){
        if (zs4.count.object.properties(req.input)==0){
          empty_input_object = true;
          if (!this._.flags.get.nogetall()){ req.getAll(); }
        }
      }

      if (empty_input_object&&req.getall&&this._.flags.get.nogetall()) {
        //zs4.debug(this._.path+' NOGETALL');
        THIS._.get(req); cb(); return;
      }

      if (!(req.flags.value & req.flags.authset)){
        var err = 'set not authorized';
      }

      var parallel = new zs4.processor.parallel();

      for (var n in this){
        if (!zs4.is.type(this[n]))continue;


        if (req.input==null||req.input[n]==null){
          if (req.getall && !this._.flags.get.nogetall()){
            parallel.call(THIS[n],THIS[n]._.transform,req.create({input:null,parent:this,}));
          }
        }
        else if (zs4.is.object(req.input)&&!this._.flags.get.notrans()){
          parallel.call(this[n],this[n]._.transform,req.create({input:req.input[n],parent:this,}));
        }
      }

      parallel.run(function(){
        THIS._.get(req);
        cb();
      });

    }).bind(this);

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      var api =this._.flags.get.api();

      var assume = true;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        if (!zs4.is.object(input)){
          return this._.zs4checkfail(req,n + ' required');
        }
        //  if (!this[n]._.zs4check(req,input[n]))return false;
        //}
        if (this[n]._.flags.get.required()){
          return this._.zs4checkfail(req,n + ' required');
        }

      }
      return true;
    }).bind(this);

    this._.load = (function(input){
      //zs4.debug('loading '+this._.path);
      if (!zs4.is.object(input))return;
      for (var n in this){
        if (!zs4.is.type(this[n]))continue;

        this[n]._.load(input[n]);
      }
    }).bind(this);
    this._.store = (function(){

      //zs4.debug(this._.path+'.store()');
      if (this._.flags.get.nostore()){
        //zs4.debug(this._.path+'.NO_store()');
        return null;
      }
      //zs4.debug(this._.path+'.actually_store()');

      //zs4.debug(this._.path+'.object_store('+this._.typename +')');
      var store = new Object();
      var count = 0;
      for (var n in this)if(zs4.is.type(this[n])){
        var ret = this[n]._.store();
        if (ret != null) {count++; store[n] = ret;}
      }

      return store;
      //if (count > 0) return store;
      //return null;
    }).bind(this);

    this._.sortNot = (function(a,b){
      return 0;
    }).bind(this);

    this._.sortName = (function(a,b){
      if (a._.name == b._.name)return 0;
      if (a._.name < b._.name)return -1;
      return 1;
    }).bind(this);

    this._.sortDefault = this._.sortName;
    this._.sortDefaultDescend = false;
    this._.sort = (function(foo,descend){
      if (foo==null)foo=this._.sortDefault;
      if (descend==null)descend = this._.sortDefaultDescend;

      if (descend==true)foo = function(a,b){return foo(b,a);}
      var a = new Array();
      for (var n in this)if(zs4.is.type(this[n])){a.push(this[n])};
      if (this._.flags.get.api())return a;

      if (a.length > 1){
        a = a.sort(foo);
      }
      return a;
    }).bind(this);

    if (zs4.is.window()){
      this._.submit = (function(input,cb){
        var THIS = this;
        var reqinp = this._.wrapRequest(input);
        zs4.post(reqinp,function(ret){
          cb(zs4.path.resolve(ret,'request.callback.'+THIS._.path));
        });
      }).bind(this);
    }
    if (zs4.is.node()){
      this._.submit = (function(input,cb){
        var THIS = this;
        var reqinp = this._.wrapRequest(input);
        zs4.post(reqinp,function(ret){
          cb(zs4.path.resolve(ret,'request.callback.'+THIS._.path));
        });
      }).bind(this);

    }

  },
  password:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'password';
    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;

      if (!zs4.is.password(input)&&input!='') return this._.zs4checkfail(req,'not password');

      return true;
    }).bind(this);
  },
  scope:function(){
    var THIS = this;
    zs4.type.object.call(this,{name:'this',flags:'scope',})
    THIS._.typename = 'scope';
    THIS._.scope = this;
    THIS._.property(new zs4.type.zs4());
    THIS.zs4.password = null;
    THIS.zs4._.property(new zs4.type.head());
    THIS._.getScopeItems = (function(scope,type){
      var subtract = false;
      if (scope != null && scope._.path.length>0){
        subtract = true;
      }
      else {
        scope = THIS;
      }
      var response = new Array();
      //zs4.debug(type);
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          if (item[n]._.flags.get.scope())continue;

          //zs4.debug('getScopeItems-recurse '+item[n]._.path);
          if (type == null
          || (zs4.is.function(type)&&type == item[n]._.type)
          || (zs4.is.string(type)&&type==item[n]._.typename)
          || (zs4.is.number(type)&&((item[n]._.flags.value&type)==type))
          ){
            //var sp = scope._.path;
            //var ip = item[n]._.path;
            var val = item[n]._.path;
            //for (var i=0;i<ip.length;i++)if (i>(sp.length+1))
            if (scope._.path.length>0)
              val = val.substr(scope._.path.length+1,val.length-scope._.path.length-1);
            response.push(new Object({item:item[n],label:val,value:val}));
          }

          if (item[n]._.type == Object){
            if (!item[n]._.flags.get.scope())
              recurse(item[n]);
          }
        }
      };
      recurse(scope);
      return response;
    }).bind(this);
    THIS._.getUserScopes = (function(){
      var scope = zs4.THIS;
      var response = new Array();
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          zs4.debug('getUserScopes('+item[n]._.path+') ? ')

          if( item[n]._.flags.get.scope()
          && (item[n]._.typename=='scope')
          ){
            zs4.debug('getUserScopes('+item[n]._.path+')')
            if (item[n]._.flags.get.notrans())continue;

            zs4.debug('getUserScopes('+item[n]._.path+') VALID!')

            var label = item[n]._.path;
            var value = item[n]._.path;
            if (zs4.is.string(item[n].zs4.head.title._.value)
            && (item[n].zs4.head.title._.value.length > 1 )){
              label = item[n].zs4.head.title._.value;
            }
            else {
              label = new String(n + '(untitled)');
            }
            response.push(new Object({label:label,value:value}));
            continue;
          }

          if (item[n]._.type == Object){
            recurse(item[n]);
          }
        }
      };

      response.push(new Object({label:'zs4.public',value:'zs4.public'}));
      response.push(new Object({label:'zs4.owner',value:'zs4.owner'}));
      response.push(new Object({label:'zs4.self',value:'zs4.self'}));
      recurse(scope.zs4.type.user.array);
      return response;
    }).bind(this);
    THIS._.getAllScopes = (function(){
      var scope = zs4.THIS;
      var response = new Array();
      response.push(scope);
      function recurse(item){
        for (var n in item){
          if (!zs4.is.type(item[n]))continue;

          if( item[n]._.flags.get.scope()
          && (item[n]._.typename=='scope')
          ){
            //zs4.debug('getAllScopes('+item[n]._.path+')')
            if (item[n]._.flags.get.notrans())continue;

            //zs4.debug('getAllScopes('+item[n]._.path+') VALID!')
            response.push(item[n]);
            continue;
          }

          if (item[n]._.type == Object){
            recurse(item[n]);
          }
        }
      };
      recurse(scope.zs4.type);
      return response;
    }).bind(this);
    THIS._.getKeyWordArray = (function(){
      var ret = new Array();
      ret.push(new String('zs4'));
      return ret;
    }).bind(this);

  },
  scopebits:function(input){
    var THIS = this;
    zs4.type.bits.call(this,input);
    this._.typename = 'scopebits';
    THIS._.bits.addBit('public',0);
    THIS._.bits.addBit('doctype',1);
    THIS._.bits.addBit('plugin',2);
  },
  scopeindex:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopeindex';
  },
  scopeindexunique:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopeindexunique';
  },
  scopeitem:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopeitem';
  },
  scopescope:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'scopescope';
  },
  search:function(){
    var SEARCH = this;
    zs4.type.object.call(this,{name:'search',flags:'api apiarg',});
    this._.typename = 'search';
    if (zs4.is.node()){
      this._.property(new zs4.type.string({name:'value',flags:'apiarg',}));
      this._.property(new zs4.type.enum({name:'type',flags:'apiarg',}));
      this._.property(new zs4.type.string({name:'owner',flags:'apiarg',}));
      this.type._.get = (function(req){
        var get = this._.getInitialize(req);
        if (get == null) return null;
        get._.value = '';

        get._.enum = new Array(); get._.enum.push('');
        for (var n in zs4.THIS.zs4.type)if (zs4.is.type(zs4.THIS.zs4.type[n])){
            get._.enum.push((' '+n+' ').trim());
        }
        return get;
      }).bind(this.type);
      this._.transform = (function(req,cb){
        var REQUEST = req;
        REQUEST.setScope(this);

        if (!zs4.is.object(req.input)){
          SEARCH._.get(REQUEST); cb(); return;
        }

        var typ = zs4.THIS.zs4.type;
        var query = new Object({search:req.input.value,select:{sc:'all'}});

        if (zs4.is.string(req.input.owner)&&req.input.owner!=''){
          zs4.debug('zs4.search('+req.input.owner+')')
          query.select.owner = new Object({
              sc:'item',
              item:'zs4.head.owner',
              opcode:'eq',
              type:'const',
              const:req.input.owner,
              prop:'',
          });
        }

        //zs4.debug('zs4.search('+JSON.stringify(query)+')');

        var parallel = new zs4.processor.parallel();

        for (var n in typ)if (zs4.is.type(typ[n])){
          if (zs4.is.string(req.input.type)&&req.input.type!=''&&req.input.type!=n)continue;

          parallel.call(
            REQUEST,
            REQUEST.call,
            {path:'zs4.type.'+n+'.method.query',input:query,wantreply:true,}
          );
        }

        parallel.run(function(){
          SEARCH._.get(REQUEST);
          cb();
        });

      }).bind(this);
      this._.get = (function(req){
        var get = this._.getInitialize(req);
        if (get == null) return null;

        req.setScope(this.value);
        this.value._.get(req);

        req.setScope(this.type);
        this.type._.get(req);

        req.setScope(this.owner);
        this.owner._.get(req);

        return get;
      }).bind(this);
    }
  },
  select:function(){
    var SELECT = this;
    zs4.type.object.call(this,{name:'select',flags:'noprune nostore apiarg local nosort',});
    this._.property(new zs4.type.string({name:'sc',flags:'nostore noset noprune nodisplay'}));
    this.sc._.flags.set.local(true);
    this.sc._.flags.set.nodisplay(true);
    this.sc._.value = 'all';

    this._.parse = (function(input){
      //zs4.debug('SELECT.parse('+this._.path+')');
      for (var n in input){
        if (!zs4.is.object(input[n])&&!zs4.is.string(input[n].sc))continue;
        if (input[n].sc == 'all'){
          var nu = new zs4.type.selectall();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }
        else if (input[n].sc == 'any'){
          var nu = new zs4.type.selectany();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }
        else if (input[n].sc == 'none'){
          var nu = new zs4.type.selectnone();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }
        else if (input[n].sc == 'item'){
          var nu = new zs4.type.selectitem();
          nu._.name = zs4.integer.to.name(this._.addId++);
          this._.property(nu);
          nu._.parse(input[n]);
        }

      }
    }).bind(this);

    this._.sortDefault = this._.sortNot;
    this._.typename = 'select';
    this._.create = zs4.type.select;
    this._.addTypes = ['selectall','selectany','selectnone','selectitem'];
    this._.select = new Object();

    this._.onLocalChange = (function(){
      this.sc._.flags.set.nodisplay(true);
      this._.select.check();
    }).bind(this);

    this._.select.inscope = (function(){
      if (zs4.is.type(this._.inscope))return this._.inscope;
      return this._.scope;
    }).bind(this);
    this._.select.result = (function(r){
      if (zs4.is.boolean(r)){
        if (!zs4.is.node()){
          this._.cberror = null;
          this._.cbresult = r;
        }
        return r;
      }
      else if (zs4.is.string(r)){
        if (!zs4.is.node()){
          SELECT._.cberror = new Object({text:r});
          SELECT._.cbresult = null;
        }
        return false;
      }
    }).bind(this);
    this._.select.check = (function(){
      //zs4.debug(this._.path+'._.select.check()');
      this.sc._.flags.set.nodisplay(true);
      for (var n in this){
        //zs4.debug('    property '+n);
      if (zs4.is.type(this[n])&&zs4.string.startsWith(this[n]._.typename,'sel')){
          if (!this[n]._.select.check())return this._.select.result('');
        }
      }
      return this._.select.result(true);

    }).bind(this);
  },
  selectall:function(){
    zs4.type.select.call(this);
    this._.typename = 'selectall';
    this.sc._.value = 'all';
    this._.create = zs4.type.selectall;
    this._.select.check = (function(){
      //zs4.debug(this._.path+'._.select.check()');
      this.sc._.flags.set.nodisplay(true);
      for (var n in this)if (zs4.is.type(this[n])&&this[n]._.type==Object){
        if (!this[n]._.select.check())return this._.select.result('');
      }
      return this._.select.result(true);
    }).bind(this);
  },
  selectany:function(){
    zs4.type.select.call(this);
    this._.typename = 'selectany';
    this.sc._.value = 'any';
    this._.create = zs4.type.selectany;
    this._.select.check = (function(){
      //zs4.debug(this._.path+'._.select.check()');
      this.sc._.flags.set.nodisplay(true);
      for (var n in this)if (zs4.is.type(this[n])&&this[n]._.type==Object){
        if (this[n]._.select.check())return this._.select.result(true);
      }
      return this._.select.result('');
    }).bind(this);
  },
  selectnone:function(){
    zs4.type.select.call(this);
    this._.typename = 'selectnone';
    this.sc._.value = 'none';
    this._.create = zs4.type.selectnone;
    this._.select.check = (function(){
      this.sc._.flags.set.nodisplay(true);
      for (var n in this)if (zs4.is.type(this[n])&&this[n]._.type==Object){
        if (this[n]._.select.check())return this._.select.result('');
      }
      return this._.select.result(true);
    }).bind(this);
  },
  selectitem:function(){
    var ITEM = this;
    zs4.type.select.call(ITEM);
    ITEM._.typename = 'selectitem';
    this.sc._.value = 'item';
    this._.create = zs4.type.selectitem;
    ITEM._.addTypes = new Array();

    ITEM._.property(new zs4.type.scopeitem({name:'item',}));
    ITEM._.property(new zs4.type.enum({name:'opcode',enum:['exists','eq','gt','lt','ge','le'],default:'exists'}));
    ITEM._.property(new zs4.type.enum({name:'type',enum:['const','prop'],default:'const'}));
    ITEM._.property(new zs4.type.string({name:'const'}));
    ITEM._.property(new zs4.type.scopeitem({name:'prop',}));

    ITEM._.parse = (function(input){
      //zs4.debug('ITEM.parse('+this._.path+')',input);
      if (zs4.is.object(input)){
        this._.load(input);
      }
      //zs4.debug(ITEM);
    }).bind(this);

    ITEM._.select.check = (function(){
      this.sc._.flags.set.nodisplay(true);
      //zs4.debug(ITEM._.path+'._.select.check()');
      var scope = this._.select.inscope();
      if (scope==null)return this._.select.result('scope');

      if (ITEM.item._.value==null||ITEM.item._.value==''){
        return this._.select.result('item empty');
      }

      var item = scope._.resolvePath(ITEM.item._.value)
      if (item==null)return this._.select.result('item not found');
      //zs4.debug('    item value: '+item._.value);
      if (ITEM.opcode._.value==null||ITEM.opcode._.value=='')return this._.select.result('opcode');

      if (ITEM.opcode._.value=='exists'){
        //zs4.debug('   EXISTS! '+ITEM.item._.value);
        return this._.select.result(true);
      }

      if (!zs4.is.function(item._.opcode[ITEM.opcode._.value])){
        return this._.select.result('no \''+ITEM.opcode._.value+'\' opcode');
      }
      //zs4.debug('   OPCODE! '+ITEM.opcode._.value);

      if (ITEM.type._.value != 'const' && ITEM.type._.value != 'prop')return this._.select.result('type');

      if (ITEM.type._.value == 'const'){
        if(item._.opcode[ITEM.opcode._.value](ITEM.const._.value)) return this._.select.result(true);
        return this._.select.result('not '+ITEM.opcode._.value);
      }

      if (ITEM.type._.value == 'prop'){
        if (ITEM.prop._.value==null||ITEM.prop._.value=='')return this._.select.result('prop empty');
        var prop = scope._.resolvePath(ITEM.prop._.value)
        if (prop==null)return this._.select.result('prop not found');
        if (prop._.type==Object)return this._.select.result('bad prop');

        if (item._.opcode[ITEM.opcode._.value](prop._.value))return this._.select.result(true);
        return this._.select.result('not '+ITEM.opcode._.value);
      }

      return this._.select.result('error');
    }).bind(this);

    ITEM._.onLocalChange = (function(){
      var scope = this._.select.inscope();
      if (scope==null)return this._.select.result('scope');
      //zs4.debug(ITEM._.path+'._.onLocalChange()');
      this.sc._.flags.set.nodisplay(true);
      ITEM.opcode._.flags.set.nodisplay(true);
      ITEM.type._.flags.set.nodisplay(true);
      ITEM.const._.flags.set.nodisplay(true);
      ITEM.prop._.flags.set.nodisplay(true);
      if (ITEM.item._.value==null||ITEM.item._.value==''){
        //zs4.debug('      all items hidden');
      }
      else {
        ITEM.opcode._.flags.set.nodisplay(false);
        var item = scope._.resolvePath(ITEM.item._.value)
        if (item!=null){
          if (item._.type==String){
            ITEM.opcode._.enum = ['exists','eq','gt','lt','ge','le',
            'str_eq','str_gt','str_lt','str_ge','str_le',
            'str_start','str_end','str_search',];
          }
          else{
            ITEM.opcode._.enum = ['exists','eq','gt','lt','ge','le'];
          }
          //zs4.debug('      show opcode');
          if (ITEM.opcode._.value == null||ITEM.opcode._.value == ''){
            ITEM.opcode._.value = 'exists';
          }
          //zs4.debug('      opcode='+ITEM.opcode._.value);
          if (ITEM.opcode._.value != 'exists'){
            ITEM.type._.flags.set.nodisplay(false);

            if (ITEM.type._.value != 'const' && ITEM.type._.value != 'prop'){
              ITEM.type._.value = 'const';
            }

            if (ITEM.type._.value == 'const'){
              ITEM.const._.flags.set.nodisplay(false);
            }
            else {
              ITEM.prop._.flags.set.nodisplay(false);
            }

          }
        }

      }
      ITEM._.select.check();
    }).bind(ITEM);
  },
  string:function(input){
    var THIS = this;
    zs4.type.unknown.call(this,input);
    this._.type = String;
    this._.typename = 'string';
    this._.default = new String();
    if (zs4.is.string(input.default))this._.default = input.default;
    if (zs4.is.array(input.enum)){
      this._.enum = input.enum;
    }
    else{
      if (zs4.is.number(input.minlength))this._.minlength = parseInt(input.minlength);
      if (zs4.is.number(input.maxlength))this._.maxlength = parseInt(input.maxlength);
      //if (!zs4.is.number(this.minlength))this._.minlength = zs4.const.STRING.MINLENGTH;
      if (!zs4.is.number(this._.maxlength))this._.maxlength = zs4.const.STRING.MAXLENGTH;
    }
    this._.value = this._.default;

    this._.zs4check = (function(req,input){
      if (!this._.zs4checkinit(req,input))return false;
      if (!zs4.is.string(input))return this._.zs4checkfail(req,'not string: '+input);
      if (zs4.is.number(this._.minlength)&&input.length<this._.minlength)return this._.zs4checkfail(req,'minlength='+this._.minlength);
      if (zs4.is.number(this._.maxlength)&&input.length>this._.maxlength)return this._.zs4checkfail(req,'maxlength='+this._.maxlength);
      if (zs4.is.array(this._.enum)&&this._.enum.length>0&&!zs4.string.array.is.element(this._.enum,input))return this._.zs4checkfail(req,'enum');
      return true;
    }).bind(this);

    this._.opcode = {
      convert:(function(v){
        if (v==null)return null;
        if (zs4.is.string(v))return v;

        else return v.toString();
      }).bind(THIS),
      eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (v==this._.value)return true;
        return false;
      }).bind(THIS),
      gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value > v)return true;
        return false;
      }).bind(THIS),
      lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value < v)return true;
        return false;
      }).bind(THIS),
      ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value >= v)return true;
        return false;
      }).bind(THIS),
      le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value <= v)return true;
        return false;
      }).bind(THIS),
      str_eq:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)==0)return true;
        return false;
      }).bind(THIS),
      str_gt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)>0)return true;
        return false;
      }).bind(THIS),
      str_lt:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)<0)return true;
        return false;
      }).bind(THIS),
      str_ge:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)>=0)return true;
        return false;
      }).bind(THIS),
      str_le:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        if (this._.value.localeCompare(v)<=0)return true;
        return false;
      }).bind(THIS),
      str_start:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        return zs4.string.startsWith(this._.value,v);
      }).bind(THIS),
      str_end:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        return zs4.string.endsWith(this._.value,v);
      }).bind(THIS),
      str_search:(function(value){
        var v = THIS._.opcode.convert(value);
        if (v==null)return false;
        var count = this._.value.search(v);
        if (count >= 0)return true;
        return false;
      }).bind(THIS),
    };

    this._.load = (function(input){
      var v = this._.opcode.convert(input);

      if (v==null){
        if (zs4.is.string(this._.default))this._.value=this._.default;
        else this._.value=new String();
      }
      else {
        this._.value=v;
      }
    }).bind(this);
  },
  text:function(input){
    if (zs4.is.object(input)){
      if (zs4.is.number(input.maxlength)){
        if (input.maxlength > zs4.const.TEXT.MAXLENGTH)input.maxlength = zs4.const.TEXT.MAXLENGTH;
        if (input.maxlength < zs4.const.STRING.MAXLENGTH)input.maxlength = zs4.const.STRING.MAXLENGTH;
      }
      else {
        input.maxlength = zs4.const.TEXT.DFTLENGTH;
      }
    }
    else{
      input = {name:'text',maxlength:zs4.const.TEXT.DFTLENGTH};
    }
    zs4.type.string.call(this,input);
    this._.typename = 'text';
  },
  type:function(){
    zs4.type.object.call(this,{name:'type',flags:'apiarg'});
    this._.typename = 'type';

  },
  um:function(input){
    zs4.type.string.call(this,input);
    this._.minlength = 3;
    this._.maxlength = 32;
    this._.typename = 'um';
    //this._.default = 'unit.one';
  },
  userscope:function(input){
    zs4.type.string.call(this,input);
    this._.typename = 'userscope';
  },
  zs4:function(){
    zs4.type.object.call(this,{name:'zs4',flags:'authgetpublic'});
    this._.typename = 'zs4';
  },
};

zs4.call = {
  api:function(input,cb){
    var req = new zs4.request({input:input});
    req.request.node = true;

    //var p = zs4.string.split.separators(path,'.');
    //var i = new Object();
    //for (var i = 0; i < p.length; i++)

    zs4.THIS._.transform(req,function(){

    });


  },

};

zs4.request = function(o){
  var REQUEST = this;
  this.create = function(o){
    if (!zs4.is.object(o))o=new Object();
    o.request = this.request;
    o.scope = this.scope;
    var ret = new zs4.request(o);
    //ret.parentreq = this;
    ret.flags.value = this.flags.value & this.flags.enherit;

    if (this.getall && !REQUEST.requestObject._.flags.get.nogetall()){
      ret.getall=true;
      ret.flags.value |= this.flags.prune;
    }

    if (this.noneedsaving==true)ret.noneedsaving=true;

    return ret;
  };
  const BADPATH = 'bad path';
  var THIS = this;

  if (zs4.is.object(o)){
    if (zs4.is.object(o.request))this.request = o.request;
    if (o.input!=null)this.input = o.input;
    if (zs4.is.object(o.parent))this.parent = o.parent;
    if (zs4.is.type(o.scope))this.scope = o.scope;
    if (o.getall==true)this.getall=true;
  }

  if (!zs4.is.object(this.request))this.request = new Object();

  if (!zs4.is.object(this.request.callback))this.request.callback = new Object();
  if (!zs4.is.object(this.request.get))this.request.get = new Object();

  if (!zs4.is.object(this.request.rbits)){
    //this.request.rbits_value = 0;
    //this.request.rbits = new zs4.util.rbits(this.request,'rbits_value');
  }
  this.flags = new zs4.util.flags();
  this.flags.value = 0;

  this.setScope = (function(o){

    function authorize(arr){
      if (!zs4.is.array(arr)){
        return THIS.userIsRoot();
      }
      if (zs4.string.array.is.element(arr,'zs4.public')){
        return true;
      }

      if (zs4.string.array.is.element(arr,'zs4.self')&&(THIS.flags.get.am())){
        return true;
      }
      if (zs4.string.array.is.element(arr,'zs4.owner')&&(THIS.flags.get.own())){
        return true;
      }
      return THIS.userIsRoot();
    };

    var thisIsScope = false;
    if (o._.flags.value & this.flags.scope){THIS.scope = o;thisIsScope=true;}
    THIS.requestObject = o;

    THIS.flags.value = 0;
    var am = THIS.am(o);
    var own = THIS.own(o);
    //own |= this.userIsRoot();

    THIS.flags.set.am(am);
    THIS.flags.set.own(own);

    if (o._.price.length>0)THIS.flags.set.priced(true);
    else THIS.flags.set.priced(true);

    if (thisIsScope && o.zs4.head.bits._.bits.public.get()){
      THIS.flags.set.authget(true);
    }
    else if (o._.flags.get.authgetpublic()||(am||own)){
      THIS.flags.set.authget(true);
    }
    else if (THIS.tokenExists()&&o._.flags.get.authgetuser()){
      THIS.flags.set.authget(true);
    }
    else {
      THIS.flags.set.authget(authorize(o._.authGet));
    }

    if (o._.flags.get.authsetpublic()){
      THIS.flags.set.authset(true);
    }
    else if ((am||own) && o._.flags.get.authsetself()){
      THIS.flags.set.authset(true);
    }
    else if (THIS.tokenExists()&&o._.flags.get.authsetuser()){
      THIS.flags.set.authset(true);
    }
    else {
      THIS.flags.set.authset(authorize(o._.authSet));
    }

    if (am||own){
      THIS.flags.set.authgetauth(true);
      if (own){
        THIS.flags.set.authsetauth(authorize(o._.authSetAuth));
      }
    }

    if (this.userIsRoot()){
      THIS.flags.set.authroot(true);
      THIS.flags.set.authget(true);
      THIS.flags.set.authset(true);
      THIS.flags.set.authgetauth(true);
      THIS.flags.set.authsetauth(true);
      THIS.flags.set.own(true);
    }
  }).bind(this);
  this.resolvePath = function(o,r){
    if (!zs4.is.type(o)){
      debugger;
      zs4.debug('object is not a type.');
      zs4.debug(o);
      return null;
    }
    return this.callbackPath(o._.path,r);
  };
  this.callbackPath = function(p,r){
    var a = zs4.string.split.separators(p,'.');
    for (var i = 0 ; i < a.length ; i++){
      if (!r.hasOwnProperty(a[i])||!zs4.is.object(r[a[i]])){
        r[a[i]] = new Object();
      }
      r = r[a[i]];
    }
    return r;
  };
  this.error = function(o,error,starttime){
    if (starttime==null)starttime = Date.now();

    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      zs4.debug(BADPATH);
      return null;
    }
    r.error = {text:'unknown error',}

    if (zs4.is.object(error)){
      if (zs4.is.string(error.text)){r.error.text = error.text.trim();}
      if (error.data!=null) r.error.data = error.data;
    }
    else if (zs4.is.string(error)){
      r.error.text = error;
    }
    else {
      r.error.data = error;
    }
    return r;
  };
  this.result = function(o,result){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      zs4.debug(BADPATH);
      return null;
    }
    r.result = result;

    return r;
  };
  this.internalResultPath = function(o){
    var r = this.resolvePath(o,this.request.callback);
    if (r==null){
      return;
    }

    if (!zs4.is.object(r._))r._ = new Object();
    return r._
  };
  this.getAll = function(){
    this.getall=true;
    this.flags.set.prune(true);
  };
  this.get = function(o,result){
    var get = this.resolvePath(o,this.request.get);
    if (!zs4.is.object(get._)) get._ = new Object();
    return get;
  }

  this.resolveInputPath = function(p){

    if (!zs4.is.object(this.input))this.input = new Object();
    var a = zs4.string.split.separators(p,'/\\.-_');
    //zs4.debug('resolveInputPath('+a+')');

    var r = this.input;
    for (var i = 0 ; i < a.length ; i++){
      if (!r.hasOwnProperty(a[i])||!zs4.is.object(r[a[i]])){
        r[a[i]] = new Object();
      }
      r = r[a[i]];
    }

    //zs4.debug('resolveInputPath('+p+') = '+JSON.stringify(r));
    return r;
  }

  if (zs4.is.node()){

    this.call = (function(args,cb,rootAuthority){
      var THIS = this;
      var request;

      if (rootAuthority==null && args.root == true)rootAuthority=true;

      if (args.wantreply){
        request = new zs4.request();
        if (this.tokenExists()){
          request.request.token = this.request.token;
          request.request.payload = this.request.payload;
        }
      }
      else {
        zs4.debug('args.wantreply==0');
        request = new zs4.request({request:{node:true,}});
      }

      var path = args.path;
      var input = args.input;
      var inp = request.resolveInputPath(path);

      for (var n in input)inp[n]=input[n];

      if (args.wantreply){
        request.request.get = this.request.get;
        request.request.callback = this.request.callback;
      }

      if (rootAuthority==true) {
        zs4.debug('internal request with root authority');
        request.userIsRoot = request.forceUserIsRoot;
      }
      else if (this.userIsRoot==this.forceUserIsRoot){
        zs4.debug('internal SUB-request with root authority');
        request.userIsRoot = request.forceUserIsRoot;
      }

      request.process(function(){
        if (request.tokenExists()){
          THIS.request.token = request.request.token;
          THIS.request.payload = request.request.payload;
        };
        cb(THIS.callbackPath(path,request.request.callback));
      });


    }).bind(this);

    this.payloadRefresh = function(){
      if (zs4.is.string(this.request.token)&&this.request.token.length>10){
        this.request.payload = zs4.THIS.zs4.token.decode(this.request.token);
        if (zs4.is.object(this.request.payload)){
          return;
        }
      }
      this.request.token=null;
      this.request.payload=null;
    };
    this.payloadRefresh();

    this.tokenCreate = function(nuload){
      //zs4.debug('this.tokenCreate');
      this.request.token = zs4.THIS.zs4.token.encode(nuload);
      this.payloadRefresh();
    };

    this.tokenDelete = function(){
      //zs4.debug('TOKEN DELETED!!!!!!!!!!');
      this.request.token=null;
      this.request.payload=null;
    };

    this.tokenExists = function(){
      if (this.request.token!=null&&this.request.payload!=null)return true;
      return false;
    }

    if (!zs4.is.boolean(this.request.needsSaving)) this.request.needsSaving = false;

    //this.request.reget = null;

    this.forceUserIsRoot = function(){
      //zs4.debug('request.userIsRoot() called returning "true"....');
      return true;
    };

    this.getUserPath = function(){
      if (this.request.node) return null;
      if (zs4.is.object(this.request.payload)){
        if (zs4.is.string(this.request.payload.scope)){
          return this.request.payload.scope;
        }
      }
      return null;
    };

    this.userIsRoot = function(){
      if (this.request.node) return true;
      if (this.request.localhost) return true;
      if (zs4.is.object(this.request.payload)){
        if (zs4.is.string(this.request.payload.scope)){
          if (this.request.payload.scope=='')return true;
        }
      }
      if (zs4.string.endsWith(zs4.THIS.zs4.email.smtp.user._.value,'@zs4.zs4')
      && (zs4.THIS.zs4.password.hashed._.value == ''))return true;
      return false;
    };

    this.am = function(THIS){
      if (!zs4.is.object(this.request.payload))return false;
      if (this.request.payload.scope==this.scope._.path){
        return true;
      }
      return false; //this.userIsRoot();
    };

    this.own = function(THIS){
      if (!zs4.is.object(this.request.payload))return false;
      if (zs4.string.startsWith(this.scope._.path,this.request.payload.scope)
      &&this.scope._.path.length>this.request.payload.scope.length){
        return true;
      }
      if (this.scope.zs4.head.owner._.value == this.request.payload.scope){
        return true;
      }
      return false; //this.userIsRoot();
    };

    this.process = function(cb){
      var THIS = this;

      if (this.getall||(zs4.is.object(this.input)&&zs4.count.object.properties(this.input)==0)){
        if (zs4.is.object(this.request.payload)&&zs4.is.string(this.request.payload.scope)){
          zs4.debug('REQUEST FROM USER \''+this.request.payload.scope+'\'',JSON.stringify(this.input))
          var userpath = this.resolveInputPath(this.request.payload.scope);
          //zs4.debug('userpath: '+userpath);
          this.getAll();
        }
      }

      //zs4.debug(THIS.request.userIsRoot());
      zs4.THIS._.transform(THIS,function(){

        if (THIS.request.needsSaving){
          var now = Date.now();
          if (zs4.THIS.zs4.head.created._.value == 0)zs4.THIS.zs4.head.created._.value=now;
          zs4.THIS.zs4.head.updated._.value=now;
          zs4.save(function(){
            zs4.debug('THIS was saved');
            cb(this);
          });
        }
        else {
          cb(this);
        }
      });
    };

    this.getReply = function(){
      var r = new Object({request:{},input:this.input,reply:this.request.get,});
      r.request.callback = this.request.callback;
      if (zs4.is.object(this.request.payload)){
        //zs4.debug('request.getReply() FOUND PAYLOAD');
        this.tokenCreate(this.request.payload);
      }
      if (zs4.is.string(this.request.token)){
        //zs4.debug('request.getReply() FOUND TOKEN');
        r.request.token = this.request.token;
        r.request.scope = this.request.payload.scope;
      }

      return r;
    };

    if (zs4.is.object(o)&&o.html!=null&&zs4.is.string(o.path)){
      //zs4.debug('REQUEST RECOGNIZED AS REDIRECT',o,zs4.is.string(o.token),o.token.length);
      this.html = true;
      if (zs4.is.string(o.token)&&o.token.length>10){
        this.request.token = o.token;
        this.payloadRefresh();
      }
      var input = this.resolveInputPath(o.path);
      input.getHTML = new Object();
      //zs4.debug(this.request.token,this.request.payload);
    }
    else {
      this.html = false;
    }

  }
  else{
    if (!zs4.is.object(this.request.window)){
      this.request.window = {
        navigator:{
          appName:window.navigator.appName,
          appCodeName:window.navigator.appCodeName,
          product:window.navigator.product,
          platform:window.navigator.platform,
        },
        screen:{
          width:window.screen.width,
          height:window.screen.height,
        },
      };
    }
    this.userIsRoot = function(){return true;};

    this.authorize = function(THIS,arr){return true;};

    this.request.needsSaving = false;

    this.process = function(cb){

    }
  }
};

zs4.THIS = new zs4.type.scope();
zs4.THIS._.flags.set.authgetpublic(true);

zs4.plugin = new Object({
  list:new Object(),
  static:new Array(),
  style:new Array(),
  script:new Array(),
  app:new Object(),
});

zs4.module = new Array();
zs4.scriptToConstructor = function(script){
  var body = '\'use strict\';\n';

  body += '{\n';

  /*
  if (zs4.is.window()){
    body += 'var zs4 = window.zs4\n';
  }
  else if (zs4.is.node()){
    body += 'var zs4 = global.zs4\n';
  }
  */

  body += '{\n'+script+'\n}\n';
  body += '}\n';

  try {
    return new Function('zs4',body);
  }
  catch(err) {
    zs4.debug(body);
    zs4.debug(err);
    return body;
  }
}
zs4.require = function(path,cb,force){

  var header;

  if (zs4.is.window){
    zs4.THIS.zs4.require._.submit({path:path},function(ret){
        if (ret==null||ret.result==null||!zs4.is.string(ret.result)){ if (cb)cb(null);}
        //zs4.debug(ret.result);

        var con = zs4.scriptToConstructor(ret.result);
        if (zs4.is.function(cb))cb(con);
    })
  }
  else if (zs4.is.node){
    zs4.debug('node.require('+path+')');
    var data = fs.readFile(path,'utf8');
  }

  return path;
};

if (zs4.is.window()){
  zs4.throttle = {
    q:[],
    k:false,
    f:function(){
      if (zs4.throttle.q.length == 0)return;
      var j = zs4.throttle.q.shift();
      j.f();
      if (zs4.is.function(j.cb)) j.cb();
      if (zs4.throttle.k==false)
        if (zs4.throttle.q.length > 0){
          setTimeout(zs4.throttle.f,1);
        }
    },
    job:function(f,cb){
      if (zs4.throttle.q.length==0)setTimeout(zs4.throttle.f,1);
      zs4.throttle.q.push(new Object({f:f,cb:cb,}));
      return;
    },
  };

  zs4.window ={
    onresize:new Array(),
    width:window.screen.width,
    height:window.screen.height,
  };

  zs4.browserLanguage = function(){
    var lang = new String(navigator.language || navigator.browserLanguage);
    if (lang.length < 2)lang = 'en';
    else if (lang.length > 2)lang = lang.substr(0,2);
    return lang;
  };
  zs4.userLanguage = function(){
    if (zs4.THIS._.token==null||zs4.THIS._.scopath==null)return zs4.browserLanguage();
    var uobj = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
    if (uobj==null)return zs4.browserLanguage();
    if (zs4.is.string(uobj.zs4.head.lang._.value)
      && uobj.zs4.head.lang._.value.length==2) return uobj.zs4.head.lang._.value;
    return zs4.browserLanguage();
  };

  zs4.io = {
    ajax:function(u,cb){
      this.bindFunction=function(caller,o) {return function(){ return caller.apply(o,[o]);};};this.stateChange=function(o){if (this.request.readyState==4)this.cb(this.request.responseText);};this.getRequest=function(){if (window.ActiveXObject)return new ActiveXObject('Microsoft.XMLHTTP');else if(window.XMLHttpRequest)return new XMLHttpRequest();return false;};this.postBody=(arguments[2]||"");this.cb=cb;this.u=u;this.request=this.getRequest();if(this.request){var req=this.request;req.onreadystatechange=this.bindFunction(this.stateChange,this);if (this.postBody!==""){req.open("POST",u,true);req.setRequestHeader('Content-type','application/json');} else{req.open("GET",u,true);}req.send(this.postBody);}
    },
    get:function(u,cb){
      this.ajax(u,function(d){if(cb!=null)cb(d);});
      return ('this.ajax(\''+u+'\',cb)');
    },
    post:function(o,cb){
      this.ajax('/',function(d){
        if(cb!=null){
          cb(JSON.parse(d));
        }else{
          //zs4.debug(d);
        }
      },JSON.stringify(o)
      );
      //return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
    },
  };

  zs4.navigate = function(path){
    if (!zs4.string.startsWith(path,'/')) path = ('/'+path);
    window.location.replace(path);
  }
  zs4.post = function(o,cb,getall){

    var req = new zs4.request({input:o})

    if (!zs4.THIS._.zs4check(req,o)){
      zs4.debug('zs4.post() not valid');
      zs4.debug(req);
      zs4.THIS._.dcb(req,req.request.callback);
      if (cb) cb(req); return;
    }

    // user token
    if (zs4.is.string(zs4.THIS._.token)&&zs4.THIS._.token.length>10){
      req.request.token = zs4.THIS._.token;
    }
    else if (zs4.is.string(zs4.window.token)&&zs4.window.token.length>10){
      req.request.token = zs4.window.token;
    }
    else {
      req.request.token = null;
    }

    req.request.lang = zs4.userLanguage();

    zs4.debug(req);

    if (getall==true){
      req.getall = true;
    }

  	zs4.io.post(req,function(ret){
      if (zs4.is.string(ret.request.token)&&ret.request.token.length>10&&zs4.is.string(ret.request.scope)){
        zs4.THIS._.token = ret.request.token;
        zs4.THIS._.scopath = ret.request.scope;
        zs4.THIS._.loggedIn = true;
      }
      else {
        zs4.THIS._.token = null;
        zs4.THIS._.scopath = null;
        zs4.THIS._.loggedIn = false;
      }
      zs4.debug(ret);
  		zs4.THIS._.got(ret,ret.reply);
      zs4.THIS._.dcb(ret,ret.request.callback);
  		if (cb) cb(ret);
      else zs4.debug('no callback specified for zs4.post()');
  	});
  };

  zs4.loaddata = function(url,cb){
    zs4.io.get(url,cb);
  }

  zs4.loadscript = function(url){
    var js=document.createElement('script');
    js.setAttribute("type","text/javascript");
    js.setAttribute("src", url);
    document.head.appendChild(js);
  };

  zs4.loadcss = function(url){
    var css=document.createElement("link")
    css.setAttribute("rel", "stylesheet")
    css.setAttribute("type", "text/css")
    css.setAttribute("href", url);
    document.head.appendChild(css);
    return css;
  };

  zs4.loadtranslations = function(cb,lang){
    if (lang==null)lang = zs4.userLanguage();
    zs4.THIS.zs4.language.translate._.call(lang,function(r){
      var t = zs4.path.resolve(r.request.callback,'zs4.language.translate');
      if (t != null){
        if (zs4.is.object(t.error)){
          zs4.debug(t.error.text);
        }
        else {
          zs4.meaning.import(t.result);
        }
      }
      zs4.debug(r);
      if (zs4.is.function(cb))cb();
    });

  };

  window.onresize = function(){
    var width = window.screen.width;
    var height = window.screen.width;
  };

}



{
  'use strict';
  var zs4;

  var isNode = new Function("try {return this===global;}catch(e){return false;}");
  var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

  if (isNode()) zs4 = require('./js');
  if (isWindow()) zs4 = window.zs4;

  zs4.meaning = new Object({
    name:{

    },
    register:function(name,context){
      if (!zs4.is.name(name))return null;

      if (!zs4.is.object(zs4.meaning.name[name])){
        zs4.meaning.name[name]=new Object();
      }
      return zs4.meaning.name[name];
    },
    find:function(name){
      if (!zs4.is.object(zs4.meaning.name[name]))return null;
      return zs4.meaning.name[name];
    },
    export:function(lang){
      if (lang==null) console.log('EXPORTING ALL MEANINGS');
      else console.log('EXPORTING MEANINGS in '+lang);

      var ret = new Object();
      for (var n in zs4.meaning.name){
        var m = zs4.meaning.name[n];
        ret[n] = new Object();

        if (lang==null){
          for (var t in m){
            ret[n][t]=new String(m[t]);
          }
        }
        else if (m.hasOwnProperty(lang)){
          ret[n][lang] = new String(m[lang]);
        }
        else if (m.hasOwnProperty('en')){
          ret[n].en = new String(m.en);
        }
      }
      return ret;
    },
    exportJSON:function(lang){
      var js = zs4.meaning.export(lang);
      return JSON.stringify(js);
    },
    import:function(o){
      for (var n in o){
        var m = zs4.meaning.register(n);
        if (m==null)continue;
        for (var lang in o[n]){
          if (!zs4.is.name(lang))continue;
          m[lang] = o[n][lang];
        }
      }
    },
    importJSON:function(json){
      js = zs4.json.parse(json);
      zs4.meaning.import(js);
    },
    translate:function(word,lang){
      if (word=='nomeaning')return '';
      var m = zs4.meaning.find(word);
      if (m==null)return word;
      if (m.hasOwnProperty(lang))return m[lang];
      else if (zs4.is.string(m.en)) return m.en;
      else return word;
    },
  });

  zs4.meaning.register('nomeaning');
  zs4.meaning.register('meaning');
  zs4.meaning.register('lang');
  zs4.meaning.register('translation');
  zs4.meaning.register('translator');
  zs4.meaning.register('translated');
  zs4.meaning.register('untranslated');
  zs4.meaning.register('sortmeaning');
  zs4.meaning.register('sorttranslation');
  zs4.meaning.register('twoletteritems');

}



{
'use strict';
var zs4;

var isNode = new Function("try {return this===global;}catch(e){return false;}");
var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

if (isNode()) zs4 = require('./js');
if (isWindow()) zs4 = window.zs4;

zs4.um = {
  _checkconvertargs:function(arr,quantity,from,to){
    if (from==null || to == null
    ||!arr.hasOwnProperty(from)
    || from.length < 1
    || from.charAt(0)=='_'
    ||!arr.hasOwnProperty(to)
    || to.length < 1
    || to.charAt(0)=='_'
    )return false;
    return true;
  },
  _convert:{
    linear:function(arr,quantity,from,to){
      if (!zs4.um._checkconvertargs(arr,quantity,from,to)) return zs4.create.error('bad args');
      return (quantity * arr[from] / arr[to]);
    },
    squared:function(arr,quantity,from,to){
      from = from.substr(0,from.length-1);
      to = to.substr(0,to.length-1);
      if (!zs4.um._checkconvertargs(arr,quantity,from,to)) return zs4.create.error('bad args');
      return (quantity * ((arr[from] * arr[from])) / (arr[to] * arr[to]));
    },
    cubed:function(arr,quantity,from,to){
      from = from.substr(0,from.length-1);
      to = to.substr(0,to.length-1);
      if (!zs4.um._checkconvertargs(arr,quantity,from,to)) return zs4.create.error('bad args');
      return (quantity * ((arr[from] * arr[from] * arr[from])) / (arr[to] * arr[to] * arr[to]));
    },
  },
  _array:function(){
    if (zs4.is.array(zs4.um._chachearray))return zs4.um._chachearray;
    var a = new Array();
    for (var n in zs4.um){
      var t = zs4.um[n];
      if (zs4.is.object(t)&&zs4.is.function(t._array)){
        var ta = t._array();
        for (var i = 0; i<ta.length; i++) a.push(ta[i]);
      }
    }
    zs4.um._chachearray = a;
    return a;
  },
  _arr:{
    plain:function(name,append){
      var a = new Array();
      var o = zs4.um[name];

      if (zs4.is.string(append)){
        for (var n in o){
          if (zs4.is.number(o[n])){
            a.push(name+append+':'+n+append);
          }
        }
      }
      else {
        for (var n in o){
          if (zs4.is.number(o[n])){
            a.push(name+':'+n)
          }
        }
      }
      return a;
    },
  },
  _po:function(c){
    var r = new Object({
      a:'',
      b:'',
    });
    c = c.substr(1,(c.length-2))
    var o = 0; var x = false;
    for (var i = 0 ; i < c.length; i++){
      if (c.charAt(i)=='(')o++;
      else if (c.charAt(i)==')')o--;

      if (o==0 && (c.charAt(i)=='/'||c.charAt(i)=='*')){x=true;continue;}
      if (x)r.b+=c.charAt(i);
      else r.a+=c.charAt(i);
    }
    return r;
  },
  _pu:function(u){
    var r = '';
    var x = false;
    for (var i = 0 ; i < u.length; i++){
      if (u.charAt(i)==':'){x=true;continue;}
      if (!x)continue;
      r += u.charAt(i);
    }

    return r;
  },
  _product:function(name,factor1,factor2){
    if (zs4.um.hasOwnProperty(name)
    ||!zs4.um.hasOwnProperty(factor1)
    ||!zs4.um.hasOwnProperty(factor2)
    ) return null;
    var product = zs4.um[name] = new Object();
    product._array = function(){
      var a = zs4.um[factor1]._array();
      var b = zs4.um[factor2]._array();
      var r = new Array();

      for (var ia = 0; ia < a.length; ia++){
        for (var ib = 0; ib < b.length; ib++){
          r.push((name+':('+a[ia]+'*'+b[ib]+')'));
        }
      }
      return r;
    };
    product._convert = function(q,f,t){
      if (!zs4.string.startsWith(f,name+':') || !zs4.string.startsWith(t,name+':')) return null;
      f = f.substr((name.length+1),((f.length-name.length)-1));
      t = t.substr((name.length+1),((t.length-name.length)-1));

      f = zs4.um._po(f); f.a = zs4.um._pu(f.a); f.b = zs4.um._pu(f.b);
      t = zs4.um._po(t); t.a = zs4.um._pu(t.a); t.b = zs4.um._pu(t.b);

      q = zs4.um[factor1]._convert(q,f.a,t.a);
      q = zs4.um[factor2]._convert(q,f.b,t.b);

      return q;
    };

    return product;
  },
  _ratio:function(name,dividend,divisor){
    if (zs4.um.hasOwnProperty(name)
    ||!zs4.um.hasOwnProperty(dividend)
    ||!zs4.um.hasOwnProperty(divisor)
    ) return null;
    var ratio = zs4.um[name] = new Object();
    ratio._array = function(){
      var a = zs4.um[dividend]._array();
      var b = zs4.um[divisor]._array();
      var r = new Array();

      for (var ia = 0; ia < a.length; ia++){
        for (var ib = 0; ib < b.length; ib++){
          r.push((name+':('+a[ia]+'/'+b[ib]+')'));
        }
      }
      return r;
    };
    ratio._convert = function(q,f,t){
      if (!zs4.string.startsWith(f,name+':') || !zs4.string.startsWith(t,name+':')) return null;
      f = f.substr((name.length+1),((f.length-name.length)-1));
      t = t.substr((name.length+1),((t.length-name.length)-1));

      f = zs4.um._po(f); f.a = zs4.um._pu(f.a); f.b = zs4.um._pu(f.b);
      t = zs4.um._po(t); t.a = zs4.um._pu(t.a); t.b = zs4.um._pu(t.b);

      q = zs4.um[dividend]._convert(q,f.a,t.a);
      q = zs4.um[divisor]._convert(q,t.b,f.b);

      return q;
    };

    return ratio;
  },
},

zs4.um.unit = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.unit,q,f,t)},
  _array:function(){return zs4.um._arr.plain('unit');},
  one:1.0,
  two:2.0,
  three:3.0,
  four:4.0,
  five:5.0,
  six:6.0,
  seven:7.0,
  eight:8.0,
  nine:9.0,
  ten:10.0,
  eleven:11.0,
  twelve:12.0,
  thirteen:13.0,
  fourteen:14.0,
  fifteen:15.0,
  sixteen:16.0,
  seventeen:17.0,
  eighteen:18.0,
  nineteen:19.0,

  teen:10.0,
  twenty:20.0,
  thirty:30.0,
  fourty:40.0,
  fifty:50.0,
  sixty:60.0,
  seventy:70.0,
  eighty:80.0,
  ninety:90.0,

  hect:100.0,
  hecto:100.0,
  hundred:100.0,

  thousand:1000.0,
  myriad:10000.0,
  mega:1000000,
  million:1000000,

  uni:1.0,
  unit:1.0,
  solo:1.0,

  semi:0.5,
  hemi:0.5,
  demi:0.5,
  half:0.5,
  third:(1.0/3.0),
  quarter:0.25,
  fifth:0.2,
  sixth:(1.0/6.0),
  seventh:(1.0/7.0),
  eighth:0.125,
  nineth:(1.0/9.0),
  tenth:0.1,

  kilo: 1000,
  mega: 1000000,
  giga: 1000000000,
  tera: 1000000000000,
  peta: 1000000000000000,
  exa:  1000000000000000000,
  zetta:1000000000000000000000,
  yotta:1000000000000000000000000,

  deci:0.1,
  centi:0.01,
  milli:0.001,
  micro:0.000001,
  nano: 0.000000001,
  pico: 0.000000000001,
  femto:0.000000000000001,
  atto: 0.000000000000000001,
  zepto:0.000000000000000000001,
  yocto:0.000000000000000000000001,

  pi:Math.PI,

  couple:2.0,
  pair:2.0,
  duo:2.0,
  duet:2.0,
  twin:2.0,

  try:3.0,
  ter:3.0,
  trio:3.0,
  tri:3.0,
  triplet:3.0,

  quartet:4.0,
  quad:4.0,
  quint:5.0,
  quintet:5.0,
  sextet:6.0,
  septet:7.0,
  octet:8.0,

  dozen:12.0,
  score:20.0,

  gross:144.0,
};
zs4.um.mass = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.mass,q,f,t)},
  _array:function(){return zs4.um._arr.plain('mass');},
  gram:1.0,
  kilogram: 1000,
  megagram: 1000000,
  gigagram: 1000000000,
  teragram: 1000000000000,
  petagram: 1000000000000000,
  exagram:  1000000000000000000,
  zettagram:1000000000000000000000,
  yottagram:1000000000000000000000000,

  decigram:0.1,
  centigram:0.01,
  milligram:0.001,
  microgram:0.000001,
  nanogram: 0.000000001,
  picogram: 0.000000000001,
  femtogram:0.000000000000001,
  attogram: 0.000000000000000001,
  zeptogram:0.000000000000000000001,
  yoctogram:0.000000000000000000000001,

  dalton:1.66053e-24,
  pound:453.59237,
  ounce:28.349523125,
  ton:1000000,
  tonne:1000000,
  kiloton:1000000000,
  quintal:100000,
  hundredweightus:45359.237,
  hundredweightuk:50802.34544,
  slug:14593.902937205,
  pennyweight:1.55517384,
  carat:0.2,
  grain:0.06479891,
  stoneus:5669.904625,
  stoneuk:6350.29318,

  electron:9.1093897e-28,
  muon:1.8835327e-25,
  proton:1.6726231e-24,
  neutron:1.6749286e-24,
  deuteron:3.343586e-24,

  earth:5.976e+27,
  sun:2e+33,

};
zs4.um.time = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.time,q,f,t)},
  _array:function(){return zs4.um._arr.plain('time');},
  second:1.0,
  minute:60.0,
  hour:(60.0*60.0),
  day:(60.0*60.0*24.0),
  moon:(60.0*60.0*24.0*29.530587981),
  week:(60.0*60.0*24.0*7),

  year:(60.0*60.0*24.0*365.25),
  olympiad:(60.0*60.0*24.0*365.25*4),
  lustrum:(60.0*60.0*24.0*365.25*5),
  indiction:(60.0*60.0*24.0*365.25*15),
  decade:(60.0*60.0*24.0*365.25*10),
  jubilee:(60.0*60.0*24.0*365.25*50),
  century:(60.0*60.0*24.0*365.25*100),
  millenium:(60.0*60.0*24.0*365.25*1000),
  kiloannum:(60.0*60.0*24.0*365.25*1000),
  month:(60.0*60.0*24.0*365.25/12.0),

  millisecond:0.001,
  microsecond:0.000001,
  nanosecond: 0.000000001,
  picosecond: 0.000000000001,
  femtosecond:0.000000000000001,
  attosecond: 0.000000000000000001,
  zeptosecond:0.000000000000000000001,
  yoctosecond:0.00000000000000000000001,
  kilosecond: 1000,
  megasecond: 1000000,
  gigasecond: 1000000000,
  terasecond: 1000000000000,
  petasecond: 1000000000000000,
  exasecond:  1000000000000000000,
  zettasecond:1000000000000000000000,
  yottasecond:1000000000000000000000000,
};
zs4.um.time2 = {
  _convert:function(q,f,t){return zs4.um._convert.squared(zs4.um.time,q,f,t)},
  _array:function(){return zs4.um._arr.plain('time','2');},
};
zs4.um.information = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.information,q,f,t)},
  _array:function(){return zs4.um._arr.plain('information');},
  byte:1.0,
  kilobyte:1024.0,
  megabyte:1024.0*1024.0,
  gigabyte:1024.0*1024.0*1024.0,
  terabyte:1024.0*1024.0*1024.0*1024.0,

  bit:0.125,
  kilobit:0.125*1024.0,
  megabit:0.125*1024.0*1024.0,
  gigabit:0.125*1024.0*1024.0*1024.0,
  terabit:0.125*1024.0*1024.0*1024.0*1024.0,

  nibble:0.5,
  word:2,
  dword:4,
  qword:8,
};
zs4.um.liquid = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.liquid,q,f,t)},
  _array:function(){return zs4.um._arr.plain('liquid');},
  cubicmeter:1.0,
  barreloil:6.2898107280219,
  barreluk:6.1102568971969,
  barrelus:8.5216794934986,
  boardfeet:423.776000658,
  busheluk:27.496156037386,
  bushelus:28.377593256211,
  centilitre:100000,
  cubiccentimetre:1000000,
  cubicdecimetre:1000,
  cubicfeet:35.314666721489,
  cubicinch:61023.744094732,
  cubicyard:1.3079506193144,
  cups:4000,
  cupsuk:3519.5079727854,
  cupsus:4226.7528377304,
  decilitre:10000,
  decalitre:100,
  dram:270512.18161474,
  fluidounceuk:35195.077544697,
  fluidounceus:33814.022701843,
  gallonsuk:219.96923465436,
  gallonsus:264.17205235815,
  hectolitre:10,
  kilolitre:1,
  litre:1000,
  millilitre:1000000,
  peckuk:109.98462415,
  peckus:113.51037228,
  pintuk:1759.7538772348,
  pintus:2113.3764188652,
  quartuk:879.87693861742,
  quartus:1056.6882094326,
  tablespoon:66666.666666667,
  tablespoonuk:56312.127564567,
  tablespoonus:67628.045403686,
  teaspoon:200000,
};
zs4.um.distance = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.distance,q,f,t)},
  _array:function(){return zs4.um._arr.plain('distance');},
  meter:1.0,
  kilometer:1000.0,
  decimeter:0.1,
  centimeter:0.01,
  millimeter:0.001,
  micrometer:0.000001,
  nanometer: 0.000000001,
  picometer: 0.000000000001,
  femtometer:0.000000000000001,
  attometer: 0.000000000000000001,
  zeptometer:0.000000000000000000001,
  yoctometer:0.000000000000000000000001,

  kilometer: 1000,
  megameter: 1000000,
  gigameter: 1000000000,
  terameter: 1000000000000,
  petameter: 1000000000000000,
  exameter:  1000000000000000000,
  zettameter:1000000000000000000000,
  yottameter:1000000000000000000000000,

  inch:0.0254,
  mil:(0.0254/1000),
  thou:(0.0254/1000),
  foot:12*0.0254,
  yard:3*12*0.0254,
  mile:5280*12*0.0254,
  league:3*5280*12*0.0254,

  fathom:2*3*12*0.0254,
  nauticalmile:1852,

  angstrom:0.0000000001,

  lightyear:9460730472580800,
  parsec:9460730472580800*3.26,
};
zs4.um.distance2 = {
  _convert:function(q,f,t){return zs4.um._convert.squared(zs4.um.distance,q,f,t)},
  _array:function(){return zs4.um._arr.plain('distance','2');},
};
zs4.um.distance3 = {
  _convert:function(q,f,t){return zs4.um._convert.cubed(zs4.um.distance,q,f,t)},
  _array:function(){return zs4.um._arr.plain('distance','3');},
};

zs4.um._ratio('bandwidth','information','time');
zs4.um._product('storage','information','time');

}



{
'use strict';
var zs4;

var isNode = new Function("try {return this===global;}catch(e){return false;}");
var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

if (isNode()) zs4 = require('../js');
if (isWindow()) zs4 = window.zs4;

zs4.color = function(init){
  var COLOR = this;
  var r = 0;
  var g = 0;
  var b = 0;
  var a = 1;
  function component(dft,input){
    if (zs4.is.number(input)){
      if (input < 0)dft = 0;
      else if (input > 1)dft = 1;
      else dft = input;
    }
    return dft;
  }
  if (zs4.is.object(init)){
    if (zs4.is.number(init.r))r=component(r,init.r)
    if (zs4.is.number(init.g))g=component(g,init.g)
    if (zs4.is.number(init.b))b=component(b,init.b)
    if (zs4.is.number(init.a))a=component(a,init.a)
  }
  COLOR.red = function(inp){return (r=component(r,inp));};
  COLOR.green = function(inp){return (g=component(g,inp));};
  COLOR.blue = function(inp){return (b=component(b,inp));};
  COLOR.alpha = function(inp){return (a=component(a,inp));};

  // input functions
  COLOR.rgba = function(str){
    str = str.trim();
    var arr = zs4.string.split.separators(str,',');
    var c = 0;
    if (arr.length > 0){r=component(r,(zs4.parse.int(arr[0])/255));}
    if (arr.length > 1){g=component(g,(zs4.parse.int(arr[1])/255));}
    if (arr.length > 2){b=component(b,(zs4.parse.int(arr[2])/255));}
    if (arr.length > 3){a=component(a,zs4.parse.float(arr[3]));}
    return COLOR.object();
  }

  // output functions
  COLOR.object = function(){
    return new Object({r:r,g:g,b:b,a:a});
  };

  COLOR.css = function(){
    return ('rgba('+
    Math.round(r*255)+','+
    Math.round(g*255)+','+
    Math.round(b*255)+','+
    a+')');
  };

};

}



{
'use strict';
var zs4;

var isNode = new Function("try {return this===global;}catch(e){return false;}");
var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

if (isNode()) zs4 = require('../js');
if (isWindow()) zs4 = window.zs4;

function styleBits(po,name){
  var STYLEBITS = this;
  zs4.util.bits.call(STYLEBITS,po,name);

  STYLEBITS.addBit('dark',0);

};

zs4.style = {
  bits:new styleBits(),
  colorToolBackground:new zs4.color({r:.75,g:.75,b:.75,a:.8}),
  colorToolTitlebarBackground:new zs4.color({r:.5,g:.5,b:.5,a:.8}),
  colorContentBackground:new zs4.color({r:1,g:1,b:1,a:.8}),
  colorGrayer:new zs4.color({r:.5,g:.5,b:.5,a:.5}),
  colorForeground:new zs4.color({r:0,g:0,b:0,a:1}),
  colorBackground:new zs4.color({r:1,g:1,b:1,a:.8}),
  colorButtonBackground:new zs4.color({r:.5,g:.5,b:.5,a:1}),
  host:'',
  ele:{

  },
  type:{
    toolbubble:function(e){
      e.style.margin='0.25em';
      //e.style.padding='0.25em';
      e.style.border='0.05em solid black';
      e.style.borderRadius = '0.5em';
      e.style.backgroundColor = zs4.style.colorToolBackground.css();
      e.style.overflow = 'auto';
      e.style.width = '90%';
    },
    toolheader:function(e){
      e.style.padding='0.5em';
      e.style.backgroundColor = zs4.style.colorToolTitlebarBackground.css();
    },
    tooldetail:function(e){
      e.style.padding='0.5em';
      e.style.backgroundColor = zs4.style.colorToolBackground.css();
    },
    content:function(e){
      e.style.padding='0.5em';
      e.style.backgroundColor = zs4.style.colorContentBackground.css();
    },
    bgimage:function(e,i){
      if (i==null){
        e.style.backgroundImage = 'initial';
      }
      else {
        e.style.backgroundImage = 'url(\"'+zs4.style.host + i+'\")';
        e.style.backgroundRepeat = 'no-repeat';
        e.style.backgroundSize = 'auto 100%';
        e.style.backgroundPosition = 'right';
      }
    },
    boxplain:function(e){
      e.style.border = '0px';
      e.style.padding = '0px';
      e.style.margin = '0px';
      e.style.overflow = 'auto';
    },
    valueplain:function(e){
      e.style.border='0.1em solid grey';
      e.style.borderRadius = '0.3em';
      e.style.padding = '0px';
      e.style.margin = '0px';
    },
    button:function(e){
      e.style.color = zs4.style.colorForeground.css();
      e.style.cursor = 'pointer';
      e.style.backgroundColor = zs4.style.colorButtonBackground.css();
      e.style.border='0.1em solid '+zs4.style.colorForeground.css();
      e.style.borderRadius = '0.3em';
      e.style.padding = '0.2em';
      e.style.margin = '0.4em';
    },
  },
  element:function(name,value){
    if (!zs4.style.ele.hasOwnProperty(name)){
      zs4.style.ele[name] = document.createElement('style');
      document.head.appendChild(zs4.style.ele[name]);
    };
    zs4.style.ele[name].innerHTML = '';
    zs4.style.ele[name].appendChild(document.createTextNode(value));
  },
  refresh:function(){
    var width = window.screen.width;
    var height = window.screen.height;

    var em = 18;
    if (bowser.mobile==true)em *= 3;
    //var sheet = '*{box-sizing: border-box;font-size:'+em+'px;}\n';
    //sheet += '.fouc{opacity:0}\n';

    //var sheet = '*{box-sizing: border-box;font-size:'+em+'px;}\n';
    var sheet = 'body{font-size:'+em+'px;}\n';
    sheet += 'textarea{height:auto;width:90%;max-width:90%;min-width:90%;height:8em;min-height:8em;opacity:0.5;}\n';
    sheet += 'a{text-decoration:none;font-weight:bold;cursor:pointer;}\n';
    sheet += 'select,option,input{width:auto;border-left-style:none;border-top-style:none;border-right-style:none;border-bottom-style:dotted;border-color:darkgray;margin-left:0.25em;margin-right:0.25em;opacity:0.5;}\n';
    sheet += 'input[type="checkbox"]{width:1em;height:1em;}\n';
    sheet += 'input[type="number"]{width:auto;height:1em;}\n';

    sheet += zs4.style.sheet;
    zs4.style.element('zs4',sheet);
  },
};

}

zs4.window.token='eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3Nzg3NDMxMzQ4NTEsImV4cCI6MTc3OTk1MjczNDg1MSwiaXNzIjoienM0Iiwic2NvcGUiOiIifQ.JqgiG78Yi45bK-hxwFG1MN-oZ_2Eb-tAwQ8So0akBU8'
zs4.location.path = ""
zs4.style.sheet = ":root{\n  margin:0;\n  border:0;\n  padding:0;\n  color:black;\n  background-color: white;\n}\n\n.zs4-container{\n  display:block;\n}\n\n.animate-spin {\n  -moz-animation: spin 2s infinite linear;\n  -o-animation: spin 2s infinite linear;\n  -webkit-animation: spin 2s infinite linear;\n  animation: spin 2s infinite linear;\n  display: inline-block;\n}\n@-moz-keyframes spin {\n  0% {\n    -moz-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -moz-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    transform: rotate(359deg);\n  }\n}\n@-webkit-keyframes spin {\n  0% {\n    -moz-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -moz-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    transform: rotate(359deg);\n  }\n}\n@-o-keyframes spin {\n  0% {\n    -moz-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -moz-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    transform: rotate(359deg);\n  }\n}\n@-ms-keyframes spin {\n  0% {\n    -moz-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -moz-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    transform: rotate(359deg);\n  }\n}\n@keyframes spin {\n  0% {\n    -moz-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -moz-transform: rotate(359deg);\n    -o-transform: rotate(359deg);\n    -webkit-transform: rotate(359deg);\n    transform: rotate(359deg);\n  }\n}\n\n\n[class^=\"icon-\"]:before, [class*=\" icon-\"]:before {\n  display:inline-block;\n  font-size:1em;\n  cursor:pointer;\n  border-radius:1em;\n  opacity: 30%;\n  width:1em;\n  height:1em;\n  -webkit-transition: color 1s, opacity 1s, border-radius 1s; /* For Safari 3.1 to 6.0 */\n  transition: color 1s, opacity 1s, border-radius;\n}\n\n[class^=\"icon-\"]:hover, [class*=\" icon-\"]:hover {\n  opacity: 100%;\n  color:darkgreen;\n}\n\n[class^=\"icon-\"].zs4-top:hover, [class*=\" icon-\"].zs4-top:hover {\n  opacity: 100%;\n  color:darkred;\n}\n\n[class^=\"icon-\"].zs4-priced:hover, [class*=\" icon-\"].zs4-priced:hover {\n  background-color: yellow;\n}\n\noption.zs4-placeholder {\n  font-style: italic;\n  color:gray;\n}\nhtml,\nzs4-scope,\nzs4-object{\n  width:100%;\n  height:100%;\n}\nbody{\n  width:100%;\n  height:100%;\n  padding:0;\n  margin:0;\n  color:black;\n  background-color: white;\n}\n\n\ninput.zs4-noset{\n  border-color:white;\n  width:auto;\n}\n\n\nzs4-name{\n  font-size: enherit;\n  padding-right: 0.2em;\n}\nzs4-name.zs4-api{\n  cursor:pointer;\n  font-weight: bold;\n}\nzs4-name.zs4-top{\n  color:lightblue;\n}\nzs4-name.zs4-am.zs4-noset:not{\n  color:blue;\n}\nzs4-name.zs4-own.zs4-noset:not{\n  color:darkgreen;\n}\n\n.zs4-noset,.zs4-notrans{\n  color:grey;\n}\n.zs4-nodisplay{\n  display:none;\n}\n\n.icon-cancel{color:red;}\n.icon-error{background-color: white;}\n\n.icon-none:before{content:\" \";font-weight: bolder;background-color: rgba(128,128,128,0.0);}\n\n.icon-equals:before{content:\"=\";font-weight: bolder;}\n\n.icon-selectall:before{content:\"&\";font-weight: bolder;}\n.icon-selectany:before{content:\"|\";font-weight: bolder;}\n.icon-selectnone:before{content:\"!\";font-weight: bolder;}\n.icon-selectitem:before{content:\"$\";font-weight: bolder;}\n\n.icon-account:before{content:url(/gfx/icons/account.svg);}\n.icon-abc:before{content:url(/gfx/icons/abc.svg);}\n.icon-about:before{content:url(/gfx/icons/info.svg);}\n.icon-add:before{content:\"+\";font-weight: bolder;}\n.icon-amppage:before{content:url(/gfx/icons/amppage.svg);}\n.icon-android:before{content:url(/gfx/icons/android.svg);}\n.icon-app:before{content:url(/gfx/icons/app.svg);}\n.icon-apple:before{content:url(/gfx/icons/apple.svg);}\n.icon-array:before{content:'\\02630';font-weight: bolder;}\n.icon-ascend:before{content:'\\0219F';font-weight: bolder;}\n.icon-auth:before{content:url(/gfx/icons/auth.svg);}\n.icon-author:before{content:url(/gfx/icons/author.svg);}\n.icon-balance:before{content:url(/gfx/icons/coins.svg);}\n.icon-blogger:before{content:url(/gfx/icons/blogger.svg);}\n.icon-browser:before{content:url(/gfx/icons/browser.svg);}\n.icon-bye:before{content:url(/gfx/icons/bye.svg);}\n.icon-bytesserved:before{content:url(/gfx/icons/html.svg);}\n.icon-chrome:before{content:url(/gfx/icons/chrome.svg);}\n.icon-clone:before{content:url(/gfx/icons/clone.svg);}\n.icon-cloud:before{content:url(/gfx/icons/cloud.svg);}\n.icon-coin:before{content:url(/gfx/icons/coin.svg);}\n.icon-coins:before{content:url(/gfx/icons/coins.svg);}\n.icon-config:before{content:url(/gfx/icons/node.svg);}\n.icon-console:before{content:url(/gfx/icons/console.svg);}\n.icon-css:before{content:url(/gfx/icons/css.svg);}\n.icon-date:before{content:url(/gfx/icons/date.svg);}\n.icon-datefrom:before{content:url(/gfx/icons/date.svg);}\n.icon-dateto:before{content:url(/gfx/icons/date.svg);}\n.icon-delete:before{content:url(/gfx/icons/delete.svg);}\n.icon-deleteall:before{content:url(/gfx/icons/delete.svg);}\n.icon-deleteone:before{content:url(/gfx/icons/delete.svg);}\n.icon-degree:before{content:'\\000B0';font-weight: bolder;}\n.icon-descend:before{content:'\\021A1';font-weight: bolder;}\n.icon-detail:before{content:url(/gfx/icons/detail.svg);}\n.icon-doctype:before{content:'\\0265E';font-weight: bolder;}\n.icon-document:before{content:url(/gfx/icons/document.svg);}\n.icon-down:before{content:url(/gfx/icons/down.svg);}\n.icon-download:before{content:url(/gfx/icons/download.svg);}\n.icon-drive:before{content:url(/gfx/icons/drive.svg);}\n.icon-dropbox:before{content:url(/gfx/icons/dropbox.svg);}\n.icon-edge:before{content:url(/gfx/icons/edge.svg);}\n.icon-email:before{content:url(/gfx/icons/email.svg);}\n.icon-emailsent:before{content:url(/gfx/icons/email.svg);}\n.icon-empty:before{content:url(/gfx/icons/empty.svg);}\n.icon-error:before{content:url(/gfx/icons/error.svg);}\n.icon-express:before{content:url(/gfx/icons/express.svg);}\n.icon-facebook:before{content:url(/gfx/icons/facebook.svg);}\n.icon-false:before{content:url(/gfx/icons/false.svg);}\n.icon-female:before{content:'\\02640';font-weight: bolder;}\n.icon-file:before{content:'f';font-weight: bolder;color:blue;}\n.icon-firefox:before{content:url(/gfx/icons/firefox.svg);}\n.icon-folder:before{content:'\\025D5';font-weight: bolder;}\n.icon-fs:before{content:url(/gfx/icons/fs.svg);}\n.icon-getone:before{content:'1';font-weight: bolder;color:darkgreen;}\n.icon-glasses:before{content:url(/gfx/icons/glasses.svg);}\n.icon-global:before{content:url(/gfx/icons/globe.svg);}\n.icon-google:before{content:url(/gfx/icons/google.svg);}\n.icon-head:before{content:url(/gfx/icons/head.svg);}\n.icon-has:before{content:url(/gfx/icons/has.svg);}\n.icon-hi:before{content:url(/gfx/icons/hi.svg);}\n.icon-home:before{content:url(/gfx/icons/home.svg);}\n.icon-id:before{content:url(/gfx/icons/head.svg);}\n.icon-info:before{content:url(/gfx/icons/info.svg);}\n.icon-instagram:before{content:url(/gfx/icons/instagram.svg);}\n.icon-is:before{content:url(/gfx/icons/server.svg);}\n.icon-item:before{content:url(/gfx/icons/item.svg);}\n.icon-js:before{content:url(/gfx/icons/js.svg);}\n.icon-keys:before{content:url(/gfx/icons/keys.svg);}\n.icon-lang:before{content:url(/gfx/icons/lang.svg);}\n.icon-language:before{content:url(/gfx/icons/language.svg);}\n.icon-layout:before{content:url(/gfx/icons/layout.svg);}\n.icon-left:before{content:url(/gfx/icons/left.svg);}\n.icon-linefeed:before{content:'\\000B6';font-weight: bolder;}\n.icon-link:before{content:url(/gfx/icons/link.svg);}\n.icon-list:before{content:url(/gfx/icons/list.svg);}\n.icon-login:before{content:url(/gfx/icons/login.svg);}\n.icon-logo:before{content:url(/gfx/icons/logo.svg);}\n.icon-logout:before{content:url(/gfx/icons/logout.svg);}\n.icon-male:before{content:'\\02642';font-weight: bolder;}\n.icon-meaning:before{content:url(/gfx/icons/info.svg);}\n.icon-menu:before{content:\"\\02630\";font-weight: bolder;}\n.icon-message:before{content:url(/gfx/icons/message.svg);}\n.icon-method:before{content:url(/gfx/icons/method.svg);}\n.icon-minus:before{content:url(/gfx/icons/minus.svg);}\n.icon-mongodb:before{content:url(/gfx/icons/mongodb.svg);}\n.icon-networkinterfaces:before{content:url(/gfx/icons/connector.svg);}\n.icon-next:before{content:url(/gfx/icons/next.svg);}\n.icon-new:before{content:url(/gfx/icons/new.svg);}\n.icon-newdir:before{content:url(/gfx/icons/newdir.svg);}\n.icon-newfile:before{content:url(/gfx/icons/newfile.svg);}\n.icon-node:before{content:url(/gfx/icons/node.svg);}\n.icon-not:before{content:url(/gfx/icons/not.svg);}\n.icon-object:before{content:url(/gfx/icons/object.svg);}\n.icon-os:before{content:url(/gfx/icons/server.svg);}\n.icon-passport:before{content:url(/gfx/icons/passport.svg);}\n.icon-password:before{content:url(/gfx/icons/password.svg);}\n.icon-pause:before{content:url(/gfx/icons/pause.svg);}\n.icon-paypal:before{content:url(/gfx/icons/paypal.svg);}\n.icon-penguin:before{content:url(/gfx/icons/penguin.svg);}\n.icon-pencil:before{content:'\\0270F';font-weight: bolder;}\n.icon-pilcrow:before{content:'\\000B6';font-weight: bolder;}\n.icon-pinterest:before{content:url(/gfx/icons/pinterest.svg);}\n.icon-play:before{content:url(/gfx/icons/play.svg);}\n.icon-plus:before{content:url(/gfx/icons/plus.svg);}\n.icon-prev:before{content:url(/gfx/icons/prev.svg);}\n.icon-price:before{content:url(/gfx/icons/coins.svg);}\n.icon-private:before{content:url(/gfx/icons/private.svg);}\n.icon-process:before{content:url(/gfx/icons/server.svg);}\n.icon-property:before{content:url(/gfx/icons/info.svg);}\n.icon-public:before{content:url(/gfx/icons/public.svg);}\n.icon-query:before{content:url(/gfx/icons/search.svg);}\n.icon-readdir:before{content:url(/gfx/icons/readdir.svg);}\n.icon-readfile:before{content:url(/gfx/icons/readfile.svg);}\n.icon-reload:before{content:url(/gfx/icons/reload.svg);}\n.icon-require:before{content:url(/gfx/icons/item.svg);}\n.icon-required:before{content:\"*\";font-weight: bolder;}\n.icon-right:before{content:url(/gfx/icons/right.svg);}\n.icon-root:before{content:url(/gfx/icons/root.svg);}\n.icon-rsa:before{content:url(/gfx/icons/rsa.svg);}\n.icon-safari:before{content:url(/gfx/icons/safari.svg);}\n.icon-save:before{content:url(/gfx/icons/save.svg);}\n.icon-scope:before{content:'\\025EF';font-weight: bolder;}\n.icon-search:before{content:url(/gfx/icons/search.svg);}\n.icon-select:before{content:url(/gfx/icons/select.svg);}\n.icon-selectedtrue:before{content:url(/gfx/icons/selectedtrue.svg);}\n.icon-selectedfalse:before{content:url(/gfx/icons/selectedfalse.svg);}\n.icon-selectitem:before{content:'\\02611';font-weight: bolder;}\n.icon-server:before{content:url(/gfx/icons/server.svg);}\n.icon-since:before{content:url(/gfx/icons/date.svg);}\n.icon-smtp:before{content:url(/gfx/icons/smtp.svg);}\n.icon-social:before{content:url(/gfx/icons/social.svg);}\n.icon-sort:before{content:url(/gfx/icons/sort.svg);}\n.icon-space:before{content:'_';}\n.icon-spin:before{content:url(/gfx/icons/globe.svg);}\n.icon-stat:before{content:url(/gfx/icons/stat.svg);}\n.icon-statpath:before{content:url(/gfx/icons/info.svg);}\n.icon-statuser:before{content:url(/gfx/icons/info.svg);}\n.icon-stop:before{content:url(/gfx/icons/stop.svg);}\n.icon-system:before{content:url(/gfx/icons/server.svg);}\n.icon-toend:before{content:url(/gfx/icons/toend.svg);}\n.icon-text:before{content:url(/gfx/icons/text.svg);}\n.icon-token:before{content:url(/gfx/icons/token.svg);}\n.icon-tostart:before{content:url(/gfx/icons/tostart.svg);}\n.icon-total:before{content:url(/gfx/icons/total.svg);}\n.icon-transferring:before{content:url(/gfx/icons/transferring.svg);}\n.icon-transform:before{content:url(/gfx/icons/transform.svg);}\n.icon-transitem:before{content:url(/gfx/icons/gears.svg);}\n.icon-translate:before{content:url(/gfx/icons/translate.svg);}\n.icon-translation:before{content:url(/gfx/icons/translation.svg);}\n.icon-translator:before{content:url(/gfx/icons/translator.svg);}\n.icon-translate:before{content:url(/gfx/icons/translate.svg);}\n.icon-true:before{content:url(/gfx/icons/true.svg);}\n.icon-tool:before{content:url(/gfx/icons/tool.svg);}\n.icon-type:before{content:url(/gfx/icons/type.svg);}\n.icon-up:before{content:url(/gfx/icons/up.svg);}\n.icon-update:before{content:'\\0219F';font-weight: bolder;color:blue;}\n.icon-upload:before{content:url(/gfx/icons/upload.svg);}\n.icon-user:before{content:url(/gfx/icons/songstress.svg);}\n.icon-wifi:before{content:url(/gfx/icons/wifi.svg);}\n.icon-windows:before{content:url(/gfx/icons/windows.svg);}\n.icon-wordpress:before{content:url(/gfx/icons/wordpress.svg);}\n.icon-yahoo:before{content:url(/gfx/icons/yahoo.svg);}\n.icon-yinyang:before{content:url(/gfx/icons/yinyang.svg);}\n.icon-youtube:before{content:url(/gfx/icons/youtube.svg);}\n.icon-zs4:before{content:url(/gfx/icons/logo.svg);}\n\n.icon-media:before{content:url(/gfx/icons/media.svg);}\n.icon-mp3:before{content:url(/gfx/icons/mp3.svg);}\n.icon-mp4:before{content:url(/gfx/icons/mp4.svg);}\n.icon-avi:before{content:url(/gfx/icons/avi.svg);}\n.icon-mov:before{content:url(/gfx/icons/mov.svg);}\n.icon-mpg:before{content:url(/gfx/icons/mpg.svg);}\n.icon-wav:before{content:url(/gfx/icons/wav.svg);}\n.icon-aif:before{content:url(/gfx/icons/aif.svg);}\n.icon-jpg:before{content:url(/gfx/icons/jpg.svg);}\n.icon-png:before{content:url(/gfx/icons/png.svg);}\n.icon-bmp:before{content:url(/gfx/icons/bmp.svg);}\n.icon-gif:before{content:url(/gfx/icons/gif.svg);}\n.icon-m4a:before{content:url(/gfx/icons/m4a.svg);}\n.icon-svg:before{content:url(/gfx/icons/svg.svg);}\n\n.icon-toonsmith:before{content:url(/gfx/icons/toonsmith.svg);}\n.icon-audio:before{content:'\\01F509';font-weight: bolder;}\n.icon-bar:before{content:url(/gfx/icons/beer.svg);}\n.icon-bars:before{content:url(/gfx/icons/beer.svg);}\n.icon-bass:before{content:url(/gfx/icons/bass.svg);}\n.icon-beat:before{content:url(/gfx/icons/beat.svg);}\n.icon-beats:before{content:url(/gfx/icons/beat.svg);}\n.icon-bpb:before{content:'\\0215E';font-weight: bolder;}\n.icon-bpm:before{content:url(/gfx/icons/clock.svg);}\n.icon-chord:before{content:url(/gfx/icons/chord.svg);}\n.icon-event:before{content:url(/gfx/icons/event.svg);}\n.icon-fivestringbass:before{content:url(/gfx/icons/fivestringbass.svg);}\n.icon-guitar:before{content:url(/gfx/icons/guitar.svg);}\n.icon-instruments:before{content:url(/gfx/icons/instruments.svg);}\n.icon-keyboard:before{content:url(/gfx/icons/piano.svg);}\n.icon-lyric:before{content:url(/gfx/icons/text.svg);}\n.icon-mandolin:before{content:url(/gfx/icons/mandolin.svg);}\n.icon-midi:before{content:'\\0266C';font-weight: bolder;}\n.icon-mixer:before{content:url(/gfx/icons/mixer.svg);}\n.icon-mute:before{content:url(/gfx/icons/mute.svg);}\n.icon-muted:before{content:url(/gfx/icons/muted.svg);}\n.icon-note:before{content:url(/gfx/icons/note.svg);}\n.icon-piano:before{content:url(/gfx/icons/piano.svg);}\n.icon-solo:before{content:url(/gfx/icons/solo.svg);}\n.icon-soloed:before{content:url(/gfx/icons/soloed.svg);}\n.icon-tpb:before{content:url(/gfx/icons/tick.svg);}\n.icon-transpose:before{content:url(/gfx/icons/transpose.svg);}\n.icon-ukulele:before{content:url(/gfx/icons/ukulele.svg);}\n.icon-violin:before{content:url(/gfx/icons/violin.svg);}\n\n/* SLIDER STYLING */\n/* END SLIDER STYLING */\n\nzs4-error{\n  color:red;\n  display:inline;\n}\nzs4-error.zs4-hide{\n  display:none;\n}\nzs4-error.zs4-top{\n  font-size: 50%;\n  vertical-align: top;\n}\n\nzs4-result{\n  color:green;\n  display:inline;\n}\nzs4-result.zs4-hide{\n  display:none;\n}\n\nzs4-object-head.zs4-object{\n  width:100%;\n  display:block;\n}\nzs4-object-head.zs4-value{\n  display:inline-block;\n}\nzs4-object-head.zs4-tbon{\n  background-color: white;\n}\nzs4-object-head.zs4-top{\n  color:white;\n  background-color: blue;\n  font-weight: bold;\n  display:block;\n}\nzs4-object-head.zs4-root{\n  background-color: darkred;\n}\n\nzs4-coins-header-balance.zs4-negative{\n  color:red;\n}\n\n\nzs4-object-content{\n  width:100%;\n  height:100%;\n  background: linear-gradient(to right, lightblue, white );\n  background-size: 0.8em 100%;\n  background-repeat: no-repeat;\n  padding:0.5em;\n  display:block;\n  overflow: auto;\n}\nzs4-object-content.zs4-off{\n  display:none;\n}\nzs4-object-content.zs4-top.zs4-tbon{\n  display:none;\n}\n\nzs4-toolbar{\n  width:100%;\n  height:100%;\n  background-color: lightblue;\n  padding:0.5em;\n  display:block;\n}\nzs4-toolbar-tool{\n  color:black;\n  background-color: white;\n}\nzs4-tool-pane.zs4-current{\n  display:block;\n  overflow:auto;\n  width:100%;\n}\n\nzs4-toolbar-toogle,\nzs4-toolbar-toogle.zs4-current.icon-tool,\nzs4-tool-tab.zs4-current{\n  border-top-left-radius: 0.2em;\n  border-top-right-radius: 0.2em;\n  background-color:lightblue;\n}\n\n\nzs4-tool-tab{\n  padding-left:0.1em;\n  padding-right:0.1em;\n  cursor:pointer;\n  color:black;\n}\nzs4-tool-tab.zs4-top{\n  color:white;\n}\n\nzs4-about-item{\n  display:block;\n}\nzs4-about-label{\n  display:inline;\n\n}\nzs4-about-value{\n  display:inline;\n  font-style: italic;\n}\n\nzs4-auth-table{\n  display:block;\n}\nzs4-auth-item{\n  display:block;\n}\n\nzs4-select-remove{\n  display:inline-block;\n  width:0.8em;\n  height:0.8em;\n  cursor:pointer;\n  background-image: url('/minus.png');\n  background-size:100% 100%;\n  border:initial;\n}\n\nzs4-select-ui{\n  display:block;\n  background-color: lightgray;\n}\n\nzs4-user-name{\n  padding-right: 0.5em;\n}\n\nzs4-email-token-send{\n  font-size: 0.5em;\n  font-weight:bold;\n  cursor: pointer;\n}\n\nzs4-email-token-response{\n  display:block;\n  font-size: 1em;\n  background-color: lightblue;\n  border-radius: 0.3em;\n}\n\nzs4-spw-title,\nzs4-setpassword,\nzs4-spw-pwe,\nzs4-spw-send{\n  display:block;\n}\n\nzs4-spw-pwe.zs4-error{\n  color:red;\n}\n\nzs4-spw-title{\n  background-color: lightgray;\n  font-weight: bold;\n}\nzs4-spw-send,\nzs4-logout-now{\n  font-weight: bold;\n  cursor: pointer;\n}\n\ninput.zs4-search{\n  width:4em;\n  height:1em;\n  border-style:none;\n  margin-left:0em;\n  margin-right:0em;\n  padding-right: 1em;\n  padding-top:0.1em;\n  padding-left:0.1em;\n  padding-bottom:0.1em;\n  background-color: lightblue;\n}\n.zs4-search:focus{\n  background-color: white;\n}\n\nzs4-app{\n  display:flex;\n  width:100%;\n  height:100%;\n}\nzs4-app.zs4-portrait{\n  flex-direction: column;\n}\nzs4-app.zs4-landscape{\n  /* flex-direction: row; */\n  flex-direction: column;\n}\n\nzs4-app-ui{\n  display:block;\n  width:100%;\n}\nzs4-app-info{\n  background-color: lightblue;\n}\nzs4-app-info.zs4-portrait{\n  display:block;\n  width:100%;\n  align-self: flex-end;\n}\nzs4-app-info.zs4-landscape{\n  display:inline-block;\n  flex-grow: 1;\n  flex-shrink: 1;\n  flex-basis:8em;\n  align-self: flex-end;\n}\nzs4-app-window,\nzs4-app-dialog{\n  display:block;\n  width:100%;\n  height:100%;\n}\nzs4-app-panel{\n  display:none;\n  width:100%;\n  height:100%;\n  overflow:auto;\n  padding:0.5em;\n  box-sizing:border-box;\n}\nzs4-media-view{\n  display:block;\n  width:100%;\n  padding:0.5em 0;\n  text-align:center;\n}\nzs4-title-bar{\n  display:block;\n  width:100%;\n  padding:0.3em 0;\n}\nzs4-title-bar input.scope-title{\n  width:100%;\n  font-size:1.2em;\n  font-weight:bold;\n  border:none;\n  border-bottom:1px solid lightgray;\n  background:transparent;\n  padding:0.2em 0.4em;\n  box-sizing:border-box;\n}\nzs4-dialog-item-toggle{\n  display:block;\n  background-color: lightgray;\n  cursor: pointer;\n  font-weight: bold;\n}\nzs4-dialog-item-content{\n  display:block;\n  background-color: white;\n}\n\nzs4-app-toolbar{\n  display:block;\n  width:100%;\n  overflow:auto;\n  background-color: lightgray;\n}\nzs4-app-content{\n  display:block;\n  width:100%;\n}\n\nzs4-app-tab{\n  border-top-left-radius: 0.2em;\n  border-top-right-radius: 0.2em;\n  padding-left:0.1em;\n  padding-right:0.1em;\n}\nzs4-app-tab.zs4-current{\n  background-color:lightgray;\n  color:black;\n}\n\nzs4-app-new-item{\n  font-weight: bold;\n  cursor: pointer;\n  color: green;\n}\nzs4-app-item{\n  display:block;\n}\nzs4-app-item-icon{\n  float:left;\n}\nzs4-app-item-newdoc{\n  padding-left: 0.5em;\n  cursor: pointer;\n  color: red;\n}\na.zs4-app-item-link{\n}\na.zs4-app-item-link.zs4-am{\n  color:blue;\n}\na.zs4-app-item-link.zs4-own{\n  color:green;\n}\nzs4-app-item-gap{\n    font-size: 0.5em;\n}\nzs4-app-item-more,\nzs4-app-item-author,\nzs4-app-item-desc{\n    display: block;\n    padding-left: 1em;\n    font-size: 0.7em;\n}\n\ninput.zs4-scope-desc,\ninput.zs4-scope-author,\ninput.zs4-scope-title{\n  background-color: lightgray;\n}\ninput.zs4-scope-desc:focus,\ninput.zs4-scope-author:focus,\ninput.zs4-scope-title:focus{\n  background-color: white;\n}\n\nselect.zs4-app-creator-select,\nselect.zs4-app-sort-select,\nselect.zs4-app-sort-toggle,\nselect.zs4-app-type-select{\n  background-color: lightgray;\n}\n\n\nzs4-app-username.zs4-am{\n  font-weight: bold;\n  color:blue;\n  cursor: pointer;\n}\nzs4-login-email,\nzs4-login-password{\n  display:block;\n}\ninput.zs4-login-email.zs4-error,\ninput.zs4-login-password.zs4-error{\n  border-color: red;\n}\nzs4-logout-args{\n  display:block;\n}\nzs4-login,zs4-logout{\n  display:block;\n  cursor:pointer;\n  font-weight: bold;\n  background-color: lightgray;\n}\nzs4-login:hover,\nzs4-logout:hover,\nzs4-spw-title:hover{\n  background-color: lightblue;\n}\n\nzs4-app-device{\n  display:block;\n  background-color: lightgray;\n  font-weight: bold;\n}\nzs4-app-device:hover{\n  background-color: lightblue;\n}\nzs4-app-device-info-item{\n  display:block;\n}\nzs4-app-device-info-name:after{\n  content:': ';\n}\nzs4-app-device-info-value{\n  font-weight: bold;\n}\n";
zs4.style.sheet += "";
zs4.style.refresh();



{
////////////////////////////////////////////////////////////////////////"+"
'use strict';


zs4.admin = new Object({debug:false,});

var UI;
zs4.admin.util = {
	clseps:' ',

	date:{
		fromInput:function(i){
			var d = new Date();

			var a = zs4.string.split.separators(i.value,"-");
			d.setFullYear(parseInt(a[0]),parseInt(a[1]),parseInt(a[2]));
			//console.log(d);
			//console.log(d.valueOf());

			return d.valueOf();
		},
		toInput:function(date,i){

			var datum = new Date();
			datum.setTime(date);

			if (i.readOnly){
			//	i.value = parseInt(date);
				return;
			}
			var s = datum.getFullYear()+'-';
			if (datum.getMonth()<10) {s+= '0'+datum.getMonth();} else {s+=datum.getMonth();}
			s += '-';
			if (datum.getDate()<10) {s+= '0'+datum.getDate();} else {s+=datum.getDate();}

			//console.log('date to input: '+s);
			//console.log('input string: '+s);
			i.value = s;
		},
	},

	am:function(o){
		return o._.flags.get.am();
	},
	own:function(o){
		return o._.flags.get.own();
	},
	root:function(){
		if (zs4.THIS._.token==null||zs4.THIS._.scopath==null)return false;
		if (zs4.THIS._.scopath=='') return true;
		return false;
	},
	user:function(){
		if (zs4.THIS._.token!=null&&zs4.THIS._.scopath!=null)return true;
		return false;
	},
	userScope:function(){
		if (!UI.user())return null;
		return zs4.THIS._.resolvePath(zs4.THIS._.scopath);
	},
	setClass:function(e,c,tof){
		if (e==null||c==null)return;
		if (tof)return UI.addClass(e,c);
		else return UI.removeClass(e,c);
	},
	setIcon:function(e,icon){
		if (e==null||icon==null)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
		for (var i = (cls.length-1) ; i >= 0; i--){
			if (cls[i].substr(0,5)=='icon-')
			cls.splice(i,1);
		}
		if (zs4.is.string(icon))cls.push('icon-'+icon);
		var ret = '';
		for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
		e.title = icon;
	},
	setAnimate:function(e,icon){
		if (e==null||icon==null)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
		for (var i = (cls.length-1) ; i >= 0; i--){
			if (cls[i].substr(0,5)=='animate-')
			cls.splice(i,1);
		}
		if (zs4.is.string(icon))cls.push('animate-'+icon);
		var ret = '';
		for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	setOnClick:function(e,foo){
		e.style.cursor = 'pointer';
		e.onclick = foo;
		return e;
	},
	addAttribute:function(e,a,c){
		if (e==null||c==null)return;
		var set = zs4.string.split.separators(c,UI.clseps);
		if  (set.length==0)return;
		var cls = zs4.string.split.separators(e[a],UI.clseps);
		for (var i = 0 ; i < set.length ; i++)zs4.string.array.add.new(cls,'zs4-'+set[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e[a] = ret;
	},
	removeAttribute:function(e,a,c){
		if (e==null||c==null)return;
		var rem = zs4.string.split.separators(c,UI.clseps);
		if  (rem.length==0)return;
		var cls = zs4.string.split.separators(e[a],UI.clseps);
		for (var i = 0 ; i < rem.length ; i++)zs4.string.array.remove.string(cls,'zs4-'+rem[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e[a] = ret;
	},
	addClass:function(e,c){
		if (e==null||c==null)return;
		var set = zs4.string.split.separators(c,UI.clseps);
		if  (set.length==0)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
		for (var i = 0 ; i < set.length ; i++)zs4.string.array.add.new(cls,'zs4-'+set[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	removeClass:function(e,c){
		if (e==null||c==null)return;
		var rem = zs4.string.split.separators(c,UI.clseps);
		if  (rem.length==0)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
		for (var i = 0 ; i < rem.length ; i++)zs4.string.array.remove.string(cls,'zs4-'+rem[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	addIconElement:function(p,icon){
		var ret = document.createElement('zs4-ielement');
		UI.setIcon(ret,icon);
		p.appendChild(ret);
		return ret;
	},
	addIconImage:function(p,icon){
		var ret = document.createElement('div');
		ret.style.display = 'inline-block';
		UI.addIconElement(ret,icon);
		p.appendChild(ret);
		return ret;
	},
	addTextSpan:function(p,text){
		var ret = document.createElement('span');
		ret.textContent = text;
		p.appendChild(ret);
		return ret;
	},
	addSpace:function(p,w,h){
		var ret = document.createElement('span');
		ret.innerHTML = '<svg width=\"0.5em\" height=\"1em\"></svg>';
		p.appendChild(ret);
		return ret;
	},

	createSearchSelect:function(o,s){
		var search = document.createElement('zs4-search-box');
		search.zs4 = new Object({
			s:s,
			value:'',
			getValue:function(){
				return search.zs4.value;
			},
			setValue:function(v){
				if (zs4.is.string(v)){
					search.zs4.value = v;
					search.zs4.selectedtitle.textContent = v;
				}
				else if (zs4.is.object(v)){
					search.zs4.value = v._.path;
					search.zs4.selectedtitle.textContent = v.zs4.head.title._.value;
					search.zs4.valuescope = v;
				}
			},
			getScope:function(){
				if (!zs4.is.object(search.zs4.valuescope))return null;
				return search.zs4.valuescope;
			},
			showResults:function(){
				if (search.zs4.results.length == 0){
					search.zs4.optionsAreVisible = false;
					return;
				}

				search.zs4.options.style.display = 'block';
				search.zs4.optionsAreVisible = true;
			},
			hideResults:function(){
				search.zs4.options.style.display = 'none';
				search.zs4.optionsAreVisible = false;
			},
			toggleResults:function(){
				if (search.zs4.optionsAreVisible){
					search.zs4.hideResults();
				}
				else {
					search.zs4.showResults();
				}
			},
			scopeTrueOrFalse:null,
			scopeIsIncluded:function(scope){
				//console.log(scope._.path+': owner ('+scope.zs4.head.owner._.value+')');
				if (zs4.is.string(search.zs4.s.owner)&&scope.zs4.head.owner._.value != search.zs4.s.owner){
					console.log(scope._.path+': bad owner ('+scope.zs4.head.owner._.value+')');
					return false;
				}
				if (zs4.is.string(search.zs4.s.type)&&search.zs4.s.type.length>0&&s.type!=scope.zs4.head.typename._.value){
					console.log(scope._.path+': bad type ('+scope.zs4.head.typename._.value+')');
					return false;
				}
				if (zs4.is.string(search.zs4.stringinput.value)&&search.zs4.stringinput.value!=''){
					if (!scope._.search(search.zs4.stringinput.value)){
						console.log(scope._.path+': did not find ('+search.zs4.stringinput.value+')');
						return false;
					}
				}
				if (zs4.is.function(search.zs4.scopeTrueOrFalse)){
					return search.zs4.scopeTrueOrFalse(scope);
				}
				return true;
			},
			refreshResults:function(){
				var a = search.zs4.results;
				for (var i = 0 ; i < a.length; i++){
					if (search.zs4.scopeIsIncluded(a[i].scope)){
						a[i].container.style.display = 'block';
						if (search.zs4.value == a[i].scope._.path){
							search.zs4.selectedtitle.textContent = a[i].scope.zs4.head.title._.value;
							search.zs4.valuescope = a[i].scope;
						}

					}
					else {
						a[i].container.style.display = 'none';
					}
				}
			},
			results:new Array(),
			result:function(scope){
				var RESULT = this;

				RESULT.scope = scope;
				RESULT.container = document.createElement('zs4-search-result');
				RESULT.container.style.display = 'block';
				RESULT.container.onclick = function(){
					search.zs4.setValue(RESULT.scope);
					search.zs4.hideResults();
					if (zs4.is.function(search.zs4.onchange)){
						search.zs4.onchange();
					}
				};

				RESULT.icon = UI.addIconElement(RESULT.container,scope.zs4.head.typename._.value);

				RESULT.title = document.createElement('zs4-search-result-title');
				RESULT.title.textContent = scope.zs4.head.title._.value;
				RESULT.container.appendChild(RESULT.title);

				RESULT.description = document.createElement('zs4-search-result-description');
				RESULT.description.textContent = scope.zs4.head.description._.value;
				RESULT.description.style.fontSize = '.7em';
				RESULT.description.style.display = 'block';
				RESULT.container.appendChild(RESULT.description);

				search.zs4.options.appendChild(RESULT.container);
				search.zs4.results.push(RESULT);
			},
			submit:function(cb){
				var req = new Object({
					value:search.zs4.stringinput.value,
					type:s.type,
					owner:s.owner,
				});

				var tq = null;
				if(req.type.length>0)
				tq=zs4.THIS._.resolvePath('zs4.type.'+req.type+'.method.query')

				console.log('resolvePath('+'zs4.type.'+req.type+'.method.query'+') = '+tq);

				UI.removeClass(o._.html.spin,'nodisplay');
				zs4.post(zs4.THIS.zs4.search._.wrapRequest(req),function(ret){
					UI.addClass(o._.html.spin,'nodisplay');
					//o._.html.refreshAll();

					var scopes = zs4.THIS._.getAllScopes();
					console.log(scopes);

					search.zs4.options.innerHTML = '';
					search.zs4.results = new Array();
					for (var i = 0 ; i < scopes.length; i++){
						var nu = new search.zs4.result(scopes[i]);
					}
					search.zs4.refreshResults();
					search.zs4.showResults();
					if (zs4.is.function(cb)) cb();
				});

			},
		});
		if (search != null){
				search.style.display = 'block';

				// add search icon and string input
				search.zs4.string = document.createElement('zs4-search-string');
				search.zs4.string.style.display = 'block';
				search.appendChild(search.zs4.string);

				search.zs4.stringicon = UI.addIconElement(search.zs4.string,'search');
				search.zs4.stringicon.onclick = search.zs4.submit;
				search.zs4.stringinput = document.createElement('input');
				search.zs4.stringinput.oninput = search.zs4.refreshResults;
				search.zs4.stringinput.onchange = search.zs4.submit;
				search.zs4.stringinput.type = 'search';
				search.zs4.string.appendChild(search.zs4.stringinput);

				// add search select input
				search.zs4.select = document.createElement('zs4-search-select');
				search.zs4.select.style.display = 'block';
				search.appendChild(search.zs4.select);

				search.zs4.selecticon = UI.addIconElement(search.zs4.select,'select');
				search.zs4.selecticon.onclick = search.zs4.toggleResults;
				search.zs4.selectedoption = document.createElement('zs4-search-selectedoption');
				search.zs4.select.appendChild(search.zs4.selectedoption);

				search.zs4.selectedtitle = document.createElement('zs4-search-selectedtitle');
				search.zs4.selectedtitle.style.fontWeight = 'bold';
				search.zs4.selectedtitle.onclick = search.zs4.toggleResults;
				search.zs4.select.appendChild(search.zs4.selectedtitle);

				// options container
				search.zs4.optionsAreVisible = true;
				search.zs4.options = document.createElement('zs4-search-options');
				search.zs4.options.style.display = 'block';
				search.appendChild(search.zs4.options);
		}
		return search;
	},
	createSelectScopeItem:function(o,s){
		if (s==null)s=zs4.THIS;
		var container = document.createElement('zs4-scope-item-select');
		var text = document.createElement('zs4-scope-item-path');
		container.appendChild(text);
		var select = document.createElement('select');
		container.appendChild(select);
		select.onchange = function(){
			select.zs4.setValue(select.value);
			console.log('createSelectScopeItem.onchange.value = '+select.value);
			if (zs4.is.function(select.zs4.onchange))select.zs4.onchange();
		}
		select.zs4 = new Object({
			container:container,
			text:text,
			scope:s,
			value:'',
			getValue:function(){
				return select.zs4.value;
			},
			setValue:function(v){
				select.value = v;
				select.zs4.value = v;
				select.zs4.text.textContent = v;
				select.zs4.refreshOptions();
			},
			setScope:function(s){
				select.zs4.scope = s;
				if (zs4.is.object(s))console.log('setScope() for item select... '+ s.zs4.head.typename._.value);
				else console.log('setScope() for item select... '+ s);
				select.zs4.refreshOptions();
			},
			showText:function(){
				text.style.display = 'inline';
			},
			hideText:function(){
				text.style.display = 'none';
			},
			showSelect:function(){
				select.style.display = 'inline';
			},
			hideSelect:function(){
				select.style.display = 'none';
			},
			refreshOptions:function(){
				select.innerHTML = '';
				if (select.zs4.scope==null){
					select.zs4.showText();
					select.zs4.hideSelect();
					return;
				}

				var a = select.zs4.scope._.getScopeItems();
				a.sort(function(a,b){
					return a.value.localeCompare(b.value);
				});
				select.zs4.options = a;

				var found = false;
				for (var i = 0 ; i < a.length; i++){
					if (zs4.is.function(select.zs4.itemTrueOrFalse)){
						//console.log('itemTrueOrFalse is a function');
						if (zs4.is.object(a[i].item)){
							if (!select.zs4.itemTrueOrFalse(a[i]))continue;
						}
					}
					a[i].opt = document.createElement('option');
					a[i].opt.textContent = a[i].value;
					a[i].opt.value = a[i].value;
					if (a[i].value = select.zs4.value){
						var found = true;
						a[i].opt.selected = true;
					}
					select.appendChild(a[i].opt);
				}
				select.value = select.zs4.value;
				if (found){
					select.zs4.hideText();
					select.zs4.showSelect();
				}
				else if (a.length > 0){
					select.zs4.showText();
					select.zs4.showSelect();
				}
				else {
					select.zs4.hideText();
					select.zs4.showSelect();
				}
			},
		});
		container.zs4 = select.zs4;
		if (select!=null){

		}
		return container;
	},
	app:function(scope,containerElement){
		//this.scope = scope;
		this.containerElement = containerElement;

		console.log(scope);

		this.internalRefresh = function(){
			// flag the first pass
			if (!zs4.is.boolean(this.uninitialized))this.uninitialized=true;
			else this.uninitialized=false;

				//console.log('refreshing app type: ' + this.scope.zs4.head.type._.value + ' ' + this.scope.zs4.head.bits._.value);

			if (zs4.is.function(this.refresh))this.refresh();

			//if (zs4.is.object(scope._.html.dialog.coins)){
				//console.log('updating balance from app.refreshInternal()');
				//scope._.html.dialog.coins.updateBalance();
			//}
		};
	},
	createValueElement:function(pe,v){
		//container
		var e = document.createElement('zs4-input-value');
		e.style.display = 'block';

		//label
		var l = document.createElement('zs4-input-label');
		l.textContent = v._.name;
		UI.setIcon(l,v._.name);
		e.appendChild(l);

		var i;
		// value READONLY
		if (v._.flags.get.noset()||!v._.flags.get.quickupdate()){
			i = document.createElement('zs4-input-noset');
			i.textContent = v._.value.toString();
			v._.onchange(function(){i.textContent = v._.value.toString();});
		}
		// value INPUT
		else if (v._.type==String){
			//var onchange = function(
			if (v._.type==String){
				if (zs4.is.array(v._.enum)&&v._.enum.length>0){
					i = document.createElement('select');
					for (var x = 0; x < v._.enum.length; x++){
						var opt = document.createElement('option');
						opt.value = opt.textContent = v._.enum[x];
						if (v._.enum[x]==v._.value)opt.selected = true;
						i.appendChild(opt);
					}
					i.onchange = function(){
						console.log(i.selectedIndex,i.value);
						if (v._.flags.get.local()){
							v._.value = v._.enum[i.selectedIndex];
						}
						else {
							UI.setIcon(l,'upload');
							zs4.post(v._.wrapRequest(v._.enum[i.selectedIndex]),function(ret){
								console.log(ret);
								UI.setIcon(l,v._.name);
							});
						}
					};
				}
				else {
					i = document.createElement('input');
					UI.addAttribute(i,'autocomplete',v._.name);
					UI.addAttribute(i,'autocomplete',v._.typename);
					i.maxLength = v._.maxlength;
					var typeAttr = 'text';
					if (v._.typename=='password')typeAttr='password';
					i.setAttribute('type', typeAttr);
					i.onchange = function(){
						//alert('++++++++++++++++++');
						if (v._.flags.get.local()){
							v._.value = i.value;
						}
						else {
							UI.setIcon(l,'upload');
							zs4.post(v._.wrapRequest(i.value),function(ret){
								UI.setIcon(l,v._.name);
							});
						}
					};
				}
				v._.onchange(function(){
					i.value = v._.value;
				});
				i.value = v._.value;
			}
			e.appendChild(i);
		}

		pe.appendChild(e);
		return e;
	},

	element:function(bitstring){
		var ELEMENT = this;

		var on = new Object();
		ELEMENT.hasEventHandler = function(name){
			if (!zs4.is.name(name))return false;
			if (!on.hasOwnProperty(name))return false;
			return true;
		};
		ELEMENT.trigger = function(name){
			if (!on.hasOwnProperty(name))return;

			var ON = on[name];
			for (var i = 0; i < ON.f.length;i++){
				ON.f[i](ON);
			}
		}
		ELEMENT.on = function(name,func,remove){
			if (!zs4.is.name(name))return false;
			if (!zs4.is.function(func))return false;
			var ON;
			if (on.hasOwnProperty(name)){
				ON = on[name];
			}
			else {
				if (remove) return false;
				ON = on[name] = new Object();
				ON.f = new Array();
			}

			var found = false;
			for (var i = 0; i < ON.f.length;i++){
				if (ON.f[i]==func){
					if (remove==true){
						ON.f.splice(i,1);
						if (ON.f.length==0){
							delete on[name];
						}
						return false;
					}
					found=true;
				}
			}
			if (!found)ON.f.push(func);

			return true;
		};

		ELEMENT.show = function(){
			if (ELEMENT.top != null){
				if (ELEMENT.bits.block.get())ELEMENT.top.style.display = 'block';
				else if (ELEMENT.bits.inlineblock.get())ELEMENT.top.style.display = 'inline-block';
				else if (ELEMENT.bits.inline.get())ELEMENT.top.style.display = 'inline';
				else ELEMENT.top.style.display = 'initial';
			}
		};
		ELEMENT.hide = function(){
			if (ELEMENT.top != null){
				ELEMENT.top.style.display = 'none';
			}
		};

		ELEMENT.element = null;

		ELEMENT.appendElement = function(e){
			if (zs4.is.string(e))e = document.createElement(e);
			ELEMENT.element.appendChild(e);
			return e;
		};

		ELEMENT.append = function(eObj){
			if (ELEMENT.element==null || eObj.top==null)return null;
			ELEMENT.element.appendChild(eObj.element);
			return eObj;
		}

		var current_bit = 0;
		function bits(){
			zs4.util.bits.call(this);
		}
		ELEMENT.bits = new bits();
		ELEMENT.addBit = function(name){
			ELEMENT.bits.addBit(name,current_bit);
			current_bit += 1;
		}

		ELEMENT.addBit('block');
		ELEMENT.addBit('inlineblock');
		ELEMENT.addBit('inline');
		ELEMENT.addBit('showing'); ELEMENT.bits.showing.true();

		ELEMENT.bgimage = function(img){
			if (ELEMENT.top==null)return false;
			if (img==null){
				zs4.style.type.bgimage(ELEMENT.top);
			}
			else {
				zs4.style.type.bgimage(ELEMENT.top,'/gfx/icons/'+img+'.svg');
			}

			return true;
		}
		ELEMENT.pointer = function(ptr){
			if (ELEMENT.element==null)return false;
			if (ptr==null) ELEMENT.element.style.cursor = 'initial';
			else ELEMENT.element.style.cursor = ptr;
			return ELEMENT.element.style.cursor;
		},
		ELEMENT.color = function(color){
			if (ELEMENT.top==null)return null;
			if (color==null)return ELEMENT.top.style.color;
			ELEMENT.top.style.color = color;
			return ELEMENT.top.style.color;
		};

		ELEMENT.setBits = function(str){ELEMENT.bits.setString(str);}
		if (zs4.is.string(bitstring))ELEMENT.setBits(bitstring);
		return ELEMENT;
	},
	div:function(pe){
		var DIV = this;
		UI.element.call(DIV,'block');
		DIV.top = DIV.element = document.createElement('div');
		pe.appendChild(DIV.top);
		DIV.show();
	},
	inline:function(pe){
		var INLINE = this;
		UI.element.call(INLINE,'inlineblock');
		INLINE.top = INLINE.element = document.createElement('div');
		pe.appendChild(INLINE.top);
		INLINE.show();
	},
	inputBoolean:function(pe,tof){
		var BOOL = this;
		UI.element.call(BOOL,'inlineblock');

		var div = BOOL.top = BOOL.element = document.createElement('div');
		div.style.width = div.style.height = '1em';
		pe.appendChild(div);

		var bool = false;
		var imgFalse = 'selectedfalse';
		var imgTrue = 'selectedtrue';

		function bg(icon){
			zs4.style.type.bgimage(div,'/gfx/icons/'+icon+'.svg');
		}

		function refresh(){
			if (bool) bg(imgTrue);
			else bg(imgFalse);
		}

		BOOL.imageFalse = function(icon){
			imgFalse = icon;
			refresh();
		};
		BOOL.imageTrue = function(icon){
			imgTrue = icon;
			refresh();
		};

		BOOL.value = function(v){
			if (v==null)return bool;
			if (v==true){
				bool=true;
			}
			else {
				bool=false;
			}
			refresh();
			return bool;
		}
		BOOL.value(tof);

		div.onclick = function(e){
			if (bool){
				bool = false;
			}
			else {
				bool = true;
			}
			refresh();
			BOOL.trigger('change');
			e.preventDefault();
			return false;
		}

		BOOL.show();
		refresh();
	},
	elementLink:function(pe,hr){
		var LINK = this;
		UI.element.call(LINK);

		var target = null;
		var href = null;

		var a = LINK.top = LINK.element = document.createElement('a');

		LINK.href = function(hr){
			a.href = hr;
		}

		if (zs4.is.string(hr)) LINK.href(hr);

		pe.appendChild(LINK.top);
	},
	elementLanguage:function(pe){
		var LANG = this;
		UI.element.call(LANG);
		var dft = zs4.userLanguage();
		var select = LANG.top = LANG.element = document.createElement('select');
		for (var i = 0; i < zs4.lang.length;i++){
			var opt = document.createElement('option');
			opt.value = zs4.lang[i];
			if (dft == zs4.lang[i])opt.selected = true;
			opt.textContent = zs4.lang[i];
			select.appendChild(opt);
		}
		select.onchange = function(){
			LANG.trigger('change');
		}
		LANG.value = function(lang){
			if (zs4.is.string(lang))select.value = lang;
			return select.value;
		}
		pe.appendChild(select);
	},
	meaning:new Array(),
	setUILanguage:function(lang,cb){
		if (!zs4.string.array.is.element(zs4.lang,lang)){
			return UI.refreshAllMeanings();
		}

		zs4.loadtranslations(function(){
			var a = UI.meaning;
			for (var i = 0 ; i < a.length; i++){
				a[i].ulang = lang;
				a[i].refresh();
			}
			if (zs4.is.function(cb)) cb();
		},lang);
	},
	refreshAllMeanings:function(){
		var a = UI.meaning;
		for (var i = 0 ; i < a.length; i++){
			a[i].refresh();
		}
	},
	elementMeaning:function(pe,meaningstring){
		var MEANING = this;
		var meaning = meaningstring;

		MEANING.object = zs4.meaning.find(meaning);
		MEANING.ulang = zs4.userLanguage();

		UI.element.call(MEANING,'inlineblock');
		UI.meaning.push(MEANING);
		var div = MEANING.top = document.createElement('div');
		div.style.display = 'inline-block';

		MEANING.addBit('noctrlclick');
		MEANING.addBit('nolinktranslator');

		var display = MEANING.element = document.createElement('div');
		var text = MEANING.text = meaning;
		display.style.cursor = 'help';
		div.appendChild(display);
		MEANING.icon = function(icon){
			UI.setIcon(display,icon);
		}
		MEANING.button = function(icon){
			zs4.style.type.button(display);
			if (zs4.is.string(icon)){MEANING.icon(icon);}
			MEANING.bold(true);
		}

		MEANING.addBit('bold');
		MEANING.bold = function(b){
			if (b==null)return MEANING.bits.bold.get();
			if (b==true) MEANING.bits.bold.true();
			else if (b==false) MEANING.bits.bold.false();

			if (MEANING.bold())MEANING.element.style.fontWeight = 'bold';
			else MEANING.element.style.fontWeight = 'initial';

			return MEANING.bits.bold.get();
		};
		MEANING.meaning = function(m){
			if (m==null)return meaning;
			meaning = m;
			MEANING.object = zs4.meaning.find(meaning);
			MEANING.refresh();
		}

		MEANING.refresh = (function(){
				var trans = zs4.meaning.find(meaning);
				if (trans == null) {
					MEANING.text = meaning;
				}
				else if (trans.hasOwnProperty(MEANING.ulang)){
					MEANING.text = trans[MEANING.ulang];
				}
				else if (trans.hasOwnProperty('en')){
					MEANING.text = trans.en;
				}
				else {
					MEANING.text = meaning;
				}
				MEANING.element.textContent = MEANING.text;

				if (MEANING.eLang)MEANING.eLang.value(MEANING.ulang);
		}).bind(MEANING);

		MEANING.tran = null;
		MEANING.shotran = null;

		var uscope = UI.userScope();
		if (uscope==null){
			MEANING.onclick = function(e){
				if (MEANING.hasEventHandler('click')){
					MEANING.trigger('click');
					return false;
				}
				console.log(e);
				return true;
			};
			display.onclick = MEANING.onclick;
		}
		else {
			MEANING.shotran = false;
			var ready = false;
			var lang; var text; var upload; var result;

			var tran = MEANING.tran = document.createElement('div');
			tran.style.display = 'none';
			div.appendChild(tran);
			function busy(){
				//MEANING.top.style.backgroundColor = 'blue';
				MEANING.top.style.backgroundImage = 'url("/gfx/icons/upload.svg")';
				MEANING.top.style.backgroundRepeat = 'no-repeat';
				MEANING.top.style.backgroundPosition = 'right';
			}
			function idle(){
				//MEANING.tran.style.backgroundColor = 'initial';
				MEANING.top.style.backgroundImage = 'initial';
			}

			MEANING.onclick = function(e){
				if (!MEANING.bits.noctrlclick.get()){
					if (!e.ctrlKey && !e.altKey){
						if (MEANING.hasEventHandler('click')){
							MEANING.trigger('click');
							return false;
						}
						return true;
					}
				}
				console.log(e);

				if (!ready){
					lang = MEANING.eLang = new UI.elementLanguage(tran);

					text = document.createElement('input');
					text.type = 'text';
					tran.appendChild(text);
					upload = UI.addIconImage(tran,'upload');
					result = document.createElement('div');
					result.style.display = 'none';
					tran.appendChild(result);

					if (!MEANING.bits.nolinktranslator.get()){
						var more = document.createElement('div');
						tran.appendChild(more);
						var link = new UI.elementLink(more,'/zs4.app.translator','Translator App');
					}

					upload.onclick = text.onchange = function(e){
						result.textContent = '';
						result.style.display = 'none';
						result.style.backgroundColor = 'initial';

						busy();
						zs4.THIS.zs4.language.translate._.call({
							meaning:meaning,
							lang:lang.value(),
							translation:text.value,
						},
						function(r){
							var t = zs4.path.resolve(r.request.callback,'zs4.language.translate');
							if (t != null){
								if (zs4.is.object(t.error)){
									result.textContent = t.error.text;
									result.style.backgroundColor = 'red';
									result.style.display = 'block';
								}
								else {
									var trans = zs4.meaning.find(meaning);
									if (trans != null){
										trans[lang.value()] = text.value;
										UI.refreshAllMeanings();
									}
									result.textContent = 'done!';
									result.style.backgroundColor = 'green';
									result.style.display = 'block';
								}
							}
							console.log(r);
							idle();
						});

						return false;
					};
					ready = true;
				}

				if (MEANING.shotran){
					MEANING.shotran = false;
					tran.style.display = 'none';
					MEANING.top.style.backgroundColor = 'initial';
				}
				else {
					MEANING.shotran = true;
					tran.style.display = 'initial';
					MEANING.top.style.backgroundColor = 'gray';

					for (var i = 0 ; i < UI.meaning.length; i++){
						var mean = UI.meaning[i];
						if (mean != MEANING && mean.tran != null){
							mean.tran.style.display = 'none';
							mean.top.style.backgroundColor = 'initial';
							mean.shotran = false;
						}
						else {
							mean.top.style.backgroundColor = 'gray';
						}
						mean.refresh();
					}
				}
				return false;
			};
			display.onclick = MEANING.onclick;
		}

		pe.appendChild(div);
		MEANING.show();
		MEANING.refresh();
	},
	toolElement:function(pe,icon){
		var TOOL = this;
		UI.element.call(TOOL,'block');

		var div = TOOL.top = document.createElement('div');
		zs4.style.type.toolbubble(div);
		zs4.style.type.bgimage(div,'/gfx/icons/'+icon+'.svg');

		var header = TOOL.header = document.createElement('div');
		zs4.style.type.toolheader(header);
		div.appendChild(header);

		UI.addIconElement(header,icon);
		UI.addSpace(header);
		var title = new UI.elementMeaning(header,icon);
		title.bold(true);
		title.pointer('pointer');

		var items = document.createElement('div');
		zs4.style.type.tooldetail(items);
		items.style.display = 'none';
		items.style.paddingLeft = '1em';
		//items.style.width = '90%';
		div.appendChild(items);
		TOOL.element = items;

		var showing = false;
		TOOL.expand = function(){
			showing = true;
			items.style.display = 'block';
		}
		TOOL.collapse = function(){
			showing = false;
			items.style.display = 'none';
		}

		header.onclick = function(){
			if (TOOL.hasEventHandler('click')){
				TOOL.trigger('click');
			}
			else {
				if (!showing) TOOL.expand();
				else TOOL.collapse();
			}
		};

		pe.appendChild(div);
	},
	toolLink:function(pe,icon,text,f){
		var LINK = this;
		if (icon==null)icon='link';

		UI.toolElement.call(LINK,pe,'link');
		UI.addSpace(LINK.header);
		var link = new UI.elementLink(LINK.header);
		LINK.element = link.element;
		var icon = UI.addIconElement(link.element,icon);
		UI.addSpace(link.element);
		var text = new UI.elementMeaning(link.element,text);
		text.pointer('pointer');
		LINK.on('click',f);
	},
	elementItem:function(pe,obj){
		var ITEM = this;
		UI.element.call(ITEM,'block');

		ITEM.value = obj;
		ITEM.top = document.createElement('div');
		ITEM.top.onclick = function(){ITEM.trigger('click');}

		var selected = ITEM.icon = new UI.inputBoolean(ITEM.top);

		var inline = new UI.inline(ITEM.top)
		ITEM.element = inline.element;

		pe.appendChild(ITEM.top);
		ITEM.show();
	},
	toolSelect:function(pe,icon){
		var SELECT = this;
		UI.toolElement.call(SELECT,pe,icon);
		var eHead = SELECT.header;
		var a = new Array();
		var value = null;
		SELECT.addBit('multiple');
		var colon = UI.addTextSpan(eHead,': ');
		colon.style.fontWeight = 'bold';

		//UI.addSpace(eHead);
		//SELECT.itemtype = new UI.elementMeaning(eHead,icon);
		//SELECT.itemtype.bold(true);
		//SELECT.itemtype.pointer('pointer');

		UI.addSpace(eHead);
		UI.addIconElement(eHead,'select');
		UI.addSpace(eHead);
		SELECT.title = new UI.elementMeaning(eHead,icon);
		SELECT.title.bold(true);
		SELECT.title.pointer('pointer');
		UI.addSpace(eHead);

		SELECT.header = new UI.inline(eHead).element;
		SELECT.tool = new UI.div(SELECT.element).element;
		SELECT.tool.style.backgroundColor = zs4.style.colorToolTitlebarBackground.css();
		SELECT.items = new UI.div(SELECT.element).element;
		SELECT.item = function(obj){
			var ITEM = this;
			UI.elementItem.call(this,SELECT.items,obj);
			if (!SELECT.bits.multiple.get()){
				ITEM.icon.imageFalse('empty');
			}
			else {

			}
			ITEM.search = '';
			ITEM.refresh = function(){
				if (!SELECT.bits.multiple.get()){
					if (value == ITEM.value){
						ITEM.icon.value(true);
					}
					else {
						ITEM.icon.value(false);
					}
				}
				else {

				}
			};
			ITEM.on('click',function(){
				if (!SELECT.bits.multiple.get()){
					SELECT.collapse();
				}
				if (value != ITEM.value){
					value = ITEM.value;
					SELECT.trigger('change');
				}
			});
			a.push(ITEM);
		};

		SELECT.forAllOptions = function(f){
			if (!zs4.is.function())return 0;
			for (var i = 0 ; i < a.length; i++){
				f(a[i]);
			}
			return a.length;
		}

		function sortDefault(a,b){
			if (zs4.is.string(a.search)&&zs4.is.string(b.search)){
				return a.search.localeCompare(b.search);
			}
			if (zs4.is.string(a.value)){
				return a.value.localeCompare(b.value);
			}
		}
		var sortFunction = sortDefault;
		function searchDefault(a){
			var string = '';
			if (zs4.is.string(a.value)){
				if (string.length > 0)string += ' ';
				string += a.value;
			}
			if (zs4.is.string(a.search)){
				if (string.length > 0)string += ' ';
				string += a.search;
			}

			return zs4.string.search(string,SELECT.searchstr.value);
		}
		var searchFunction = searchDefault;

		function refresh(){
			for (var i = 0 ; i < a.length; i++){
				var ITEM = a[i];
				ITEM.refresh();
				if (searchFunction(ITEM)){
					ITEM.top.style.display = 'block';
				}
				else {
					ITEM.top.style.display = 'none';
				}
			}
			a.sort(function(a,b){
				if (SELECT.sortswitch.value()){
					return -sortFunction(a,b);
				}
				else {
					return sortFunction(a,b);
				}
				sortFunction
			});
			for (var i = 0 ; i < (a.length-1) ; i++){
				var ITEM = a[i];
				SELECT.items.removeChild(ITEM.top);
				SELECT.items.insertBefore(ITEM.top,SELECT.items.childNodes[i]);
			}
		}

		SELECT.searchtool = new UI.div(SELECT.tool).element;
		UI.addIconElement(SELECT.searchtool,'search');
		UI.addSpace(SELECT.searchtool);
		new UI.elementMeaning(SELECT.searchtool,'search');
		SELECT.searchstr = document.createElement('input');
		SELECT.searchstr.type = 'text';
		SELECT.searchstr.oninput = refresh;
		SELECT.searchtool.appendChild(SELECT.searchstr);

		SELECT.sorttool = new UI.div(SELECT.tool).element;
		UI.addIconElement(SELECT.sorttool,'sort');
		UI.addSpace(SELECT.sorttool);
		new UI.elementMeaning(SELECT.sorttool,'sort');

		SELECT.sortswitch = new UI.inputBoolean(SELECT.sorttool);
		SELECT.sortswitch.imageFalse('down');
		SELECT.sortswitch.imageTrue('up');
		SELECT.sortswitch.on('change',refresh);

		SELECT.value = function(v){
			if (v==null)return value;
			value = v;
			refresh();
		};
		SELECT.on('change',refresh);
	},
	toolSelectUiLanguage:function(pe){
		var LANG = this;
		UI.toolSelect.call(LANG,pe,'language');

		function refreshItem(ITEM){
			ITEM.search = '';
			function add(s){if (ITEM.search!='')ITEM.search+=' '; ITEM.search+=s;}
			var m = zs4.meaning.find(ITEM.value);
			for (var n in m){
				if (zs4.is.string(m[n]))add(m[n]);
			}
			add(ITEM.value);
		}

		function language(lang){
			var ITEM = this;
			LANG.item.call(this,lang);

			UI.addSpace(ITEM.element);
			UI.addTextSpan(ITEM.element,'('+lang+')');
			UI.addSpace(ITEM.element);
			LANG.meaning = new UI.elementMeaning(ITEM.element,lang);
			LANG.meaning.pointer('pointer');
			refreshItem(ITEM);
		}

		for (var i = 0 ; i < zs4.lang.length; i++){
			new language(zs4.lang[i]);
		}

		LANG.refresh = function(){
			LANG.title.meaning(LANG.value());
			LANG.forAllOptions(refreshItem);
		};

		function onchange(){
			UI.setUILanguage(LANG.value(),function(){
				LANG.refresh();
			});
		};

		LANG.value(zs4.userLanguage());
		LANG.on('change',onchange);
		LANG.refresh();
	},
	toolLinkScope:function(pe,scope,f){
		var LINK = this;
		UI.toolElement.call(LINK,pe,'link');

		UI.addSpace(LINK.header);
		var link = new UI.elementLink(LINK.header);
		LINK.element = link.element;

		if (zs4.is.type(scope)){
			var si = 'home';
			var st = 'navhome';
			if (scope._.path==''){
				var icon = UI.addIconElement(link.element,si);
				UI.addSpace(link.element);
				var title = new UI.elementMeaning(link.element,st);
				title.pointer('pointer');
			}
			else {
				si = scope.zs4.head.typename._.value;
				st = scope.zs4.head.title._.value;

				var notitle = false;
				if (st.trim() == '') {
					notitle = true;
					st='notitle';
					UI.addTextSpan(link.element,'(');
				}
				var icon = UI.addIconElement(link.element,'link');
				if (notitle) {
					UI.addTextSpan(link.element,')');
				}
				UI.addSpace(link.element);
				var mean = new UI.elementMeaning(link.element,si);
				mean.pointer('pointer');
				UI.addSpace(link.element);
				var icon = UI.addIconElement(link.element,si);
				UI.addSpace(link.element);
				var title = new UI.elementMeaning(link.element,st);
				title.pointer('pointer');
			}

			LINK.on('click',f);
		}
	},
	loginElement:function(pe){
		var LOGIN = this;
		if (!zs4.THIS._.loggedIn){
			UI.toolElement.call(LOGIN,pe,'login');
			this.loginform = document.createElement('form');
			this.loginform.onsubmit = function(){return false;};
			this.loginform.id = 'login';
			this.loginform.autocomplete = 'on';
			LOGIN.appendElement(this.loginform);

			this.email = document.createElement('zs4-login-email');
			this.loginform.appendChild(this.email);

			new UI.elementMeaning(this.email,'email');

			this.emailAddress = document.createElement('input');
			//this.emailAddress.autocomplete = 'username';
			UI.addAttribute(this.emailAddress,'autocomplete','username');
			this.emailAddress.type = 'text';
			this.email.appendChild(this.emailAddress);
			UI.addClass(this.emailAddress,'login-email');

			this.password = document.createElement('zs4-login-password');
			this.loginform.appendChild(this.password);

			new UI.elementMeaning(this.password,'password');

			this.pass = document.createElement('input');
			this.pass.autocomplete = 'username';
			this.pass.type = 'password';
			this.password.appendChild(this.pass);
			UI.addClass(this.pass,'login-password');

			this.failcount = 0;

			var etok = new UI.div(LOGIN.element);
			etok.hide();

			var emailtoken = new UI.elementMeaning(etok.element,'emailtok');
			emailtoken.top.style.fontSize = '0.5em';
			emailtoken.button('email');
			function tokerr(){
				emailtoken.element.style.backgroundColor = 'red';
			}
			function tokok(){
				emailtoken.element.style.backgroundColor = zs4.style.colorButtonBackground.css();
			}

			var emailresponse = new UI.div(etok.element);
			emailresponse.element.style.backgroundColor = 'lightblue';
			emailresponse.element.style.borderRadius = '0.3em';
			emailresponse.hide();

			emailtoken.on('click',(function(){
				if (!zs4.is.email(LOGIN.emailAddress.value)){
					UI.addClass(LOGIN.emailAddress,'error');
					return;
				}
				else {
					UI.removeClass(LOGIN.emailAddress,'error');
				}
				UI.removeClass(this.pass,'error');

				zs4.style.type.bgimage(LOGIN.element,'/gfx/icons/email.svg');
				zs4.THIS.zs4.hi._.call({email:this.emailAddress.value,sendtoken:true,},function(){
					zs4.style.type.bgimage(LOGIN.element);

					console.log(zs4.THIS.zs4.hi._.cberror);
					console.log(zs4.THIS.zs4.hi._.cbresult);
					if (zs4.THIS.zs4.hi._.cbresult != null){
						//window.alert('token sent');
						UI.removeClass(LOGIN.emailAddress,'error');
						UI.removeClass(LOGIN.pass,'error');
						tokok();
						//UI.removeClass(LOGIN.emailtoken,'error');

						emailresponse.element.textContent = zs4.THIS.zs4.hi._.cbresult;
						emailresponse.show();
						UI.addClass(LOGIN.emailtoken,'nodisplay');
						//UI.removeClass(LOGIN.emailresponse,'nodisplay');
						UI.removeClass(LOGIN.hi,'nodisplay');
						LOGIN.failcount = 0;
						LOGIN.refresh();
					}
					else {
						tokerr();
						//UI.addClass(emailtoken.element,'error');
					}

				});

			}).bind(LOGIN));

			var hi = new UI.elementMeaning(LOGIN.element,'login');
			hi.button('login');
			hi.on('click',(function(){
				var error = false;
				if (!zs4.is.email(this.emailAddress.value)){
					UI.addClass(LOGIN.emailAddress,'error');
					error = true;
				}
				else {
					UI.removeClass(LOGIN.emailAddress,'error');
				}
				if (!zs4.is.password(this.pass.value)){
					UI.addClass(this.pass,'error');
					error = true;
				}
				else {
					UI.removeClass(this.pass,'error');
				}
				if (error)return;

				hi.bgimage('transferring');
				zs4.post(zs4.THIS.zs4.hi._.wrapRequest({email:this.emailAddress.value,password:this.pass.value,}),function(ret){
					if (zs4.THIS.zs4.hi._.cberror != null){
						UI.addClass(LOGIN.emailAddress,'error');
						UI.addClass(LOGIN.pass,'error');
						LOGIN.failcount++;
						LOGIN.refresh();
					}
					console.log('LOGIN.failcount: '+LOGIN.failcount);

					hi.bgimage();
				});
			}).bind(this))

			LOGIN.refresh = function(){
				if (LOGIN.failcount > 2){
					etok.show();
					//UI.removeClass(this.etok,'nodisplay');
				}
			};
		}
	},
	socialLoginElement:function(pe){
		var LOGIN = this;
		if (!zs4.THIS._.loggedIn){
			UI.toolElement.call(LOGIN,pe,'social');

			console.log('LOGIN OPTIONS:');
			this.pp = new Object();
			this.pp.e = document.createElement('div');
			LOGIN.appendElement(this.pp.e);
			var pp = zs4.THIS.zs4.passport;
			for (var n in pp){
				if (!zs4.is.type(pp[n]))continue;
				var provider = this.pp[n] = new Object();
				provider.e = document.createElement('div');
				provider.e.style.cursor = 'pointer';
				//provider.e.style.display = 'block';
				this.pp.e.appendChild(provider.e);

				UI.addIconElement(provider.e,n);
				UI.addSpace(provider.e);
				UI.addTextSpan(provider.e,n);

				provider.e.onclick = function(){zs4.navigate('/zs4.passport.'+n+'.login');}
				console.log('  - '+n);
			}
		}
	},
	logoutElement:function(pe){
		var LOGOUT = this;
		if (zs4.THIS._.loggedIn){
			UI.toolElement.call(LOGOUT,pe,'logout');
			// LOGOUT pane
			///////////////////////////////////////////////////////////
			///////////////////////////////////////////////////////////
			var ulang = zs4.userLanguage();

			var e = LOGOUT.element;

			var sureDiv = new UI.div(e);
			var sureText = new UI.elementMeaning(sureDiv.element,'areyousure');

			UI.addSpace(sureDiv.element);
			var sure = new UI.inputBoolean(sureDiv.element,false);

			var bye = new UI.elementMeaning(e,'logout');
			bye.button('logout');
			bye.hide();

			sure.on('change',(function(){
				if (sure.value())bye.show();
				else bye.hide();
			}).bind(this));

			bye.on('click',(function(){
				zs4.style.type.bgimage(bye.top,'logout');
				zs4.THIS.zs4.bye._.call({sure:true},function(ret){
					zs4.style.type.bgimage(bye.top);
				});
			}).bind(this));

		}
	},
	setPassWordElement:function(pe){
		var LOGIN = this;

		if (!zs4.THIS._.loggedIn)return;

		var ulang = zs4.userLanguage();

		var uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
		if (uscope==null)return;
		var password = uscope._.resolvePath('zs4.password');
		if (password==null)return;
		var set = uscope._.resolvePath('zs4.password.set');
		if (set==null)return;
		var vfy = uscope._.resolvePath('zs4.password.vfy');

		if (uscope == null || set==null)return;

		if (uscope != null){
			UI.toolElement.call(LOGIN,pe,'password');
			this.spwIsOpen = false;

			var setpassword = document.createElement('form');
			setpassword.onsubmit = function(){return false;};
			setpassword.id = 'cpwd';
			LOGIN.appendElement(setpassword);

			// OLD PASSWORD 1
			var vfy0 = new UI.div(setpassword);
			new UI.elementMeaning(vfy0.element,'oldpassword');
			UI.addTextSpan(vfy0.element,': ');
			this.vfy0input = document.createElement('input');
			UI.addAttribute(this.vfy0input,'autocomplete','current-password');
			this.vfy0input.type = 'password';
			this.vfy0input.oninput = function(){LOGIN.validate();}
			vfy0.element.appendChild(this.vfy0input);

			// OLD PASSWORD 2
			var new0 = new UI.div(setpassword);
			new UI.elementMeaning(new0.element,'newpassword');
			UI.addTextSpan(new0.element,': ');
			this.new0input = document.createElement('input');
			UI.addAttribute(this.new0input,'autocomplete','current-password');
			this.new0input.type = 'password';
			this.new0input.oninput = function(){LOGIN.validate();}
			new0.element.appendChild(this.new0input);

			// NEW PASSWORD
			var setpwd = new UI.div(setpassword);
			new UI.elementMeaning(setpwd.element,'newpassword');
			UI.addTextSpan(setpwd.element,': ');
			this.setpwdinput = document.createElement('input');
			UI.addAttribute(this.setpwdinput,'autocomplete','new-password');
			this.setpwdinput.type = 'password';
			this.setpwdinput.oninput = function(){LOGIN.validate();}
			setpwd.element.appendChild(this.setpwdinput);

			// SEND BUtTON
			var butdiv = document.createElement('div');
			setpassword.appendChild(butdiv);
			var button = new UI.elementMeaning(butdiv,'save');
			button.button('save');

			var senderr = new UI.elementMeaning(butdiv,'senderr');
			senderr.element.style.color = 'red';
			senderr.hide();

			LOGIN.validate = function(){
				vfy0.color('initial');
				new0.color('initial');
				setpwd.color('initial');

				var wrong = false;
				if (vfy!=null){
					if (!zs4.is.password(this.vfy0input.value)){
						vfy0.color('red');
						senderr.meaning('zenotapwd');
						wrong = true;
					}
					if (!wrong && !zs4.is.password(this.new0input.value)){
						new0.color('red');
						senderr.meaning('zenotapwd');
						wrong = true;
					}
					if (!wrong && this.setpwdinput.value!=this.new0input.value){
						new0.color('red');
						setpwd.color('red');
						senderr.meaning('zepwdmissmatch');
						wrong = true;
					}
				}
				if (!wrong && !zs4.is.password(this.setpwdinput.value)){
					setpwd.color('red');
					senderr.meaning('zenotapwd');
					wrong = true;
				}
				if (wrong){
					button.hide();
					senderr.show();
					return false;
				}
				else {
					senderr.meaning('nomeaning');
					button.show();
					senderr.hide();
					return true;
				}

			}

			button.on('click',(function(){
				if (!LOGIN.validate())return;

				var input = new Object({set:this.setpwdinput.value,})
				if (vfy!=null){
					input.vfy = this.vfy0input.value;
				}

				vfy0.color('initial');
				new0.color('initial');
				setpwd.color('initial');

				zs4.style.type.bgimage(setpassword,'/gfx/icons/upload.svg');
				zs4.post(password._.wrapRequest(input),function(ret){
					zs4.style.type.bgimage(setpassword);
					var callback = zs4.path.resolve(ret,'request.callback.'+password._.path);
					console.log(callback);
					if (zs4.is.error(callback)){
						vfy0.color('red');
						new0.color('red');
						setpwd.color('red');

						senderr.meaning(callback.error.text);
						senderr.show();
						zs4.debug(callback.error.text);
					}

					LOGIN.refresh();
				});


			}).bind(LOGIN));

			LOGIN.refresh = function(){
				if (set!=null){
					if (vfy==null){
						UI.addClass(LOGIN.vfy0,'nodisplay');
						UI.addClass(LOGIN.new0,'nodisplay');
					}
					else {
						UI.removeClass(LOGIN.vfy0,'nodisplay');
						UI.removeClass(LOGIN.new0,'nodisplay');
					}
					UI.removeClass(LOGIN.setpwd,'nodisplay');
				}
				else {
					UI.addClass(LOGIN.setpwd,'nodisplay');
				}
			};
			LOGIN.refresh();

		}
	},
	loginoutElement:function(pe){
		var LOGIN = this;

		this.loggedIn = zs4.THIS._.loggedIn;

		var utitle = '';
		var uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);

		//var home = new UI.toolLink(pe,'home','navhome',function(){zs4.navigate('/')})
		var home = new UI.toolLinkScope(pe,zs4.THIS,function(){zs4.navigate('/');});

		if (uscope!=null){
			if (zs4.THIS._.scopath==''){uitle = 'root';}
			else if (uscope.zs4.head.title._.value.trim()==''){utitle = zs4.THIS._.scopath;}
			else {utitle = uscope.zs4.head.title._.value;}

			if (zs4.THIS._.scopath!='') {
				new UI.toolLinkScope(pe,uscope,function(){zs4.navigate('/'+zs4.THIS._.scopath);});
			}
			new UI.toolSelectUiLanguage(pe);
			new UI.setPassWordElement(pe);
			new UI.logoutElement(pe);
		}
		else {
			new UI.loginElement(pe);
			new UI.socialLoginElement(pe);
		}

	},
	bowserElement:function(pe){
		var BOWSER = this;

		UI.toolElement.call(BOWSER,pe,'browser');

		var browser = 'browser';
		if (zs4.string.search(bowser.name,'Firefox'))browser = 'firefox';
		else if (zs4.string.search(bowser.name,'Chrome'))browser = 'chrome';
		else if (zs4.string.search(bowser.name,'Safari'))browser = 'safari';
		else if (zs4.string.search(bowser.name,'Edge'))browser = 'edge';

		if (browser != 'browser'){
			UI.addSpace(BOWSER.header);
			UI.addIconElement(BOWSER.header,browser);
		}


		var e = BOWSER.element;

		function addDeviceItem(name,value){
			var item = document.createElement('zs4-app-device-info-item');
			e.appendChild(item);

			var nameEle = document.createElement('zs4-app-device-info-name');
			nameEle.textContent = name;
			item.appendChild(nameEle);

			var valueEle = document.createElement('zs4-app-device-info-value');
			valueEle.textContent = value.toString();
			item.appendChild(valueEle);
		}

		var titles = new Array();
		function addBowserFlag(title,flag){
			if(zs4.string.array.is.element(titles,title))return false;

			if (zs4.is.boolean(bowser[flag])&&bowser[flag]==true){
				titles.push(title);
				addDeviceItem(title,flag);
				return true;
			}
			return false;
		}

		{
			addDeviceItem('browser',bowser.name);
			addDeviceItem('version',bowser.version);

			addBowserFlag('type','mobile');
			addBowserFlag('type','tablet');

			addBowserFlag('renderer','webkit');
			addBowserFlag('renderer','blink');
			addBowserFlag('renderer','gecko');
			addBowserFlag('renderer','msie');
			addBowserFlag('renderer','msedge');

			addBowserFlag('os','mac');
			addBowserFlag('os','windows');
			addBowserFlag('os','windowsphone');
			addBowserFlag('os','linux');
			addBowserFlag('os','chromeos');
			addBowserFlag('os','android');
			addBowserFlag('os','ios');
			addBowserFlag('os','blackberry');
			addBowserFlag('os','firefoxos');
			addBowserFlag('os','webos');
			addBowserFlag('os','bada');
			addBowserFlag('os','tizen');
			addBowserFlag('os','sailfish');

			addBowserFlag('ios','iphone');
			addBowserFlag('ios','ipad');
			addBowserFlag('ios','ipod');
		}
		if (bowser.osversion!=null)addBowserFlag('version',bowser.osversion);


		var hr = document.createElement('hr');
		e.appendChild(hr);

		addDeviceItem('appName',window.navigator.appName);
		addDeviceItem('appCodeName',window.navigator.appCodeName);
		addDeviceItem('product',window.navigator.product);
		addDeviceItem('platform',window.navigator.platform);

		hr = document.createElement('hr');
		e.appendChild(hr);

		addDeviceItem('screen',window.screen.width + 'x'+window.screen.height);

	},
	bitsElement:function(pe,bits){
		UI.element.call(this);
		var BITS = this;
		var a = new Array();
		var e = BITS.top = BITS.element = document.createElement('zs4-input-bits');
		e.style.display = 'inline-block';
		e.style.paddingLeft = '1em';
		//zs4.style.type.toolbubble(e);

		function bit(n){
			var BIT = this;
			var name = n.trim();

			BIT.meaning = new UI.elementMeaning(e,name);

			var b = BIT.meaning.element;
			//b.style.display='inline';
			b.style.marginLeft='0.25em';
			b.style.marginRight='0.25em';
			b.style.paddingLeft='0.25em';
			b.style.paddingRight='0.25em';
			b.style.border='0.05em solid black';
			b.style.borderRadius = '0.5em';

			//b.textContent = name;
			b.onclick = function(e){
				if (e.ctrlKey || e.altKey){
					if (zs4.is.function(BIT.meaning.element.onclick)){
						BIT.meaning.onclick(e);
					}
					return true;
				}

				if (bits[name].get()){
					bits[name].false();
					b.style.backgroundColor='initial';
				}
				else {
					bits[name].true();
					b.style.backgroundColor='gray';
				}
				BITS.trigger('change');
				return false;
			}

			BIT.refresh = function(){
				if (bits[name].get()){
					b.style.backgroundColor='gray';
				}
				else {
					b.style.backgroundColor='initial';
				}
			};

			a.push(BIT)
			//e.appendChild(b);
			UI.addTextSpan(e,' ');
		}

		for (var n in bits)if(zs4.is.object(bits[n])&&zs4.is.number(bits[n].m)){
			new bit(' '+n+' ');
		}

		BITS.refresh = function(){
			for (var i = 0; i < a.length; i++){
				a[i].refresh();
			}
		};
		BITS.refresh();

		pe.appendChild(e);
	},
	sliderElement:function(pe,hori,vert){
		UI.element.call(this);

		const BOUNDARY_DIVISOR = 10;
		const INCREMENT_SMALL = 0.01;
		const INCREMENT_BIG = 0.1;
		const SLIDERBACKGROUNDCOLOR = new zs4.color({r:.2,g:.2,b:.2,a:.2});
		const KNOBCOLOR = new zs4.color({r:.1,g:.1,b:0,a:.7});
		const KNOBBACKGROUNDCOLOR = new zs4.color({r:.8,g:.8,b:.8,a:.8});
		const TRACKCOLOR = new zs4.color({r:.4,g:.4,b:.4,a:.7});
		const VALUEBACKGROUNDCOLOR = new zs4.color({r:.6,g:.6,b:.6,a:.8});
		var v_value = 0.0;
		var h_value = 0.0;

		function sliderBits(){
			var SLIDERBITS = this;
			zs4.util.bits.call(this);
			SLIDERBITS.addBit('drawtrack',0);
			SLIDERBITS.drawtrack.true();
			SLIDERBITS.addBit('drawvalue',1);
			SLIDERBITS.drawvalue.true();
			SLIDERBITS.addBit('disabled',2);
		};

		var SLIDER = this;
		var bits = new sliderBits();

		var horizontal = true;
		if (hori==false)horizontal = false;
		var vertical = false;
		if (vert==true)vertical = true;
		if (!vertical && !horizontal) horizontal=true;

		var e = document.createElement('table');
		e.style.display = 'inline-block';
		e.style.backgroundColor = SLIDERBACKGROUNDCOLOR.css();
		e.style.fontSize = '0.5em';
		zs4.style.type.valueplain(e);

		var u; var d; var l; var r; var k;

		function drawUp(){
			var ctx = ctx = u.getContext("2d");
			var w = u.width;
			var h = u.height;

			ctx.beginPath();
			ctx.moveTo(w/2,0);
			ctx.lineTo(0,h);
			ctx.lineTo(w,h);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};
		function drawLeft(){
			var ctx = ctx = l.getContext("2d");
			var w = l.width;
			var h = l.height;

			ctx.beginPath();
			ctx.moveTo(0,h/2);
			ctx.lineTo(w,0);
			ctx.lineTo(w,h);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};
		function drawKnob(){
			var ctx = ctx = k.getContext("2d");
			var w = k.width;
			var h = k.height;

			ctx.clearRect(0,0,w,h);

			var kw = w; var kh = h; var kl = 0; var kt = 0;
			if (horizontal){
				kw = w/BOUNDARY_DIVISOR;
				kl = (w-kw) * h_value;
			}
			else {
				kw = w;
				kl = 0;
			}
			if (vertical){
				kh = h/BOUNDARY_DIVISOR;
				kt = (h-kh) * (1-v_value);
			}
			else {
				kh = h;
				kt = 0;
			}

			if (bits.drawvalue.get()){
				ctx.fillStyle = VALUEBACKGROUNDCOLOR.css();
				var left = kw/2;
				var top = kt+(kh*5/8);
				var width = kl+(kw*3/8)-left;
				var height = h - top - (kh/2);
				if (horizontal && vertical){
					ctx.fillRect(left,top,width,height);
				}
				else if (horizontal){
					ctx.fillRect(0,0,kl+(kw*3/8),h);
				}
				else {
					ctx.fillRect(0,top,w,height+(kh/2));
				}
			}
			if (bits.drawtrack.get()){
				ctx.fillStyle = TRACKCOLOR.css();
				if (horizontal){
					ctx.fillRect(kw/2,kt+(kh*3/8),w-kw,kh/4);
				}
				if (vertical){
					ctx.fillRect(kl+(kw*3/8),kh/2,kw/4,h-kh);
				}
			}

			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fillRect(kl,kt,kw,kh);
		};
		function drawRight(){
			var ctx = ctx = r.getContext("2d");
			var w = r.width;
			var h = r.height;

			ctx.beginPath();
			ctx.moveTo(w,h/2);
			ctx.lineTo(0,0);
			ctx.lineTo(0,h);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};
		function drawDown(){
			var ctx = ctx = d.getContext("2d");
			var w = d.width;
			var h = d.height;

			ctx.beginPath();
			ctx.moveTo(w/2,h);
			ctx.lineTo(0,0);
			ctx.lineTo(w,0);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};

		function redraw(){
			if (horizontal){
				drawLeft();
				drawRight();
			}
			if (vertical){
				drawUp();
				drawDown();
			}
			drawKnob();
		}
		// top row;
		if (vertical){
			var tru = document.createElement('tr');
			zs4.style.type.boxplain(tru);
			e.appendChild(tru);

			if (horizontal){
				var td = document.createElement('td');
				zs4.style.type.boxplain(td);
				tru.appendChild(td);
			}
			tdu = document.createElement('td');
			zs4.style.type.boxplain(tdu);
			tru.appendChild(tdu);

			u = document.createElement('canvas');
			u.style.height = '1em';
			tdu.appendChild(u);
			u.onclick = function(){SLIDER.vertical.value(v_value+INCREMENT_BIG);SLIDER.trigger('change');}
			//u.ondblclick = function(){SLIDER.vertical.value(v_value+INCREMENT_BIG);SLIDER.trigger('change');}

			if (horizontal){
				u.style.width = '5em';

				var td = document.createElement('td');
				zs4.style.type.boxplain(td);
				tru.appendChild(td);
			}
			else {
				u.style.width = '1em';
			}

			drawUp();
		}

		// center row;
		var trk = document.createElement('tr');
		zs4.style.type.boxplain(trk);
		e.appendChild(trk);

		if (horizontal){
			var tdl = document.createElement('td');
			zs4.style.type.boxplain(tdl);
			trk.appendChild(tdl)

			l = document.createElement('canvas');
			l.style.width = '1em';
			l.onclick = function(){SLIDER.horizontal.value(h_value-INCREMENT_BIG);SLIDER.trigger('change');}
			//l.ondblclick = function(){SLIDER.horizontal.value(h_value-INCREMENT_BIG);SLIDER.trigger('change');}
			tdl.appendChild(l);
			if (vertical)l.style.height = '5em';
			else l.style.height = '1em';
			drawLeft();
		}
		tdk = document.createElement('td');
		zs4.style.type.boxplain(tdk);
		trk.appendChild(tdk);

		var k = document.createElement('canvas');
		k.style.backgroundColor = KNOBBACKGROUNDCOLOR.css();
		zs4.style.type.valueplain(k);
		tdk.appendChild(k);
		if (horizontal && vertical){
			k.style.width = k.style.height = '5em';
		}
		else if (horizontal){
			k.style.width = '5em';
			k.style.height = '1em';
		}
		else {
			k.style.width = '1em';
			k.style.height = '5em';
		}

		drawKnob();

		var liveUpdate = false;
		function updateValue(e){
			var eRect = k.getBoundingClientRect();
			//console.log(eRect,e);
			//console.log(e.offsetX,e.offsetY);

			if (horizontal){
				var w = eRect.width;
				var wLimit = w/BOUNDARY_DIVISOR;
				if (e.offsetX <= wLimit) h_value = 0;
				else if (e.offsetX >= (w-wLimit)) h_value = 1;
				else h_value = (e.offsetX-wLimit)/(w-(2*wLimit));
				//console.log(h_value);
			}
			if (vertical){
				var h = eRect.height;
				var hLimit = h/BOUNDARY_DIVISOR;
				if (e.offsetY <= hLimit) v_value = 1;
				else if (e.offsetY >= (h-hLimit)) v_value = 0;
				else {
					var offset = h-e.offsetY;
					v_value = ((h-e.offsetY)-hLimit)/(h-(2*hLimit));
				}

				//console.log("SLIDER.trigger('update');",v_value);
			}
			e.preventDefault();
			SLIDER.trigger('update');
			drawKnob();
		}
		function mouseMoved(e){
			//console.log('mouseMoved',e);
			if (liveUpdate)updateValue(e);

		}
		function mouseDown(e){
			var eRect = k.getBoundingClientRect();
			if (e.offsetX>0 && e.offsetY>0 && e.offsetX<eRect.width && e.offsetY<eRect.height){
				liveUpdate = true;
				e.target.addEventListener("mousemove", mouseMoved, false);
				updateValue(e);
			}
			//console.log('mouseDown',e);
		}
		function mouseUp(e){
			if (liveUpdate){
				updateValue(e);
				liveUpdate = false;
				SLIDER.trigger('change');
				e.target.removeEventListener("mousemove", mouseMoved, false);
			}
			//console.log('mouseUp',e);
		}
		k.addEventListener("mousedown", mouseDown, false);
		k.addEventListener("mouseleave", mouseUp, false);
		k.addEventListener("mouseup", mouseUp, false);


		if (horizontal){
			tdr = document.createElement('td');
			zs4.style.type.boxplain(tdr);
			trk.appendChild(tdr);

			r = document.createElement('canvas');
			r.style.width = '1em';
			r.onclick = function(){SLIDER.horizontal.value(h_value+INCREMENT_BIG);SLIDER.trigger('change');}
			//r.ondblclick = function(){SLIDER.horizontal.value(h_value+INCREMENT_BIG);SLIDER.trigger('change');}
			tdr.appendChild(r);
			if (vertical)r.style.height = '5em';
			else r.style.height = '1em';
			drawRight();
		}

		// bottom ROW

		if (vertical){
			var trd = document.createElement('tr');
			zs4.style.type.boxplain(trd);
			e.appendChild(trd);

			if (horizontal){
				var td = document.createElement('td')
				zs4.style.type.boxplain(td);
				trd.appendChild(td);
			}

			var tdd = document.createElement('td');
			zs4.style.type.boxplain(tdd);
			trd.appendChild(tdd);

			d = document.createElement('canvas');
			d.style.height = '1em';
			d.onclick = function(){SLIDER.vertical.value(v_value-INCREMENT_BIG);SLIDER.trigger('change');}
			//d.ondblclick = function(){SLIDER.vertical.value(v_value-INCREMENT_BIG);SLIDER.trigger('change');}
			tdd.appendChild(d);

			if (horizontal){
				d.style.width = '5em';

				var td = document.createElement('td')
				zs4.style.type.boxplain(td);
				trd.appendChild(td);
			}
			else {
				d.style.width = '1em';
			}
			drawDown();
		}


		// external interface
		if (horizontal){
			SLIDER.horizontal = new Object({
				value:function(v){
					if (v==null)return h_value;
					if (zs4.is.number(v)){
						if (v<0)v = 0;
						else if (v>1)v=1;
						h_value = v;
						drawKnob();
					}
				},

			});
		}
		if (vertical){
			SLIDER.vertical = new Object({
				value:function(v){
					if (v==null)return v_value;
					if (zs4.is.number(v)){
						if (v<0)v = 0;
						else if (v>1)v=1;
						v_value = v;
						drawKnob();
					}
				},

			});

		}
		if (!vertical || !horizontal){
			if (horizontal){
				SLIDER.value = SLIDER.horizontal.value;
			}
			else {
				SLIDER.value = SLIDER.vertical.value;
			}
		}

		function addBit(n){
			n = n.trim();
			SLIDER[n] = function(v){
				if (v==null)return bits[n].get();
				if (v==true){
					bits[n].true();
				}
				else if (v==false){
					bits[n].false();
				}
				redraw();
			};

		}

		for (var n in bits)if (zs4.is.object(bits[n])){
			addBit(' '+n+' ');
		}
		pe.appendChild(e);
	},

	unknown:function(po,o){
		if (!zs4.is.object(o._.html))o._.html = new Object();
		if (o._.input==null)o._.input = (function(){return null;}).bind(o);
		if (o._.response==null)o._.response = (function(r){console.log(r);}).bind(o);

		if (!zs4.is.boolean(o._.html.uninitialized))o._.html.uninitialized=true;
		else o._.html.uninitialized=false;

		if (o._.cleanup==null)o._.cleanup = (function(){
			//console.log(this._.path + '._.cleanup()');
			//console.log(o._.html.parentElement);
			//console.log(o._.html.e);
			if (o._.html.parentElement != null && o._.html.e != null){
				o._.html.parentElement.removeChild(o._.html.e);
				o._.html.parentElement = null;
				o._.html.e = null;
			}
		}).bind(o);

		if (o._.html.refreshAll==null){
			o._.html.refreshAll = function(){
				zs4.admin.rootObject._.localRefresh();
				zs4.admin.type.object(zs4.admin.rootElementParent,zs4.admin.rootObject);
			}
		}

		if (o._.html.icon == null){
			o._.html.icon = new Object({
				on:'minus',
				off:'plus',
			});
			if (o._.type != Object){
				if (o._.typename=='filecontent'){o._.html.icon.off=o._.html.icon.on='upload'}
				else if (o._.flags.get.required()){o._.html.icon.off=o._.html.icon.on='required'}
				else if (o._.flags.get.noset()){o._.html.icon.off=o._.html.icon.on='info'}
				else {o._.html.icon.off=o._.html.icon.on=o._.typename;}
			}
			else if (o._.flags.value & o._.flags.scope){
				if (o._.html.topElement){
					o._.html.icon.on = o.zs4.head.typename._.value;
					o._.html.icon.off = 'logo';
				}
				else if (zs4.string.startsWith(o._.path,'zs4.type.')){
					var a = zs4.string.split.words(o._.path);
					if (a.length == 5 && a[3]=='array'){
						o._.html.icon.on = a[2];
						o._.html.icon.off = a[2];
					}
					else {
						o._.html.icon.on = 'minus';
						o._.html.icon.off = o.zs4.head.typename._.value;
					}
				}
				else {
					o._.html.icon.on = 'minus';
					o._.html.icon.off = o.zs4.head.typename._.value;
				}
			}
			else {
				if (o._.flags.get.local()){
					o._.html.icon.off=o._.typename;
				}
				else {
					o._.html.icon.off=o._.name;
				}
				o._.html.icon.on='minus';
			}
		}

		if (o._.html.e==null){
			o._.html.e = document.createElement('zs4-'+o._.typename);
			UI.addClass(o._.html.e,'container');

			if (zs4.is.type(po)){
				po._.html.c.appendChild(o._.html.e);
				o._.html.parentElement = po._.html.c;
				UI.addClass(o._.html.e,'branch');
			}
			else {

				if (po==null)po=document.body;
				po.appendChild(o._.html.e);
				o._.html.parentElement = po;

				if (zs4.admin.rootElementParent==null)zs4.admin.rootElementParent = po;
				zs4.admin.rootObject = o;

				UI.addClass(o._.html.e,'top');
				o._.html.topElement=true;
				o._.html.top = new Object({value:{}});

				zs4.window.onresize.push(o._.html.refreshAll);
			}

			o._.html.genericRefresh = (function(){
				var add = '';
				var rem = '';

				function addrem(e){
					if (e==null)return;
					UI.addClass(e,add);
					UI.removeClass(e,rem);
				};
				//if (UI.am(o))add+=' am'; else rem+=' am';
				//if (UI.own(o))add+=' own'; else rem+=' own';


				if (o._.html.toolbarIsOpen){
					add+=' tbon'; rem+=' tboff';
					if (o._.html.expanded){
						UI.removeClass(o._.html.toolbarHeader,'nodisplay');
						UI.removeClass(o._.html.toolbar,'nodisplay');
						UI.setIcon(o._.html.toolbarToggle,'tool');
					}
					else if (o._.html.toolbar!=null){
						UI.addClass(o._.html.toolbarHeader,'nodisplay');
						UI.addClass(o._.html.toolbar,'nodisplay');
						UI.setIcon(o._.html.toolbarToggle,'tool');
					}
					if (o._.type==Object){
						if (o._.html.c != null)UI.addClass(o._.html.c,'nodisplay');
					}
					else {
						if (o._.html.input != null)UI.addClass(o._.html.input,'nodisplay');
					}
				}
				else{
					add+=' tboff';rem+=' tbon';
					if (o._.html.toolbar!=null){
						UI.addClass(o._.html.toolbarHeader,'nodisplay');
						UI.addClass(o._.html.toolbar,'nodisplay');
						UI.setIcon(o._.html.toolbarToggle,'tool');
					}
					if (o._.type==Object){
						if (o._.html.c != null)UI.addClass(o._.html.c,'nodisplay');
					}
					else {
						if (o._.html.input != null)UI.addClass(o._.html.input,'nodisplay');
					}
				}

				if (o._.html.expanded==true){
					add+=' on'; rem+=' off';
					if (o._.html.toolbarIsOpen){
						UI.setIcon(o._.html.toggle,'tostart');
					}
					else{
						if (o._.html.topElement)UI.setIcon(o._.html.toggle,'logo');
						else UI.setIcon(o._.html.toggle,o._.html.icon.on);
						if (o._.type==Object){
							if (o._.html.c != null)UI.removeClass(o._.html.c,'nodisplay');
						}
						else {
							if (o._.html.input != null)UI.removeClass(o._.html.input,'nodisplay');
						}
					}
					if (o._.html.toolbar != null){
						UI.removeClass(o._.html.toolbarToggle,'nodisplay');
					}
				}
				else{
					add+=' off';rem+=' on'
					UI.setIcon(o._.html.toggle,o._.html.icon.off);
					if (o._.html.toolbar != null){
						UI.addClass(o._.html.toolbarToggle,'nodisplay');
					}
				}

				if (o._.html.topElement==true){
					UI.setIcon(o._.html.toggle,'logo');
					var top = o._.html.top;
					add+=' top';
					if (o._.flags.get.authroot())add+=' root';else rem+=' root';
					var wtit = 'zs4';
					if (o.zs4.head.title._.value != '')wtit+= ':' + o.zs4.head.title._.value;
					if (top.value.utitle != '')wtit+=':'+top.value.utitle;
					if (document.title != wtit)document.title = wtit;

					if (o._.html.appIsOpen){
						if (o._.html.top.dialogActive)UI.setIcon(o._.html.toggle,'tostart');
						else UI.setIcon(o._.html.toggle,'logo');
						UI.removeClass(o._.html.dialogHeader,'nodisplay');
						UI.removeClass(o._.html.appElement,'nodisplay');
						UI.addClass(o._.html.c,'nodisplay');
						if (o._.html.toolbarToggle){
							UI.addClass(o._.html.toolbarToggle,'nodisplay');
						}
						if (zs4.is.object(top.app)){
							top.app.internalRefresh();
						}
					}
					else {
						UI.addClass(o._.html.dialogHeader,'nodisplay');
						UI.addClass(o._.html.appElement,'nodisplay');
						UI.removeClass(o._.html.c,'nodisplay');

					}
				}
				else {
					rem+=' top';

				}
				if (o._.name == 'zs4')add+=' settings';else rem+=' settings';
				if (o._.name == 'email')add+=' email';else rem+=' email';
				if (o._.name == 'rsa')add+=' rsa';else rem+=' rsa';

				if (o._.flags.get.api())add+=' api';else rem+=' api';
				if (o._.flags.get.scope())add+=' scope';else rem+=' scope';
				if (o._.flags.get.am())add+=' am';else rem+=' am';
				if (o._.flags.get.own())add+=' own';else rem+=' own';
				if (o._.flags.get.notrans())add+=' notrans';else rem+=' notrans';
				if (o._.flags.get.priced())add+=' priced';else rem+=' priced';

				if (window.innerWidth>window.innerHeight){add+=' landscape';rem+=' portrait'}
				else {add+=' portrait';rem+=' landscape'}

				if (o._.type == Object){
					add+=' object'; rem+=' value';
				}
				else {
					add+=' value'; rem+=' object';
					if (o._.typename=='filecontent'){
						if (o._.value=='') o._.html.icon.off=o._.html.icon.on='upload';
						else o._.html.icon.off=o._.html.icon.on='upload';
					}
					else if (o._.flags.get.required()){o._.html.icon.off=o._.html.icon.on='required'}
					else if (o._.flags.get.noset()){o._.html.icon.off=o._.html.icon.on='info'}
					else {o._.html.icon.off=o._.html.icon.on='none'}

					if (o._.html.input != null)UI.setClass(o._.html.input,'noset',o._.flags.get.noset());
				}


				addrem(o._.html.toolbar);
				addrem(o._.html.toolbarHeader);
				addrem(o._.html.toolbarContent);
				addrem(o._.html.toolbarTool);
				addrem(o._.html.toolbarToggle);
				addrem(o._.html.c);
				addrem(o._.html.input);
				addrem(o._.html.head);
				addrem(o._.html.toggle);
				addrem(o._.html.name);
				if (o._.html.topElement==true && o._.html.top.app){
					var top = o._.html.top;
					addrem(o._.html.dialogHeader);
					addrem(o._.html.appElement);
					addrem(o._.html.appWindow);
					addrem(o._.html.top.app.toolbar);
					addrem(o._.html.top.app.searchButton);
					addrem(o._.html.top.app.search);
					addrem(o._.html.top.app.content);
					for (var n in o._.html.dialog){
						addrem(o._.html.dialog[n].select)
						addrem(o._.html.dialog[n].pane)
						addrem(o._.html.dialog[n].toolbar)
					}
				}

				addrem(o._.html.e);

				UI.setClass(o._.html.e,'nodisplay',o._.flags.get.nodisplay());

				if (o._.cberror == null){
					UI.addClass(o._.html.error,'nodisplay');
				}
				else {
					o._.html.error.textContent = o._.cberror.text;
					UI.removeClass(o._.html.error,'nodisplay');
				}

				if (o._.cbresult == null){
					UI.addClass(o._.html.result,'nodisplay');
				}
				else {
					o._.html.result.textContent = '';
					UI.removeClass(o._.html.result,'nodisplay');
				}

			}).bind(o);

			if (o._.type == Object){
				o._.html.sort = (function(foo,descend){
					zs4.throttle.job(function(){
						var a = o._.sort(foo,descend);
						if (a.length > 1){
							for (var i = 0 ; i < (a.length-1) ; i++){
								if (zs4.is.object(a[i]._.html)){
									o._.html.c.removeChild(a[i]._.html.e);
									o._.html.c.insertBefore(a[i]._.html.e, o._.html.c.childNodes[i]);
								}
							}
						}
					});

				}).bind(o);
			}
		}

		if (o._.flags.get.scope()){
			UI.addClass(o._.html.e,'scope');
			o._.scope = o;
			//if (o.zs4.head.bits._.bits.plugin.get()){
				UI.addClass(o._.html.e,o.zs4.head.typename._.value);
			//}
		}
		else{
			if (zs4.is.type(po))o._.scope = po._.scope;
			UI.removeClass(o._.html.e,'scope');
		}

		UI.setClass(o._.html.e,'am',UI.am(o));
		UI.setClass(o._.html.e,'own',UI.own(o));

		if (o._.html.head==null){
			o._.html.head = document.createElement('zs4-object-head');
			o._.html.e.appendChild(o._.html.head);

			o._.html.toggle = document.createElement('zs4-object-toggle');
			//if (o._.flags.get.priced())UI.addClass('priced');
			o._.html.head.appendChild(o._.html.toggle);
			UI.setIcon(o._.html.toggle,'minus');
			UI.addClass(o._.html.toggle,o._.typename);
			o._.html.expanded = false;
			o._.html.toggleOff = function(){
				o._.html.expanded = false;
				o._.html.genericRefresh();
			};
			o._.html.expandTree = function(){
				o._.html.expanded = true;
				if (o._.type == Object){
					zs4.admin.type[o._.typename](po,o);
				}
				else {
					o._.html.genericRefresh();
				}
			};
			o._.html.toggleOn = function(){
				o._.html.expandTree();
			};
			o._.html.onToggle = function(){
				if (o._.html.toolbarIsOpen && o._.html.toolbar != null){
					o._.html.toolbarClose();
				}
				if (o._.html.topElement==true){
					o._.html.toggleOn()
					if (o._.html.appIsOpen){
						if (UI.root()||zs4.admin.debug){
							o._.html.appIsOpen=false;
							o._.html.toggleOn()
						}
						else if (zs4.admin.rootObject._.scope._.path!='' && !o._.html.top.dialogActive){
							if (UI.user()&&zs4.THIS._.scopath!=o._.path){
								console.log('NAV 2 USER');
								zs4.navigate(zs4.THIS._.scopath);
								return;
							}
							else {
								console.log('NAV 2 ROOT');
								zs4.navigate('');
								return;
							}
						}
						else {
							o._.html.top.deselectAll();
						}
					}
					else {
						o._.html.appIsOpen = true;
						if (o._.html.toolbar!=null)o._.html.toolbarClose();
						o._.html.toggleOff()
					}
				}
				else if (o._.path=='zs4'){
					o._.html.toggleOn()
				}
				else {
					if (o._.html.expanded){
						if (o._.type==Object){
							o._.html.toggleOff();
						}
						else {
							o._.html.toggleOn();
						}
					}
					else {
						o._.html.toggleOn();
					}
				}
				//o._.html.refreshAll();
			};
			o._.html.toggle.onclick = o._.html.onToggle;

			o._.html.ePlugName = document.createElement('zs4-scope-type');
			o._.html.head.appendChild(o._.html.ePlugName);

			o._.html.name = document.createElement('zs4-name');
			o._.html.head.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;
			if (o._.flags.value & o._.flags.scope){
				o.zs4.head.title._.onchange(function(){
					//console.log('AUTOUPDATING SCOPE TITLE');
					o._.html.name.textContent = o.zs4.head.title._.value;
				});
			}

			o._.html.error = document.createElement('zs4-error');
			UI.setIcon(o._.html.error,'error');
			UI.addClass(o._.html.error,'nodisplay');
			o._.html.error.onclick = function(){
				UI.addClass(o._.html.error,'nodisplay');
			};
			o._.html.head.appendChild(o._.html.error);

			o._.html.result = document.createElement('zs4-result');
			UI.addClass(o._.html.result,'nodisplay');
			UI.setIcon(o._.html.result,'true');
			o._.html.head.appendChild(o._.html.result);
			o._.html.result.onclick = function(){
				if (o._.cbresult != null)console.log(o._.cbresult);
				o._.html.result.style.display = 'none';
			};

			o._.html.spin = document.createElement('zs4-spin');
			UI.setIcon(o._.html.spin,'spin');
			UI.setAnimate(o._.html.spin,'spin');
			UI.addClass(o._.html.spin,'nodisplay');
			o._.html.head.appendChild(o._.html.spin);

			o._.html.c == null;
			o._.html.input == null;
			o._.html.toolbar == null;
			o._.html.toolbarIsOpen = false;
			o._.html.defaultTool = null;

			o._.html.quickupdate = function(input,cb){
				if (input == null){
					if (zs4.is.function(cb))cb();
					return;
				}
				UI.removeClass(o._.html.spin,'nodisplay');
				zs4.post(o._.wrapRequest(input),function(ret){
					//o._.html.refreshAll();
					UI.addClass(o._.html.spin,'nodisplay');
					if (zs4.is.function(cb))cb();
				});

			};

			if (o._.type==Object){
				o._.html.form = document.createElement('form');
				o._.html.form.onsubmit = function(){return false;};
				o._.html.form.autocomplete = 'on';
				o._.html.form.id = o._.path;
				o._.html.e.appendChild(o._.html.form);

				o._.html.c = document.createElement('zs4-object-content');
				o._.html.form.appendChild(o._.html.c);

				if (!zs4.is.function(o._.html.submit)){
					o._.html.submit = (function(){
						var count = o._.countProperties();
						if (o._.flags.get.api()&&(o._.html.expanded||count==0)){
							var input = o._.input();
							if (input == null)return;
							UI.removeClass(o._.html.spin,'nodisplay');
							UI.addClass(o._.html.toolbarToggle,'nodisplay');
							zs4.post(o._.wrapRequest(input),function(ret){
								o._.html.refreshAll();
								UI.addClass(o._.html.spin,'nodisplay');
								UI.removeClass(o._.html.toolbarToggle,'nodisplay');
							});
						}
					}).bind(o);
				}
				o._.html.name.onclick = o._.html.submit;

				o._.input = (function(){
					var ret = new Object();

					for (var n in o){
						//if (zs4.is.name(n))console.log(n);
						if (!zs4.is.type(o[n])||!zs4.is.function(zs4.admin.type[o[n]._.typename]))continue;

						var prop = o[n]._.input();
						if (prop != null)ret[n]=prop;
					}

		      //console.log(ret);
					return ret;
		    }).bind(o);

				o._.html.toggleOff();
			}
			else {
				o._.html.c = null;
			}

			if (o._.html.topElement==true){
				var top = o._.html.top;
				top.value.uscope = null;
				top.value.utitle = '';

				o._.html.result.style.display = 'none';

				o._.html.appIsOpen = true;
				o._.html.dialog = new Object();

				o._.html.dialogHeader= document.createElement('zs4-app-header');
				o._.html.head.appendChild(o._.html.dialogHeader);

				o._.html.appElement = document.createElement('zs4-app');
				o._.html.e.appendChild(o._.html.appElement);

				o._.html.appUserInterface = document.createElement('zs4-app-ui');
				o._.html.appElement.appendChild(o._.html.appUserInterface);

				o._.html.appWindow = document.createElement('zs4-app-window');
				o._.html.appUserInterface.appendChild(o._.html.appWindow);

				if (UI.own(o) || UI.am(o)){
					var titleBar = document.createElement('zs4-title-bar');
					o._.html.appWindow.appendChild(titleBar);
					var titleInput = o._.html.titleField = document.createElement('input');
					titleInput.type = 'text';
					titleInput.placeholder = '(title)';
					titleInput.value = o.zs4.head.title._.value;
					UI.addClass(titleInput,'scope-title');
					titleBar.appendChild(titleInput);
					o.zs4.head.title._.onchange(function(){
						titleInput.value = o.zs4.head.title._.value;
					});
					titleInput.onchange = function(){
						o.zs4.head.title._.call(titleInput.value, function(){});
					};
				}

				o._.html.docOptions = document.createElement('zs4-doc-options');
				o._.html.docOptions.style.display = 'block';

				if (zs4.plugin.list.hasOwnProperty(o.zs4.head.typename._.value)){
					var plugname = o.zs4.head.typename._.value;

					o._.html.ePlugName.textContent = plugname;

					o._.html.appWindowToolbar = document.createElement('zs4-app-toolbar');
					UI.addClass(o._.html.appWindowToolbar,plugname);
					o._.html.appWindow.appendChild(o._.html.appWindowToolbar);

					// Reload Button
					if (zs4.is.function(zs4.plugin.list[plugname].reload)){
						o._.html.appWindowReload = document.createElement('zs4-app-window-reload');
						//o._.html.appWindowReload.title = 'save';
						o._.html.appWindowReload.onclick = zs4.plugin.list[plugname].reload;
						UI.setIcon(o._.html.appWindowReload,'reload');
						UI.addClass(o._.html.appWindowReload,plugname);
						o._.html.head.appendChild(o._.html.appWindowReload);
					}

					// Create new Document BUtTON
					var nu = zs4.path.resolve(zs4.THIS,'zs4.type.'+plugname+'.method.new');
					if (UI.user()&&nu!=null){
						//console.log('MUST PUT NEW DOC OPTION!!!!'); // 'new'
						var block = document.createElement('div');
						o._.html.docOptions.appendChild(block);
						var icon = UI.addIconElement(block,'new');
						UI.addSpace(block);
						UI.addTextSpan(block,'new '+plugname+' document');
					 	icon.onclick = function(){
							UI.removeClass(o._.html.spin,'nodisplay');
							nu._.call({},function(){
								UI.addClass(o._.html.spin,'nodisplay');
								if (zs4.is.string(nu._.cbresult)){
									zs4.navigate(nu._.cbresult)
								}
							});
						};

						if (zs4.is.function(zs4.plugin.list[plugname].store)){
							var block = document.createElement('div');
							o._.html.docOptions.appendChild(block);
							var icon = UI.addIconElement(block,'clone');
							UI.addSpace(block);
							UI.addTextSpan(block,'clone this '+plugname+' document');
						 	icon.onclick = function(){
								var obj = zs4.plugin.list[plugname].store();
								obj.zs4.head.title = obj.zs4.head.title + ' (clone)';

								var bits = new zs4.type.scopebits({name:'temp'});
								bits._.value = obj.zs4.head.bits;
								bits._.bits.public.false();
								obj.zs4.head.bits = bits._.value;

								UI.removeClass(o._.html.spin,'nodisplay');
								nu._.call(obj,function(){
									UI.addClass(o._.html.spin,'nodisplay');
									if (zs4.is.string(nu._.cbresult)){
										zs4.navigate(nu._.cbresult)
									}
								});
							};
						}
					}

					// Save Button
					if (zs4.is.function(zs4.plugin.list[plugname].save)&&o._.flags.get.own()){
						if (o._.html.docOptions!=null){
							var block = document.createElement('div');
							o._.html.docOptions.appendChild(block);
							var icon = UI.addIconElement(block,'save');
							icon.onclick = zs4.plugin.list[plugname].save;
							UI.addSpace(block);
							UI.addTextSpan(block,'save document');
						}
					}

					zs4.plugin.list[plugname].ui(o._.html.appWindow,o);
				}
				else if (o.zs4.head.typename._.value === 'app'){
					// navigating to an app scope launches it (creates icon+pane, runs main once)
					if (zs4.app && zs4.app.launch) zs4.app.launch(o);
				}
				o._.html.top.dialogActive = false;
				o._.html.top.dialog = function(name){
					this.active = false;
					this.name = name;
					o._.html.dialog[name] = this;

					//o._.html.topElement=true;
					this.select = document.createElement('zs4-app-tab');
					o._.html.dialogHeader.appendChild(this.select);
					UI.setIcon(this.select,name);
					UI.removeClass(this.select,'current');
					//this.select.textContent = name;

					this.pane = document.createElement('zs4-app-dialog');
					//zs4.style.type.toolbubble(this.pane);
					o._.html.appUserInterface.appendChild(this.pane);
					//this.pane.textContent = 'dialog pane for '+name;
					UI.removeClass(this.pane,'current');
					UI.addClass(this.pane,'nodisplay');
					this.refreshDialog = function(){};
					this.refreshInternal = function(){
						//console.log('dialog('+this.name+').refreshInternal()');
						if (!zs4.is.boolean(this.uninitialized))this.uninitialized=true;
						else this.uninitialized=false;
						this.refreshDialog();
						//console.log(o._.html.dialog.coins);
						if (zs4.is.object(o._.html.dialog.coins)){
							//console.log('updating balance from refreshInternal()');
							o._.html.dialog.coins.updateBalance();
						}
					};

					this.toolbar = document.createElement('zs4-app-toolbar');
					this.pane.appendChild(this.toolbar);

					this.dItem = new Object();
					this.dialogItem = function(name){
						var di = this.dItem[name] = new Object();

						di.element = document.createElement('zs4-dialog-item');
						this.pane.appendChild(di.element);

						di.toggleActive = false;
						di.toggle = document.createElement('zs4-dialog-item-toggle');
						di.toggle.textContent = name;
						di.element.appendChild(di.toggle);
						di.toggleOn = function(){
							di.toggleActive=true;
							if (zs4.is.function(di.ontoggleopen))di.ontoggleopen();
							UI.removeClass(di.content,'nodisplay');
						};
						di.toggleOff = function(){
							di.toggleActive=false;
							UI.addClass(di.content,'nodisplay');
						};
						di.toggle.onclick = function(){
							if (di.toggleActive==true){di.toggleOff();}
							else {di.toggleOn();}
						};

						di.content = document.createElement('zs4-dialog-item-content');
						di.element.appendChild(di.content);

						di.toggleOff();
						return di;
					}

					this.select.onclick = (function(){
						var active = false;

						for (var n in o._.html.dialog){
							//console.log('...this.name='+this.name+'  o._.html.tool[n].name='+o._.html.tool[n].name);
							if (name==o._.html.dialog[n].name && o._.html.dialog[n].active==false){
								//console.log('... CURRENT: '+n);
								active = o._.html.dialog[n].active = true;
								UI.addClass(o._.html.dialog[n].select,'current');
								UI.addClass(o._.html.dialog[n].pane,'current');
							}
							else {
								//console.log('... IDLE: '+n);
								o._.html.dialog[n].active = false;
								UI.removeClass(o._.html.dialog[n].select,'current');
								UI.removeClass(o._.html.dialog[n].pane,'current');
							}

							if (o._.html.dialog[n].active){
								UI.removeClass(o._.html.dialog[n].pane,'nodisplay');
								UI.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
								this.refreshInternal();
							}
							else {
								UI.addClass(o._.html.dialog[n].pane,'nodisplay');
								UI.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
							}
						}
						if (active){
							o._.html.top.dialogActive = true;
							UI.addClass(o._.html.appWindow,'nodisplay');
						}
						else{
							o._.html.top.dialogActive = false;
							UI.removeClass(o._.html.appWindow,'nodisplay');
						}
						o._.html.refreshAll();
					}).bind(this);

				};
				o._.html.top.dialogTool = function(){
					var THIS = this;
					o._.html.top.dialog.call(this,'document');

					this.toolbar.appendChild(o._.html.docOptions);

					// TITLE
					this.titleblock = document.createElement('zs4-title-block');
					this.titleblock.style.display = 'block';
					this.toolbar.appendChild(this.titleblock);

					this.titleicon = UI.addIconElement(this.titleblock,'search');
					UI.addSpace(this.titleblock);

					this.title = document.createElement('input');
					this.title.type = 'text';
					UI.addClass(this.title,'scope-title');
					//UI.setIcon(this.title,'search');
					UI.addAttribute(this.title,'autocomplete','title');
					this.title.value = o.zs4.head.title._.value;
					o.zs4.head.title._.onchange(function(){
						//console.log('AUTOUPDATED DOC TITLE');
						THIS.title.value = o.zs4.head.title._.value;
					});
					this.title.maxLength = o.zs4.head.title._.maxlength;
					this.titleblock.appendChild(this.title);

					this.title.onchange = function(){
						UI.removeClass(o._.html.spin,'nodisplay');
						o.zs4.head.title._.call(THIS.title.value,function(){
							UI.addClass(o._.html.spin,'nodisplay');
							o._.html.refreshAll();
						});
					};

					// AUTHOR
					this.authorblock = document.createElement('zs4-author-block');
					this.authorblock.style.display = 'block';
					this.toolbar.appendChild(this.authorblock);

					this.authoricon = UI.addIconElement(this.authorblock,'author');

					this.author = document.createElement('input');
					this.author.type = 'text';
					UI.addAttribute(this.author,'autocomplete','author');
					UI.addClass(this.author,'scope-author');
					UI.setIcon(this.author,'search');
					this.author.value = o.zs4.head.author._.value;
					this.author.maxLength = o.zs4.head.author._.maxlength;
					this.authorblock.appendChild(this.author);

					this.author.onchange = function(){
						UI.removeClass(o._.html.spin,'nodisplay');
						o.zs4.head.author._.call(THIS.author.value,function(){
							UI.addClass(o._.html.spin,'nodisplay');
							o._.html.refreshAll();
						});
					};

					// LANGUAGE
					UI.createValueElement(this.toolbar,o.zs4.head.lang);

					// DESRIPTION
					this.descblock = document.createElement('zs4-desc-block');
					this.descblock.style.display = 'block';
					this.toolbar.appendChild(this.descblock);

					this.descicon = UI.addIconElement(this.descblock,'info');

					this.desc = document.createElement('textarea');
					//this.desc.type = 'text';
					UI.addClass(this.desc,'scope-desc');
					UI.setIcon(this.desc,'search');
					this.desc.value = o.zs4.head.description._.value;
					this.desc.maxLength = o.zs4.head.description._.maxlength;
					this.descblock.appendChild(this.desc);

					this.desc.onchange = function(){
						UI.removeClass(o._.html.spin,'nodisplay');
						o.zs4.head.description._.call(THIS.desc.value,function(){
							UI.addClass(o._.html.spin,'nodisplay');
							o._.html.refreshAll();
						});
					};

					// PUBLIC / PRIVATE
					if (o._.flags.get.own()||o._.flags.get.am()){
						this.isPublic = false;
						this.public = document.createElement('zs4-bit-public');
						UI.setIcon(this.public,'auth');
						this.toolbar.appendChild(this.public);
						this.public.onclick = (function(){
							var bits = new zs4.type.scopebits({name:'temp'});
							bits._.value = o.zs4.head.bits._.value;

							if (bits._.bits.public.get()){
								bits._.bits.public.false();
							}
							else {
								bits._.bits.public.true();
							}

							UI.removeClass(o._.html.spin,'nodisplay');
							o.zs4.head.bits._.call(bits._.value,function(){
								UI.addClass(o._.html.spin,'nodisplay');
								THIS.refreshInternal();
							});
						}).bind(THIS);

					}
					this.refreshDialog = (function(){
						if (o._.flags.get.own()||o._.flags.get.am()){
							if (o.zs4.head.bits._.bits.public.get()){
								this.public.textContent = 'public';
							}
							else {
								this.public.textContent = 'private';
							}
						}
					}).bind(this);

					// Media preview in document panel
					if (o.zs4.head.typename._.value === 'media'){
						var mediaPane = document.createElement('zs4-media-view');
						this.pane.appendChild(mediaPane);
						var _o = o;
						function buildMediaPreview(){
							mediaPane.innerHTML = '';
							var p = _o.path ? _o.path._.value : '';
							var mime = _o.mimetype ? _o.mimetype._.value : '';
							var name = _o.originalname ? _o.originalname._.value : p;
							if (!p) return;
							if (mime.indexOf('image/') === 0){
								var img = document.createElement('img');
								img.src = p;
								img.style.maxWidth = '100%';
								img.style.display = 'block';
								mediaPane.appendChild(img);
							} else if (mime.indexOf('audio/') === 0){
								var aud = document.createElement('audio');
								aud.src = p; aud.controls = true;
								aud.style.width = '100%';
								mediaPane.appendChild(aud);
							} else if (mime.indexOf('video/') === 0){
								var vid = document.createElement('video');
								vid.src = p; vid.controls = true;
								vid.style.maxWidth = '100%';
								vid.style.display = 'block';
								mediaPane.appendChild(vid);
							} else {
								var dl = document.createElement('a');
								dl.href = p; dl.textContent = name || p;
								dl.target = '_blank';
								mediaPane.appendChild(dl);
							}
						}
						buildMediaPreview();
						_o._.onchange(buildMediaPreview);
					}

					// App: show path info in document panel; launch happens in appWindow
					if (o.zs4.head.typename._.value === 'app'){
						var appFileInfo = document.createElement('div');
						appFileInfo.style.cssText = 'font-family:monospace;font-size:0.8em;color:gray;padding:0.3em 0;';
						appFileInfo.textContent = './apps/'+o._.name+'/main.js';
						this.pane.appendChild(appFileInfo);
					}

				};
				o._.html.top.dialogCoins = function(){
					var DIALOG = this;
					o._.html.top.dialog.call(this,'coins');
					DIALOG.uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
					DIALOG.updateBalance = function(){
						if (UI.root())return;
						if (DIALOG.uscope != null){
							DIALOG.balance.textContent = DIALOG.uscope.account.balance._.value;
							if (DIALOG.uscope.account.balance._.value >= 0){
								UI.addClass(DIALOG.balance,'positive');
								UI.removeClass(DIALOG.balance,'negative');
							}
							else {
								UI.addClass(DIALOG.balance,'negative');
								UI.removeClass(DIALOG.balance,'positive');
							}
							console.log('BALANCE UPDATED');
						}

					};
					this.balance = document.createElement('zs4-coins-header-balance');
					o._.html.dialogHeader.appendChild(this.balance);
					o._.onchange(DIALOG.updateBalance);

					DIALOG.updateBalance();

					DIALOG.refreshDialog = function(){

					};

				},
				o._.html.top.dialogUser = function(){
					var DIALOG = this;
					o._.html.top.dialog.call(this,'user');

					new UI.loginoutElement(this.pane);
					new UI.bowserElement(this.pane);

					/*
					this.refreshDialog = (function(){
						if (zs4.THIS._.loggedIn){
							var uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
							var utitle = '';
							//console.log('scopath='+zs4.THIS._.scopath+', ');
							if (uscope!=null){
								if (zs4.THIS._.scopath==''){
									utitle = 'root';
								}
								else if (uscope.zs4.head.title._.value.trim()==''){
									utitle = zs4.THIS._.scopath;
								}
								else {
									utitle = uscope.zs4.head.title._.value;
								}
								this.username.text = utitle;

								if (this.spwIsOpen){
									var vfy = uscope._.resolvePath('zs4.password.vfy');
									var set = uscope._.resolvePath('zs4.password.set');
									if (set!=null){
										if (vfy==null){
											UI.addClass(DIALOG.vfy0,'nodisplay');
											UI.addClass(DIALOG.new0,'nodisplay');
										}
										else {
											UI.removeClass(DIALOG.vfy0,'nodisplay');
											UI.removeClass(DIALOG.new0,'nodisplay');
										}
										UI.removeClass(DIALOG.setpwd,'nodisplay');
									}
									else {
										UI.addClass(DIALOG.setpwd,'nodisplay');
									}
								}
								else {

								}
							}
						}
						else {
							this.username.text = 'login';
							if (DIALOG.failcount > 2){
								UI.removeClass(this.etok,'nodisplay');
							}
						}

						if (this.loggedIn==true){
							UI.addClass(this.logoutArgs,'nodisplay');
							UI.addClass(this.bye,'nodisplay');
						}
					}).bind(this);
					*/

				};
				o._.html.top.dialogDocument = function(){
					var THIS = this;
					o._.html.top.dialog.call(this,'document');

					var nu = THIS.dialogItem('new');
					nu.create = document.createElement('zs4-document-create');
					nu.create.textContent = 'create';
					nu.content.appendChild(nu.create);

					var list = THIS.dialogItem('list');
					list.ontoggleopen = function(){
						window.alert('listing documents');
					};
				};

				o._.html.top.deselectAll = function(){
					for (var n in o._.html.dialog){

						o._.html.dialog[n].active = false;
						UI.removeClass(o._.html.dialog[n].select,'current');
						UI.removeClass(o._.html.dialog[n].pane,'current');
						UI.addClass(o._.html.dialog[n].pane,'nodisplay');
						UI.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
					}
					o._.html.top.dialogActive = false;
					UI.removeClass(o._.html.appWindow,'nodisplay');

					o._.html.refreshAll();
				}

				if (o._.flags.get.scope()){
					if (o.zs4.head.typename._.value=='node'||o.zs4.head.typename._.value=='user'){
						top.app = new UI.app(o,o._.html.appWindow);
						top.app.toolbar = document.createElement('zs4-app-toolbar');
						top.app.containerElement.appendChild(top.app.toolbar);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){

								top.app.searchButton = document.createElement('zs4-app-search-icon');
								UI.setIcon(top.app.searchButton,'search');
								top.app.toolbar.appendChild(top.app.searchButton);
								top.app.searchButton.onclick = (function(){
									o._.html.top.deselectAll();
									this.requestItems();
								}).bind(top.app);

								top.app.search = document.createElement('input');
								top.app.search.type = 'search';
								UI.addClass(top.app.search,'search');
								top.app.toolbar.appendChild(top.app.search);
								top.app.search.onchange = (function(){
									this.requestItems();
								}).bind(top.app);
								top.app.search.oninput = (function(){
									top.app.internalRefresh();
								}).bind(top.app);


								top.app.type = document.createElement('zs4-app-type');
								top.app.toolbar.appendChild(top.app.type);

								top.app.typeSelect = document.createElement('select');
								UI.addClass(top.app.typeSelect,'app-type-select');
								top.app.type.appendChild(top.app.typeSelect);
								var option = document.createElement('option');
								option.value = '';
								option.text = 'all types';
								option.selected = true;
								top.app.typeSelect.add(option);
								for (var n in zs4.THIS.zs4.type)if (zs4.is.type(zs4.THIS.zs4.type[n])){
									if (n=='user'&&!UI.root())continue;
									option = document.createElement('option');
									option.text = option.value = (' '+n+' ').trim();
									UI.setIcon(option,option.value);
				          			top.app.typeSelect.add(option);
								}
								top.app.typeSelect.onchange = (function(){
									if (top.app.typeSelect.value != ''){
										var path = 'zs4.type.'+top.app.typeSelect.value+'.method.new';
										console.log('path for new option: '+path);
										var nu = zs4.THIS._.resolvePath(path);
										if (top.app.typeSelect.value === 'media'){
											UI.addClass(top.app.new,'nodisplay');
											UI.removeClass(top.app.uploadBtn,'nodisplay');
										} else if (nu != null){
											UI.removeClass(top.app.new,'nodisplay');
											UI.addClass(top.app.uploadBtn,'nodisplay');
										}
										else {
											UI.addClass(top.app.new,'nodisplay');
											UI.addClass(top.app.uploadBtn,'nodisplay');
										}
									}
									else {
										UI.addClass(top.app.new,'nodisplay');
										UI.addClass(top.app.uploadBtn,'nodisplay');
									}

									this.requestItems();
								}).bind(top.app);

								top.app.creator = document.createElement('zs4-app-creator');
								top.app.toolbar.appendChild(top.app.creator);

								top.app.searchForOwner = '';
								if (o._.flags.get.scope()&&o.zs4.head.typename._.value=='user'){
									top.app.searchForOwner = o._.path;
								}

								/*
								top.app.creatorSelect = document.createElement('select');
								UI.addClass(top.app.creatorSelect,'app-creator-select');
								top.app.creator.appendChild(top.app.creatorSelect);
								top.app.creatorInitialized = false;
								top.app.creatorRefresh = (function(){
									var lastSelection;
									if (top.app.creatorInitialized){
										lastSelection = top.app.creatorSelect.value;
									}
									top.app.creatorSelect.innerHTML = '';
									var option = document.createElement('option');
									option.value = '';
									option.text = 'any owner';
									if (!top.app.creatorInitialized){
										option.selected = true;
										lastSelection = '';
									}
									top.app.creatorSelect.add(option);

									top.app.creatorInitialized = true;
									var arr = zs4.THIS.zs4.type.user.array;
					        for (var n in arr)if(zs4.is.type(arr[n])){
					          option = document.createElement('option');
										if (arr[n].zs4.head.title._.value.length > 0)
											option.text = arr[n].zs4.head.title._.value;
										else option.text = arr[n]._.name;
										option.value = arr[n]._.path;
										if (lastSelection==arr[n]._.path)option.selected = true;
					          top.app.creatorSelect.add(option);
					        }
								}).bind(top.app);
								top.app.creatorSelect.onchange = (function(){this.requestItems();}).bind(top.app);
								if (o._.path != ''){
									UI.addClass(top.app.creator,'nodisplay');
								}
								*/

								top.app.sortFunction = new Object();
								top.app.sort = document.createElement('zs4-app-sort');
								top.app.toolbar.appendChild(top.app.sort);

								top.app.sortSelect = document.createElement('select');
								UI.addClass(top.app.sortSelect,'app-sort-select');
								top.app.sort.appendChild(top.app.sortSelect);
								top.app.sortSelectOption = (function(input,path,foo,selected){
									var option = document.createElement('option');
									top.app.sortFunction[input.name] = input;
									option.value = input.name;
									option.text = input.name;
									if (input.selected==true){
										option.selected = true;
										top.app.orderFunction = input;
									}
									top.app.sortSelect.add(option);
								}).bind(top.app);
								top.app.sortSelect.onchange = (function(){
									top.app.orderFunction = top.app.sortFunction[top.app.sortSelect.value];
									//top.app.internalRefresh();
									this.requestItems();
								}).bind(top.app);

								top.app.sortSelectOption({
									name:'title',
									path:'zs4.head.title',
									descend:false,
									selected:false,
									sort:function(a,b){
										return a.scope.zs4.head.title._.value.localeCompare(b.scope.zs4.head.title._.value);
									},});

								top.app.sortSelectOption({
									name:'recent',
									path:'zs4.head.updated',
									descend:true,
									selected:true,
									sort:function(a,b){
										return b.scope.zs4.head.updated._.value - a.scope.zs4.head.updated._.value;
									},});

								top.app.sortSelectOption({
									name:'oldest',
									path:'zs4.head.created',
									descend:false,
									selected:false,
									sort:function(a,b){
										return a.scope.zs4.head.created._.value - b.scope.zs4.head.created._.value;
									},});

								if (zs4.is.string(zs4.THIS._.scopath)){// && o._.path==zs4.THIS._.scopath){
									top.app.new = document.createElement('zs4-app-new-item');
									top.app.new.textContent = 'new';
									UI.addClass(top.app.new,'nodisplay');
									top.app.toolbar.appendChild(top.app.new);
									top.app.new.onclick = function(){
										if (top.app.typeSelect.value != ''){
											var path = 'zs4.type.'+top.app.typeSelect.value+'.method.new';

											if (top.app.typeSelect.value == 'document'){
												top.app.typeSelect.value = 'doctype';
												top.app.typeSelect.onchange();
												return;
											}

											var nu = zs4.THIS._.resolvePath(path);
											if (nu == null) return;

											UI.removeClass(o._.html.spin,'nodisplay');
											nu._.call({},function(){
												UI.addClass(o._.html.spin,'nodisplay');
												if (zs4.is.string(nu._.cbresult)){
													zs4.navigate(nu._.cbresult)
												}
											});

											//alert('NEW METHOD EXISTS!');
										}
									};
								}

								// Upload button — only shown when media type is selected
								top.app.uploadBtn = document.createElement('zs4-app-new-item');
								UI.setIcon(top.app.uploadBtn,'upload');
								UI.addClass(top.app.uploadBtn,'nodisplay');
								top.app.toolbar.appendChild(top.app.uploadBtn);

								top.app.uploadInput = document.createElement('input');
								top.app.uploadInput.type = 'file';
								top.app.uploadInput.style.display = 'none';
								top.app.toolbar.appendChild(top.app.uploadInput);

								top.app.uploadBtn.onclick = function(){
									top.app.uploadInput.value = '';
									top.app.uploadInput.click();
								};

								top.app.uploadInput.onchange = function(){
									var file = top.app.uploadInput.files[0];
									if (!file) return;
									var reader = new FileReader();
									reader.onload = function(e){
										var nu = zs4.THIS._.resolvePath('zs4.type.media.method.new');
										if (!nu) return;
										UI.removeClass(o._.html.spin,'nodisplay');
										nu._.call({
											filename: file.name,
											mimetype: file.type,
											filedata: e.target.result,
										}, function(){
											UI.addClass(o._.html.spin,'nodisplay');
											o._.html.refreshAll();
										});
									};
									reader.readAsDataURL(file);
								};

								top.app.content = document.createElement('zs4-app-content');
								o._.html.appWindow.appendChild(top.app.content);

								top.app.orderHtml = (function(){
									var a = top.app.array.sort(top.app.orderFunction.sort);
									if (a.length > 1){
										for (var i = 0 ; i < (a.length-1) ; i++){
											top.app.content.removeChild(a[i].element);
											top.app.content.insertBefore(a[i].element, top.app.content.childNodes[i]);
										}
									}
								}).bind(top.app);

								top.app.array = new Array();

								top.app.item = (function(scope){
									var THIS = this;
									this.scope = scope;
									top.app.array.push(this);

									this.element = document.createElement('zs4-app-item');
									this.element.style.display = 'block';
									top.app.content.appendChild(this.element);

									this.icon = document.createElement('zs4-app-item-icon');
									UI.setIcon(this.icon,scope.zs4.head.typename._.value);
									this.element.appendChild(this.icon);

									this.data = document.createElement('zs4-app-item-data');
									this.element.appendChild(this.data);

									this.title = document.createElement('a');
									this.title.text = scope.zs4.head.title._.value;
									if (scope.zs4.head.title._.value=='')this.title.text = '(untitled)';
									this.title.href = '/'+scope._.path;
									this.title.onclick = (function(e){
										e.preventDefault();
										zs4.navigate(scope._.path);
									}).bind(this);
									UI.addClass(this.title,'app-item-link');
									this.data.appendChild(this.title);

									if (scope._.flags.get.own()){
										if (scope.zs4.head.bits._.bits.public.get()){
											this.isPublic = true;
											this.ePublic = UI.addIconElement(this.data,'public');
										}
										else {
											this.isPublic = false;
											this.ePublic = UI.addIconElement(this.data,'private');
										}
										var epub = this.ePublic;
										this.ePublic.onclick = function(){
											var bits = new zs4.type.scopebits({name:'temp'});
											bits._.value = scope.zs4.head.bits._.value;

											if (scope.zs4.head.bits._.bits.public.get()){
												bits._.bits.public.false();
											}
											else {
												bits._.bits.public.true();
											}

											UI.removeClass(o._.html.spin,'nodisplay');
											scope.zs4.head.bits._.call(bits._.value,function(){
												UI.addClass(o._.html.spin,'nodisplay');
												if (scope.zs4.head.bits._.bits.public.get()){
														UI.setIcon(epub,'public');
												}
												else {
													UI.setIcon(epub,'private');
												}
												//scope._.html.refreshAll();
											});
										};

										this.delblock = document.createElement('zs4-app-item-delblock');
										this.delblock.style.display = 'inline-block';
										this.data.appendChild(this.delblock);

										this.delete = document.createElement('zs4-app-item-delete');
										UI.setIcon(this.delete,'delete');
										this.delblock.appendChild(this.delete);
										this.delete.onclick = function(){
											UI.removeClass(THIS.surdel,'nodisplay');
											UI.removeClass(THIS.sure,'nodisplay');
										};

										this.surdel = document.createElement('zs4-app-item-delete-sure');
										this.surdel.textContent = 'sure?';
										UI.addClass(this.surdel,'nodisplay');
										this.delblock.appendChild(this.surdel);

										this.sure = document.createElement('input');
										this.sure.type = 'checkbox';
										UI.addClass(this.sure,'nodisplay');
										this.delblock.appendChild(this.sure);
										this.sure.onchange = function(){
											if (THIS.sure.checked)UI.removeClass(THIS.reallydelete,'nodisplay');
											else UI.addClass(THIS.reallydelete,'nodisplay');
										};

										this.reallydelete = document.createElement('zs4-app-item-really-delete');
										UI.setIcon(this.reallydelete,'delete');
										UI.addClass(this.reallydelete,'nodisplay');
										this.delblock.appendChild(this.reallydelete);
										this.reallydelete.onclick = function(){
											var a = zs4.string.split.separators(THIS.scope._.path,'./\\ ');
											if (a.length != 5
											|| a[0] != 'zs4'
											|| a[1] != 'type'
											|| !zs4.THIS.zs4.type.hasOwnProperty(a[2])
											|| a[3] != 'array'){
												return;
											}

											var delone = zs4.THIS._.resolvePath('zs4.type.'+a[2]+'.method.deleteone.id');
											if (delone==null)return;

											UI.removeClass(o._.html.spin,'nodisplay');
											delone._.call(THIS.scope._.name,function(){
												o._.html.refreshAll();
												UI.addClass(o._.html.spin,'nodisplay');
											});

										};
									}

									this.more = document.createElement('zs4-app-item-more');
									this.more.style.display = 'block';
									this.element.appendChild(this.more);

									this.description = document.createElement('zs4-app-item-desc');
									this.description.style.display = 'block';
									this.description.textContent = this.scope.zs4.head.description._.value;
									this.more.appendChild(this.description);

									if (this.scope.zs4.head.author._.value!=''){
										this.author = document.createElement('zs4-app-item-author');
										this.author.textContent = this.scope.zs4.head.author._.value;
										UI.setIcon(this.author,'author');
										this.more.appendChild(this.author);
									}

									this.listGap = document.createElement('zs4-app-item-gap');
									this.listGap.style.display = 'block';
									this.listGap.style.visibility = 'hidden';
									this.listGap.textContent = '|';
									this.element.appendChild(this.listGap);

								}).bind(top.app);

								top.app.findItem = (function(scope){
									for (var i = 0 ; i < top.app.array.length ; i++){
										if (top.app.array[i].scope==scope)return top.app.array[i];
									}
									return null;
								}).bind(top.app);

								top.app.setCurrentItem = (function(scope){
									for (var i = 0 ; i < top.app.array.length ; i++){
										if (top.app.array[i].scope==scope){
											return top.app.array[i];
										}
									}
									return null;
								}).bind(top.app);

								top.app.requestItems = (function(){
									var req = new Object();
									req.value = top.app.search.value;
									req.type = top.app.typeSelect.value;
									req.owner = top.app.searchForOwner;
									//req.owner = ''; //top.app.creatorSelect.value;
									//if (o._.flags.get.scope()&&o.zs4.head.typename._.value=='user'){
									//	req.owner = o._.path;
									//}

									var tq = null;
									if(req.type.length>0)
									tq=zs4.THIS._.resolvePath('zs4.type.'+req.type+'.method.query')

									console.log('resolvePath('+'zs4.type.'+req.type+'.method.query'+') = '+tq);

									if (tq != null){
										var query = new Object({
											search:top.app.search.value,
											sort:{
												item:top.app.orderFunction.path,
												descend:top.app.orderFunction.descend,
											},
											select:{sc:'all'},
										});

										if (o.zs4.head.typename._.value=='user'){
											query.select.owner = new Object({
												sc:'item',
												item:'zs4.head.owner',
												opcode:'eq',
												type:'const',
												const:o._.path,
												prop:'',
											});
										}

										console.log(JSON.stringify(query));

										UI.removeClass(o._.html.spin,'nodisplay');
										zs4.post(tq._.wrapRequest(query),function(ret){
											UI.addClass(o._.html.spin,'nodisplay');
											if (req.type === 'app'){
												var arr = zs4.THIS.zs4.type.app.array;
												for (var n in arr){
													if (!zs4.is.type(arr[n])) continue;
													zs4.app.addIcon(arr[n]);
												}
											}
											o._.html.refreshAll();
										});
									}
									else {
										UI.removeClass(o._.html.spin,'nodisplay');
										zs4.post(zs4.THIS.zs4.search._.wrapRequest(req),function(ret){
											UI.addClass(o._.html.spin,'nodisplay');
											o._.html.refreshAll();
										});
									}

								}).bind(top.app);

								top.app.requestItems();
							}

							//top.app.creatorRefresh();

							// get new objects
							var arr = o._.getAllScopes();
							for (var i = 0 ; i < arr.length  ; i++){
								var item = top.app.findItem(arr[i]);
								if (item != null){
									item.title.textContent = item.scope.zs4.head.title._.value || '(untitled)';
								}
								else {
									if (arr[i]._.path != '')item = new top.app.item(arr[i]);
								}
							}

							// clean up discarded objects;
							for (var i = top.app.array.length-1 ; i >= 0 ; i--){
								if (zs4.THIS._.resolvePath(top.app.array[i].scope._.path)==null){
									console.log('discarding '+top.app.array[i].scope._.path);
									top.app.content.removeChild(top.app.array[i].element);
									top.app.array.splice(i,1);
									continue;
								}

								if (top.app.array[i].scope==o){
									//UI.addClass(top.app.array[i].element,'nodisplay');
									top.app.array[i].element.style.display = 'none';
									continue;
								}

								if (top.app.array[i].scope._.flags.get.own()){
									UI.addClass(top.app.array[i].surdel,'nodisplay');
									UI.addClass(top.app.array[i].sure,'nodisplay');
									UI.addClass(top.app.array[i].reallydelete,'nodisplay');
								}

								if (top.app.search.value != ''){
									if (!top.app.array[i].scope._.search(top.app.search.value)){
										//UI.addClass(top.app.array[i].element,'nodisplay');
										top.app.array[i].element.style.display = 'none';
										continue;
									}
								}
								if (top.app.typeSelect.value != ''){
									if (top.app.array[i].scope.zs4.head.typename._.value!=top.app.typeSelect.value){
										//UI.addClass(top.app.array[i].element,'nodisplay');
										top.app.array[i].element.style.display = 'none';
										continue;
									}
								}
								if (top.app.searchForOwner != ''){
									console.log('compare '+top.app.searchForOwner+' to '+top.app.array[i].scope.zs4.head.owner._.value);
									if (top.app.array[i].scope.zs4.head.owner._.value!=top.app.searchForOwner){
										//UI.addClass(top.app.array[i].element,'nodisplay');
										top.app.array[i].element.style.display = 'none';
										continue;
									}
								}

								if (zs4.is.string(zs4.THIS._.token)
								&& zs4.is.string(zs4.THIS._.scopath)
								&& top.app.array[i].scope.zs4.head.owner._.value==zs4.THIS._.scopath){
									UI.addClass(top.app.array[i].element,'own');
									UI.addClass(top.app.array[i].icon,'own');
									UI.addClass(top.app.array[i].title,'own');
								}
								else if (zs4.is.string(zs4.THIS._.token)
								&& zs4.is.string(zs4.THIS._.scopath)
								&& top.app.array[i].scope._.path==zs4.THIS._.scopath){
									UI.addClass(top.app.array[i].element,'am');
									UI.addClass(top.app.array[i].icon,'am');
									UI.addClass(top.app.array[i].title,'am');
								}
								else {
									UI.removeClass(top.app.array[i].element,'own');
									UI.removeClass(top.app.array[i].icon,'own');
									UI.removeClass(top.app.array[i].title,'own');

									UI.removeClass(top.app.array[i].element,'am');
									UI.removeClass(top.app.array[i].icon,'am');
									UI.removeClass(top.app.array[i].title,'am');
								}

								//UI.removeClass(top.app.array[i].element,'nodisplay');
								top.app.array[i].element.style.display = 'block';
							}

							top.app.orderHtml();

						}).bind(top.app);
						top.app.internalRefresh();
					}
					else if (o.zs4.head.typename._.value=='price'){
						top.app = new UI.app(o,o._.html.appWindow);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){
								top.app.content = document.createElement('zs4-app-content');
								top.app.content.textContent = 'price editor';
								o._.html.appWindow.appendChild(top.app.content);

								top.app.searchdialog = UI.createSearchSelect(o,{type:'',owner:o.zs4.head.owner._.value,});
								top.app.searchdialog.zs4.setValue(o.scope._.value);
								top.app.searchdialog.zs4.scopeTrueOrFalse = function(scope){
									var styp = scope.zs4.head.typename._.value;
									if (styp=='user'||styp=='price')return false;
									return true;
								}
								top.app.searchdialog.zs4.onchange = function(){
									o.scope._.html.quickupdate(top.app.searchdialog.zs4.getValue(),function(){
										var s = top.app.searchdialog.zs4.getScope();
										if (zs4.is.object(s)){
											UI.setIcon(top.app.scopeitemicon,s.zs4.head.typename._.value);
											top.app.scopeitemselect.zs4.setScope(s);
										}
									});

								}
								top.app.content.appendChild(top.app.searchdialog);

								top.app.scopeitem = document.createElement('zs4-price-scopeitem');
								top.app.scopeitem.style.display = 'block';
								top.app.content.appendChild(top.app.scopeitem);

								top.app.scopeitemicon = UI.addIconElement(top.app.scopeitem,'item');
								top.app.scopeitemselect = UI.createSelectScopeItem(o,zs4.THIS);
								top.app.scopeitemselect.zs4.setValue(o.item._.value);
								top.app.scopeitemselect.zs4.itemTrueOrFalse = function(item){
									//console.log('testing item: '+item.value);
									if (zs4.string.startsWith(item.value,'zs4.type.price'))return false;
									return true;
								};
								top.app.scopeitemselect.zs4.onchange = function(){
									var val = top.app.scopeitemselect.zs4.getValue();
									//o.item._.html.quickupdate(val);
									var req = new Object({
										item:val,
										zs4:{head:{title:val}},
									});

									UI.removeClass(o._.html.spin,'nodisplay');
									o._.call(req,function(){
										UI.addClass(o._.html.spin,'nodisplay');

									});
									//o.zs4.head.title._.html.quickupdate(top.app.scopeitemselect.zs4.getValue());
								};
								top.app.content.appendChild(top.app.scopeitemselect);

								top.app.searchdialog.zs4.submit(top.app.searchdialog.zs4.hideResults);
							}



						}).bind(top.app);

						top.app.internalRefresh();
					}
					else {
						top.app = new UI.app(o,o._.html.appWindow);
						top.app.toolbar = document.createElement('zs4-app-toolbar');
						top.app.containerElement.appendChild(top.app.toolbar);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){
								//top.app.content = document.createElement('zs4-app-content');
								//top.app.content.textContent = o.zs4.head.typename._.value+' editor';
								//o._.html.appWindow.appendChild(top.app.content);
							}

						}).bind(top.app);
						top.app.internalRefresh();
					}


					if (o.zs4.head.bits._.bits.plugin.get()){
						var appClass = o.zs4.head.typename._.value;
						//window.alert(appClass);
						UI.addClass(o._.html.head,appClass);
						UI.addClass(o._.html.toggle,appClass);
						UI.addClass(o._.html.name,appClass);
						UI.addClass(o._.html.c,appClass);

						UI.addClass(o._.html.dialogHeader,appClass);
						UI.addClass(o._.html.appElement,appClass);
						UI.addClass(o._.html.appUserInterface,appClass);
						UI.addClass(o._.html.appWindow,appClass);

						UI.addClass(o._.html.top.app.toolbar,appClass);
						UI.addClass(o._.html.top.app.searchButton,appClass);
						UI.addClass(o._.html.top.app.search,appClass);
						UI.addClass(o._.html.top.app.content,appClass);
						//UI.addClass(,appClass);
						//UI.addClass(,appClass);
					}
				}

				var homeTab = document.createElement('zs4-app-tab');
				UI.setIcon(homeTab,'home');
				homeTab.onclick = function(){
					if (zs4.app) zs4.app.showHome();
				};
				o._.html.dialogHeader.appendChild(homeTab);

				// App system — persistent per-app panes, run main() once per session
				o._.html.appPanels = o._.html.appPanels || {};
				zs4.app = zs4.app || {};

				zs4.app.showHome = function(){
					for (var k in o._.html.appPanels)
						o._.html.appPanels[k].style.display = 'none';
					UI.removeClass(o._.html.appWindow,'nodisplay');
				};

				zs4.app.show = function(name){
					for (var k in o._.html.appPanels)
						o._.html.appPanels[k].style.display = 'none';
					UI.addClass(o._.html.appWindow,'nodisplay');
					if (o._.html.appPanels[name])
						o._.html.appPanels[name].style.display = 'block';
				};

				zs4.app.addIcon = function(appObj){
					var name = appObj._.name;
					if (o._.html.appPanels[name]) return;

					// private pane — lives for the session
					var pane = document.createElement('zs4-app-panel');
					pane.style.cssText = 'display:none;width:100%;height:100%;overflow:auto;padding:0.5em;box-sizing:border-box;';
					pane.code_executed = false;
					o._.html.appUserInterface.appendChild(pane);
					o._.html.appPanels[name] = pane;

					// toolbar icon
					var iconName = (appObj.icon && appObj.icon._.value) ? appObj.icon._.value : 'app';
					var tab = document.createElement('zs4-app-tab');
					tab.setAttribute('data-app', name);
					UI.setIcon(tab, iconName);
					tab.title = appObj.zs4.head.title._.value || name;
					tab.onclick = function(){ zs4.app.launch(appObj); };
					o._.html.dialogHeader.appendChild(tab);
				};

				zs4.app.launch = function(appObj){
					var name = appObj._.name;
					zs4.app.addIcon(appObj); // no-op if already exists
					var pane = o._.html.appPanels[name];
					if (!pane.code_executed){
						pane.code_executed = true;
						var code = appObj.code ? appObj.code._.value : '';
						if (code){
							try {
								var fn = new Function('return ('+code.trim()+')')();
								fn.call(appObj, appObj, pane);
							} catch(e){
								pane.textContent = 'Error in '+name+': '+e.message;
							}
						} else {
							pane.textContent = name+' — no code yet.';
						}
					}
					zs4.app.show(name);
				};
				if (UI.am(o)||UI.own(o)){
					new o._.html.top.dialogTool();
				}
				new o._.html.top.dialogUser();
				if (UI.user()) {
					new o._.html.top.dialogCoins();
				}

				if (o._.html.docOptions != null){
					var block = document.createElement('div');
					o._.html.docOptions.appendChild(block);

					var icon = UI.addIconElement(o._.html.docOptions,'amppage');
					UI.addSpace(o._.html.docOptions);
					UI.addTextSpan(o._.html.docOptions,'view document as AMP page');

					icon.onclick = function(){
						if (o._.path=='') zs4.navigate('/amp');
						else zs4.navigate(o._.path + '.amp');
					}
				}

				o._.html.appInfo = document.createElement('zs4-app-info');
				o._.html.appElement.appendChild(o._.html.appInfo);

				o._.html.appInfoContent = document.createElement('zs4-app-info-content');
				o._.html.appInfo.appendChild(o._.html.appInfoContent);

				if (zs4.is.function(zs4.static)){
					//window.alert('asdfasddf');
					zs4.static(o._.html.appInfoContent);
				}
				else {
					o._.html.appInfoContent.innerHTML = 'zs4 toonsmith by Andy Flinn...';
				}
			}

		}

	},

}
UI = zs4.admin.util;

zs4.admin.type = {
	array:function(po,o){
		zs4.admin.type.object(po,o);
	},
	bits:function(po,o){
		zs4.admin.type.integer(po,o);
	},
	boolean:function(po,o){
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'checkbox');
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					if (o._.html.input.checked==true){
						o._.value = true;
					}
					else {
						o._.value = false;
					}
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					if (o._.html.input.checked==true){
						o._.html.quickupdate(true);
					}
					else {
						o._.html.quickupdate(false);
					}
				}
			};
			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				if (this._.html.input.checked==true)return true;
				return false;
			}).bind(o);
			o._.onchange(function(ctx){
				o._.html.input.checked = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.expanded = true;
			o._.html.input.checked = o._.value;
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			//o._.html.input.readOnly = o._.flags.get.noset();
		}
	},
	bye:function(po,o){
		zs4.admin.type.object(po,o);
	},
	date:function(po,o){
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){
			if (o._.flags.get.noset()){
				o._.html.input = document.createElement('input-date-readonly');
				o._.html.e.appendChild(o._.html.input);

			}
			else {
				o._.html.input = document.createElement('input');
				o._.html.e.appendChild(o._.html.input);
				o._.html.input.setAttribute('type', 'date');
				UI.addAttribute(o._.html.input,'autocomplete',o._.name);
				UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
				o._.html.input.onchange = function(){
					console.log("o._.html.input.value: ",o._.html.input.value)
					console.log("UI.date.fromInput(o._.html.input): ",UI.date.fromInput(o._.html.input))
					if (o._.flags.get.local()){
						o._.value = UI.date.fromInput(o._.html.input);
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(UI.date.fromInput(o._.html.input));
					}
				};

				o._.input = (function(){
					if (o._.flags.get.noset())return null;
					return UI.date.fromInput(o._.html.input);
				}).bind(o);
			}
			o._.onchange(function(ctx){
				if (o._.flags.get.noset()){
					var d = new Date(o._.value);
					o._.html.input.textContent = ( d.toLocaleDateString() + ' ' + d.toLocaleTimeString() );
				}
				else {
					UI.date.toInput(o._.value,o._.html.input);
				}

			});
			o._.html.expanded = true;
			o._.html.input.readOnly = o._.flags.get.noset();
			o._.onchange_call();
			o._.html.genericRefresh();
		}

		//console.log('admin.date.type: ',o._.type)
		//console.log('admin.date.value: ',o._.value)


		//o._.html.genericRefresh();
	},
	download:function(po,o){
		zs4.admin.type.object(po,o);
	},
	enum:function(po,o){
		UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

			o._.html.enumRefresh = function(){
				//console.log(o._.path+'._.html.enumRefresh()');
				o._.html.input.innerHTML = '';
				for (var i = 0 ; i < o._.enum.length ; i++){
					var option = document.createElement('option');
					option.text = o._.enum[i];
					option.value = o._.enum[i];
					if (o._.value == o._.enum[i])option.selected=true;
					o._.html.input.add(option);
				}

			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

			o._.html.expanded = true;

			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.enumRefresh();
				o._.html.genericRefresh();
			});
			o._.html.input.value = o._.value;
			o._.html.enumRefresh();
			o._.html.genericRefresh();
    }
	},
	email:function(po,o){
		zs4.admin.type.string(po,o);
	},
	file:function(po,o){
		zs4.admin.type.object(po,o);
	},
	filecontent:function(po,o){
		zs4.admin.type.text(po,o);
	},
	folder:function(po,o){
		zs4.admin.type.object(po,o);
	},
	head:function(po,o){
		zs4.admin.type.object(po,o);
	},
	hi:function(po,o){
		zs4.admin.type.object(po,o);
		//o.email._.html.
	},
	integer:function(po,o){
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			UI.addAttribute(o._.html.input,'autocomplete',o._.name);
			UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.parseInt(o._.html.input.value);
					o._.value = o._.parseInt(o._.html.input.value);
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.parseInt(o._.html.input.value));
				}
			};

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseInt(this._.html.input.value);
			}).bind(o);
			o._.html.expanded = true;
			o._.onchange(function(ctx){
				o._.html.input.value = parseInt(o._.value);
				o._.html.genericRefresh();
			});
			//o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = parseInt(o._.value);
			o._.html.genericRefresh();
		}
	},
	lang:function(po,o){
		zs4.admin.type.enum(po,o);
	},
	name:function(po,o){
		zs4.admin.type.string(po,o);
	},
	names:function(po,o){
		zs4.admin.type.string(po,o);
	},
	number:function(po,o){
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			UI.addAttribute(o._.html.input,'autocomplete',o._.name);
			UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');
			o._.html.input.setAttribute('step', 0.000001);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.parseFloat(o._.html.input.value);
					o._.value = o._.parseFloat(o._.html.input.value);
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.parseFloat(o._.html.input.value));
				}
			};

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseFloat(this._.html.input.value);
			}).bind(o);
			o._.html.expanded = true;
			o._.onchange(function(ctx){
				o._.html.input.value = parseFloat(o._.value);
				o._.html.genericRefresh();
			});
			//o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = parseFloat(o._.value);
			o._.html.genericRefresh();
		}
	},
	object:function(po,o){
		//if (!zs4.is.type(o) || o._.typename!='object'){
		if (!zs4.is.type(o)||o._.type!=Object){
			console.log('not a valid zs4 object');
			console.log(o);
			return null;
		}

		zs4.throttle.job(function(){
			UI.unknown(po,o);

			var kids = new Array();

			for (var n in o){
				var name = new String(n);
				//if (zs4.is.name(n))console.log(n);
				if (!zs4.is.type(o[n]))continue;
				if (!zs4.is.function(zs4.admin.type[o[n]._.typename])){
					console.log('o[n]._.typename '
					+o[n]._.typename
					+' @'
					+o[n]._.path
					+' IS NOT A CONSTRUCTOR!!!')
					continue;
				}
				kids.push(o[n]);
			}

			function makefoo(child){

			};
			for (var i = 0 ; i < kids.length; i++){
				if (o._.html.expanded){
					var child = kids[i]
					zs4.admin.type[new String(child._.typename)](o,child);
				}
			}

			zs4.throttle.job(function(){
				if (zs4.is.type(o.zs4)&&(o._.flags.value & o._.flags.scope)){

					o._.scope = o;
					if (zs4.is.string(o.zs4.head.title._.value) && o.zs4.head.title._.value.length > 0){
						o._.html.name.textContent = o.zs4.head.title._.value;
						o._.onchange(function(){
							o._.html.name.textContent = o.zs4.head.title._.value;
						});
					}
					else if (!o._.flags.get.notrans()){
						o._.html.name.textContent = o._.name + ' (untitled)';
					}
				}
				else{
					if (zs4.is.type(po))o._.scope = po._.scope;
				}
			});

			zs4.throttle.job(function(){o._.html.genericRefresh();});
			zs4.throttle.job(function(){o._.html.sort();});

		});

		//UI.addClass(e)



	},
	password:function(po,o){
		zs4.admin.type.string(po,o);
	},
	scope:function(po,o){
		zs4.admin.type.object(po,o);
	},
	scopebits:function(po,o){
		zs4.admin.type.bits(po,o);
	},
	scopeindex:function(po,o){
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = o._.scope._.getScopeItems(o._.inscope,o._.flags.index);
        //console.log (arr);
        //for (var i = (o._.html.input.size-1) ; i >= 0 ; i-- )o._.html.input.remove(i);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i].label;
					option.value = arr[i].value;
        	o._.html.input.add(option);
        }
      }
			o._.html.expanded = true;


    }

    //o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
  },
	scopeindexunique:function(po,o){
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
				//console.log ('getting options '+o._.path+' inscope='+o._.inscope._.path);
        var arr = o._.scope._.getScopeItems(o._.inscope,o._.flags.index|o._.flags.unique);
        //console.log (arr);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i].label;
					option.value = arr[i].value;
        	o._.html.input.add(option);
        }
      }
			o._.html.expanded = true;
    }
		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
	},
	scopeitem:function(po,o){
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = o._.scope._.getScopeItems(o._.inscope);
        //console.log (arr);
        //for (var i = (o._.html.input.size-1) ; i >= 0 ; i-- )o._.html.input.remove(i);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i].label;
					option.value = arr[i].value;
        	o._.html.input.add(option);
        }
      }
			o._.html.expanded = true;
    }

		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
  },
  scopescope:function(po,o){
		UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = zs4.THIS._.getAllScopes();
        //console.log (arr);
        //for (var i = (o._.html.input.size-1) ; i >= 0 ; i-- )o._.html.input.remove(i);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i]._.path;
					option.value = arr[i];
          o._.html.input.add(option);
        }
      }
			o._.html.expanded = true;
    }
		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
  },
	search:function(po,o){
		zs4.admin.type.object(po,o);
	},
	select:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'select';
		o._.select.check();
	},
	selectall:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'all';
		o._.select.check();
	},
	selectany:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'any';
		o._.select.check();
	},
	selectnone:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'none';
		o._.select.check();
	},
	selectitem:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'property';
		o._.select.check();
	},
	string:function(po,o){
		UI.unknown(po,o);
		if (o._.html.input==null){
			o._.select = false;
			if (zs4.is.array(o._.enum)&&o._.enum.length>0){
				o._.select = true;
				o._.html.input = document.createElement('select');
				for (var i = 0; i < o._.enum.length; i++){
					var opt = document.createElement('option');
					opt.value = opt.textContent = o._.enum[i];
					if (i==0)opt.selected = true;
					o._.html.input.appendChild(opt);
				}
				o._.html.input.onchange = function(){
					console.log(o._.html.input.selectedIndex,o._.html.input.value);
					if (o._.flags.get.local()){
						o._.value = o._.enum[o._.html.input.selectedIndex];
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(o._.enum[o._.html.input.selectedIndex]);
					}
				};
				o._.html.e.appendChild(o._.html.input);

				o._.input = (function(){
					if (o._.flags.get.noset())return null;
					return o._.enum[o._.html.input.selectedIndex];
				}).bind(o);
			}
			else {
				o._.html.input = document.createElement('input');
				UI.addAttribute(o._.html.input,'autocomplete',o._.name);
				UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
				o._.html.input.maxLength = o._.maxlength;
				o._.html.e.appendChild(o._.html.input);
				var typeAttr = 'text';
				if (o._.typename=='password')typeAttr='password';
				o._.html.input.setAttribute('type', typeAttr);
				o._.html.input.onchange = function(){
					//alert('++++++++++++++++++');
					if (o._.flags.get.local()){
						o._.value = o._.html.input.value;
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(o._.html.input.value);
					}
				};

				o._.input = (function(){
					if (o._.flags.get.noset())return null;
					return this._.html.input.value;
				}).bind(o);
			}
			o._.html.expanded = true;
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.input.value = o._.value;
			o._.html.genericRefresh();
		}
	},
	text:function(po,o){
		var THIS = this;
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('textarea');
			o._.html.input.maxLength = o._.maxlength;
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return this._.html.input.value;
			}).bind(o);
			o._.html.expanded = true;
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.value = o._.value;
			o._.html.genericRefresh();
		}
	},
	type:function(po,o){
		zs4.admin.type.object(po,o);
	},
	um:function(po,o){
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
			o._.html.input.onclick = function(){
				o._.html.refreshOptions(o);
			};
			o._.html.input.onblur = function(){
				o._.html.input.value = o._.value;
				//window.alert('onblur in um dropdown');
			};
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = o._.value;

			//console.log('refreshing read-only um dropdown');
			//o._.html.input.value = o._.value;
			o._.html.input.innerHTML = '';
			var option = document.createElement('option');
			option.text = o._.value;
			option.value = o._.value;
			option.selected = true;
			o._.html.input.appendChild(option);


      o._.html.e.appendChild(o._.html.input);
			if (!o._.flags.get.noset()){
				o._.html.input.onchange = function(){

					if (o._.flags.get.local()){
						o._.value = o._.html.input.value;
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(o._.html.input.value);
					}
				};
			}
			else {
				o._.html.input.onchange = function(){
				};
			}

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

			o._.html.umtable = null;
      o._.html.refreshOptions = function(o){
				if (zs4.is.array(o._.html.umtable))return;
				o._.html.input.innerHTML = '';
				var a = o._.html.umtable = zs4.um._array();

        for (var i = 0 ; i < a.length ; i++){
          var option = document.createElement('option');
					option.text = a[i];
					option.value = a[i];
					if (a[i]==o._.value)option.selected = true;
        	o._.html.input.appendChild(option);
        }
      }
			o._.html.expanded = true;
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.value = o._.value;
			o._.html.genericRefresh();
    }
  },
	userscope:function(po,o){
		UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = zs4.THIS._.getUserScopes();
        //console.log (arr);
        //for (var i = (o._.html.input.size-1) ; i >= 0 ; i-- )o._.html.input.remove(i);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i].label;
					option.value = arr[i].value;
          o._.html.input.add(option);
        }
      }
			o._.html.expanded = true;
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
				o._.html.refreshOptions(o);
			});
			//o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = o._.value;
			o._.html.refreshOptions(o);
			o._.html.genericRefresh();
    }
  },
	zs4:function(po,o){
		zs4.admin.type.object(po,o);
	},
	media:function(po,o){
		zs4.admin.type.object(po,o);
	},
	app:function(po,o){
		zs4.admin.type.object(po,o);
	},
};

}



{
if (true){
  var input = new Object();
  var a = zs4.string.split.separators(zs4.location.path,'./\\_-');
  var p = input;
  for (var i = 0 ; i < a.length ; i++){
    p[a[i]] = new Object();
    p = p[a[i]];
  }
  zs4.post(input,function(){
    zs4.loadtranslations(function(){
      zs4.throttle.job(function(){
        zs4.admin.type.object(null,zs4.location.get());
        zs4.style.refresh();
      });
    });

  },true);

}

}


{

}
