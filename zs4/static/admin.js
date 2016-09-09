////////////////////////////////////////////////////////////////////////"+"
'use strict';

zs4.admin = new Object({debug:true,});

zs4.admin.util = {
	clseps:' ',
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
		if (e==null||c==null)return;
		if (tof)return zs4.admin.util.addClass(e,c);
		else return zs4.admin.util.removeClass(e,c);
	},
	setIcon:function(e,icon){
		if (e==null||icon==null)return;
		var cls = zs4.string.split.separators(e.className,zs4.admin.util.clseps);
		for (var i = (cls.length-1) ; i >= 0; i--){
			if (cls[i].substr(0,5)=='icon-')
			cls.splice(i,1);
		}
		if (zs4.is.string(icon))cls.push('icon-'+icon);
		var ret = '';
		for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	setAnimate:function(e,icon){
		if (e==null||icon==null)return;
		var cls = zs4.string.split.separators(e.className,zs4.admin.util.clseps);
		for (var i = (cls.length-1) ; i >= 0; i--){
			if (cls[i].substr(0,5)=='animate-')
			cls.splice(i,1);
		}
		if (zs4.is.string(icon))cls.push('animate-'+icon);
		var ret = '';
		for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	addClass:function(e,c){
		if (e==null||c==null)return;
		var set = zs4.string.split.separators(c,zs4.admin.util.clseps);
		if  (set.length==0)return;
		var cls = zs4.string.split.separators(e.className,zs4.admin.util.clseps);
		for (var i = 0 ; i < set.length ; i++)zs4.string.array.add.new(cls,'zs4-'+set[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	removeClass:function(e,c){
		if (e==null||c==null)return;
		var rem = zs4.string.split.separators(c,zs4.admin.util.clseps);
		if  (rem.length==0)return;
		var cls = zs4.string.split.separators(e.className,zs4.admin.util.clseps);
		for (var i = 0 ; i < rem.length ; i++)zs4.string.array.remove.string(cls,'zs4-'+rem[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	tool:function(o,name){
		this.active = false;
		this.name = name;
		o._.html.tool[name] = this;

		//o._.html.topElement=true;
		this.select = document.createElement('zs4-tool-tab');
		o._.html.toolbarHeader.appendChild(this.select);
		zs4.admin.util.setIcon(this.select,name);
		if (o._.html.topElement)zs4.admin.util.addClass(this.select,'top');
		//this.select.textContent = name;
		this.pane = document.createElement('zs4-tool-pane');
		o._.html.toolbarTool.appendChild(this.pane);
		if (o._.html.topElement)zs4.admin.util.addClass(this.select,'top');
		//this.pane.textContent = 'tool pane for '+name;
		this.refreshTool = function(){};

		this.deselectAll = (function(){
			var count = 0;
			for (var n in o._.html.tool){
				zs4.admin.util.removeClass(o._.html.tool[n].select,'current');
				zs4.admin.util.removeClass(o._.html.tool[n].pane,'current');
				o._.html.tool[n].active = false;
				zs4.admin.util.addClass(o._.html.tool[n].pane,'nodisplay');
				zs4.admin.util.setIcon(o._.html.tool[n].select,o._.html.tool[n].name);
			}
			zs4.admin.util.addClass(o._.html.toolbarTogglePane,'current');
			zs4.admin.util.removeClass(o._.html.toolbarTogglePane,'nodisplay');
			zs4.admin.util.addClass(o._.html.toolbarToggle,'current');
		}).bind(this);

		this.select.onclick = (function(){
			//console.log(this);
			//console.log(this.name);
			//console.log(o._.path+'.zs4.admin.tool.'+name);
			var active = false;
			for (var n in o._.html.tool){
				//console.log('...this.name='+this.name+'  o._.html.tool[n].name='+o._.html.tool[n].name);
				if (name==o._.html.tool[n].name){
					//console.log('... CURRENT: '+n);
					//if (this.active){
					//	o._.html.tool[n].active = false;
					//	zs4.admin.util.removeClass(o._.html.tool[n].select,'current');
					//	zs4.admin.util.removeClass(o._.html.tool[n].pane,'current');
					//}
					//else {
						active = o._.html.tool[n].active = true;
						zs4.admin.util.addClass(o._.html.tool[n].select,'current');
						zs4.admin.util.addClass(o._.html.tool[n].pane,'current');
					//}
				}
				else {
					//console.log('... IDLE: '+n);
					zs4.admin.util.removeClass(o._.html.tool[n].select,'current');
					zs4.admin.util.removeClass(o._.html.tool[n].pane,'current');
					o._.html.tool[n].active = false;
				}

				if (o._.html.tool[n].active){
					zs4.admin.util.removeClass(o._.html.tool[n].pane,'nodisplay');
					zs4.admin.util.setIcon(o._.html.tool[n].select,o._.html.tool[n].name);
					this.refreshTool();
				}
				else {
					zs4.admin.util.addClass(o._.html.tool[n].pane,'nodisplay');
					zs4.admin.util.setIcon(o._.html.tool[n].select,o._.html.tool[n].name);
				}
			}
			if (active){
				zs4.admin.util.addClass(o._.html.toolbarTogglePane,'nodisplay');
				zs4.admin.util.removeClass(o._.html.toolbarTogglePane,'current');
				zs4.admin.util.removeClass(o._.html.toolbarToggle,'current');
			}
			else{
				zs4.admin.util.removeClass(o._.html.toolbarTogglePane,'nodisplay');
				zs4.admin.util.addClass(o._.html.toolbarTogglePane,'current');
				zs4.admin.util.addClass(o._.html.toolbarToggle,'current');
			}
		}).bind(this);
	},
	about:function(o){
		var THIS = this;
		zs4.admin.util.tool.call(THIS,o,'about');
		THIS.about = new Object();
		function addValue(n,v){
			var lbl = n+'_label';
			var val = n+'_value';

			THIS.about[n] = document.createElement('zs4-about-item');
			THIS.pane.appendChild(THIS.about[n]);

			THIS.about[lbl] = document.createElement('zs4-about-label');
			THIS.about[lbl].textContent = n;
			THIS.about[n].appendChild(THIS.about[lbl]);

			THIS.about.colon = document.createElement('zs4-about-colon');
			THIS.about.colon.textContent = ': ';
			THIS.about[n].appendChild(THIS.about.colon);

			THIS.about[val] = document.createElement('zs4-about-value');
			if (zs4.is.string(v))	THIS.about[val].textContent = '\''+v+'\'';
			else	THIS.about[val].textContent = v;
			THIS.about[n].appendChild(THIS.about[val]);
		}
		addValue('name',o._.name);
		addValue('path',o._.path);
		addValue('typename',o._.typename);
		if (zs4.is.type(o._.inscope))addValue('inscope',o._.inscope._.path);
		addValue('flags',o._.flags.getString());
		if (o._.type==Number){
			if (zs4.is.number(o._.min)&&o._.min>0)addValue('min',o._.min);
			if (zs4.is.number(o._.max))addValue('max',o._.max);
		}
		if (o._.type==String){
			if (zs4.is.number(o._.minlength))addValue('minlength',o._.minlength);
			if (zs4.is.number(o._.maxlength))addValue('maxlength',o._.maxlength);
		}
		//if (o._.==true)addValue('hidden',true);

	},
	auth:function(o){
		var THIS = this;
		zs4.admin.util.tool.call(THIS,o,'auth');
		THIS.auth = new Object();

		THIS.auth.add = document.createElement('zs4-auth-add');
		zs4.admin.util.setIcon(THIS.auth.add,'plus')
		THIS.pane.appendChild(THIS.auth.add);
		THIS.auth.add.onclick = function(){
			var typ = THIS.auth.type.value;
			if (!zs4.is.string(typ)||typ=='')return;
			var user = THIS.auth.user.value;
			if (!zs4.is.string(user)||user=='')return;

			zs4.admin.util.setIcon(THIS.auth.add,'spin');
			var input = new Object({_:{auth:{type:typ,add:user,}}});
			zs4.post(o._.wrapRequest(input),function(ret){
				zs4.admin.util.setIcon(THIS.auth.add,'plus');
				THIS.redisplayTable()
			});

		};

		THIS.auth.type = document.createElement('select');
		THIS.auth.type.className = 'authtype';
		THIS.auth.type.oninput = function(){
			THIS.refreshUsers();
			THIS.refreshTable();
		};
		//THIS.auth.type.oninput = THIS.refreshTool;
		THIS.pane.appendChild(THIS.auth.type);

		THIS.refreshAuthTypes = function(){
			THIS.auth.type.innerHTML = '';

			function appendAuthType(t){
				var option = document.createElement('option');
				option.className = 'authtype';

				option.text = t;
				option.value = t;

				THIS.auth.type.add(option);
				return option;
			};


			var blank = appendAuthType('');
			if (o._.flags.get.authgetauth())appendAuthType('getauth');
			if (o._.flags.get.authsetauth())appendAuthType('setauth');
			if (o._.flags.get.am()){
				appendAuthType('authgetauth');
			}
			if (o._.flags.get.own()){
				appendAuthType('authsetauth');
			}

		};

		THIS.auth.user = document.createElement('select');
		THIS.auth.user.className = 'authuser';
		THIS.pane.appendChild(THIS.auth.user);

		THIS.auth.table = document.createElement('zs4-auth-table');
		THIS.pane.appendChild(THIS.auth.table);

		THIS.refreshUsers= function(){
			var arr = o._.scope._.getScopeScopes();
			console.log(arr);
			THIS.auth.user.innerHTML = '';

			var option = document.createElement('option');
			option.className = 'placeholder';
			option.text = 'select user';
			option.value = '';
			THIS.auth.user.add(option);

			for (var i = 0 ; i < arr.length ; i++){
				option = document.createElement('option');
				option.text = arr[i].value;
				option.value = arr[i].value;
				THIS.auth.user.add(option);
			}
		}

		THIS.redisplayTable= function(){
			THIS.auth.table.innerHTML = '';
			var typ = THIS.auth.type.value;
			if (!zs4.is.string(typ)||typ==''){
					THIS.auth.table.innerHTML = 'no authorization type selected.';
					return;
			}
			o._.print('redisplaying auth table');

			var arr;
			if (typ == 'getauth')arr = o._.authGet;
			else if (typ == 'setauth')arr = o._.authSet;
			else if (typ == 'authgetauth')arr = o._.authGetAuth;
			else if (typ == 'authsetauth')arr = o._.authSetAuth;
			else {
				THIS.auth.table.innerHTML = typ+' is not a valid auth type.';
				return;
			}

			if (arr.length == 0){
				THIS.auth.table.innerHTML = 'no '+typ+' authorizations.';
				return;
			}
			for (var i = 0 ; i < arr.length ; i++){
				var line = document.createElement('zs4-auth-item');
				THIS.auth.table.appendChild(line);

				var remove = document.createElement('zs4-auth-remove');
				zs4.admin.util.setIcon(remove,'cancel')
				line.appendChild(remove);
				var id = arr[i];
				remove.onclick = function(){
					var typ = THIS.auth.type.value;
					if (!zs4.is.string(typ)||typ=='')return;

					var input = new Object({_:{auth:{type:typ,remove:id,}}});
					zs4.admin.util.setIcon(THIS.auth.add,'spin');
					zs4.post(o._.wrapRequest(input),function(ret){
						zs4.admin.util.setIcon(THIS.auth.add,'plus');
						THIS.redisplayTable()
					});
				};

				var user = document.createElement('zs4-auth-user');
				user.textContent = arr[i];
				line.appendChild(user);
			}

		}

		THIS.refreshTable= function(){
			console.log('refreshing auth table \''+THIS.auth.type.value+'\'');
			THIS.auth.table.innerHTML = '';
			var typ = THIS.auth.type.value;
			if (!zs4.is.string(typ)||typ==''){
					THIS.auth.table.innerHTML = 'no authorization type selected.';
					return;
			}

			//THIS.auth.table.innerHTML = 'showing '+typ;
			zs4.admin.util.setIcon(THIS.auth.add,'spin')
			var input = new Object({_:{auth:{type:typ}}});
			zs4.post(o._.wrapRequest(input),function(ret){
				THIS.redisplayTable();
				zs4.admin.util.setIcon(THIS.auth.add,'plus');
			});
		};

		THIS.refreshTool = function(){
			THIS.refreshAuthTypes();
			THIS.refreshUsers();
			THIS.refreshTable();
		};

	},
	console:function(o){
		var THIS = this;
		zs4.admin.util.tool.call(THIS,o,'console');
		THIS.console = new Object();

		THIS.console.windowlabel = document.createElement('zs4-console-label');
		THIS.console.windowlabel.textContent = 'window';
		THIS.pane.appendChild(THIS.console.windowlabel);

		THIS.console.window = document.createElement('input');
		THIS.console.window.type = 'checkbox';
		THIS.pane.appendChild(THIS.console.window);
		THIS.console.window.onchange = function(){
			//o._.print('THIS.console.node.onchange');
			o._.print('changing THIS.console.window.checked to '+THIS.console.window.checked);
			if (THIS.console.window.checked) {
				zs4.string.array.add.new(zs4.console.arr,o._.path);
				o._.print('window.console turned on');
			}
			else {
				o._.print('turning off window.console');
				zs4.string.array.remove.string(zs4.console.arr,o._.path);
			}
		}

		if (o._.flags.get.authroot()){
			THIS.console.nodelabel = document.createElement('zs4-console-label');
			THIS.console.nodelabel.textContent = 'node';
			THIS.pane.appendChild(THIS.console.nodelabel);

			THIS.console.node = document.createElement('input');
			THIS.console.node.type = 'checkbox';
			THIS.pane.appendChild(THIS.console.node);
			THIS.console.node.onchange = function(){
				o._.print('changing THIS.console.node.checked to '+THIS.console.node.checked);
				var input;
				if (THIS.console.node.checked) input = new Object({_:{console:{switch:true,}}});
				else input = new Object({_:{console:{switch:false,}}});

				zs4.post(o._.wrapRequest(input),function(ret){THIS.redisplayNode()});
			}

			THIS.redisplayNode = function(){
				THIS.console.node.checked = o._.console.switch;
			};
			THIS.refreshNode= function(){
				console.log('refreshing node value \''+THIS.console+'\'');

				var input = new Object({_:{console:{}}});
				zs4.post(o._.wrapRequest(input),function(ret){THIS.redisplayNode()});
			};

			THIS.refreshTool = function(){
				THIS.refreshNode();
			};
		}
	},
	add:function(o){
		var THIS = this;
		zs4.admin.util.tool.call(THIS,o,'add');

		function createOnClick(ele,name){
			ele.onclick = function(){
				var prop = new zs4.type[name]();
				prop._.name = zs4.integer.to.name(o._.addId++);
				o._.property(prop);
				prop._.flags.set.deletable(true);
				o._.html.toolbarIsOpen = false;
				o._.html.refreshAll();
			}
		};

		for (var i = 0 ; i < o._.addTypes.length ; i++){
			var name = ''+o._.addTypes[i];
			var ele = document.createElement('zs4-add-'+name);
			THIS.pane.appendChild(ele);
			zs4.admin.util.setIcon(ele,name);
			createOnClick(ele,name);
		}

	},

	unknown:function(po,o){
		if (!zs4.is.object(o._.html))o._.html = new Object();
		if (o._.input==null)o._.input = (function(){return null;}).bind(o);
		if (o._.response==null)o._.response = (function(r){console.log(r);}).bind(o);

		if (!zs4.is.boolean(o._.html.uninitialized))o._.html.uninitialized=true;
		else o._.html.uninitialized=false;

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

		if (o._.html.refreshAll==null){
			o._.html.refreshAll = function(){
				o._.print('refreshing object tree');
				zs4.admin.rootObject._.localRefresh();
				zs4.admin.type.object(zs4.admin.rootElementParent,zs4.admin.rootObject);
			}
		}

		if (o._.html.icon == null){
			o._.html.icon = new Object({
				on:'minus',
				off:'plus',
			});
			if (o._.type != Object){
				if (o._.flags.get.required()){o._.html.icon.off=o._.html.icon.on='required'}
				else if (o._.flags.get.noset()){o._.html.icon.off=o._.html.icon.on='info'}
				else {o._.html.icon.off=o._.html.icon.on='none'}
			}
			else {
				o._.html.icon.off=o._.typename;
				o._.html.icon.on='minus';
			}

		}

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
				o._.html.top = new Object({value:{}});
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


				if (o._.html.toolbarIsOpen){
					add+=' tbon'; rem+=' tboff';
					if (o._.html.expanded){
						zs4.admin.util.removeClass(o._.html.toolbarHeader,'nodisplay');
						zs4.admin.util.removeClass(o._.html.toolbar,'nodisplay');
						zs4.admin.util.setIcon(o._.html.toolbarToggle,'tool');
					}
					else if (o._.html.toolbar!=null){
						zs4.admin.util.addClass(o._.html.toolbarHeader,'nodisplay');
						zs4.admin.util.addClass(o._.html.toolbar,'nodisplay');
						zs4.admin.util.setIcon(o._.html.toolbarToggle,'tool');
					}
					if (o._.type==Object){
						if (o._.html.c != null)zs4.admin.util.addClass(o._.html.c,'nodisplay');
					}
					else {
						if (o._.html.input != null)zs4.admin.util.addClass(o._.html.input,'nodisplay');
					}
				}
				else{
					add+=' tboff';rem+=' tbon';
					if (o._.html.toolbar!=null){
						zs4.admin.util.addClass(o._.html.toolbarHeader,'nodisplay');
						zs4.admin.util.addClass(o._.html.toolbar,'nodisplay');
						zs4.admin.util.setIcon(o._.html.toolbarToggle,'tool');
					}
					if (o._.type==Object){
						if (o._.html.c != null)zs4.admin.util.addClass(o._.html.c,'nodisplay');
					}
					else {
						if (o._.html.input != null)zs4.admin.util.addClass(o._.html.input,'nodisplay');
					}
				}

				if (o._.html.expanded==true){
					add+=' on'; rem+=' off';
					if (o._.html.toolbarIsOpen){
						zs4.admin.util.setIcon(o._.html.toggle,'to-start');
					}
					else{
						if (o._.html.topElement)zs4.admin.util.setIcon(o._.html.toggle,'logo');
						else zs4.admin.util.setIcon(o._.html.toggle,o._.html.icon.on);
						if (o._.type==Object){
							if (o._.html.c != null)zs4.admin.util.removeClass(o._.html.c,'nodisplay');
						}
						else {
							if (o._.html.input != null)zs4.admin.util.removeClass(o._.html.input,'nodisplay');
						}
					}
					if (o._.html.toolbar != null){
						zs4.admin.util.removeClass(o._.html.toolbarToggle,'nodisplay');
					}
				}
				else{
					add+=' off';rem+=' on'
					zs4.admin.util.setIcon(o._.html.toggle,o._.html.icon.off);
					if (o._.html.toolbar != null){
						zs4.admin.util.addClass(o._.html.toolbarToggle,'nodisplay');
					}
				}

				if (o._.html.topElement==true){
					zs4.admin.util.setIcon(o._.html.toggle,'logo');
					var top = o._.html.top;
					add+=' top';
					if (o._.flags.get.authroot())add+=' root';else rem+=' root';
					var wtit = 'zs4';
					if (o.zs4.head.title._.value != '')wtit+= ':' + o.zs4.head.title._.value;
					if (top.value.utitle != '')wtit+=':'+top.value.utitle;
					if (document.title != wtit)document.title = wtit;

					if (o._.html.appIsOpen){
						zs4.admin.util.removeClass(o._.html.dialogHeader,'nodisplay');
						zs4.admin.util.removeClass(o._.html.appElement,'nodisplay');
						zs4.admin.util.addClass(o._.html.c,'nodisplay');
					}
					else {
						zs4.admin.util.addClass(o._.html.dialogHeader,'nodisplay');
						zs4.admin.util.addClass(o._.html.appElement,'nodisplay');
						zs4.admin.util.removeClass(o._.html.c,'nodisplay');

					}
				}
				else {
					rem+=' top';

				}
				if (o._.name == 'zs4')add+=' settings';else rem+=' settings';
				if (o._.name == 'email')add+=' email';else rem+=' email';
				if (o._.name == 'rsa')add+=' rsa';else rem+=' rsa';

				if (o._.flags.get.api())add+=' api';else rem+=' api';
				if (o._.flags.get.scope())add+=' scope';else rem+=' scope';
				if (o._.flags.get.am())add+=' am';else rem+=' am';
				if (o._.flags.get.own())add+=' own';else rem+=' own';
				if (o._.flags.get.notrans())add+=' notrans';else rem+=' notrans';

				if (o._.type == Object){
					add+=' object'; rem+=' value';
				}
				else {
					add+=' value'; rem+=' object';
					if (o._.flags.get.required()){o._.html.icon.off=o._.html.icon.on='required'}
					else if (o._.flags.get.noset()){o._.html.icon.off=o._.html.icon.on='info'}
					else {o._.html.icon.off=o._.html.icon.on='none'}

					if (o._.html.input != null)zs4.admin.util.setClass(o._.html.input,'noset',o._.flags.get.noset());
				}


				addrem(o._.html.toolbar);
				addrem(o._.html.toolbarHeader);
				addrem(o._.html.toolbarContent);
				addrem(o._.html.toolbarTool);
				addrem(o._.html.toolbarToggle);
				addrem(o._.html.c);
				addrem(o._.html.input);
				addrem(o._.html.head);
				addrem(o._.html.toggle);
				addrem(o._.html.name);


				addrem(o._.html.e);

				zs4.admin.util.setClass(o._.html.e,'nodisplay',o._.flags.get.nodisplay());

				if (o._.cberror == null){
					zs4.admin.util.addClass(o._.html.error,'nodisplay');
				}
				else {
					o._.html.error.textContent = o._.cberror.text;
					zs4.admin.util.removeClass(o._.html.error,'nodisplay');
				}

				if (o._.cbresult == null){
					zs4.admin.util.addClass(o._.html.result,'nodisplay');
				}
				else {
					o._.html.result.textContent = '';
					zs4.admin.util.removeClass(o._.html.result,'nodisplay');
				}

			}).bind(o);

			if (o._.type == Object){
				o._.html.sort = (function(foo,descend){
					var a = o._.sort(foo,descend);
					if (a.length > 1){
						for (var i = 0 ; i < (a.length-1) ; i++){
							this._.html.c.removeChild(a[i]._.html.e);
							this._.html.c.insertBefore(a[i]._.html.e, this._.html.c.childNodes[i]);
						}

					}
				}).bind(o);
			}
		}

		if (o._.flags.get.scope()){
			zs4.admin.util.addClass(o._.html.e,'scope');
			o._.scope = o;
		}
		else{
			if (zs4.is.type(po))o._.scope = po._.scope;
			zs4.admin.util.removeClass(o._.html.e,'scope');

		}

		zs4.admin.util.setClass(o._.html.e,'am',zs4.admin.util.am(o));
		zs4.admin.util.setClass(o._.html.e,'own',zs4.admin.util.own(o));

		if (o._.html.head==null){
			o._.html.head = document.createElement('zs4-object-head');
			o._.html.e.appendChild(o._.html.head);

			o._.html.toggle = document.createElement('zs4-object-toggle');
			o._.html.head.appendChild(o._.html.toggle);
			zs4.admin.util.setIcon(o._.html.toggle,'minus');
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
				if (o._.html.toolbarIsOpen && o._.html.toolbar != null){
					o._.html.toolbarClose();
				}
				if (o._.html.topElement==true){
					o._.html.toggleOn()
					if (o._.html.appIsOpen && (o._.flags.get.own()||zs4.admin.debug)){
						o._.html.appIsOpen=false;
						o._.html.toggleOn()
					}
					else {
						o._.html.appIsOpen = true;
						if (o._.html.toolbar!=null)o._.html.toolbarClose();
						o._.html.toggleOff()
					}
				}
				else if (o._.path=='zs4'){
					o._.html.toggleOn()
				}
				else {
					if (o._.html.expanded){
						o._.html.toggleOff();
					}
					else {
						o._.html.toggleOn();
					}
				}
			};
			o._.html.toggle.onclick = o._.html.onToggle;

			o._.html.name = document.createElement('zs4-name');
			o._.html.head.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.error = document.createElement('zs4-error');
			zs4.admin.util.setIcon(o._.html.error,'error');
			zs4.admin.util.addClass(o._.html.error,'nodisplay');
			o._.html.head.appendChild(o._.html.error);

			o._.html.result = document.createElement('zs4-result');
			zs4.admin.util.addClass(o._.html.result,'nodisplay');
			zs4.admin.util.setIcon(o._.html.result,'true');
			o._.html.head.appendChild(o._.html.result);
			o._.html.result.onclick = function(){
				if (o._.cbresult != null)console.log(o._.cbresult);
			};

			o._.html.spin = document.createElement('zs4-spin');
			zs4.admin.util.setIcon(o._.html.spin,'spin');
			zs4.admin.util.setAnimate(o._.html.spin,'spin');
			zs4.admin.util.addClass(o._.html.spin,'nodisplay');
			o._.html.head.appendChild(o._.html.spin);

			o._.html.c == null;
			o._.html.input == null;
			o._.html.toolbar == null;
			o._.html.toolbarIsOpen = false;
			o._.html.defaultTool = null;

			o._.html.quickupdate = function(input){
				if (input == null)return;
				zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
				zs4.post(o._.wrapRequest(input),function(ret){
					o._.html.refreshAll();
					zs4.admin.util.addClass(o._.html.spin,'nodisplay');
				});

			};

			if (o._.flags.value & o._.flags.am || o._.flags.value & o._.flags.own || (o._.flags.get.apiarg())){
				o._.html.toolbarToggle = document.createElement('zs4-toolbar-toggle');
				o._.html.head.appendChild(o._.html.toolbarToggle);
				zs4.admin.util.setIcon(o._.html.toolbarToggle,'settings');
				o._.html.toolbarToggle.onclick = (function(){
					if (o._.html.toolbarIsOpen){
						o._.html.defaultTool.deselectAll();
					}
					else {
						o._.html.toolbarOpen();
					}
				}).bind(o);

				o._.html.toolbarHeader = document.createElement('zs4-toolbar-header');
				o._.html.head.appendChild(o._.html.toolbarHeader);

				o._.html.toolbar = document.createElement('zs4-toolbar');
				o._.html.head.appendChild(o._.html.toolbar);

				o._.html.tool = new Object();
				o._.html.toolbarOpen = (function(){
					o._.html.toolbarIsOpen = true;
					o._.html.genericRefresh();
				}).bind(o);
				o._.html.toolbarClose = (function(){
					o._.html.toolbarIsOpen = false;
					o._.html.genericRefresh();
				}).bind(o);

				o._.html.toolbarTool = document.createElement('zs4-toolbar-tool');
				o._.html.toolbar.appendChild(o._.html.toolbarTool);

				//
				o._.html.toolbarTogglePane = 	document.createElement('zs4-tool-pane');
				o._.html.toolbarTool.appendChild(o._.html.toolbarTogglePane);

				o._.html.toolbarTogglePane.textContent = 'toolbarTogglePane';

				o._.html.toolbarClose();

				o._.html.defaultTool = null;
				if (o._.addTypes.length > 0){
					if (!o._.html.tool.hasOwnProperty('add'))new zs4.admin.util.add(o);
					o._.html.defaultTool = o._.html.tool.add;
				}
				if (!o._.html.tool.hasOwnProperty('about'))new zs4.admin.util.about(o);
				if (!o._.html.tool.hasOwnProperty('auth')){
					if (o._.flags.get.authgetpublic()&&o._.flags.get.authsetpublic())
					{

					}
					else {
						new zs4.admin.util.auth(o);
					}
				}
				if (!o._.html.tool.hasOwnProperty('console'))new zs4.admin.util.console(o);
				o._.html.tool.about.deselectAll();

				//if (o._.html.defaultTool==null)o._.html.defaultTool = o._.html.tool.about;
				//o._.html.defaultTool.select.onclick();

				if (o._.html.defaultTool==null)o._.html.defaultTool = o._.html.tool.about;
				else o._.html.defaultTool.select.onclick();

			}

			if (o._.type==Object){
				o._.html.c = document.createElement('zs4-object-content');
				o._.html.e.appendChild(o._.html.c);

				if (!zs4.is.function(o._.html.submit)){
					o._.html.submit = (function(){
						var count = o._.countProperties();
						if (o._.flags.get.api()&&(o._.html.expanded||count==0)){
							var input = o._.input();
							if (input == null)return;
							zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
							zs4.admin.util.addClass(o._.html.toolbarToggle,'nodisplay');
							zs4.post(o._.wrapRequest(input),function(ret){
								o._.html.refreshAll();
								zs4.admin.util.addClass(o._.html.spin,'nodisplay');
								zs4.admin.util.removeClass(o._.html.toolbarToggle,'nodisplay');
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

			if (o._.html.topElement==true){
				var top = o._.html.top;
				top.value.uscope = null;
				top.value.utitle = '';

				if (zs4.is.string(zs4.THIS._.token)&&zs4.is.string(zs4.THIS._.scopath)){
					top.value.uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
					if (top.value.uscope!=null){
						top.userHead = document.createElement('zs4-user-head');
						o._.html.head.appendChild(top.userHead);

						top.userName = document.createElement('zs4-user-name');
						top.userHead.appendChild(top.userName);

						if (zs4.THIS._.scopath==''){
							top.value.utitle = 'root';
						}
						else if (top.value.uscope.zs4.head.title._.value.trim()==''){
							top.value.utitle = zs4.THIS._.scopath;
						}
						else {
							top.value.utitle = top.value.uscope.zs4.head.title._.value;
						}
						top.userName.textContent = top.value.utitle;
					}
				}

				o._.html.appIsOpen = true;
				o._.html.dialog = new Object();

				o._.html.dialogHeader= document.createElement('zs4-app-header');
				o._.html.head.appendChild(o._.html.dialogHeader);

				o._.html.searchIcon = document.createElement('zs4-app-tab');

				o._.html.appElement = document.createElement('zs4-app');
				o._.html.e.appendChild(o._.html.appElement);

				o._.html.appWindow = document.createElement('zs4-app-window');
				o._.html.appElement.appendChild(o._.html.appWindow);

				o._.html.appWindow.textContent = 'here is the actual app window';

				o._.html.top.dialog = function(name){
					this.active = false;
					this.name = name;
					o._.html.dialog[name] = this;

					//o._.html.topElement=true;
					this.select = document.createElement('zs4-app-tab');
					o._.html.dialogHeader.appendChild(this.select);
					zs4.admin.util.setIcon(this.select,name);
					zs4.admin.util.removeClass(this.select,'current');
					//this.select.textContent = name;

					this.pane = document.createElement('zs4-app-dialog');
					o._.html.appElement.appendChild(this.pane);
					this.pane.textContent = 'dialog pane for '+name;
					zs4.admin.util.removeClass(this.pane,'current');
					zs4.admin.util.addClass(this.pane,'nodisplay');
					this.refreshDialog = function(){};

					this.select.onclick = (function(){
						var active = false;

						for (var n in o._.html.dialog){
							//console.log('...this.name='+this.name+'  o._.html.tool[n].name='+o._.html.tool[n].name);
							if (name==o._.html.dialog[n].name && o._.html.dialog[n].active==false){
								//console.log('... CURRENT: '+n);
								active = o._.html.dialog[n].active = true;
								zs4.admin.util.addClass(o._.html.dialog[n].select,'current');
								zs4.admin.util.addClass(o._.html.dialog[n].pane,'current');
							}
							else {
								//console.log('... IDLE: '+n);
								o._.html.dialog[n].active = false;
								zs4.admin.util.removeClass(o._.html.dialog[n].select,'current');
								zs4.admin.util.removeClass(o._.html.dialog[n].pane,'current');
							}

							if (o._.html.dialog[n].active){
								zs4.admin.util.removeClass(o._.html.dialog[n].pane,'nodisplay');
								zs4.admin.util.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
								this.refreshDialog();
							}
							else {
								zs4.admin.util.addClass(o._.html.dialog[n].pane,'nodisplay');
								zs4.admin.util.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
							}
						}
						if (active){
							zs4.admin.util.addClass(o._.html.appWindow,'nodisplay');
						}
						else{
							zs4.admin.util.removeClass(o._.html.appWindow,'nodisplay');
						}
					}).bind(this);

				};
				o._.html.top.dialogUser = function(){
					o._.html.top.dialog.call(this,'user');
				};
				o._.html.top.dialogSearch = function(){
					o._.html.top.dialog.call(this,'search');
				};

				new o._.html.top.dialogSearch();

				o._.html.search = document.createElement('input');
				o._.html.search.type = 'text';
				zs4.admin.util.addClass(o._.html.search,'search');
				o._.html.dialogHeader.appendChild(o._.html.search);

				new o._.html.top.dialogUser();
			}

		}

	},

}

zs4.admin.type = {
	array:function(po,o){
		zs4.admin.type.object(po,o);
		//o._.html.icon.on = 'database';
		//o._.html.icon.off = 'database';
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
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					if (o._.html.input.checked==true){
						o._.value = true;
					}
					else {
						o._.value = false;
					}
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					if (o._.html.input.checked==true){
						o._.html.quickupdate(true);
					}
					else {
						o._.html.quickupdate(false);
					}
				}
			};
			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				if (this._.html.input.checked==true)return true;
				return false;
			}).bind(o);
			o._.html.expanded = true;
		}

		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.checked = o._.value;
		o._.html.genericRefresh();
	},
	bye:function(po,o){
		zs4.admin.type.object(po,o);
		//._.html.icon.on = 'bye';
		//o._.html.icon.off = 'bye';
	},
	date:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.parseInt(o._.html.input.value);
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.parseInt(o._.html.input.value));
				}
			};

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseInt(this._.html.input.value);
			}).bind(o);
			o._.html.expanded = true;
		}

		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = parseInt(o._.value);
		o._.html.genericRefresh();
	},
	document:function(po,o){
		zs4.admin.type.scope(po,o);
		//o._.html.icon.on = 'info';
		//o._.html.icon.off = 'info';
	},
	enum:function(po,o){
		zs4.admin.util.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

			o._.html.enumRefresh = function(){
				//console.log(o._.path+'._.html.enumRefresh()');
				o._.html.input.innerHTML = '';
				for (var i = 0 ; i < o._.enum.length ; i++){
					var option = document.createElement('option');
					option.text = o._.enum[i];
					option.value = o._.enum[i];
					o._.html.input.add(option);
				}

			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

			o._.html.expanded = true;
    }
		o._.html.genericRefresh();
		o._.html.enumRefresh();
		o._.html.input.value = o._.value;
	},
	email:function(po,o){
		zs4.admin.type.string(po,o);
	},
	head:function(po,o){
		zs4.admin.type.object(po,o);
		//o._.html.icon.on = 'info';
		//o._.html.icon.off = 'info';
	},
	hi:function(po,o){
		zs4.admin.type.object(po,o);
		//._.html.icon.on = 'bye';
		//o._.html.icon.off = 'bye';
	},
	integer:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.parseInt(o._.html.input.value);
					o._.value = o._.parseInt(o._.html.input.value);
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.parseInt(o._.html.input.value));
				}
			};

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseInt(this._.html.input.value);
			}).bind(o);
			o._.html.expanded = true;
		}

		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = parseInt(o._.value);
		o._.html.genericRefresh();
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
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.parseFloat(o._.html.input.value);
					o._.value = o._.parseFloat(o._.html.input.value);
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.parseFloat(o._.html.input.value));
				}
			};

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return parseFloat(this._.html.input.value);
			}).bind(o);
			o._.html.expanded = true;
		}
		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = parseFloat(o._.value);
		o._.html.genericRefresh();
	},
	object:function(po,o){
		//if (!zs4.is.type(o) || o._.typename!='object'){
		if (!zs4.is.type(o)||o._.type!=Object){
			console.log('not a valid zs4 object');
			console.log(o);
			return null;
		}
		zs4.admin.util.unknown(po,o);

		if (o._.html.uninitialized){
		}

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

		//zs4.admin.util.addClass(e)

		if (zs4.is.type(o.zs4)&&(o._.flags.value & o._.flags.scope)){

			o._.scope = o;
			//if (zs4.is.string(zs4.path.resolve(o,'zs4.head.title._.value')) && o.zs4.head.title._.value.length > 0){
			if (zs4.is.string(o.zs4.head.title._.value) && o.zs4.head.title._.value.length > 0){
				o._.html.name.textContent = o.zs4.head.title._.value;
			}
			else if (!o._.flags.get.notrans()){
				o._.html.name.textContent = o._.name + ' (untitled)';
			}
		}
		else{
			if (zs4.is.type(po))o._.scope = po._.scope;
		}

		o._.html.genericRefresh();
		o._.html.sort();
	},
	password:function(po,o){
		zs4.admin.type.string(po,o);
		//o._.html.icon.on = 'key';
		//o._.html.icon.off = 'password';
	},
	scope:function(po,o){
		zs4.admin.type.object(po,o);
		if (o._.html.topElement){
			o._.html.icon.on = 'logo';
			o._.html.icon.off = 'logo';
		}
		else {
			//._.html.icon.on = 'user';
			//o._.html.icon.off = 'user';
		}
	},
	scopeindex:function(po,o){
    zs4.admin.util.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = o._.scope._.getScopeItems(o._.inscope,o._.flags.index);
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
			o._.html.expanded = true;
    }

    //o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
  },
	scopeindexunique:function(po,o){
    zs4.admin.util.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
				//console.log ('getting options '+o._.path+' inscope='+o._.inscope._.path);
        var arr = o._.scope._.getScopeItems(o._.inscope,o._.flags.index|o._.flags.unique);
        //console.log (arr);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i].label;
					option.value = arr[i].value;
        	o._.html.input.add(option);
        }
      }
			o._.html.expanded = true;
    }
		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
	},
	scopeitem:function(po,o){
    zs4.admin.util.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

      o._.html.refreshOptions = function(o){
        var arr = o._.scope._.getScopeItems(o._.inscope);
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
			o._.html.expanded = true;
    }

		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
  },
  scopescope:function(po,o){
		zs4.admin.util.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

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
			o._.html.expanded = true;
    }
		o._.html.genericRefresh();
		o._.html.refreshOptions(o);
		o._.html.input.value = o._.value;
  },
	search:function(po,o){
		zs4.admin.type.object(po,o);
		//o._.html.icon.on = 'zs4';
		//o._.html.icon.off = 'zs4';
	},
	select:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'select';
		o._.select.check();
	},
	selectall:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'all';
		o._.select.check();
	},
	selectany:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'any';
		o._.select.check();
	},
	selectnone:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'none';
		o._.select.check();
	},
	selectitem:function(po,o){
		o.sc._.flags.set.nodisplay();
		zs4.admin.type.object(po,o);
		o._.html.name.textContent = 'property';
		o._.select.check();
	},
	string:function(po,o){
		zs4.admin.util.unknown(po,o);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			var typeAttr = 'text';
			if (o._.typename=='password')typeAttr='password';
			o._.html.input.setAttribute('type', typeAttr);
			o._.html.input.onchange = function(){
				//alert('++++++++++++++++++');
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
					o._.print(o._.path + ' updated with '+o._.value);
				}
				else if (o._.flags.get.quickupdate()){
					o._.html.quickupdate(o._.html.input.value);
				}
			};

			o._.input = (function(){
				if (o._.flags.get.noset())return null;
				return this._.html.input.value;
			}).bind(o);
			o._.html.expanded = true;
		}
		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = o._.value;
		o._.html.genericRefresh();
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
			o._.html.expanded = true;
		}
		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = o._.value;
		o._.html.genericRefresh();
	},
	type:function(po,o){
		zs4.admin.type.object(po,o);
		//o._.html.icon.on = 'info';
		//o._.html.icon.off = 'info';
	},
	zs4:function(po,o){
		zs4.admin.type.object(po,o);
		//o._.html.icon.on = 'zs4';
		//o._.html.icon.off = 'zs4';
	},
};

//zs4.session = {};

zs4.css = zs4.loadcss('/style.css');
zs4.css.onload = function(){
	zs4.THIS._.print('loaded css \''+'/style.css'+'\'')
	zs4.admin.type.object(null,zs4.location.get());
	zs4.admin.rootObject._.html.toggleOn();
	zs4.admin.rootObject.zs4._.html.toggleOn();
	zs4.THIS._.print('ADMIN LAUNCHED');
};
