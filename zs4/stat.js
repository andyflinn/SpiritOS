'use strict';

var zs4 = require('./js/js');
var meaning = require('./js/meaning');
var debug = require('debug')('zs4stat');
var fs = require('fs');

zs4.stat = {
  createAccumulator:function(parent,name){
    parent._.property(new zs4.type.object({name:name,flags:'noset authsetself'}))

    var ACC = parent[name];
    ACC._.property(new zs4.type.number({name:'value',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'vmin',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'vmax',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'count',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'time',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'tmin',flags:'authpublic noset',}));
    ACC._.property(new zs4.type.number({name:'tmax',flags:'authpublic noset',}));

    ACC._.stat = new Object({});
    ACC._.stat.clear = (function(){
      ACC.count._.value = ACC.value._.value = ACC.time._.value = ACC.tmax._.value = 0;
      ACC.vmin._.value = ACC.tmin._.value = 999999999999;
    }).bind(ACC);
    ACC._.stat.accumulate = (function(v,t){
      ACC.value._.value += v;
      if (ACC.vmax._.value < v)ACC.vmax._.value = v;
      if (ACC.vmin._.value > v)ACC.vmin._.value = v;

      ACC.time._.value += t;
      if (ACC.tmax._.value < t)ACC.tmax._.value = t;
      if (ACC.tmin._.value > t)ACC.tmin._.value = t;

      ACC.count._.value += 1;
    }).bind(ACC);

    ACC._.stat.clear();
  },
  createItem:function(parent,name,um){
    parent.item._.property(new zs4.type.object({name:name,flags:'noset authsetself'}));
    var ITEM = parent.item[name];

    if (zs4.is.string(um)){
      ITEM._.property(new zs4.type.um({name:'um',flags:'noset notrans nostore',default:um}));
    }

    zs4.stat.createAccumulator(ITEM,'since');
    zs4.stat.createAccumulator(ITEM,'total');

    ITEM._.stat = new Object({});
    ITEM._.stat.accumulate = (function(v,t){
      ITEM.since._.stat.accumulate(v,t);
      parent.dateto._.value = Date.now();
    }).bind(ITEM);

  },
  create:function(name){
    var BASIC = this;
    zs4.type.object.call(BASIC,{name:name,flags:'noprune authgetpublic',});
    BASIC._.name = name;

    BASIC._.property(new zs4.type.date({name:'datefrom',flags:'noset authsetself'}));
    BASIC._.property(new zs4.type.date({name:'dateto',flags:'noset authsetself'}));
    BASIC._.property(new zs4.type.object({name:'item',flags:'noset authsetself'}));

    zs4.stat.createItem(BASIC,'transform','unit.one');
    zs4.stat.createItem(BASIC,'transitem','unit.one');
    zs4.stat.createItem(BASIC,'bytesserved','information.byte');
    zs4.stat.createItem(BASIC,'emailsent','unit.one');
    zs4.stat.createItem(BASIC,'error','unit.one');
  },
  updateUser:function(req,cb){
    if (!zs4.is.string(req.request.token)
    ||!zs4.is.object(req.request.payload)
    ||!zs4.string.startsWith(req.request.payload.scope,'zs4.type.user.array.')
    ){
      zs4.debug('err: update User called for no user');
      cb(); return;
    }
    zs4.debug('stat.updateUser('+req.request.payload.scope+')');

    var a = zs4.string.split.separators(req.request.payload.scope,'._-');
    if (a.length != 5){
      zs4.debug('err: path "'+ req.request.payload.scope +'"not a user scope');
      cb(); return;
    }
    var userid = a[4];

    if (req.request.tokenlogin==true){
      zs4.debug('updateUser() tOKENloGIN');
    }

    var arr = new Array();
    for (var i = 0; i < req.request.stat.length; i++){
      if (req.request.stat[i].u == req.request.payload.scope)
        arr.push(req.request.stat[i]);
    }
    req.request.stat = new Array();
    req.request.nostat = true;
    //var json = JSON.stringify(req.request.stat);

    req.call({path:'zs4.type.user.array.'+userid+'.zs4.update',wantreply:true,input:{array:arr}},function(read){
      cb(); return;
    },true);
  },
  boot:function(input,cb){
    zs4.debug('zs4.stat.boot() is active');
    //if (input==zs4.THIS)zs4.debug('input: zs4.THIS');

    var q = new Object({zs4:{type:{price:{method:{
      query:{
        search:'',
        sort:{
          item:'zs4.head.updated',
          descend:true,
        },
        select:{
          sc:'all',
          a:{
            sc:'item',
            item:'zs4.head.owner',
            opcode:'eq',
            const:'',
          },
        }
      }
    }}}}});

    var req = new zs4.request({input:q});
    req.request.node = true;

    zs4.THIS._.transform(req,function(ret){
      var array = req.request.get.zs4.type.price.array;
      if (zs4.is.object(array)){
        //zs4.debug('query called back',array);
        for (var n in array){
          var item = array[n];
          if (!zs4.is.type(item))continue;

          var scope;
          if (item.scope._.value=='')scope = zs4.THIS;
          else {
            scope = zs4.THIS._.resolvePath(item.scope._.value);
          }
          if (!zs4.is.type(scope)||!scope._.flags.get.scope()){
            zs4.debug('no scope in price: '+item._.path);
            continue;
          }

          var scopeitem = scope._.resolvePath(item.item._.value);
          if (item.item._.value!='' && zs4.is.type(scopeitem)){
            scopeitem._.price.push(item);
            scopeitem._.flags.set.priced(true);
            zs4.debug('price \"'+item._.path+'\" attached to '+item.item._.value);
          }
          else {
            scope._.price.push(item);
            scope._.flags.set.priced(true);
            zs4.debug('price \"'+item._.path+'\" attached to scope'+scope.zs4.head.title._.value)
          }
        }
      }
      cb();
    });
  },
};
