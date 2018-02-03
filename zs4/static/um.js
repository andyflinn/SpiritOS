'use strict';
var zs4;

var isNode = new Function("try {return this===global;}catch(e){return false;}");
var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

if (isNode()) zs4 = require('./zs4');
if (isWindow()) zs4 = window.zs4;

zs4.um = {
  _checkconvertargs:function(arr,quantity,from,to){
    if (from==null || to == null
    ||!arr.hasOwnProperty(from)
    || from.length < 1
    || from.charAt(0)=='_'
    ||!arr.hasOwnProperty(to)
    || to.length < 1
    || to.charAt(0)=='_'
    )return false;
    return true;
  },
  _convert:{
    linear:function(arr,quantity,from,to){
      if (!zs4.um._checkconvertargs(arr,quantity,from,to)) return zs4.create.error('bad args');
      return (quantity * arr[from] / arr[to]);
    },
    squared:function(arr,quantity,from,to){
      from = from.substr(0,from.length-1);
      to = to.substr(0,to.length-1);
      if (!zs4.um._checkconvertargs(arr,quantity,from,to)) return zs4.create.error('bad args');
      return (quantity * ((arr[from] * arr[from])) / (arr[to] * arr[to]));
    },
    cubed:function(arr,quantity,from,to){
      from = from.substr(0,from.length-1);
      to = to.substr(0,to.length-1);
      if (!zs4.um._checkconvertargs(arr,quantity,from,to)) return zs4.create.error('bad args');
      return (quantity * ((arr[from] * arr[from] * arr[from])) / (arr[to] * arr[to] * arr[to]));
    },
  },
  _array:function(){
    if (zs4.is.array(zs4.um._chachearray))return zs4.um._chachearray;
    var a = new Array();
    for (var n in zs4.um){
      var t = zs4.um[n];
      if (zs4.is.object(t)&&zs4.is.function(t._array)){
        var ta = t._array();
        for (var i = 0; i<ta.length; i++) a.push(ta[i]);
      }
    }
    zs4.um._chachearray = a;
    return a;
  },
  _arr:{
    plain:function(name,append){
      var a = new Array();
      var o = zs4.um[name];

      if (zs4.is.string(append)){
        for (var n in o){
          if (zs4.is.number(o[n])){
            a.push(name+append+':'+n+append);
          }
        }
      }
      else {
        for (var n in o){
          if (zs4.is.number(o[n])){
            a.push(name+':'+n)
          }
        }
      }
      return a;
    },
  },
  _po:function(c){
    var r = new Object({
      a:'',
      b:'',
    });
    c = c.substr(1,(c.length-2))
    var o = 0; var x = false;
    for (var i = 0 ; i < c.length; i++){
      if (c.charAt(i)=='(')o++;
      else if (c.charAt(i)==')')o--;

      if (o==0 && (c.charAt(i)=='/'||c.charAt(i)=='*')){x=true;continue;}
      if (x)r.b+=c.charAt(i);
      else r.a+=c.charAt(i);
    }
    return r;
  },
  _pu:function(u){
    var r = '';
    var x = false;
    for (var i = 0 ; i < u.length; i++){
      if (u.charAt(i)==':'){x=true;continue;}
      if (!x)continue;
      r += u.charAt(i);
    }

    return r;
  },
  _product:function(name,factor1,factor2){
    if (zs4.um.hasOwnProperty(name)
    ||!zs4.um.hasOwnProperty(factor1)
    ||!zs4.um.hasOwnProperty(factor2)
    ) return null;
    var product = zs4.um[name] = new Object();
    product._array = function(){
      var a = zs4.um[factor1]._array();
      var b = zs4.um[factor2]._array();
      var r = new Array();

      for (var ia = 0; ia < a.length; ia++){
        for (var ib = 0; ib < b.length; ib++){
          r.push((name+':('+a[ia]+'*'+b[ib]+')'));
        }
      }
      return r;
    };
    product._convert = function(q,f,t){
      if (!zs4.string.startsWith(f,name+':') || !zs4.string.startsWith(t,name+':')) return null;
      f = f.substr((name.length+1),((f.length-name.length)-1));
      t = t.substr((name.length+1),((t.length-name.length)-1));

      f = zs4.um._po(f); f.a = zs4.um._pu(f.a); f.b = zs4.um._pu(f.b);
      t = zs4.um._po(t); t.a = zs4.um._pu(t.a); t.b = zs4.um._pu(t.b);

      q = zs4.um[factor1]._convert(q,f.a,t.a);
      q = zs4.um[factor2]._convert(q,f.b,t.b);

      return q;
    };

    return product;
  },
  _ratio:function(name,dividend,divisor){
    if (zs4.um.hasOwnProperty(name)
    ||!zs4.um.hasOwnProperty(dividend)
    ||!zs4.um.hasOwnProperty(divisor)
    ) return null;
    var ratio = zs4.um[name] = new Object();
    ratio._array = function(){
      var a = zs4.um[dividend]._array();
      var b = zs4.um[divisor]._array();
      var r = new Array();

      for (var ia = 0; ia < a.length; ia++){
        for (var ib = 0; ib < b.length; ib++){
          r.push((name+':('+a[ia]+'/'+b[ib]+')'));
        }
      }
      return r;
    };
    ratio._convert = function(q,f,t){
      if (!zs4.string.startsWith(f,name+':') || !zs4.string.startsWith(t,name+':')) return null;
      f = f.substr((name.length+1),((f.length-name.length)-1));
      t = t.substr((name.length+1),((t.length-name.length)-1));

      f = zs4.um._po(f); f.a = zs4.um._pu(f.a); f.b = zs4.um._pu(f.b);
      t = zs4.um._po(t); t.a = zs4.um._pu(t.a); t.b = zs4.um._pu(t.b);

      q = zs4.um[dividend]._convert(q,f.a,t.a);
      q = zs4.um[divisor]._convert(q,t.b,f.b);

      return q;
    };

    return ratio;
  },
},

