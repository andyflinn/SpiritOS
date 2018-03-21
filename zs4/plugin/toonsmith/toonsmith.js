var zs4 = require('../../js/js');
var xpress = require('express');
//var ts = require('../../static/toonsmith/window');
var debug = require('debug')('zs4toonsmith');
var fs = require('fs');

const APPNAME = 'toonsmith';
debug('toonsmith loading...');

zs4.meaning.register(APPNAME);

var ts;
var toonsmith;
if (zs4.is.node()) {
    toonsmith = exports;
    //toonsmith.audioloader = fs.readFileSync('./zs4/plugin/toonsmith/audio-loader.min.js','utf8');
    toonsmith.script0 = fs.readFileSync('./zs4/plugin/toonsmith/script0.js','utf8');
    toonsmith.script1 = fs.readFileSync('./zs4/plugin/toonsmith/script1.js','utf8');
    toonsmith.style = fs.readFileSync('./zs4/plugin/toonsmith/style.css','utf8');
    var createTS = zs4.scriptToConstructor(toonsmith.script1);
    //if (createTS==null){exit();}
    console.log(createTS);
    ts = new createTS(zs4);
    //console.log(ts);

    //console.log(toonsmith.audioloader);
}
else {
    toonsmith = new Object();
}

toonsmith.create = function(){
  var TOONSMITH = this;
  zs4.type.scope.call(this);
  this.zs4.head.typename._.value = 'toonsmith';
  this.zs4.head.typename._.default = 'toonsmith';
  //debug(this.zs4.head.typename._.value);
  this.zs4.head.bits._.bits.plugin.true();
  this._.name = 'toonsmith';

var dbg = true;
  if (zs4.THIS.zs4.node.is.heroku._.value == true)dbg = false;

  //this._.flags.set.authuser();
  TOONSMITH._.create = toonsmith.create;
  TOONSMITH._.property(new zs4.type.text({name:'data',flags:'authgetpublic quickupdate authsetself',}));
  TOONSMITH._.getScript = (function(req,cb){
    //var js = toonsmith.audioloader;
    //js += '\n';

    var js = toonsmith.script0;
    js += '\n';

    if (dbg){
      js +=  fs.readFileSync('./zs4/plugin/toonsmith/script0.js','utf8');
      js += '\n';
      js +=  fs.readFileSync('./zs4/plugin/toonsmith/script1.js','utf8');
    }
    else{
      js += toonsmith.script0;
      js += '\n';
      js += toonsmith.script1;
    }
    js += '\n';
    debug('returning script');
    cb(js);
  }).bind(TOONSMITH);
  TOONSMITH._.getStyle = (function(req,cb){

    debug('returning style');
    if (dbg){
      cb(fs.readFileSync('./zs4/plugin/toonsmith/style.css','utf8'));
    }
    else{
      cb(toonsmith.style);
    }

  }).bind(TOONSMITH);


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
    //debug(textOnly);
    var arr = zs4.string.split.separators(textOnly,zs4.const.SPECIALCHARS);

    for (var i = 0; i < arr.length; i++){
      zs4.string.array.add.new(ret,zs4.string.to.lower(arr[i]));
    }

    return ret;
  }).bind(TOONSMITH);

  TOONSMITH._.getAmpStyle= (function(req,cb){
    var style = '';
    style += 'span.zs4e{display:inline-block;border:0px;margin:0px;padding:0px;}';
    style += 'span.zs4c{display:block;border:0px;margin:0px;padding:0px;}';
    style += 'span.zs4t{display:block;border:0px;margin:0px;padding:0px;}';
    style += 'span.zs4i{visibility:hidden;border:0px;margin:0px;padding:0px;}';
    return cb(style);
  }).bind(TOONSMITH);
  TOONSMITH._.oldGetAmpBody = TOONSMITH._.getAmpBody;
  TOONSMITH._.getAmpBody= (function(req,cb){
    var html = '';
    var section = new Array();

    function spaceImage(){
      return '<svg width=\"0.25em\" height=\"1em\"></svg>';
      //return '<amp-img src="/gfx/images/empty.svg" alt="image" height="1em" width="0.25em"></amp-img>';
    };
    function storeSection(title,html,expanded){
      section.push(new Object({
        title:title,
        html:html,
        expanded:expanded,
      }));
    }
    var SEQUENCE = new ts.create();
    SEQUENCE.runChordsAndLyrics(TOONSMITH.data._.value);
    SEQUENCE.updateStats();


    function htmlSongInfo(){
      var html = '';

      return html;
    }

    // Generate Section functions
    function lyrics(){
      var html = '\n<!-- LYRICS -->\n<br>\n';
      var txt = TOONSMITH._.getTextOnly();
      html += zs4.string.escape.html(txt);
      html += '\n<br>\n';
      return html;
    };
    function chordsAndLyrics(){
      var html = '\n<!-- CHORDS AND LYRICS -->\n<br>\n';

      for (var i = 0; i < SEQUENCE.evt.length; i++){
        var EVENT = SEQUENCE.evt[i];
        //if (EVENT.lyric!='') debug(EVENT.lyric);

        if (EVENT.linefeed && SEQUENCE.layoutlinefeed){
          html += '<br>\n';
          continue;
        }

        var chord = EVENT.isChord();
        var lyric = EVENT.isLyric();

        if (!chord && !lyric){
          //console.log('space only')
          if (EVENT.space)html += spaceImage();//'\n';
          continue;
        }

        // OUTPUT EVENT
        html+='<span class="zs4e">';
        {
          // OUTPUT CHORD;
          html+='<span class="zs4c">';
          {
            if (chord){
              //debug(EVENT.chord);
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
                //console.log('space in lyric')
                html+=spaceImage();//' '
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
        html+='</span>';
      }
      html += '\n<br>\n';
      return html;
    }

    var stats = SEQUENCE.stats;
    debug('lyric:'+stats.lyric,stats.result);

    if (stats.result.words){
      if (stats.chords > 0){
        storeSection('Chords and Lyrics',chordsAndLyrics(),true);
        storeSection('Lyrics',lyrics(),false);
      }
      else {
        storeSection('Lyrics',lyrics(),true);
      }
    }
    else {
      storeSection('Chords',chordsAndLyrics(),true);
    }

    html += '<amp-accordion>\n';
    for (var i = 0; i < section.length; i++){
      var s = section[i];
      if (s.expanded)html += '<section expanded>\n';
      else html += '<section>\n';
      html += '<h4>'+zs4.string.escape.html(s.title)+'</h4><div>';
      html += s.html;

      html += '\n</div></section>\n';
    }
    html += '</amp-accordion>\n';

    return cb(html);
  }).bind(TOONSMITH);
}

// install application
var app = new toonsmith.create();
zs4.THIS.zs4.app._.property(app);
app.zs4.head.title._.value = APPNAME;
app.zs4.head.author._.value = 'Andy Flinn';
app.zs4.head.description._.value = 'a tool to create song charts';
app.zs4.head.bits._.bits.public.true();
app._.flags.set.authgetpublic(true);

// install database
zs4.THIS.zs4.type._.property(new zs4.type.array({name:'toonsmith',template:new toonsmith.create(),}));
zs4.THIS.zs4.type.toonsmith._.flags.value |= zs4.THIS.zs4.type.toonsmith._.flags.apiarg;
zs4.THIS.zs4.type.toonsmith.method.new._.flags.set.authuser();
