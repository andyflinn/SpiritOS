var zs4 = exports;


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
    for (var n in zs4.um){if (n==arg)return true;}
    return false;
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

  kilo:1000.0,
  thousand:1000.0,
  myriad:10000.0,
  mega:1000000,
  million:1000000,
  giga:1000000000,
  tera:1000000000000,

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

  deci:0.1,
  Centi:0.01,
  Milli:0.001,
  Micro:0.000001,
  Nano:0.000000001,
  Pico:0.000000000001,
  Femto:0.000000000000001,
  Atto:0.000000000000000001,

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
zs4.um.time = {
  _convert:zs4.um._convert.linear,
  second:1.0,
  minute:60.0,
  hour:(60.0*60.0),
  day:(60.0*60.0*24.0),
  millisecond:0.001,
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
};
zs4.um.distance = {
  _convert:zs4.um._convert.linear,
  meter:1.0,
  kilometer:1000.0,
  decimeter:0.1,
  centimeter:0.01,
  millimeter:0.001,

  inch:0.0254,
  foot:12*0.0254,
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