zs4.um.unit = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.unit,q,f,t)},
  _array:function(){return zs4.um._arr.plain('unit');},
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

  thousand:1000.0,
  myriad:10000.0,
  mega:1000000,
  million:1000000,

  uni:1.0,
  unit:1.0,
  solo:1.0,

  semi:0.5,
  hemi:0.5,
  demi:0.5,
  half:0.5,
  third:(1.0/3.0),
  quarter:0.25,
  fifth:0.2,
  sixth:(1.0/6.0),
  seventh:(1.0/7.0),
  eighth:0.125,
  nineth:(1.0/9.0),
  tenth:0.1,

  kilo: 1000,
  mega: 1000000,
  giga: 1000000000,
  tera: 1000000000000,
  peta: 1000000000000000,
  exa:  1000000000000000000,
  zetta:1000000000000000000000,
  yotta:1000000000000000000000000,

  deci:0.1,
  centi:0.01,
  milli:0.001,
  micro:0.000001,
  nano: 0.000000001,
  pico: 0.000000000001,
  femto:0.000000000000001,
  atto: 0.000000000000000001,
  zepto:0.000000000000000000001,
  yocto:0.000000000000000000000001,

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
zs4.um.mass = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.mass,q,f,t)},
  _array:function(){return zs4.um._arr.plain('mass');},
  gram:1.0,
  kilogram: 1000,
  megagram: 1000000,
  gigagram: 1000000000,
  teragram: 1000000000000,
  petagram: 1000000000000000,
  exagram:  1000000000000000000,
  zettagram:1000000000000000000000,
  yottagram:1000000000000000000000000,

  decigram:0.1,
  centigram:0.01,
  milligram:0.001,
  microgram:0.000001,
  nanogram: 0.000000001,
  picogram: 0.000000000001,
  femtogram:0.000000000000001,
  attogram: 0.000000000000000001,
  zeptogram:0.000000000000000000001,
  yoctogram:0.000000000000000000000001,

  dalton:1.66053e-24,
  pound:453.59237,
  ounce:28.349523125,
  ton:1000000,
  tonne:1000000,
  kiloton:1000000000,
  quintal:100000,
  hundredweightus:45359.237,
  hundredweightuk:50802.34544,
  slug:14593.902937205,
  pennyweight:1.55517384,
  carat:0.2,
  grain:0.06479891,
  stoneus:5669.904625,
  stoneuk:6350.29318,

  electron:9.1093897e-28,
  muon:1.8835327e-25,
  proton:1.6726231e-24,
  neutron:1.6749286e-24,
  deuteron:3.343586e-24,

  earth:5.976e+27,
  sun:2e+33,

};
zs4.um.time = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.time,q,f,t)},
  _array:function(){return zs4.um._arr.plain('time');},
  second:1.0,
  minute:60.0,
  hour:(60.0*60.0),
  day:(60.0*60.0*24.0),
  moon:(60.0*60.0*24.0*29.530587981),
  week:(60.0*60.0*24.0*7),

  year:(60.0*60.0*24.0*365.25),
  olympiad:(60.0*60.0*24.0*365.25*4),
  lustrum:(60.0*60.0*24.0*365.25*5),
  indiction:(60.0*60.0*24.0*365.25*15),
  decade:(60.0*60.0*24.0*365.25*10),
  jubilee:(60.0*60.0*24.0*365.25*50),
  century:(60.0*60.0*24.0*365.25*100),
  millenium:(60.0*60.0*24.0*365.25*1000),
  kiloannum:(60.0*60.0*24.0*365.25*1000),
  month:(60.0*60.0*24.0*365.25/12.0),

  millisecond:0.001,
  microsecond:0.000001,
  nanosecond: 0.000000001,
  picosecond: 0.000000000001,
  femtosecond:0.000000000000001,
  attosecond: 0.000000000000000001,
  zeptosecond:0.000000000000000000001,
  yoctosecond:0.00000000000000000000001,
  kilosecond: 1000,
  megasecond: 1000000,
  gigasecond: 1000000000,
  terasecond: 1000000000000,
  petasecond: 1000000000000000,
  exasecond:  1000000000000000000,
  zettasecond:1000000000000000000000,
  yottasecond:1000000000000000000000000,
};
zs4.um.time2 = {
  _convert:function(q,f,t){return zs4.um._convert.squared(zs4.um.time,q,f,t)},
  _array:function(){return zs4.um._arr.plain('time','2');},
};
zs4.um.information = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.information,q,f,t)},
  _array:function(){return zs4.um._arr.plain('information');},
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

  nibble:0.5,
  word:2,
  dword:4,
  qword:8,
};
zs4.um.liquid = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.liquid,q,f,t)},
  _array:function(){return zs4.um._arr.plain('liquid');},
  cubicmeter:1.0,
  barreloil:6.2898107280219,
  barreluk:6.1102568971969,
  barrelus:8.5216794934986,
  boardfeet:423.776000658,
  busheluk:27.496156037386,
  bushelus:28.377593256211,
  centilitre:100000,
  cubiccentimetre:1000000,
  cubicdecimetre:1000,
  cubicfeet:35.314666721489,
  cubicinch:61023.744094732,
  cubicyard:1.3079506193144,
  cups:4000,
  cupsuk:3519.5079727854,
  cupsus:4226.7528377304,
  decilitre:10000,
  decalitre:100,
  dram:270512.18161474,
  fluidounceuk:35195.077544697,
  fluidounceus:33814.022701843,
  gallonsuk:219.96923465436,
  gallonsus:264.17205235815,
  hectolitre:10,
  kilolitre:1,
  litre:1000,
  millilitre:1000000,
  peckuk:109.98462415,
  peckus:113.51037228,
  pintuk:1759.7538772348,
  pintus:2113.3764188652,
  quartuk:879.87693861742,
  quartus:1056.6882094326,
  tablespoon:66666.666666667,
  tablespoonuk:56312.127564567,
  tablespoonus:67628.045403686,
  teaspoon:200000,
};
zs4.um.distance = {
  _convert:function(q,f,t){return zs4.um._convert.linear(zs4.um.distance,q,f,t)},
  _array:function(){return zs4.um._arr.plain('distance');},
  meter:1.0,
  kilometer:1000.0,
  decimeter:0.1,
  centimeter:0.01,
  millimeter:0.001,
  micrometer:0.000001,
  nanometer: 0.000000001,
  picometer: 0.000000000001,
  femtometer:0.000000000000001,
  attometer: 0.000000000000000001,
  zeptometer:0.000000000000000000001,
  yoctometer:0.000000000000000000000001,

  kilometer: 1000,
  megameter: 1000000,
  gigameter: 1000000000,
  terameter: 1000000000000,
  petameter: 1000000000000000,
  exameter:  1000000000000000000,
  zettameter:1000000000000000000000,
  yottameter:1000000000000000000000000,

  inch:0.0254,
  mil:(0.0254/1000),
  thou:(0.0254/1000),
  foot:12*0.0254,
  yard:3*12*0.0254,
  mile:5280*12*0.0254,
  league:3*5280*12*0.0254,

  fathom:2*3*12*0.0254,
  nauticalmile:1852,

  angstrom:0.0000000001,

  lightyear:9460730472580800,
  parsec:9460730472580800*3.26,
};
zs4.um.distance2 = {
  _convert:function(q,f,t){return zs4.um._convert.squared(zs4.um.distance,q,f,t)},
  _array:function(){return zs4.um._arr.plain('distance','2');},
};
zs4.um.distance3 = {
  _convert:function(q,f,t){return zs4.um._convert.cubed(zs4.um.distance,q,f,t)},
  _array:function(){return zs4.um._arr.plain('distance','3');},
};

zs4.um._ratio('bandwidth','information','time');
zs4.um._product('storage','information','time');
