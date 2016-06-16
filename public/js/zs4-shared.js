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
    },
    object:{
      tree:function(s,d){
        if (d==null)d={};
        for (var n in s){
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
      if (nu==null) nu = {};
      for (var n in type.schema){
        if (zs4.is.schemaMember(type.schema[n])){
          nu[n]=type.schema[n].default;
        }else if (zs4.is.array(type.schema[n])){
          nu[n]=[];
        }else if (zs4.is.object(type.schema[n])){
          nu[n]={};
          zs4.create.type(type.schema[n],nu[n]);
        }
      }
      if (zs4.instance.client){for (var n in type.method){nu.method[n] = type.method[n];}}
      return nu;
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

zs4.type.Hierarchy = {};
zs4.type.Hierarchy.info={
  name:'Hierarchy',
  type:zs4.const.TYPE.PLAIN,
  auth:{
    create:[zs4.type.Auth.schema],
  },

};
zs4.type.Hierarchy.method={
  isContainer:function(){return !this.file;},
  isContent:function(){return this.file;},
  get:function(){return this},
};
zs4.type.Hierarchy.schema={
  path: {
    type: String,
    required: true,
    trim: true,
    minlength:zs4.const.PATH.MINLENGTH,
    maxlength:zs4.const.PATH.MAXLENGTH,
    default:'/',
  },
  file: {
    type: Boolean,
    required: true,
    default:false,
  },
  list:[zs4.type.Hierarchy];
};

zs4.type.Folder = zs4.type.enherit('Folder',zs4.type.Hierarchy);

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
