'use strict';
var zs4;

var isNode = new Function("try {return this===global;}catch(e){return false;}");
var isWindow = new Function("try {return this===window;}catch(e){ return false;}");

if (isNode()) zs4 = require('./zs4');
if (isWindow()) zs4 = window.zs4;

zs4.um = {
  _convert:{
    linear:function(quantity,from,to){
      if (from==null || to == null
      ||!this.hasOwnProperty(from)
      || from.length < 1
      || from.charAt(0)=='_'
      ||!this.hasOwnProperty(to)
      || to.length < 1
      || to.charAt(0)=='_'
      )return zs4.create.error('bad args');

      return (quantity * this[from] / this[to]);
    }
  },
  _quantifyable(arg){
    if (arg == null || !zs4.is.name(arg)){
      var ret = [];
      for (var n in zs4.um){if (zs4.is.name(n))ret.push(n);}
      return ret;
    }

    var ret = [];
    for (var n in zs4.um)if (n==arg){
      //console.log('check '+n);
      for (var u in zs4.um[n]){
        //console.log('um '+u);
        if(zs4.is.name(u))ret.push(u);
      }
    }
    return ret;
  },

},
zs4.um.unit = {
  _convert:zs4.um._convert.linear,
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
  _convert:zs4.um._convert.linear,
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
  _convert:zs4.um._convert.linear,
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
zs4.um.information = {
  _convert:zs4.um._convert.linear,
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
  _convert:zs4.um._convert.linear,
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
  _convert:zs4.um._convert.linear,
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
zs4.unit = {
  _exists:function(name){
    if (name==null || !zs4.is.name(name) || !zs4['unit'].hasOwnProperty(name))false;
    return true;
  },
  _create:function(name){
    if (name==null || !zs4.is.name(name))return null;
    if (zs4['unit'].hasOwnProperty(name))return zs4['unit'][name];
    zs4['unit'][name] = {};
  },

};
