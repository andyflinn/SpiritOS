var shared = exports;

shared.install = function(shared,target){for (var n in shared) if (n!='install')target[n]=shared[n];};

shared.mongoose = {
  schema:{
    zs4:{
        number: { type: Number, required: true, min:0, max:1, default:0},
        public:{
          name: { type: String, required: true, trim: true, minlength:1, maxlength:16, default:'zs4' },
          slogan: { type: String, required: true, trim: true, minlength:4, maxlength:32, default:'awesomeness!' },
        },
    },
    User:{
      email: { type: String, required: true, trim: true, minlength:5, maxlength:64, index: { unique: true }},
      auth:[{
          identity: { type: String, required: true, trim: true },
          provider: { type: String, required: true, trim: true },
          name: { type: String, required: true, trim: true },
          pic: { type: String, required: true, trim: true },
      }],
    },
  },
};

shared.is = {
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
};

shared.copy = {
    object:{
      members:function(from,to){for (var n in from)to[n]=from[n];},
    },
}

shared.create = {
  error:function(text,data){
    return {
      type:'error',
      text:text,
      data:data,
    }
  }
};

shared.string = {
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

  }
}
