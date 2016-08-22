////////////////////////////////////////////////////////////////////////"+"
'use strict';
zs4.admin = new Object();

zs4.admin.util = {
	am:function(o){
		if (zs4.THIS._.token==null||zs4.THIS._.scopath==null)return false;
		if (zs4.THIS._.scopath==o._.scope._.path)return true;

		return false;
	},
	own:function(o){
		if (zs4.THIS._.token==null||zs4.THIS._.scopath==null)return false;

		if (o._.scope._.path.startsWith(zs4.THIS._.scopath)
		&&  o._.scope._.path>zs4.THIS._.scopath)return true;
		return false;
	},
	setClass:function(e,c,tof){
		if (tof)return zs4.admin.util.addClass(e,c);
		else return zs4.admin.util.removeClass(e,c);
	},
	addClass:function(e,c){
		var set = zs4.string.split.words(c);
		if  (set.length==0)return;
		var cls = zs4.string.split.words(e.className);
		for (var i = 0 ; i < set.length ; i++)zs4.string.array.add.new(cls,set[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	removeClass:function(e,c){
		var rem = zs4.string.split.words(c);
		if  (rem.length==0)return;
		var cls = zs4.string.split.words(e.className);
		for (var i = 0 ; i < rem.length ; i++)zs4.string.array.remove.string(cls,rem[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	tool:function(o,name){
		this.active = false;
		this.name = name;
		o._.html.tool[name] = this;

		this.select = document.createElement('zs4-tool-tab');
		o._.html.toolbarHeader.appendChild(this.select);
		this.select.textContent = name;

		this.pane = document.createElement('zs4-tool-pane');
		o._.html.toolbarTool.appendChild(this.pane);
		this.pane.textContent = 'tool pane for '+name;

		this.select.onclick = (function(){
			console.log(this);
			console.log(this.name);
			console.log(o._.path+'.zs4.admin.tool.'+name);
			var count = 0;
			for (var n in o._.html.tool){
				console.log('...this.name='+this.name+'  o._.html.tool[n].name='+o._.html.tool[n].name);
				if (name==o._.html.tool[n].name){
					console.log('... CURRENT: '+n);
					zs4.admin.util.addClass(o._.html.tool[n].select,'current');
					zs4.admin.util.addClass(o._.html.tool[n].pane,'current');
					if (this.active)o._.html.tool[n].active = false;
					else o._.html.tool[n].active = true;
				}
				else {
					console.log('... IDLE: '+n);
					zs4.admin.util.removeClass(o._.html.tool[n].select,'current');
					zs4.admin.util.removeClass(o._.html.tool[n].pane,'current');
					o._.html.tool[n].active = false;
				}

				if (o._.html.tool[n].active){
					zs4.admin.util.addClass(o._.html.tool[n].select,'active');
					zs4.admin.util.addClass(o._.html.tool[n].pane,'show');
					zs4.admin.util.removeClass(o._.html.tool[n].pane,'hide');
				}
				else {
					zs4.admin.util.addClass(o._.html.tool[n].pane,'hide');
					zs4.admin.util.removeClass(o._.html.tool[n].pane,'show');
					zs4.admin.util.removeClass(o._.html.tool[n].select,'active');
				}
			}
		}).bind(this);
	},
	unknown:function(po,o){
		if (!zs4.is.object(o._.html))o._.html = new Object();
		if (o._.input==null)o._.input = (function(){return null;}).bind(o);
		if (o._.response==null)o._.response = (function(r){console.log(r);}).bind(o);

		if (o._.cleanup==null)o._.cleanup = (function(){
			//console.log(this._.path + '._.cleanup()');
			//console.log(o._.html.parentElement);
			//console.log(o._.html.e);
			if (o._.html.parentElement != null && o._.html.e != null){
				o._.html.parentElement.removeChild(o._.html.e);
				o._.html.parentElement = null;
				o._.html.e = null;
			}
		}).bind(o);

		if (o._.html.e==null){
			o._.html.e = document.createElement('zs4-'+o._.typename);
			zs4.admin.util.addClass(o._.html.e,'container');

			if (zs4.is.type(po)){
				po._.html.c.appendChild(o._.html.e);
				o._.html.parentElement = po._.html.c;
				zs4.admin.util.addClass(o._.html.e,'branch');
			}
			else {
				if (po==null){
					po=document.body;
				}
				po.appendChild(o._.html.e);
				o._.html.parentElement = po;

				if (zs4.admin.rootElementParent==null)zs4.admin.rootElementParent = po;
				zs4.admin.rootObject = o;

				zs4.admin.util.addClass(o._.html.e,'top');
				o._.html.topElement=true;
			}

			o._.html.genericRefresh = (function(){
				var add = '';
				var rem = '';

				function addrem(e){
					if (e==null)return;
					zs4.admin.util.addClass(e,add);
					zs4.admin.util.removeClass(e,rem);
				};
				//if (zs4.admin.util.am(o))add+=' am'; else rem+=' am';
				//if (zs4.admin.util.own(o))add+=' own'; else rem+=' own';

				if (o._.html.toolbarIsOpen){add+=' tbon'; rem+=' tboff'}else{add+=' tboff';rem+=' tbon'}
				if (zs4.is.boolean(o._.html.expanded)){
					if (o._.html.expanded){
						add+=' on'; rem+=' off'
					}
					else{
						add+=' off';rem+=' on'
					}

				}

				if (o._.html.topElement==true)add+=' top';else rem+=' top';

				if (o._.name == 'zs4')add+=' settings';else rem+=' settings';
				if (o._.name == 'email')add+=' email';else rem+=' email';
				if (o._.name == 'rsa')add+=' rsa';else rem+=' rsa';

				if (o._.flags.get.api())add+=' api';else rem+=' api';
				if (o._.flags.get.scope())add+=' scope';else rem+=' scope';
				if (o._.flags.get.am())add+=' am';else rem+=' am';
				if (o._.flags.get.own())add+=' own';else rem+=' own';
				if (o._.flags.get.arrayio())add+=' arrayio';else rem+=' arrayio';
				if (o._.flags.get.notrans())add+=' notrans';else rem+=' notrans';
				if (o._.flags.get.nodisplay())add+=' nodisplay';else rem+=' nodisplay';;

				addrem(o._.html.e);
				addrem(o._.html.head);
				addrem(o._.html.toggle);
				addrem(o._.html.name);
				addrem(o._.html.c);

				addrem(o._.html.toolbar);
				addrem(o._.html.toolbarContent);
				addrem(o._.html.toolbarToggleOff);
				addrem(o._.html.toolbarToggleOn);

			}).bind(o);
		}

		if (o._.flags.get.scope()){
			zs4.admin.util.addClass(o._.html.e,'scope');
			o._.scope = o;
		}
		else{
			o._.scope = po._.scope;
			zs4.admin.util.removeClass(o._.html.e,'scope');

		}
		zs4.admin.util.setClass(o._.html.e,'am',zs4.admin.util.am(o));
		zs4.admin.util.setClass(o._.html.e,'own',zs4.admin.util.own(o));

		if (o._.html.head==null){
			o._.html.head = document.createElement('zs4-object-head');
			o._.html.e.appendChild(o._.html.head);

			if (o._.type==Object){
				o._.html.toggle = document.createElement('zs4-object-toggle');
				o._.html.head.appendChild(o._.html.toggle);
				zs4.admin.util.addClass(o._.html.toggle,o._.typename);
				o._.html.expanded = false;
				o._.html.toggleOff = function(){
					o._.html.expanded = false;
					o._.html.genericRefresh();
				};
				o._.html.toggleOn = function(){
					o._.html.expanded = true;
					o._.html.genericRefresh();
				};
				o._.html.onToggle = function(){
					if (o._.html.expanded){
						o._.html.toggleOff();
					}
					else {
						o._.html.toggleOn();
					}
				};
				o._.html.toggle.onclick = o._.html.onToggle;
			}

			o._.html.name = document.createElement('zs4-name');
			o._.html.head.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.error = document.createElement('zs4-error');
			zs4.admin.util.addClass(o._.html.error,'hide');
			o._.html.head.appendChild(o._.html.error);

			o._.html.result = document.createElement('zs4-result');
			zs4.admin.util.addClass(o._.html.result,'hide');
			o._.html.head.appendChild(o._.html.result);

			o._.html.toolbar = document.createElement('zs4-toolbar');
			o._.html.head.appendChild(o._.html.toolbar);

					o._.html.tool = new Object();
					o._.html.toolbarIsOpen = false;
					o._.html.toolbarOpen = (function(){
						o._.html.toolbarIsOpen = true;
						o._.html.genericRefresh();
					}).bind(o);
					o._.html.toolbarClose = (function(){
						o._.html.toolbarIsOpen = false;
						o._.html.genericRefresh();
					}).bind(o);

					o._.html.toolbarToggleOff = document.createElement('zs4-toolbar-toggle-off');
					o._.html.head.appendChild(o._.html.toolbarToggleOff);
					o._.html.toolbarToggleOff.onclick = (function(){
						if (o._.html.toolbarIsOpen)o._.html.toolbarClose();
						else o._.html.toolbarOpen();
					}).bind(o);

					o._.html.toolbarContent = document.createElement('zs4-toolbar-content');
					o._.html.toolbar.appendChild(o._.html.toolbarContent);

					o._.html.toolbarToggleOn = document.createElement('zs4-toolbar-toggle-on');
					o._.html.toolbarContent.appendChild(o._.html.toolbarToggleOn);
					o._.html.toolbarToggleOn.onclick = (function(){
						if (o._.html.toolbarIsOpen)o._.html.toolbarClose();
						else o._.html.toolbarOpen();
					}).bind(o);

					o._.html.toolbarHeader = document.createElement('zs4-toolbar-header');
					o._.html.toolbarContent.appendChild(o._.html.toolbarHeader);

					o._.html.toolbarTool = document.createElement('zs4-toolbar-tool');
					o._.html.toolbarContent.appendChild(o._.html.toolbarTool);

					o._.html.toolbarClose();

			if (o._.type==Object){
				o._.html.c = document.createElement('zs4-object-content');
				o._.html.e.appendChild(o._.html.c);

				if (!zs4.is.function(o._.html.submit)){
					o._.html.submit = (function(){
						var count = o._.countProperties();
						if (o._.flags.get.api()&&(o._.html.expanded||count==0)){
							var input = o._.input();
							if (input == null)return;

							zs4.post(o._.wrapRequest(input),function(ret){
								console.log('refreshing object tree');
								zs4.admin.type.object(zs4.admin.rootElementParent,zs4.admin.rootObject);
							});
						}
						else {
							o._.html.onToggle();
						}
					}).bind(o);
				}
				o._.html.name.onclick = o._.html.submit;

				o._.input = (function(){
					var ret = new Object();

					for (var n in o){
						//if (zs4.is.name(n))console.log(n);
						if (!zs4.is.type(o[n])||!zs4.is.function(zs4.admin.type[o[n]._.typename]))continue;

						var prop = o[n]._.input();
						if (prop != null)ret[n]=prop;
					}

		      //console.log(ret);
					return ret;
		    }).bind(o);

				o._.html.toggleOff();
			}
			else {
				o._.html.c = null;
			}

			new zs4.admin.util.tool(o,'auth');
			new zs4.admin.util.tool(o,'about');
			o._.html.tool.auth.select.onclick();
		}

	},

	refreshNameInput:function(po,o){
		zs4.admin.util.setClass(o._.html.name,'noset',o._.flags.get.noset());
		zs4.admin.util.setClass(o._.html.input,'noset',o._.flags.get.noset());

		zs4.admin.util.setClass(o._.html.e,'nodisplay',o._.flags.get.nodisplay());
	},
	refreshCallback:function(THIS){
		//console.log('refreshCallback('+THIS._.path+')')
		if (THIS._.cberror == null){
			zs4.admin.util.addClass(THIS._.html.error,'hide');
		}
		else {
			THIS._.html.error.textContent = THIS._.cberror.text;
			zs4.admin.util.removeClass(THIS._.html.error,'hide');
		}

		if (THIS._.cbresult == null){
			zs4.admin.util.addClass(THIS._.html.result,'hide');
		}
		else {
			THIS._.html.result.textContent = 'result!';
			zs4.admin.util.removeClass(THIS._.html.result,'hide');
		}
	},

}

zs4.admin.type = {
	array:function(po,o){
		zs4.admin.type.object(po,o);

		if (!zs4.is.function(o._.html.refresh)){
			o._.html.refresh = (function(){
				console.log('inside '+o._.path+'.html.refresh()');
				//console.log(o.array._.value);

				for (var n in o.array._.value){
					//console.log('refresh('+n+')');
					if (!zs4.is.type(o.array[n])){
						//console.log('new('+n+')');
						var nu = o.template._.new();
						nu._.flags.value =
						nu._.flags.set.notrans(false);
						nu._.name = n;
						o.array._.property(nu);
					}
					//console.log('load('+n+')');
					o.array[n]._.load(o.array._.value[n]);
					zs4.admin.type.object(o.array,o.array[n]);
				}

				for (var n in o.array){
					if (!zs4.is.type(o.array[n]))continue;
					if (!o.array._.value.hasOwnProperty(n)){
						if (zs4.is.function(o.array[n]._.cleanup))o.array[n]._.cleanup();
            o.array._.value[n]=null;
            o.array[n]=null;
					}
				}
  			zs4.admin.type.object(o,o.array);

			}).bind(o);
		}

		for (var n in o){
			//if (zs4.is.name(n))console.log(n);
			if (!zs4.is.type(o[n])||!zs4.is.function(zs4.admin.type[o[n]._.typename]))continue;
			zs4.admin.type[o[n]._.typename](o,o[n]);
		}

	},
	auth:function(po,o){
		zs4.admin.type.object(po,o);
	},
	boolean:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'checkbox');

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				if (this._.html.input.checked==true)return true;
				return false;
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.checked = po._.value[o._.name];
		zs4.admin.util.refreshNameInput(po,o);
	},
	bye:function(po,o){
		zs4.admin.type.object(po,o);
	},
	date:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseInt(this._.html.input.value);
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = parseInt(po._.value[o._.name]);
		zs4.admin.util.refreshNameInput(po,o);
	},
	email:function(po,o){
		zs4.admin.type.string(po,o);
	},
	head:function(po,o){
		zs4.admin.type.object(po,o);
	},
	integer:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseInt(this._.html.input.value);
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = parseInt(po._.value[o._.name]);
		zs4.admin.util.refreshNameInput(po,o);
	},
	name:function(po,o){
		zs4.admin.type.string(po,o);
	},
	number:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseFloat(this._.html.input.value);
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = parseFloat(po._.value[o._.name]);
		zs4.admin.util.refreshNameInput(po,o);
	},
	object:function(po,o){
		//if (!zs4.is.type(o) || o._.typename!='object'){
		if (!zs4.is.type(o)||o._.type!=Object){
			console.log('not a valid zs4 object');
			console.log(o);
			return null;
		}
		zs4.admin.util.unknown(po,o);

		//console.log('checking ui for object '+o._.path);
		if (o._.html.c==null){
			//console.log('make ui for object '+o._.name);


		}

		o._.html.genericRefresh();

		zs4.admin.util.refreshCallback(o);

		for (var n in o){
			//if (zs4.is.name(n))console.log(n);
			if (!zs4.is.type(o[n]))continue;
			if (!zs4.is.function(zs4.admin.type[o[n]._.typename])){
				console.log('o[n]._.typename '
				+o[n]._.typename
				+' @'
				+o[n]._.path
				+' IS NOT A CONSTRUCTOR!!!')
				continue;
			}
			zs4.admin.type[o[n]._.typename](o,o[n]);
		}


		if (o._.flags.value & o._.flags.scope){
			console.log('change label for scope '+o._.path+': '+o._.value.zs4.head.title);
			o._.scope = o;
			if (zs4.is.string(o._.value.zs4.head.title) && o._.value.zs4.head.title.length > 0){
				o._.html.name.textContent = o._.value.zs4.head.title;
			}
			else {
				o._.html.name.textContent = o._.name;
			}
		}
		else{
			o._.scope = po._.scope;
			//zs4.admin.util.removeClass(o._.html.toggle,'scope');
		}


		if (zs4.is.function(o._.html.refresh))o._.html.refresh();
	},
	password:function(po,o){
		zs4.admin.type.string(po,o);
	},
	scope:function(po,o){
		zs4.admin.type.object(po,o);
	},
	scopeitem:function(po,o){
    zs4.admin.util.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = o._.scope._.getScopeItems();
        //console.log (arr);
        //for (var i = (o._.html.input.size-1) ; i >= 0 ; i-- )o._.html.input.remove(i);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i].label;
					option.value = arr[i].value;
        	o._.html.input.add(option);
        }
      }
    }

    o._.html.refreshOptions(o);
    //o._.html.input.readOnly = o._.flags.get.noset();
    o._.html.input.value = po._.value[o._.name];
    zs4.admin.util.refreshNameInput(po,o);
  },
  scopescope:function(po,o){
		zs4.admin.util.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				console.log(o._.html.input.value);
			}

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = o._.scope._.getScopeScopes();
        //console.log (arr);
        //for (var i = (o._.html.input.size-1) ; i >= 0 ; i-- )o._.html.input.remove(i);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i].label;
					option.value = arr[i].value;
          o._.html.input.add(option);
        }
      }
    }

    o._.html.refreshOptions(o);
    //o._.html.input.readOnly = o._.flags.get.noset();
    o._.html.input.value = po._.value[o._.name];
    zs4.admin.util.refreshNameInput(po,o);
  },
	string:function(po,o){
		zs4.admin.util.unknown(po,o);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			var typeAttr = 'text';
			if (o._.typename=='password')typeAttr='password';
			o._.html.input.setAttribute('type', typeAttr);

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return this._.html.input.value;
			}).bind(o);
		}
		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = po._.value[o._.name];
		zs4.admin.util.refreshNameInput(po,o);
	},
	text:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('textarea');
			o._.html.e.appendChild(o._.html.input);

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return this._.html.input.value;
			}).bind(o);
		}
		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = po._.value[o._.name];
		zs4.admin.util.refreshNameInput(po,o);
	},
};

//zs4.session = {};

zs4.css = zs4.loadcss('/style.css');
zs4.admin.type.object(null,zs4.location.get());
zs4.admin.rootObject._.html.toggleOn();
zs4.admin.rootObject.zs4._.html.toggleOn();
