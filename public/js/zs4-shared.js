var zs4 = exports;

zs4.install = function(shared,target){for (var n in shared) if (n!='install')target[n]=shared[n];};

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
  },
  OBJECT:{
    OWNER:'owner@zs4.zs4',
  },
  PATH:{
    MINLENGTH:1,
    MAXLENGTH:256,
  },
  STRING:{
    MINLENGTH:0,
    MAXLENGTH:256,
  },
  TEXT:{
    MINLENGTH:0,
    MAXLENGTH:256*256,
  },
  SERVER:{
    NAME:{
      MINLENGTH:1,
      MAXLENGTH:16,
    },
    SLOGAN:{
      MINLENGTH:4,
      MAXLENGTH:32,
    },
  },
  SYSTEM:{
    ITSELF:'zs4@zs4.zs4',
    USER:'user@zs4.zs4',
    ADMIN:'admin@zs4.zs4',
    PUBLIC:'public@zs4.zs4',
  },
  TYPE:{
    PLAIN:0,
    COLLECTED:1,
  },
};

zs4.is = {
  array:function(a){
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
  name:function(n){
    if	(!this.string(n))return false;
    if	(n=="zs4")return true;
    var l=n.length;
    if	(l<1)return false;
    for (var i=0;i<l;i++){
      if(n.charAt(i)<'a'||n.charAt(i)>'z')return false;
    }
    return true;
  },
  email:function(str){
    if (!this.string(str)||str.length<zs4.const.EMAIL.MINLENGTH||str.length>zs4.const.EMAIL.MAXLENGTH)return false;
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
  number:function(b){
    if	(b==null)return false;
    if	(typeof(b)!='number')return false;
    return true;
  },
  object:function(o){
    if	(o==null)return false;
    if ((o instanceof Function)==true)return false;
    if	((o instanceof Array)==true)return false;
    if	(o instanceof Object)return true;
    return false;
  },
  error:function(e){
    if (!zs4.is.object(e)
        ||!e.hasOwnProperty('type')
        ||e.type != 'error'
        ||!e.hasOwnProperty('text')
      )return false;
      return true;
  },
  done:function(e){
    if (!zs4.is.object(e)
        ||!e.hasOwnProperty('type')
        ||e.type != 'done'
        ||!e.hasOwnProperty('text')
      )return false;
      return true;
  },
  property:function(o,p){
    if(!this.object(o)||!this.string(p))return null;
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
  string:function(s){
    if	(s==null)return false;
    if	(typeof(s)!='string')return false;
    return true;
  },
  space:function(ch){
    if (ch=='\n'||ch=='\r'||ch=='\t'||ch==' ')return true;
    return false;
  },
  schemaMember(o){
    if (!zs4.is.object(o)
      ||!o.hasOwnProperty('type')
      ||!o.hasOwnProperty('default')
      )return false;

    return true;
  }
};

zs4.copy = {
    object:{
      members:function(from,to){for (var n in from)to[n]=from[n];},
      tree:function(s,d){
        if (d==null)d={};
        for (var n in s){
          if (n=='zs4')continue;
          if(zs4.is.object(s[n])){
            if(!d.hasOwnProperty(n)){d[n]={};}
            zs4.copy.object.tree(s[n],d[n]);
            continue;
          }
          d[n]=s[n];
        }
        return d;
      },
    },
}

zs4.create = {
  error:function(text,data){
    return {
      type:'error',
      text:text,
      data:data,
    }
  },
  done:function(text,data){
    return {
      type:'done',
      text:text,
      data:data,
    }
  },
  type:{
    instance:function(type,nu){
    },
  },
},

zs4.string = {
  split:{
    words:function(str){
      arr = []; buf = '';
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
      arr = []; buf = '';
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
  },
  array:{
    hasString:function(arr,str){
      var trimmed = str.trim();
      for (var i = 0 ; i < arr.length ; i++){
        if (arr[i].trim() == trimmed)return true;
      }
      return false;
    },
    addIfNew:function(arr,str){
      if (this.hasString(arr,str))return arr;
      arr.push(str.trim());
      return arr;
    },
    trimToArray:function(arr,to){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        if (!this.hasString(to,arr[i].trim()))
          arr.splice(i,1);
      }
    },
    addToArray:function(arr,to){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        this.addIfNew(to,arr[i]);
      }
    },

  },
  to:{
    lower:function(str){return str.toLowerCase();}
  },
}

zs4.name = {
  _validate:function(n){return zs4.is.name(n);}
};

zs4.um = {
  _convert:{
    linear:function(quantity,from,to){
      if (from==null || to == null
      ||!this.hasOwnProperty(from)
      || from.length < 1
      || from.charAt(0)=='_'
      ||!this.hasOwnProperty(to)
      || to.length < 1
      || to.charAt(0)=='_'
      )return zs4.create.error('bad args');

      return (quantity * this[from] / this[to]);
    }
  },
  _quantifyable(arg){
    if (arg == null || !zs4.is.name(arg)){
      var ret = [];
      for (var n in zs4.um){if (zs4.is.name(n))ret.push(n);}
      return ret;
    }
    for (var n in zs4.um){if (n==arg)return true;}
    return false;
  },
},
zs4.um.unit = {
  _convert:zs4.um._convert.linear,
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

  kilo:1000.0,
  thousand:1000.0,
  myriad:10000.0,
  mega:1000000,
  million:1000000,
  giga:1000000000,
  tera:1000000000000,

  uni:1.0,
  unit:1.0,
  solo:1.0,

  semi:0.5,
  hemi:0.5,
  demi:0.5,
  half:0.5,
  third:0.3333333333,
  quarter:0.25,
  fifth:0.2,
  sixth:0.1666666666,

  deci:0.1,
  Centi:0.01,
  Milli:0.001,
  Micro:0.000001,
  Nano:0.000000001,
  Pico:0.000000000001,
  Femto:0.000000000000001,
  Atto:0.000000000000000001,

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
zs4.um.time = {
  _convert:zs4.um._convert.linear,
  second:1.0,
  minute:60.0,
  hour:(60.0*60.0),
  day:(60.0*60.0*24.0),
  millisecond:0.001,
};
zs4.um.information = {
  _convert:zs4.um._convert.linear,
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
};
zs4.um.distance = {
  _convert:zs4.um._convert.linear,
  meter:1.0,
  kilometer:1000.0,
  decimeter:0.1,
  centimeter:0.01,
  millimeter:0.001,

  inch:0.0254,
  foot:12*0.0254,
};
zs4.unit = {
  _exists:function(name){
    if (name==null || !zs4.is.name(name) || !zs4['unit'].hasOwnProperty(name))false;
    return true;
  },
  _create:function(name){
    if (name==null || !zs4.is.name(name))return null;
    if (zs4['unit'].hasOwnProperty(name))return zs4['unit'][name];
    zs4['unit'][name] = {};
  },

};

zs4.type = {};

zs4.type.enherit = function(name,from){
  var type = {
    info:{
      name:name,
      parentType:from,
      type:from.info.type,
    },
  };
  type.schema = zs4.copy.object.tree(from.schema);
  if (from.info.childType == null)from.info.childType = [];
  from.info.childType.push(type);
  return type;
};

zs4.type.Auth = {
  info:{
    name:'Auth',
    type:zs4.const.TYPE.PLAIN,
  },
  method:{
    add:function(arr,user){
      for (var i = 0 ; i < arr.length ; i++){
        if (arr[i].email == user)return arr[i];
      }
      var nu = {email:user};
      arr.push(nu);
      return nu;
    },
    remove:function(arr,user){
      for (var i = (arr.length-1) ; i >= 0 ; i--){
        if (arr[i].email == user){
          var r = arr[i];
          arr.splice(i,1);
          return r;
        }
      }
      return null;
    },
    set:function(arr,user){
      //console.log('setAuth('+user+')');
      arr.splice(0,arr.length);
      if (zs4.is.array(user)){
        for (var i = 0 ; i < user.length ; i++)
          zs4.type.Auth.method.add(user[i]);
          return arr;
      }else{
        //console.log('push('+user.email+')');
        arr.push(user);
        return arr;
      }
    },
  },
  schema:{
    email: {
      type: String,
      required: true,
      trim: true,
      minlength:zs4.const.EMAIL.MINLENGTH,
      maxlength:zs4.const.EMAIL.MAXLENGTH,
      default: zs4.const.SYSTEM.ITSELF,
      set:zs4.string.to.lower,
      zs4:{
        validate:zs4.is.email,
      },
    },
  },
};

zs4.type.Meta = {
    info:{
      name:'Meta',
      type:zs4.const.TYPE.PLAIN,
    },
    schema:{
      created:{
        type: Date,
        default: Date.now,
      },
      updated:{
        type: Date,
        default: Date.now,
      },
      owner:{
        type: String,
        required: true,
        trim: true,
        minlength:zs4.const.EMAIL.MINLENGTH,
        maxlength:zs4.const.EMAIL.MAXLENGTH,
        index: true,
        set:zs4.string.to.lower,
        default:zs4.const.SYSTEM.ITSELF,
        zs4:{
          validate:zs4.is.email,
        },
      },
      auth:{
        read:[zs4.type.Auth.schema],
        update:[zs4.type.Auth.schema],
        delete:[zs4.type.Auth.schema],
      },
    },
  };

zs4.type.Server = {
    info:{
      name:'Server',
      type:zs4.const.TYPE.COLLECTED,
      auth:{
        create:[zs4.type.Auth.schema],
      },
    },
    schema:{
        meta:zs4.type.Meta.schema,
        number: { type: Number, required: true, min:0, max:1, default:0},
        public:{
          name: {
            type: String,
            required: true,
            trim: true,
            minlength:zs4.const.SERVER.NAME.MINLENGTH,
            maxlength:zs4.const.SERVER.NAME.MAXLENGTH,
            default:'zs4'
          },
          slogan: {
            type: String,
            required: true,
            trim: true,
            minlength:zs4.const.SERVER.SLOGAN.MINLENGTH,
            maxlength:zs4.const.SERVER.SLOGAN.MAXLENGTH,
            default:'awesomeness!'
          },
        },
        api:{},
    },
  };

zs4.type.User = {
  info:{
    name:'User',
    type:zs4.const.TYPE.COLLECTED,
    auth:{
      create:[zs4.type.Auth.schema],
    },
  },
  schema:{
    meta:zs4.type.Meta.schema,
    email: {
      type: String,
      required: true,
      trim: true,
      minlength:zs4.const.EMAIL.MINLENGTH,
      maxlength:zs4.const.EMAIL.MAXLENGTH,
      index: { unique: true },
      set:zs4.string.to.lower,
      default:zs4.const.SYSTEM.PUBLIC,
      zs4:{
        validate:zs4.is.email,
      },
    },
    stats:{
      tokens_used:{
        type: Number,
        required: true,
        default:0,
      },
      tokens_requested:{
        type: Number,
        required: true,
        default:0,
      },
    },
  },
};

zs4.type.Cost = {
  info:{
    name:'Cost',
    type:zs4.const.TYPE.PLAIN,
  },
  schema:{
    um: {
      type: String,
      required: true,
      enum: zs4.um._quantifyable(),
      index: { unique: true },
      set:zs4.string.to.lower,
      default:'time',
      zs4:{
        validate:zs4.um._quantifyable,
      },
    },
    q:{
      type: Number,
      required: true,
      default:0,
    },
  },
};

zs4.type.Object = {
  info:{
    name:'Object',
    type:zs4.const.TYPE.PLAIN,
  },
  method:{

  },
  schema:{
    zs4:{
      version:{
        type:Number,
        required: true,
        set:parseInt,
        default:0,
      },
      created:{
        type:Date,
        required: true,
        default:new Date(),
      },
      updated:{
        type:Date,
        required: true,
        default:new Date(),
      },
      expires:{
        type:Date,
        required: true,
        default:new Date(),
      },
    },
  },
};

zs4.type.Message = {
  info:{
    name:'Message',
    type:zs4.const.TYPE.PLAIN,
    auth:{
      create:[zs4.type.Auth.schema],
    },
  },
  schema:{
    origin:{
      cost:{
        network:{
          send:{
            information:{},
          },
          receive:{
            information:{},
          },
        },
        processor:{
          time:{},
        },
        storage:{
          read:{
            information:{},
          },
          write:{
            information:{},
          },
        },
      },
      number:{
        type:Number,
        default:0,
      },
      expiry:{
        ms:{
          type:Number,
          default:zs4.const.DEFAULT.MESSAGE.EXPIRY.MS,
        }
      },
      email: {
        type: String,
        required: true,
        trim: true,
        minlength:zs4.const.EMAIL.MINLENGTH,
        maxlength:zs4.const.EMAIL.MAXLENGTH,
        set:zs4.string.to.lower,
        default:zs4.const.SYSTEM.PUBLIC,
        zs4:{
          validate:zs4.is.email,
        },
      },
      expiry:{
        ms:{
          type:Number,
          default:zs4.const.DEFAULT.MESSAGE.EXPIRY.MS,
        }
      },
    },
    format:{
      type:String,
      default:'Object',
    },
    data:{},
  },
};

zs4.job = {

};

zs4.respond = function(message,callback){
  var processor = {
    countSend:0;
    countReceive:0;
    doneSending:false;
    data:{},
    call:function(function,args){

    },
    registerCallback:function(){

    },
    callback:function(){

    },
  }

  var job = [];

}
