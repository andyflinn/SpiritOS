var zs4 = require('../../static/zs4');
var xpress = require('express');
var ts = require('./static/toonsmith/window');

console.log('toonsmith loading...');

var toonsmith;
if (zs4.is.node()) {
    toonsmith = exports;
}
else {
    toonsmith = new Object();
}

zs4.plugin.registerStatic('./plugin/toonsmith/static/');
zs4.plugin.registerScript('tables/midi.js');
zs4.plugin.registerStyle('toonsmith/style.css');
zs4.plugin.registerScript('toonsmith/window.js');
zs4.plugin.registerScript('toonsmith/script.js');

toonsmith.create = function(){
  var TOONSMITH = this;
  zs4.type.scope.call(this);
  this.zs4.head.typename._.value = 'toonsmith';
  this.zs4.head.typename._.default = 'toonsmith';
  //console.log(this.zs4.head.typename._.value);
  this.zs4.head.bits._.bits.plugin.true();
  this._.name = 'toonsmith';
  //this._.flags.set.authuser();
  TOONSMITH._.create = toonsmith.create;
  TOONSMITH._.property(new zs4.type.text({name:'data',flags:'authgetpublic quickupdate authsetself',}));
  TOONSMITH._.getTextOnly = (function(){
    var ret = '';
    var skip = false;
    for (var i = 0 ; i < TOONSMITH.data._.value.length ; i++){
      var cur_ch = TOONSMITH.data._.value.charAt(i);
      if (skip==true){if (cur_ch == ']'){skip=false;}continue;}
      else if (cur_ch == '['){skip=true;continue;}
      else {ret += cur_ch;}
     }
     return ret;
  }).bind(TOONSMITH);

  TOONSMITH._.getKeyWordArray = (function(){
    var ret = new Array();
    ret.push(new String('zs4'));
    ret.push(new String('toonsmith'));

    var textOnly = TOONSMITH._.getTextOnly();
    //console.log(textOnly);
    var arr = zs4.string.split.separators(textOnly,zs4.const.SPECIALCHARS);

    for (var i = 0; i < arr.length; i++){
      zs4.string.array.add.new(ret,zs4.string.to.lower(arr[i]));
    }

    return ret;
  }).bind(TOONSMITH);

  TOONSMITH._.getAmpStyle= (function(req,cb){
    var style = '';
    style += 'span.zs4e{display:inline-block;}';
    style += 'span.zs4c{display:block;}';
    style += 'span.zs4t{display:block;}';
    style += 'span.zs4i{visibility:hidden;}';
    return cb(style);
  }).bind(TOONSMITH);
  TOONSMITH._.oldGetAmpBody = TOONSMITH._.getAmpBody;
  TOONSMITH._.getAmpBody= (function(req,cb){
    var html = '';

    var SEQUENCE = new ts.create();
    SEQUENCE.runChordsAndLyrics(TOONSMITH.data._.value);
    SEQUENCE.updateStats();

    for (var i = 0; i < SEQUENCE.evt.length; i++){
      var EVENT = SEQUENCE.evt[i];
      //if (EVENT.lyric!='') console.log(EVENT.lyric);

      if (EVENT.linefeed && SEQUENCE.layoutlinefeed){
        html += '<br>\n';
        continue;
      }

      var chord = false;
      if (zs4.is.object(EVENT.chord)&&EVENT.chord.ok==true)chord=true;

      var lyric = false;
      //if (EVENT.lyric != '' || (EVENT.lyric == ' ' && !EVENT.space)) lyric = true;
      if (EVENT.lyric != '') lyric = true;

      if (!chord && !lyric)continue;

      // OUTPUT EVENT
      html+='<span class="zs4e">';
      {
        // OUTPUT CHORD;
        html+='<span class="zs4c">';
        {
          if (chord){
            console.log(EVENT.chord);
            html += ts.music.NOTES[EVENT.chord.v].s;
            html += ts.music.CHORD.TYPE[EVENT.chord.t].s;
            if (EVENT.chord.v != EVENT.chord.b){
              html += '/'+ts.music.NOTES[EVENT.chord.b].s;
            }
          }
        }
        html+='</span>';

        // OUTPUT LYRIC;
        if (lyric){
          html+='<span class="zs4t">';
          {
            if (EVENT.space){
              html+=' '
            }
            else if (EVENT.lyric != ''){
              html += zs4.string.escape.html(EVENT.lyric);
            }
          }
          html+='</span>';
        }
        else {
          html+='<span class="zs4i">|</span>';
        }
      }
      html+='</span>\n';
    }

    return cb(html);
  }).bind(TOONSMITH);
}

zs4.THIS.zs4.type._.property(new zs4.type.array({name:'toonsmith',template:new toonsmith.create(),}));
zs4.THIS.zs4.type.toonsmith._.flags.value |= zs4.THIS.zs4.type.toonsmith._.flags.apiarg;
zs4.THIS.zs4.type.toonsmith.method.new._.flags.set.authuser();
