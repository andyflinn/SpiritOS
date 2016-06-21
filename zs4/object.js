var object = exports;

object.start = function(object){
  if (object==null)object=this;
  if (object.zs4==null){
    object.zs4 = {
      object:object,
      zs4:{
        is:{
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
        },
        addOnEnd:function(foo){data.push(foo);},
        cleanup:[],
        onEnd:function(){
          for (var i = cleanup.length-1 ; i >= 0 ; i-- ){
            cleanup[i]();
          };
          delete cleanup;
          delete data;
          delete object.zs4;
        },
        name:{
          validate:function(name){return object.zs4.zs4.is.name},
          exists:function(name){
            if (!validate(name))return false;
            if (object.zs4.hasOwnProperty(name))return true;
            return false;
          },
        },
      },
      type:{
        object:function(type){

          this.validate = function(obj){
            var root = {
              return:true;
              depth:0,
              path:[],
              objects:[],
              error:[],
            };

            function recurse(root,o){
              for (var n in o){

              }
            }

            recurse(obj);
            if (root.true)return true;
            return false;
          };
          this.string=function(arg){
            var template = {
              name:new String(),
              type:String,
              required:true,
              enum:new Array(),
              minlength:new Number(),
              maxlength:new Number(),
              default:new String(),
            };
            if (arg==null)return template;
            if (object.zs4.zs4.is.name(arg)){
              template.name = arg;
            }
            else if (object.zs4.zs4.is.object(arg)&&object.zs4.zs4.is.name(arg.name)){

              template.name = arg.name;

              if (object.zs4.zs4.is.boolean(arg.required))template.required = arg.required;

              var enum_good = false;
              if (object.zs4.zs4.is.array(arg.enum)&&arg.enum.length>0){
                enum_good = true;
                for (var i = 0 ; i < arg.enum.length ;i++){if (typeof arg.enum[i] != 'string')enum_good = false;}
              }
              if (enum_good)template.enum = arg.enum;
              else delete template.enum;
            }
            else {
              console.log('no name.');
              return null;
            }

            if (this.hasOwnProperty(template.name)){console.log(template.name+' already defined.');return null;}

            return (this[template.name] = template);
          };
          this.number=function(arg){
            var template = {
              name:new String(),
              type:Number,
              required:true,
              enum:new Array(),
              default:new Number(),
            };
            if (arg==null)return template;
            if (object.zs4.zs4.is.name(arg)){
              template.name = arg;
            }
            else if (object.zs4.zs4.is.object(arg)&&object.zs4.zs4.is.name(arg.name)){

              template.name = arg.name;

              if (object.zs4.zs4.is.boolean(arg.required))template.required = arg.required;

              var enum_good = false;
              if (object.zs4.zs4.is.array(arg.enum)&&arg.enum.length>0){
                enum_good = true;
                for (var i = 0 ; i < arg.enum.length ;i++){if (typeof arg.enum[i] != 'number')enum_good = false;}
              }
              if (enum_good)template.enum = arg.enum;
              else delete template.enum;
            }
            else {
              console.log('no name.');
              return null;
            }

            if (this.hasOwnProperty(template.name)){console.log(template.name+' already defined.');return null;}

            return (this[template.name] = template);
          };
          this.boolean=function(arg){
            var template = {
              name:new String(),
              type:Boolean,
              required:true,
              enum:[false,true],
              default:new Boolean(),
            };
            if (arg==null)return template;
            if (object.zs4.zs4.is.name(arg)){
              template.name = arg;
            }
            else if (object.zs4.zs4.is.object(arg)&&object.zs4.zs4.is.name(arg.name)){

              template.name = arg.name;

              if (object.zs4.zs4.is.boolean(arg.required))template.required = arg.required;
            }
            else {
              console.log('no name.');
              return null;
            }

            if (this.hasOwnProperty(template.name)){console.log(template.name+' already defined.');return null;}

            return (this[template.name] = template);
          };
          this.date=function(arg){
            var template = {
              name:new String(),
              type:Date,
              required:true,
              default:new Date(),
            };
            if (arg==null)return template;
            if (object.zs4.zs4.is.name(arg)){
              template.name = arg;
            }
            else if (object.zs4.zs4.is.object(arg)&&object.zs4.zs4.is.name(arg.name)){

              template.name = arg.name;

              if (object.zs4.zs4.is.boolean(arg.required))template.required = arg.required;
            }
            else {
              console.log('no name.');
              return null;
            }

            if (this.hasOwnProperty(template.name)){console.log(template.name+' already defined.');return null;}

            return (this[template.name] = template);
          };
          this.object=function(name){

            var template = {
              name:new String(),
              type:Object,
              required:true,
              validate:this.validate,
              string:this.string,
              number:this.number,
              boolean:this.boolean,
              date:this.date,
              default:new Object(),
            };
            if (arg==null)return template;
            if (object.zs4.zs4.is.name(arg)){
              template.name = arg;
            }
            else if (object.zs4.zs4.is.object(arg)&&object.zs4.zs4.is.name(arg.name)){

              template.name = arg.name;

              if (object.zs4.zs4.is.boolean(arg.required))template.required = arg.required;
            }
            else {
              console.log('no name.');
              return null;
            }

            if (this.hasOwnProperty(template.name)){console.log(template.name+' already defined.');return null;}

            return (this[template.name] = template);
          };

          this.type=Object;
          this.default={
            type:Object,
            required:true,
            default:{
              zs4:{
                type:Object,
                required:true,
                default:{
                  zs4:object.zs4.zs4,
                  type:object.zs4.type,
                },
              },
            },
          };
          this.create = function(){
            var nu = new Object();
            for (var n in this){
              if(!object.zs4.zs4.is.object(this[n])
              ||  object.zs4.zs4.is.function(this[n])
              ||  this.type == null
              ||  this.default == null
              ) continue;

              if (this.type==Object){
                console.log('zs4.type.object.create()');
                console.log(this[n]);
              }
            }
            return nu;
          };
        },
        new:function(type){
          console.log('inside object.zs4.type.new()');
          if (!object.zs4.zs4.is.name(type)){console.log(type+' not a zs4.name.');return null;}
          if (this.hasOwnProperty(type)){console.log(type+' already defined.');return null;}

          this[type]=new object.zs4.type.object();
          return this[type];
        },
      },
      api:{

      },
    };
  }

  //new object.zs4.type.new('object');
  //console.log(object.zs4.type.object);
};
object.start();

console.log('initializing zs4 object');
