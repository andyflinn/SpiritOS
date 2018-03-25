'use strict';

zs4.plugin.list.translator = new Object({
  SCOPE:this,
  initialized:false,
  scope:null,

  initialize:function(){
    var THIS = zs4.plugin.list.translator;

    if (THIS.initialized)return;
    THIS.initialized=true;

    //ts.initialize();
  },
  ui:function(e,scope){
    var THIS = zs4.plugin.list.translator;

    console.log(scope);
    THIS.scope = scope;
    THIS.initialize();

    var T = new zs4.admin.util.toolElement(e,'translator');
    T.expand();

    THIS.language = zs4.userLanguage();
    var searchTerm = '';
    var LIST = new Array();
    function sortMeaning(){
      LIST.sort(function(a,b){
        return a.name.localeCompare(b.name);
      });
    }
    function sortTranslation(){
      LIST.sort(function(a,b){
        return a.text.localeCompare(b.text);
      });
    }
    THIS.refresh = function(){
      console.log('refreshing translator',THIS.language,searchTerm,THIS.switch,LIST[0]);
      for (var i = 0 ; i < LIST.length; i++){
        var item = LIST[i];

        if (item.meaning){
          var m = item.meaning;
          m.ulang = THIS.language;
          if (m.eLang)m.eLang.value(THIS.language);
          m.refresh();
          item.text = m.text;
        }

        var found = false;
        if (searchTerm=='')found = true;
        else if (zs4.string.search(item.meaning.text,searchTerm))found = true;
        else if (zs4.string.search(item.name,searchTerm))found = true;


        if (found){
          if (zs4.is.object(item.meaning.object)){
            if (!THIS.switch.translated.get()){
              if (zs4.is.string(item.meaning.object[THIS.language])){
                found = false;
              }
            }
            if (!THIS.switch.untranslated.get()){
              if (!zs4.is.string(item.meaning.object[THIS.language])){
                found = false;
              }
            }
            if (!THIS.switch.twoletteritems.get()){
              if (item.name.length < 3)found = false;
            }
          }
        }

        if (found) {
          item.div.style.display = 'block';
        }
        else {
          item.div.style.display = 'none';
        }

        item.span.style.color = 'initial';
        if (!zs4.is.string(item.meaning.object[THIS.language])){
          item.span.style.color = 'rgb(128,0,0)';
        }
      }

      if (THIS.switch.sortmeaning.get())sortMeaning();
      else if (THIS.switch.sorttranslation.get())sortTranslation();
      else sortMeaning();

      var PARENT = THIS.listDiv;
      for (var i = 0 ; i < (LIST.length-1) ; i++){
        PARENT.removeChild(LIST[i].div);
        PARENT.insertBefore(LIST[i].div, PARENT.childNodes[i]);
      }
    };

    var tool = document.createElement('div');
    zs4.style.type.toolbubble(tool);
    T.element.appendChild(tool);
    function busy(){
      tool.style.backgroundColor = 'blue';
      tool.style.backgroundImage = 'url("/gfx/icons/transferring.svg")';
      tool.style.backgroundRepeat = 'no-repeat';
      tool.style.backgroundPosition = 'right';
    }
    function idle(){
      tool.style.backgroundColor = 'initial';
      tool.style.backgroundImage = 'initial';
    }

    var toolLanguage = document.createElement('div');
    tool.appendChild(toolLanguage);
    var languageIcon = zs4.admin.util.addIconElement(toolLanguage,'language');
    zs4.admin.util.addSpace(toolLanguage);
    var languageSelect = new zs4.admin.util.elementLanguage(toolLanguage);
    languageSelect.on('change',function(){
      THIS.language = languageSelect.value();
      busy();
      zs4.admin.util.setUILanguage(THIS.language,function(){
        THIS.refresh();
        idle();
      });
    });

    var toolSearch = document.createElement('div');
    tool.appendChild(toolSearch);
    var searchIcon = zs4.admin.util.addIconElement(toolSearch,'search');
    zs4.admin.util.addSpace(toolSearch);
    var input = document.createElement('input');
    toolSearch.appendChild(input);
    input.oninput = function(){
      searchTerm = input.value;
      THIS.refresh();
    };

    THIS.switch = new zs4.util.bits();
    THIS.switch.addBit('translated',0); THIS.switch.translated.false();
    THIS.switch.addBit('untranslated',1); THIS.switch.untranslated.true();
    THIS.switch.addBit('twoletteritems',2); THIS.switch.twoletteritems.false();
    THIS.switch.addBit('sortmeaning',3); THIS.switch.sortmeaning.false();
    THIS.switch.addBit('sorttranslation',4); THIS.switch.sorttranslation.false();

    var toolSwitch = document.createElement('div');
    tool.appendChild(toolSwitch);
    var searchIcon = zs4.admin.util.addIconElement(toolSwitch,'tool');
    zs4.admin.util.addSpace(toolSwitch);
    var bits = new zs4.admin.util.bitsElement(toolSwitch,THIS.switch);
    bits.on('change',function(){THIS.refresh();});

    var list = THIS.listDiv = document.createElement('div');
    T.element.appendChild(list);

    for (var n in zs4.meaning.name){
      var item = new Object({
        name:n,
      });

      var div = item.div = document.createElement('div');
      div.style.verticalAlign = 'top';
      list.appendChild(div);

      var m = item.span = document.createElement('span');
      m.textContent = n+': ';
      m.style.fontWeight = 'bold';
      div.appendChild(m);
      var e = item.meaning = new zs4.admin.util.elementMeaning(div,n);
      e.bits.noctrlclick.true();
      e.bits.nolinktranslator.true();

      LIST.push(item);
    }

    THIS.refresh();
  },

});
