'use strict';

var zs4 = require('./static/zs4');
var debug = require('debug')('zs4word');

var word = exports;

word.meaning = new Object({
  schema:function(parent){
    parent._.property(new word.meaning.create());
  },
  create:function(context){

    zs4.type.scope.call(this);

    var MEANING = this;
    MEANING._.create = word.meaning.create;

    MEANING.zs4.head.typename._.value = 'meaning';
    MEANING.zs4.head.typename._.default = 'meaning';
    MEANING._.name = 'meaning';

    MEANING._.property(new zs4.type.name({name:'name',flags:'index unique authsetself',}));
    MEANING._.property(new zs4.type.names({name:'context',flags:'authsetself quickupdate',}));
  }
});

word.lang = new Object({
  schema:function(parent){
    parent._.property(new word.lang.create());
  },
  create:function(){

    word.meaning.create.call(this);

    var LANG = this;
    LANG._.create = word.lang.create;

    LANG.zs4.head.typename._.value = 'lang';
    LANG.zs4.head.typename._.default = 'lang';
    LANG._.name = 'lang';
  }
});

word.translation = new Object({
  schema:function(parent){
    parent._.property(new word.translation.create());
  },
  create:function(){
    zs4.type.scope.call(this);

    var TRANSLATION = this;
    TRANSLATION._.flags.set.nosort(true);
    TRANSLATION._.create = word.translation.create;

    TRANSLATION.zs4.head.typename._.value = 'translation';
    TRANSLATION.zs4.head.typename._.default = 'translation';
    TRANSLATION._.name = 'translation';

    TRANSLATION._.property(new zs4.type.name({name:'meaning',flags:'index authsetself quickupdate',}));
    TRANSLATION._.property(new zs4.type.name({name:'lang',flags:'index authsetself quickupdate',}));
    TRANSLATION._.property(new zs4.type.string({name:'translation',flags:'authsetself quickupdate',}));
  },
});
