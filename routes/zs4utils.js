var zs4 = module.exports;

//zs4.dummy = 'asdf';
zs4.debug = false;

if ((process.env.ZS4_DEBUG.trim()) == 'true' ){
  console.log('ZS4_DEBUG == true');
  zs4.debug = true;
}


zs4.createResponseFrame = function(req){
  var response = {zs4:{user:null,req:req.body,res:null,}};
  if (zs4.debug) response.zs4.debug = {};
  if (req.user){
    response.zs4.user = {name:req.user.displayName,pic:req.user.picture, email:false};
    if (req.user.emails != null && req.user.emails.length > 0)
      response.zs4.user.email = true;
      if (zs4.debug){
        response.zs4.debug.user = req.user;
      }
      response.zs4.account = req.account;
  }

  return response;
}

zs4.getRequestUser = function(req,res){

  if (req.user == null) return null;
  if (req.user._json == null) return null;
  if (req.user._json.email == null) return null;
  //if (req.user.id == null) return null;
  //if (req.user._json.email == null) return null;
  return {
    email:req.user._json.email,
    name:req.user.displayName,
    pic:req.user.picture,
    identity:req.user.id,
    provider:req.user.provider,
  };
}


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
