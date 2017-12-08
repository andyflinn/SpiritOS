////////////////////////////////////////////////////////////////////////"+"
'use strict';

zs4.admin = new Object({debug:false,});

zs4.admin.util = {
	clseps:' ',
	am:function(o){
		return o._.flags.get.am();
	},
	own:function(o){
		return o._.flags.get.own();
	},
	root:function(){
		if (zs4.THIS._.token==null||zs4.THIS._.scopath==null)return false;
		if (zs4.THIS._.scopath=='') return true;
		return false;
	},
	user:function(){
		if (zs4.THIS._.token!=null&&zs4.THIS._.scopath!=null)return true;
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
			var arr = zs4.THIS._.getUserScopes();
			console.log(arr);
			THIS.auth.user.innerHTML = '';

			var option = document.createElement('option');
			option.className = 'placeholder';
			option.text = 'select user';
			option.value = '';
			THIS.auth.user.add(option);

			for (var i = 0 ; i < arr.length ; i++){
				option = document.createElement('option');
				//console.log(arr[i].label+': '+arr[i].value);
				option.text = arr[i].label;
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
				zs4.admin.util.setIcon(remove,'delete')
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

	app:function(scope,containerElement){
		this.scope = scope;
		this.containerElement = containerElement;

		console.log(scope);

		if (this.scope.zs4.head.bits._.bits.plugin.get()){
			window.alert('plugin created...');
		}

		this.internalRefresh = function(){
			// flag the first pass
			if (!zs4.is.boolean(this.uninitialized))this.uninitialized=true;
			else this.uninitialized=false;

				//console.log('refreshing app type: ' + this.scope.zs4.head.type._.value + ' ' + this.scope.zs4.head.bits._.value);

			if (zs4.is.function(this.refresh))this.refresh();
		};
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
				//document.body.style.width = window.innerWidth+'px';
				//document.body.style.height = window.innerHeight+'px';
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
				if (o._.typename=='filecontent'){o._.html.icon.off=o._.html.icon.on='upload'}
				else if (o._.flags.get.required()){o._.html.icon.off=o._.html.icon.on='required'}
				else if (o._.flags.get.noset()){o._.html.icon.off=o._.html.icon.on='info'}
				else {o._.html.icon.off=o._.html.icon.on='none'}
			}
			else if (o._.flags.value & o._.flags.scope){
				if (o._.html.topElement){
					o._.html.icon.on = 'logo';
					o._.html.icon.off = 'logo';
				}
				else if (o._.path.startsWith('zs4.type.')){
					var a = zs4.string.split.words(o._.path);
					if (a.length == 5 && a[3]=='array'){
						o._.html.icon.on = a[2];
						o._.html.icon.off = a[2];
					}
					else {
						o._.html.icon.on = 'scope';
						o._.html.icon.off = 'scope';
					}
				}
				else {
					o._.html.icon.on = 'scope';
					o._.html.icon.off = 'scope';
				}
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

				zs4.window.onresize.push(o._.html.refreshAll);
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
						if (o._.html.top.dialogActive)zs4.admin.util.setIcon(o._.html.toggle,'to-start');
						else zs4.admin.util.setIcon(o._.html.toggle,'logo');
						zs4.admin.util.removeClass(o._.html.dialogHeader,'nodisplay');
						zs4.admin.util.removeClass(o._.html.appElement,'nodisplay');
						zs4.admin.util.addClass(o._.html.c,'nodisplay');
						if (o._.html.toolbarToggle){
							zs4.admin.util.addClass(o._.html.toolbarToggle,'nodisplay');
						}
						if (zs4.is.object(top.app)){
							top.app.internalRefresh();
						}
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

				if (window.innerWidth>window.innerHeight){add+=' landscape';rem+=' portrait'}
				else {add+=' portrait';rem+=' landscape'}

				if (o._.type == Object){
					add+=' object'; rem+=' value';
				}
				else {
					add+=' value'; rem+=' object';
					if (o._.typename=='filecontent'){
						if (o._.value=='') o._.html.icon.off=o._.html.icon.on='upload';
						else o._.html.icon.off=o._.html.icon.on='upload';
					}
					else if (o._.flags.get.required()){o._.html.icon.off=o._.html.icon.on='required'}
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
				if (o._.html.topElement==true && o._.html.top.app){
					var top = o._.html.top;
					addrem(o._.html.dialogHeader);
					addrem(o._.html.appElement);
					addrem(o._.html.appWindow);
					addrem(o._.html.top.app.toolbar);
					addrem(o._.html.top.app.searchButton);
					addrem(o._.html.top.app.search);
					addrem(o._.html.top.app.content);
					for (var n in o._.html.dialog){
						addrem(o._.html.dialog[n].select)
						addrem(o._.html.dialog[n].pane)
						addrem(o._.html.dialog[n].toolbar)
					}
				}

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
					if (o._.html.appIsOpen){
						if (zs4.admin.util.root()||zs4.admin.debug){
							o._.html.appIsOpen=false;
							o._.html.toggleOn()
						}
						else if (zs4.admin.rootObject._.scope._.path!='' && !o._.html.top.dialogActive){
							if (zs4.admin.util.user()&&zs4.THIS._.scopath!=o._.path){
								console.log('NAV 2 USER');
								zs4.navigate(zs4.THIS._.scopath);
								return;
							}
							else {
								console.log('NAV 2 ROOT');
								zs4.navigate('');
								return;
							}
						}
						else {
							o._.html.top.deselectAll();
						}
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
						if (o._.type==Object){
							o._.html.toggleOff();
						}
						else {
							o._.html.toggleOn();
						}
					}
					else {
						o._.html.toggleOn();
					}
				}
				//o._.html.refreshAll();
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

				o._.html.appIsOpen = true;
				o._.html.dialog = new Object();

				o._.html.dialogHeader= document.createElement('zs4-app-header');
				o._.html.head.appendChild(o._.html.dialogHeader);

				o._.html.appElement = document.createElement('zs4-app');
				o._.html.e.appendChild(o._.html.appElement);

				o._.html.appUserInterface = document.createElement('zs4-app-ui');
				o._.html.appElement.appendChild(o._.html.appUserInterface);

				o._.html.appWindow = document.createElement('zs4-app-window');
				o._.html.appUserInterface.appendChild(o._.html.appWindow);

				o._.html.top.dialogActive = false;
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
					o._.html.appUserInterface.appendChild(this.pane);
					//this.pane.textContent = 'dialog pane for '+name;
					zs4.admin.util.removeClass(this.pane,'current');
					zs4.admin.util.addClass(this.pane,'nodisplay');
					this.refreshDialog = function(){};
					this.refreshInternal = function(){
						if (!zs4.is.boolean(this.uninitialized))this.uninitialized=true;
						else this.uninitialized=false;
						this.refreshDialog();
					};

					this.toolbar = document.createElement('zs4-app-toolbar');
					this.pane.appendChild(this.toolbar);

					this.dItem = new Object();
					this.dialogItem = function(name){
						var di = this.dItem[name] = new Object();

						di.element = document.createElement('zs4-dialog-item');
						this.pane.appendChild(di.element);

						di.toggleActive = false;
						di.toggle = document.createElement('zs4-dialog-item-toggle');
						di.toggle.textContent = name;
						di.element.appendChild(di.toggle);
						di.toggleOn = function(){
							di.toggleActive=true;
							if (zs4.is.function(di.ontoggleopen))di.ontoggleopen();
							zs4.admin.util.removeClass(di.content,'nodisplay');
						};
						di.toggleOff = function(){
							di.toggleActive=false;
							zs4.admin.util.addClass(di.content,'nodisplay');
						};
						di.toggle.onclick = function(){
							if (di.toggleActive==true){di.toggleOff();}
							else {di.toggleOn();}
						};

						di.content = document.createElement('zs4-dialog-item-content');
						di.element.appendChild(di.content);

						di.toggleOff();
						return di;
					}

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
								this.refreshInternal();
							}
							else {
								zs4.admin.util.addClass(o._.html.dialog[n].pane,'nodisplay');
								zs4.admin.util.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
							}
						}
						if (active){
							o._.html.top.dialogActive = true;
							zs4.admin.util.addClass(o._.html.appWindow,'nodisplay');
						}
						else{
							o._.html.top.dialogActive = false;
							zs4.admin.util.removeClass(o._.html.appWindow,'nodisplay');
						}
						o._.html.refreshAll();
					}).bind(this);

				};
				o._.html.top.dialogTool = function(){
					var THIS = this;
					o._.html.top.dialog.call(this,'tool');

					this.title = document.createElement('input');
					this.title.type = 'text';
					zs4.admin.util.addClass(this.title,'scope-title');
					this.title.value = o.zs4.head.title._.value;
					this.toolbar.appendChild(this.title);

					this.title.onchange = function(){
						zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
						o.zs4.head.title._.call(THIS.title.value,function(){
							zs4.admin.util.addClass(o._.html.spin,'nodisplay');
							o._.html.refreshAll();
						});
					};

					if (o._.flags.get.own()||o._.flags.get.am()){
						this.isPublic = false;
						this.public = document.createElement('zs4-bit-public');
						this.toolbar.appendChild(this.public);
						this.public.onclick = (function(){
							var bits = new zs4.type.scopebits({name:'temp'});
							bits._.value = o.zs4.head.bits._.value;

							if (bits._.bits.public.get()){
								bits._.bits.public.false();
							}
							else {
								bits._.bits.public.true();
							}

							zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
							o.zs4.head.bits._.call(bits._.value,function(){
								zs4.admin.util.addClass(o._.html.spin,'nodisplay');
								THIS.refreshInternal();
							});
						}).bind(THIS);

					}
					this.refreshDialog = (function(){
						if (o._.flags.get.own()||o._.flags.get.am()){
							if (o.zs4.head.bits._.bits.public.get()){
								this.public.textContent = 'public';
							}
							else {
								this.public.textContent = 'private';
							}
						}
					}).bind(this);
				};
				o._.html.top.dialogUser = function(){
					var DIALOG = this;
					o._.html.top.dialog.call(this,'user');

					this.loggedIn = zs4.THIS._.loggedIn;
					//if (zs4.THIS.zs4.hasOwnProperty('bye'))this.loggedIn=true;

					this.username = document.createElement('a');
					this.toolbar.appendChild(this.username);
					if (this.loggedIn){
						this.username.href = '/'+zs4.THIS._.scopath;
						zs4.admin.util.addClass(this.username,'am');
					}
					else {
						this.username.href = '#';
					}

					if (this.loggedIn){
						this.spwIsOpen = false;

						this.spwtitle = document.createElement('zs4-spw-title');
						this.spwtitle.textContent = 'set password';
						this.pane.appendChild(this.spwtitle);
						this.spwtitle.onclick = function(){
							if (DIALOG.spwIsOpen){
								DIALOG.spwIsOpen = false;
								zs4.admin.util.addClass(DIALOG.setpassword,'nodisplay');
							}
							else {
								DIALOG.spwIsOpen = true;
								zs4.admin.util.removeClass(DIALOG.setpassword,'nodisplay');
							}
							DIALOG.refreshInternal();
						};


						this.setpassword = document.createElement('zs4-setpassword');
						zs4.admin.util.addClass(DIALOG.setpassword,'nodisplay');
						this.pane.appendChild(this.setpassword);

						this.old1 = document.createElement('zs4-spw-pwe');
						this.setpassword.appendChild(this.old1);

						this.old1label = document.createElement('zs4-spw-old');
						this.old1label.textContent = 'old: ';
						this.old1.appendChild(this.old1label);
						this.old1input = document.createElement('input');
						this.old1input.type = 'password';
						this.old1.appendChild(this.old1input);

						this.old2 = document.createElement('zs4-spw-pwe');
						this.setpassword.appendChild(this.old2);

						this.old2label = document.createElement('zs4-spw-old');
						this.old2label.textContent = 'old: ';
						this.old2.appendChild(this.old2label);
						this.old2input = document.createElement('input');
						this.old2input.type = 'password';
						this.old2.appendChild(this.old2input);

						this.setpwd = document.createElement('zs4-spw-pwe');
						this.setpassword.appendChild(this.setpwd);

						this.setpwdlabel = document.createElement('zs4-spw-old');
						this.setpwdlabel.textContent = 'new: ';
						this.setpwd.appendChild(this.setpwdlabel);
						this.setpwdinput = document.createElement('input');
						this.setpwdinput.type = 'password';
						this.setpwd.appendChild(this.setpwdinput);

						this.setpwdsend = document.createElement('zs4-spw-send');
						this.setpassword.appendChild(this.setpwdsend);
						this.setpwdsend.textContent = 'set now';
						this.setpwdsend.onclick = (function(){
							if (!zs4.THIS._.loggedIn)return;
							var uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
							if (uscope==null)return;
							var password = uscope._.resolvePath('zs4.password');
							if (password==null)return;
							var set = uscope._.resolvePath('zs4.password.set');
							if (set==null)return;
							if (!zs4.is.password(this.setpwdinput.value)){
								zs4.admin.util.addClass(DIALOG.setpwd,'error');
								return;
							}
							var input = new Object({set:this.setpwdinput.value,})
							var vfy = uscope._.resolvePath('zs4.password.vfy');
							if (vfy != null){
								if (!zs4.is.password(this.old1input.value)
								||  !zs4.is.password(this.old2input.value)
								||  this.old1input.value!=this.old2input.value
								){
									zs4.admin.util.addClass(DIALOG.old1,'error');
									zs4.admin.util.addClass(DIALOG.old2,'error');
									return;
								}
								input.vfy = this.old1input.value;
							}

							zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
							zs4.post(password._.wrapRequest(input),function(ret){
								zs4.admin.util.addClass(o._.html.spin,'nodisplay');
								o._.html.refreshAll();
							});


						}).bind(DIALOG);

						this.logout = document.createElement('zs4-logout');
						this.logout.textContent = 'logout';
						this.pane.appendChild(this.logout);
						this.logoutvisible = false;
						this.logout.onclick = (function(){
							if (!DIALOG.logoutvisible){
								zs4.admin.util.removeClass(this.logoutArgs,'nodisplay');
								zs4.admin.util.addClass(this.bye,'nodisplay');
								DIALOG.sure.checked = false;
								DIALOG.logoutvisible = true;
							}
							else {
								zs4.admin.util.addClass(this.logoutArgs,'nodisplay');
								zs4.admin.util.addClass(this.bye,'nodisplay');
								DIALOG.sure.checked = false;
								DIALOG.logoutvisible = false;
							}
						}).bind(this);

						this.logoutArgs = document.createElement('zs4-logout-args');
						this.pane.appendChild(this.logoutArgs);
						zs4.admin.util.addClass(this.logoutArgs,'nodisplay');

						this.sureText = document.createElement('zs4-sure-text');
						this.sureText.textContent = 'sure?';
						this.logoutArgs.appendChild(this.sureText);

						this.sure = document.createElement('input');
						this.sure.type = 'checkbox';
						zs4.admin.util.addClass(this.sure,'sure');
						this.logoutArgs.appendChild(this.sure);
						this.sure.onchange = (function(){
							if (this.sure.checked)zs4.admin.util.removeClass(this.bye,'nodisplay');
							else zs4.admin.util.addClass(this.bye,'nodisplay');
						}).bind(this);

						this.bye = document.createElement('zs4-logout-now');
						this.bye.textContent = 'logout';
						zs4.admin.util.addClass(this.bye,'nodisplay');
						this.pane.appendChild(this.bye);
						this.bye.onclick = (function(){
							zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
							zs4.post(zs4.THIS.zs4.bye._.wrapRequest({sure:true}),function(ret){
								zs4.admin.util.addClass(o._.html.spin,'nodisplay');
							});
						}).bind(this);

					}
					else {
						this.email = document.createElement('zs4-login-email');
						this.pane.appendChild(this.email);

						this.emailLabel = document.createElement('zs4-login-email-label');
						this.emailLabel.textContent = 'email';
						this.email.appendChild(this.emailLabel);

						this.emailAddress = document.createElement('input');
						this.emailAddress.type = 'text';
						this.email.appendChild(this.emailAddress);
						zs4.admin.util.addClass(this.emailAddress,'login-email');

						this.password = document.createElement('zs4-login-password');
						this.pane.appendChild(this.password);

						this.passwordLabel = document.createElement('zs4-login-password-label');
						this.passwordLabel.textContent = 'password';
						this.password.appendChild(this.passwordLabel);

						this.pass = document.createElement('input');
						this.pass.type = 'password';
						this.password.appendChild(this.pass);
						zs4.admin.util.addClass(this.pass,'login-password');

						this.failcount = 0;

						this.etok = document.createElement('zs4-email-token');
						this.pane.appendChild(this.etok);
						zs4.admin.util.addClass(this.etok,'nodisplay');

						this.emailtoken = document.createElement('zs4-email-token-send');
						this.emailtoken.textContent = 'email access code / password reset';
						this.etok.appendChild(this.emailtoken);
						this.emailtoken.onclick = (function(){
							if (!zs4.is.email(DIALOG.emailAddress.value)){
								zs4.admin.util.addClass(DIALOG.emailAddress,'error');
								return;
							}
							else {
								zs4.admin.util.removeClass(DIALOG.emailAddress,'error');
							}
							zs4.admin.util.removeClass(this.pass,'error');

							zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
							zs4.THIS.zs4.hi._.call({email:this.emailAddress.value,sendtoken:true,},function(){
								zs4.admin.util.addClass(o._.html.spin,'nodisplay');
								console.log(zs4.THIS.zs4.hi._.cberror);
								console.log(zs4.THIS.zs4.hi._.cbresult);
								if (zs4.THIS.zs4.hi._.cbresult != null){
									//window.alert('token sent');
									zs4.admin.util.removeClass(DIALOG.emailAddress,'error');
									zs4.admin.util.removeClass(DIALOG.pass,'error');
									zs4.admin.util.removeClass(DIALOG.emailtoken,'error');

									DIALOG.emailresponse.textContent = zs4.THIS.zs4.hi._.cbresult;
									zs4.admin.util.addClass(DIALOG.emailtoken,'nodisplay');
									zs4.admin.util.removeClass(DIALOG.emailresponse,'nodisplay');
									zs4.admin.util.removeClass(DIALOG.hi,'nodisplay');
									DIALOG.failcount = 0;
									DIALOG.refreshDialog();
								}
								else {
									zs4.admin.util.addClass(DIALOG.emailtoken,'error');
								}

							});

						}).bind(DIALOG);

						this.emailresponse = document.createElement('zs4-email-token-response');
						this.etok.appendChild(this.emailresponse);

						this.hi = document.createElement('zs4-login');
						this.hi.textContent = 'login';
						this.pane.appendChild(this.hi);
						this.hi.onclick = (function(){
							var error = false;
							if (!zs4.is.email(this.emailAddress.value)){
								zs4.admin.util.addClass(DIALOG.emailAddress,'error');
								error = true;
							}
							else {
								zs4.admin.util.removeClass(DIALOG.emailAddress,'error');
							}
							if (!zs4.is.password(this.pass.value)){
								zs4.admin.util.addClass(this.pass,'error');
								error = true;
							}
							else {
								zs4.admin.util.removeClass(this.pass,'error');
							}
							if (error)return;

							zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
							zs4.post(zs4.THIS.zs4.hi._.wrapRequest({email:this.emailAddress.value,password:this.pass.value,}),function(ret){
								if (zs4.THIS.zs4.hi._.cberror != null){
									zs4.admin.util.addClass(DIALOG.emailAddress,'error');
									zs4.admin.util.addClass(DIALOG.pass,'error');
									DIALOG.failcount++;
									DIALOG.refreshDialog();
								}
								console.log('DIALOG.failcount: '+DIALOG.failcount);

								zs4.admin.util.addClass(o._.html.spin,'nodisplay');
							});
						}).bind(this);
					}

					this.deviceIsOpen = false;
					this.device = document.createElement('zs4-app-device');
					this.device.textContent = 'device info';
					this.pane.appendChild(this.device);
					this.device.onclick = function(){
						if (DIALOG.deviceIsOpen){
							DIALOG.deviceIsOpen = false;
							zs4.admin.util.addClass(DIALOG.deviceInfo,'nodisplay');
						}
						else {
							DIALOG.deviceIsOpen = true;
							zs4.admin.util.removeClass(DIALOG.deviceInfo,'nodisplay');
						}
						DIALOG.refreshInternal();
					};

					this.deviceInfo = document.createElement('zs4-app-device-info');
					zs4.admin.util.addClass(DIALOG.deviceInfo,'nodisplay');
					this.pane.appendChild(this.deviceInfo);

					function addDeviceItem(name,value){
						var item = document.createElement('zs4-app-device-info-item');
						DIALOG.deviceInfo.appendChild(item);

						var nameEle = document.createElement('zs4-app-device-info-name');
						nameEle.textContent = name;
						item.appendChild(nameEle);

						var valueEle = document.createElement('zs4-app-device-info-value');
						valueEle.textContent = value.toString();
						item.appendChild(valueEle);
					}

					var titles = new Array();
					function addBowserFlag(title,flag){
						if(zs4.string.array.is.element(titles,title))return false;

						if (zs4.is.boolean(bowser[flag])&&bowser[flag]==true){
							titles.push(title);
							addDeviceItem(title,flag);
							return true;
						}
						return false;
					}

					addDeviceItem('browser',bowser.name);
					addDeviceItem('version',bowser.version);

					addBowserFlag('type','mobile');
					addBowserFlag('type','tablet');

					addBowserFlag('renderer','webkit');
					addBowserFlag('renderer','blink');
					addBowserFlag('renderer','gecko');
					addBowserFlag('renderer','msie');
					addBowserFlag('renderer','msedge');

					addBowserFlag('os','mac');
					addBowserFlag('os','windows');
					addBowserFlag('os','windowsphone');
					addBowserFlag('os','linux');
					addBowserFlag('os','chromeos');
					addBowserFlag('os','android');
					addBowserFlag('os','ios');
					addBowserFlag('os','blackberry');
					addBowserFlag('os','firefoxos');
					addBowserFlag('os','webos');
					addBowserFlag('os','bada');
					addBowserFlag('os','tizen');
					addBowserFlag('os','sailfish');

					addBowserFlag('ios','iphone');
					addBowserFlag('ios','ipad');
					addBowserFlag('ios','ipod');
					if (bowser.osversion!=null)addBowserFlag('version',bowser.osversion);


					var hr = document.createElement('hr');
					DIALOG.deviceInfo.appendChild(hr);

					addDeviceItem('appName',window.navigator.appName);
					addDeviceItem('appCodeName',window.navigator.appCodeName);
					addDeviceItem('product',window.navigator.product);
					addDeviceItem('platform',window.navigator.platform);

					hr = document.createElement('hr');
					DIALOG.deviceInfo.appendChild(hr);

					addDeviceItem('screen',window.screen.width + 'x'+window.screen.height);

					this.refreshDialog = (function(){
						if (zs4.THIS._.loggedIn){
							var uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
							var utitle = '';
							//console.log('scopath='+zs4.THIS._.scopath+', ');
							if (uscope!=null){
								if (zs4.THIS._.scopath==''){
									utitle = 'root';
								}
								else if (uscope.zs4.head.title._.value.trim()==''){
									utitle = zs4.THIS._.scopath;
								}
								else {
									utitle = uscope.zs4.head.title._.value;
								}
								this.username.text = utitle;

								if (this.spwIsOpen){
									var vfy = uscope._.resolvePath('zs4.password.vfy');
									var set = uscope._.resolvePath('zs4.password.set');
									if (set!=null){
										if (vfy==null){
											zs4.admin.util.addClass(DIALOG.old1,'nodisplay');
											zs4.admin.util.addClass(DIALOG.old2,'nodisplay');
										}
										else {
											zs4.admin.util.removeClass(DIALOG.old1,'nodisplay');
											zs4.admin.util.removeClass(DIALOG.old2,'nodisplay');
										}
										zs4.admin.util.removeClass(DIALOG.setpwd,'nodisplay');
									}
									else {
										zs4.admin.util.addClass(DIALOG.setpwd,'nodisplay');
									}
								}
								else {

								}
							}
						}
						else {
							this.username.text = 'login';
							if (DIALOG.failcount > 2){
								zs4.admin.util.removeClass(this.etok,'nodisplay');
							}
						}

						if (this.loggedIn==true){
							zs4.admin.util.addClass(this.logoutArgs,'nodisplay');
							zs4.admin.util.addClass(this.bye,'nodisplay');
						}
					}).bind(this);
				};
				o._.html.top.dialogDocument = function(){
					var THIS = this;
					o._.html.top.dialog.call(this,'document');

					var nu = THIS.dialogItem('new');
					nu.create = document.createElement('zs4-document-create');
					nu.create.textContent = 'create';
					nu.content.appendChild(nu.create);

					var list = THIS.dialogItem('list');
					list.ontoggleopen = function(){
						window.alert('listing documents');
					};
				};

				o._.html.top.deselectAll = function(){
					for (var n in o._.html.dialog){

						o._.html.dialog[n].active = false;
						zs4.admin.util.removeClass(o._.html.dialog[n].select,'current');
						zs4.admin.util.removeClass(o._.html.dialog[n].pane,'current');
						zs4.admin.util.addClass(o._.html.dialog[n].pane,'nodisplay');
						zs4.admin.util.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
					}
					o._.html.top.dialogActive = false;
					zs4.admin.util.removeClass(o._.html.appWindow,'nodisplay');

					o._.html.refreshAll();
				}

				if (o._.flags.get.scope()){
					if (o.zs4.head.typename._.value=='node'||o.zs4.head.typename._.value=='user'){
						top.app = new zs4.admin.util.app(o,o._.html.appWindow);
						top.app.toolbar = document.createElement('zs4-app-toolbar');
						top.app.containerElement.appendChild(top.app.toolbar);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){

								top.app.searchButton = document.createElement('zs4-app-search-icon');
								zs4.admin.util.setIcon(top.app.searchButton,'search');
								top.app.toolbar.appendChild(top.app.searchButton);
								top.app.searchButton.onclick = (function(){
									o._.html.top.deselectAll();
									this.requestItems();
								}).bind(top.app);

								top.app.search = document.createElement('input');
								top.app.search.type = 'search';
								zs4.admin.util.addClass(top.app.search,'search');
								top.app.toolbar.appendChild(top.app.search);
								top.app.search.onchange = (function(){
									this.requestItems();
								}).bind(top.app);
								top.app.search.oninput = (function(){
									top.app.internalRefresh();
								}).bind(top.app);


								top.app.type = document.createElement('zs4-app-type');
								top.app.toolbar.appendChild(top.app.type);

								top.app.typeSelect = document.createElement('select');
								zs4.admin.util.addClass(top.app.typeSelect,'app-type-select');
								top.app.type.appendChild(top.app.typeSelect);
								var option = document.createElement('option');
								option.value = '';
								option.text = 'all types';
								option.selected = true;
								top.app.typeSelect.add(option);
								for (var n in zs4.THIS.zs4.type)if (zs4.is.type(zs4.THIS.zs4.type[n])){
									option = document.createElement('option');
									option.text = option.value = (' '+n+' ').trim();
									zs4.admin.util.setIcon(option,option.value);
				          top.app.typeSelect.add(option);
								}
								top.app.typeSelect.onchange = (function(){
									if (top.app.typeSelect.value != ''){
										var path = 'zs4.type.'+top.app.typeSelect.value+'.method.new';
										var nu = zs4.THIS._.resolvePath(path);
										if (nu != null){
											zs4.admin.util.removeClass(top.app.new,'nodisplay');
										}
										else {
											zs4.admin.util.addClass(top.app.new,'nodisplay');
										}
									}
									else {
										zs4.admin.util.addClass(top.app.new,'nodisplay');
									}

									this.requestItems();
								}).bind(top.app);

								top.app.creator = document.createElement('zs4-app-creator');
								top.app.toolbar.appendChild(top.app.creator);

								top.app.creatorSelect = document.createElement('select');
								zs4.admin.util.addClass(top.app.creatorSelect,'app-creator-select');
								top.app.creator.appendChild(top.app.creatorSelect);
								top.app.creatorInitialized = false;
								top.app.creatorRefresh = (function(){
									var lastSelection;
									if (top.app.creatorInitialized){
										lastSelection = top.app.creatorSelect.value;
									}
									top.app.creatorSelect.innerHTML = '';
									var option = document.createElement('option');
									option.value = '';
									option.text = 'any owner';
									if (!top.app.creatorInitialized){
										option.selected = true;
										lastSelection = '';
									}
									top.app.creatorSelect.add(option);

									top.app.creatorInitialized = true;
									var arr = zs4.THIS.zs4.type.user.array;
					        for (var n in arr)if(zs4.is.type(arr[n])){
					          option = document.createElement('option');
										if (arr[n].zs4.head.title._.value.length > 0)
											option.text = arr[n].zs4.head.title._.value;
										else option.text = arr[n]._.name;
										option.value = arr[n]._.path;
										if (lastSelection==arr[n]._.path)option.selected = true;
					          top.app.creatorSelect.add(option);
					        }
								}).bind(top.app);
								top.app.creatorSelect.onchange = (function(){this.requestItems();}).bind(top.app);
								if (o._.path != ''){
									zs4.admin.util.addClass(top.app.creator,'nodisplay');
								}

								top.app.sortFunction = new Object();
								top.app.sort = document.createElement('zs4-app-sort');
								top.app.toolbar.appendChild(top.app.sort);

								top.app.sortSelect = document.createElement('select');
								zs4.admin.util.addClass(top.app.sortSelect,'app-sort-select');
								top.app.sort.appendChild(top.app.sortSelect);
								top.app.sortSelectOption = (function(input,path,foo,selected){
									var option = document.createElement('option');
									top.app.sortFunction[input.name] = input;
									option.value = input.name;
									option.text = input.name;
									if (input.selected==true){
										option.selected = true;
										top.app.orderFunction = input;
									}
									top.app.sortSelect.add(option);
								}).bind(top.app);
								top.app.sortSelect.onchange = (function(){
									top.app.orderFunction = top.app.sortFunction[top.app.sortSelect.value];
									//top.app.internalRefresh();
									this.requestItems();
								}).bind(top.app);

								top.app.sortSelectOption({
									name:'title',
									path:'zs4.head.title',
									descend:false,
									selected:false,
									sort:function(a,b){
										return a.scope.zs4.head.title._.value.localeCompare(b.scope.zs4.head.title._.value);
									},});

								top.app.sortSelectOption({
									name:'recent',
									path:'zs4.head.updated',
									descend:true,
									selected:true,
									sort:function(a,b){
										return b.scope.zs4.head.updated._.value - a.scope.zs4.head.updated._.value;
									},});

								top.app.sortSelectOption({
									name:'oldest',
									path:'zs4.head.created',
									descend:false,
									selected:false,
									sort:function(a,b){
										return a.scope.zs4.head.created._.value - b.scope.zs4.head.created._.value;
									},});

								if (o._.path==''){
									top.app.new = document.createElement('zs4-app-new-item');
									top.app.new.textContent = 'new';
									zs4.admin.util.addClass(top.app.new,'nodisplay');
									top.app.toolbar.appendChild(top.app.new);
									top.app.new.onclick = function(){
										if (top.app.typeSelect.value != ''){
											var path = 'zs4.type.'+top.app.typeSelect.value+'.method.new';

											if (top.app.typeSelect.value == 'document'){
												top.app.typeSelect.value = 'doctype';
												top.app.typeSelect.onchange();
												return;
											}

											var nu = zs4.THIS._.resolvePath(path);
											if (nu == null) return;

											zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
											nu._.call({},function(){
												zs4.admin.util.addClass(o._.html.spin,'nodisplay');
												if (zs4.is.string(nu._.cbresult)){
													zs4.navigate(nu._.cbresult)
												}
											});

											//alert('NEW METHOD EXISTS!');
										}
									};
								}

								top.app.content = document.createElement('zs4-app-content');
								o._.html.appWindow.appendChild(top.app.content);

								top.app.orderHtml = (function(){
									var a = top.app.array.sort(top.app.orderFunction.sort);
									if (a.length > 1){
										for (var i = 0 ; i < (a.length-1) ; i++){
											top.app.content.removeChild(a[i].element);
											top.app.content.insertBefore(a[i].element, top.app.content.childNodes[i]);
										}
									}
								}).bind(top.app);

								top.app.array = new Array();

								top.app.item = (function(scope){
									var THIS = this;
									this.scope = scope;
									top.app.array.push(this);

									this.element = document.createElement('zs4-app-item');
									top.app.content.appendChild(this.element);

									this.icon = document.createElement('zs4-app-item-icon');
									zs4.admin.util.setIcon(this.icon,scope.zs4.head.typename._.value);
									this.element.appendChild(this.icon);

									this.data = document.createElement('zs4-app-item-data');
									this.element.appendChild(this.data);

									this.title = document.createElement('a');
									this.title.text = scope.zs4.head.title._.value;
									this.title.href = THIS.scope._.path;
									zs4.admin.util.addClass(this.title,'app-item-link');
									this.data.appendChild(this.title);

									if (scope._.flags.get.own()){
										this.delete = document.createElement('zs4-app-item-delete');
										zs4.admin.util.setIcon(this.delete,'delete');
										this.data.appendChild(this.delete);
										this.delete.onclick = function(){
											zs4.admin.util.removeClass(THIS.surdel,'nodisplay');
											zs4.admin.util.removeClass(THIS.sure,'nodisplay');
										};

										this.surdel = document.createElement('zs4-app-item-delete-sure');
										this.surdel.textContent = 'sure?';
										zs4.admin.util.addClass(this.surdel,'nodisplay');
										this.data.appendChild(this.surdel);

										this.sure = document.createElement('input');
										this.sure.type = 'checkbox';
										zs4.admin.util.addClass(this.sure,'nodisplay');
										this.data.appendChild(this.sure);
										this.sure.onchange = function(){
											if (THIS.sure.checked)zs4.admin.util.removeClass(THIS.reallydelete,'nodisplay');
											else zs4.admin.util.addClass(THIS.reallydelete,'nodisplay');
										};

										this.reallydelete = document.createElement('zs4-app-item-really-delete');
										zs4.admin.util.setIcon(this.reallydelete,'delete');
										zs4.admin.util.addClass(this.reallydelete,'nodisplay');
										this.data.appendChild(this.reallydelete);
										this.reallydelete.onclick = function(){
											var a = zs4.string.split.separators(THIS.scope._.path,'./\\ ');
											if (a.length != 5
											|| a[0] != 'zs4'
											|| a[1] != 'type'
											|| !zs4.THIS.zs4.type.hasOwnProperty(a[2])
											|| a[3] != 'array'){
												return;
											}

											var delone = zs4.THIS._.resolvePath('zs4.type.'+a[2]+'.method.deleteone.id');
											if (delone==null)return;

											zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
											delone._.call(THIS.scope._.name,function(){
												o._.html.refreshAll();
												zs4.admin.util.addClass(o._.html.spin,'nodisplay');
											});

										};
									}

									if (scope.zs4.head.typename._.value=='doctype'){
										if (zs4.is.object(zs4.THIS.zs4.type.document.method.new)){
											this.newdoc = document.createElement('zs4-app-item-newdoc');
											this.newdoc.textContent = 'new';
											this.element.appendChild(this.newdoc);
											this.newdoc.onclick = function(){

											};
										}
									}

								}).bind(top.app);

								top.app.findItem = (function(scope){
									for (var i = 0 ; i < top.app.array.length ; i++){
										if (top.app.array[i].scope==scope)return top.app.array[i];
									}
									return null;
								}).bind(top.app);

								top.app.requestItems = (function(){
									var req = new Object();
									req.value = top.app.search.value;
									req.type = top.app.typeSelect.value;
									req.owner = top.app.creatorSelect.value;
									if (o._.flags.get.scope()&&o.zs4.head.typename._.value=='user'){
										req.owner = o._.path;
									}

									var tq = null;
									if(req.type.length>0)
									tq=zs4.THIS._.resolvePath('zs4.type.'+req.type+'.method.query')

									console.log('resolvePath('+'zs4.type.'+req.type+'.method.query'+') = '+tq);

									if (tq != null){
										var query = new Object({
											search:top.app.search.value,
											sort:{
												item:top.app.orderFunction.path,
												descend:top.app.orderFunction.descend,
											},
											select:{sc:'all'},
										});

										if (o.zs4.head.typename._.value=='user'){
											query.select.owner = new Object({
												sc:'item',
												item:'zs4.head.owner',
												opcode:'eq',
												type:'const',
												const:o._.path,
												prop:'',
											});
										}

										console.log(JSON.stringify(query));

										zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
										zs4.post(tq._.wrapRequest(query),function(ret){
											zs4.admin.util.addClass(o._.html.spin,'nodisplay');
											o._.html.refreshAll();
										});
									}
									else {
										zs4.admin.util.removeClass(o._.html.spin,'nodisplay');
										zs4.post(zs4.THIS.zs4.search._.wrapRequest(req),function(ret){
											zs4.admin.util.addClass(o._.html.spin,'nodisplay');
											o._.html.refreshAll();
										});
									}

								}).bind(top.app);

								top.app.requestItems();
							}

							top.app.creatorRefresh();

							// get new objects
							var arr = o._.getAllScopes();
							for (var i = 0 ; i < arr.length  ; i++){
								var item = top.app.findItem(arr[i]);
								if (item != null){
									item.title.textContent = item.scope.zs4.head.title._.value;
								}
								else {
									item = new top.app.item(arr[i]);
								}
							}

							// clean up discarded objects;
							for (var i = top.app.array.length-1 ; i >= 0 ; i--){
								if (zs4.THIS._.resolvePath(top.app.array[i].scope._.path)==null){
									console.log('discarding '+top.app.array[i].scope._.path);
									top.app.content.removeChild(top.app.array[i].element);
									top.app.array.splice(i,1);
									continue;
								}

								if (top.app.array[i].scope==o){
									zs4.admin.util.addClass(top.app.array[i].element,'nodisplay');
									continue;
								}

								if (top.app.array[i].scope._.flags.get.own()){
									zs4.admin.util.addClass(top.app.array[i].surdel,'nodisplay');
									zs4.admin.util.addClass(top.app.array[i].sure,'nodisplay');
									zs4.admin.util.addClass(top.app.array[i].reallydelete,'nodisplay');
								}

								if (top.app.search.value != ''){
									if (!top.app.array[i].scope._.search(top.app.search.value)){
										zs4.admin.util.addClass(top.app.array[i].element,'nodisplay');
										continue;
									}
								}
								if (top.app.typeSelect.value != ''){
									if (top.app.array[i].scope.zs4.head.typename._.value!=top.app.typeSelect.value){
										zs4.admin.util.addClass(top.app.array[i].element,'nodisplay');
										continue;
									}
								}
								if (top.app.creatorSelect.value != ''){
									console.log('compare '+top.app.creatorSelect.value+' to '+top.app.array[i].scope.zs4.head.owner._.value);
									if (top.app.array[i].scope.zs4.head.owner._.value!=top.app.creatorSelect.value){
										zs4.admin.util.addClass(top.app.array[i].element,'nodisplay');
										continue;
									}
								}

								if (zs4.is.string(zs4.THIS._.token)
								&& zs4.is.string(zs4.THIS._.scopath)
								&& top.app.array[i].scope.zs4.head.owner._.value==zs4.THIS._.scopath){
									zs4.admin.util.addClass(top.app.array[i].element,'own');
									zs4.admin.util.addClass(top.app.array[i].icon,'own');
									zs4.admin.util.addClass(top.app.array[i].title,'own');
								}
								else if (zs4.is.string(zs4.THIS._.token)
								&& zs4.is.string(zs4.THIS._.scopath)
								&& top.app.array[i].scope._.path==zs4.THIS._.scopath){
									zs4.admin.util.addClass(top.app.array[i].element,'am');
									zs4.admin.util.addClass(top.app.array[i].icon,'am');
									zs4.admin.util.addClass(top.app.array[i].title,'am');
								}
								else {
									zs4.admin.util.removeClass(top.app.array[i].element,'own');
									zs4.admin.util.removeClass(top.app.array[i].icon,'own');
									zs4.admin.util.removeClass(top.app.array[i].title,'own');

									zs4.admin.util.removeClass(top.app.array[i].element,'am');
									zs4.admin.util.removeClass(top.app.array[i].icon,'am');
									zs4.admin.util.removeClass(top.app.array[i].title,'am');
								}

								zs4.admin.util.removeClass(top.app.array[i].element,'nodisplay');
							}

							top.app.orderHtml();

						}).bind(top.app);
						top.app.internalRefresh();
					}
					else if (o.zs4.head.typename._.value=='doctype'){
						top.app = new zs4.admin.util.app(o,o._.html.appWindow);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){
								if (o.zs4.head.title._.value != ''){
									console.log('APP: '+o.zs4.head.title._.value);
									zs4.loadcss('/plugin/'+o.zs4.head.title._.value+'/style.css');
									zs4.loaddata('/plugin/'+o.zs4.head.title._.value+'/index.js',function(data){
										console.log(data);
										var foo;
										foo = new Function('element',data);
										foo.call(o,top.app.containerElement);
									});

								}
							}

						}).bind(top.app);
						new o._.html.top.dialogDocument();
						top.app.internalRefresh();
					}
					else {
						top.app = new zs4.admin.util.app(o,o._.html.appWindow);
						top.app.toolbar = document.createElement('zs4-app-toolbar');
						top.app.containerElement.appendChild(top.app.toolbar);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){
							}

						}).bind(top.app);
						top.app.internalRefresh();
					}

				}

				if (zs4.admin.util.am(o)||zs4.admin.util.own(o)){
					new o._.html.top.dialogTool();
				}
				new o._.html.top.dialogUser();

				o._.html.appInfo = document.createElement('zs4-app-info');
				o._.html.appElement.appendChild(o._.html.appInfo);

				o._.html.appInfoContent = document.createElement('zs4-app-info-content');
				o._.html.appInfoContent.textContent = 'lorem ipsum et cetera...';
				o._.html.appInfo.appendChild(o._.html.appInfoContent);

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
	bits:function(po,o){
		zs4.admin.type.integer(po,o);
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
	download:function(po,o){
		zs4.admin.type.object(po,o);
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
	file:function(po,o){
		zs4.admin.type.object(po,o);
	},
	filecontent:function(po,o){
		zs4.admin.type.text(po,o);
	},
	folder:function(po,o){
		zs4.admin.type.object(po,o);
	},
	head:function(po,o){
		zs4.admin.type.object(po,o);
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
	},
	scope:function(po,o){
		zs4.admin.type.object(po,o);
		/*
		if (o._.html.topElement){
			o._.html.icon.on = 'logo';
			o._.html.icon.off = 'logo';
		}
		else if (o._.path.startsWith('zs4.type.')){
			var a = zs4.string.split.words(o._.path);
			if (a.length == 5 && a[3]=='array')
			o._.html.icon.on = a[2];
			o._.html.icon.off = a[2];
		}
		*/
	},
	scopebits:function(po,o){
		zs4.admin.type.bits(po,o);
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
        var arr = zs4.THIS._.getAllScopes();
        //console.log (arr);
        //for (var i = (o._.html.input.size-1) ; i >= 0 ; i-- )o._.html.input.remove(i);
				o._.html.input.innerHTML = '';
        for (var i = 0 ; i < arr.length ; i++){
          var option = document.createElement('option');
					option.text = arr[i]._.path;
					option.value = arr[i];
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
		var THIS = this;
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('textarea');
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
			o._.html.expanded = true;
		}
		o._.html.input.readOnly = o._.flags.get.noset();
		o._.html.input.value = o._.value;
		o._.html.genericRefresh();
	},
	type:function(po,o){
		zs4.admin.type.object(po,o);
	},
	userscope:function(po,o){
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
        var arr = zs4.THIS._.getUserScopes();
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
	zs4:function(po,o){
		zs4.admin.type.object(po,o);
	},
};

zs4.css = zs4.loadcss('/style.css');
zs4.css.onload = function(){
	zs4.THIS._.print('loaded css \''+'/style.css'+'\'')
	zs4.admin.type.object(null,zs4.location.get());
	zs4.admin.rootObject._.html.toggleOn();
	zs4.admin.rootObject.zs4._.html.toggleOn();
	zs4.THIS._.print('ADMIN LAUNCHED');
	zs4.style.refresh();
};
