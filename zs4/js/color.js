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
