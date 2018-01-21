'use strict';

zs4.plugin.list.toonsmith = new Object({
  SCOPE:this,
  initialized:false,
  toon:null,
  scope:null,

  initialize:function(){
    var THIS = zs4.plugin.list.toonsmith;

    if (THIS.initialized)return;
    THIS.initialized=true;

    ts.initialize();
//
//    ts.html.get.plain('this is a plain text');
//    console.log('toonsmith initialized');
  },
  ui:function(e,scope){
    var THIS = zs4.plugin.list.toonsmith;

    console.log(scope);
    THIS.scope = scope;
    //window.alert('mekkin toonsmith ui');
    THIS.initialize();
    THIS.toon = ts.html.init.block(e);
    THIS.toon.runChordsAndLyrics(THIS.scope.data._.value);
  },
  reload:function(){
    var THIS = zs4.plugin.list.toonsmith;
    THIS.toon.clearChordsAndLyrics(THIS.scope.data._.value);
    THIS.toon.runChordsAndLyrics(THIS.scope.data._.value);
  },
  save:function(){
    var THIS = zs4.plugin.list.toonsmith;

    if (!THIS.scope._.flags.get.own()){
      THIS.scope._.html.error.textContent = 'not authorized';
      zs4.admin.util.removeClass(THIS.scope._.html.error,'nodisplay');
      return;
    }

    zs4.admin.util.removeClass(THIS.scope._.html.spin,'nodisplay');
    THIS.scope.data._.call(THIS.toon.getChordsAndLyrics(),function(r){
      THIS.scope._.html.refreshAll();
      zs4.admin.util.addClass(THIS.scope._.html.spin,'nodisplay');
    });

  },


});
