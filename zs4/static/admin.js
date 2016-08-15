////////////////////////////////////////////////////////////////////////"+"
'use strict';
zs4.admin = new Object();

zs4.admin.util = {
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
		}

		zs4.admin.util.setClass(o._.html.e,'scope',o._.flags.get.scope());
		zs4.admin.util.setClass(o._.html.e,'am',o._.flags.get.am());
		zs4.admin.util.setClass(o._.html.e,'own',o._.flags.get.own());
	},

	createNameElement:function(po,o){
		o._.html.name = document.createElement('zs4-name');
		o._.html.e.appendChild(o._.html.name);
		o._.html.name.textContent = o._.name;
	},
	refreshNameInput:function(po,o){
		zs4.admin.util.setClass(o._.html.name,'noset',o._.flags.get.noset());
		zs4.admin.util.setClass(o._.html.input,'noset',o._.flags.get.noset());


	},

	createCallback:function(THIS){
		THIS._.html.error = document.createElement('zs4-error');
		zs4.admin.util.addClass(THIS._.html.error,'hide');
		THIS._.html.e.appendChild(THIS._.html.error);

		THIS._.html.result = document.createElement('zs4-result');
		zs4.admin.util.addClass(THIS._.html.result,'hide');
		THIS._.html.e.appendChild(THIS._.html.result);
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
}

zs4.admin.type = {
	admin:function(po,o){
		zs4.admin.type.object(po,o);
	},
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
						nu._.flags.set.notrans(false);
						nu._.name = n;
						zs4.type.property(o.array,nu);
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
				//zs4.admin.type.object(zs4.admin.rootElementParent,zs4.admin.rootObject);
  			zs4.admin.type.object(o,o.array);

			}).bind(o);
		}

		for (var n in o){
			//if (zs4.is.name(n))console.log(n);
			if (!zs4.is.type(o[n])||!zs4.is.function(zs4.admin.type[o[n]._.typename]))continue;
			zs4.admin.type[o[n]._.typename](o,o[n]);
		}

	},
	boolean:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){

			zs4.admin.util.createNameElement(po,o);

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'checkbox');

			zs4.admin.util.createCallback(o);

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
	date:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){

			zs4.admin.util.createNameElement(po,o);

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			zs4.admin.util.createCallback(o);

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
	integer:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){

			zs4.admin.util.createNameElement(po,o);

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			zs4.admin.util.createCallback(o);

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
		if (o._.html.name==null){

			zs4.admin.util.createNameElement(po,o);

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			zs4.admin.util.createCallback(o);

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
		if (o._.html.toggle==null){
			//console.log('make ui for object '+o._.name);

			if (o._.flags.get.notrans()){
				zs4.admin.util.addClass(o._.html.e,'notrans');
			}
			else {
				zs4.admin.util.removeClass(o._.html.e,'notrans');
			}

			o._.html.head = document.createElement('zs4-object-head');
			o._.html.e.appendChild(o._.html.head);
			if (o._.html.topElement==true)zs4.admin.util.addClass(o._.html.head,'top');

			o._.html.toggle = document.createElement('zs4-object-toggle');
			o._.html.head.appendChild(o._.html.toggle);
			o._.html.toggle.textContent = '+';
			o._.html.expanded = false;
			if (o._.html.topElement==true){
				o._.html.toggle.textContent = '';
				zs4.admin.util.addClass(o._.html.toggle,'top');
			}

			o._.html.name = document.createElement('zs4-name');
			o._.html.head.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;
			if (o._.html.topElement==true)zs4.admin.util.addClass(o._.html.name,'top');


			if (!zs4.is.function(o._.html.submit)){
				o._.html.submit = (function(){
					var count = o._.countProperties();
					if (o._.flags.get.api()&&(o._.html.expanded||count==0)){
						var input = o._.input();
						if (input == null)return;

						var patharr = zs4.string.split.separators(o._.path,'.');
						if (patharr.length>0)for (var i = 0 ; i < patharr.length ; i++){
							var n = patharr[patharr.length-1-i];
							var wrap = new Object();
							wrap[n] = input;
							input = wrap;
						}
						//console.log(input);

						zs4.post(input,function(ret){
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

			if (po != null) {
				o._.html.name.textContent = o._.name;
			}
			else {
				o._.html.treetitle = zs4.THIS.zs4.admin._.value.title;
			}

			zs4.admin.util.createCallback(o);

			o._.html.c = document.createElement('zs4-object-content');
			o._.html.e.appendChild(o._.html.c);
			zs4.admin.util.addClass(o._.html.c,'hide');
			if (o._.html.topElement==true)zs4.admin.util.addClass(o._.html.c,'top');

			o._.html.onToggle = function(){
				if (o._.html.expanded){
					o._.html.expanded = false;
					zs4.admin.util.removeClass(o._.html.toggle,'on');
					zs4.admin.util.addClass(o._.html.c,'hide');
					if (o._.html.topElement!=true)o._.html.toggle.textContent = '+';
				}
				else {
					o._.html.expanded = true;
					zs4.admin.util.addClass(o._.html.toggle,'on');
					zs4.admin.util.removeClass(o._.html.c,'hide');
					if (o._.html.topElement!=true)o._.html.toggle.textContent = '-';
				}
			};
			o._.html.toggle.onclick = o._.html.onToggle;

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
		}

		if (o._.flags.get.api()){
			//o._.html.response = (function(res){window.alert(JSON.stringify(res))}).bind(o);
			zs4.admin.util.addClass(o._.html.name,'api');
		}
		else {
			zs4.admin.util.removeClass(o._.html.name,'api');
		}

		if (zs4.is.string(o._.html.treetitle)){
			o._.html.treetitle = (zs4.THIS.zs4.admin._.value.title).trim();
			if (o._.html.treetitle.length==null)o._.html.treetitle = 'zs4';
			o._.html.name.textContent = o._.html.treetitle;
		}

		zs4.admin.util.refreshCallback(o);

		for (var n in o){
			//if (zs4.is.name(n))console.log(n);
			if (!zs4.is.type(o[n])||!zs4.is.function(zs4.admin.type[o[n]._.typename]))continue;
			zs4.admin.type[o[n]._.typename](o,o[n]);
		}

		if (zs4.is.function(o._.html.refresh))o._.html.refresh();
	},
	password:function(po,o){
		zs4.admin.type.string(po,o);
	},
	scope:function(po,o){
		zs4.admin.type.object(po,o);
	},
	string:function(po,o){
		zs4.admin.util.unknown(po,o);
		if (o._.html.name==null){

			zs4.admin.util.createNameElement(po,o);

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			var typeAttr = 'text';
			if (o._.typename=='password')typeAttr='password';
			o._.html.input.setAttribute('type', typeAttr);

			zs4.admin.util.createCallback(o);

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
		if (o._.html.name==null){

			zs4.admin.util.createNameElement(po,o);

			zs4.admin.util.createCallback(o);

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

zs4.session = {};

zs4.css = zs4.loadcss('/style.css');
zs4.admin.type.object(null,zs4.THIS);
