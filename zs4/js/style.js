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
