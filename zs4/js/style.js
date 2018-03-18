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
  hue:new zs4.color({r:.5,g:.5,b:.5}),
  host:'',
  ele:{

  },
  type:{
    toolbubble:function(e){
      e.style.margin='0.25em';
      e.style.padding='0.25em';
      e.style.border='0.05em solid black';
      e.style.borderRadius = '0.5em';
      e.style.backgroundColor = 'lightgray';
      e.style.overflow = 'auto';
    },
    bgimage:function(e,i){
      e.style.backgroundImage = 'url(\"'+zs4.style.host + i+'\")';
      e.style.backgroundRepeat = 'no-repeat';
      e.style.backgroundSize = 'auto 100%';
      e.style.backgroundPosition = 'right';
    },
    boxplain:function(e){
      e.style.border = '0px';
      e.style.padding = '0px';
      e.style.margin = '0px';
    },
    valueplain:function(e){
      e.style.border='0.1em solid grey';
      e.style.borderRadius = '0.3em';
      e.style.padding = '0px';
      e.style.margin = '0px';
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
    var height = window.screen.width;

    var em = 18;
    if (bowser.mobile==true)em *= 3;
    //var sheet = '*{box-sizing: border-box;font-size:'+em+'px;}\n';
    //sheet += '.fouc{opacity:0}\n';

    //var sheet = '*{box-sizing: border-box;font-size:'+em+'px;}\n';
    var sheet = 'body{font-size:'+em+'px;}\n';
    sheet += zs4.style.sheet;
    zs4.style.element('zs4',sheet);
  },
};
