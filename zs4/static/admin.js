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
				if (o._.html.topElement==true){
					//o._.html.toggle.textContent = '';
					zs4.admin.util.addClass(o._.html.toggle,'top');
				}
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

			if (o._.flags.get.notrans()){
				zs4.admin.util.addClass(o._.html.e,'notrans');
			}
			else {
				zs4.admin.util.removeClass(o._.html.e,'notrans');
			}

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

			o._.html.c = document.createElement('zs4-object-content');
			o._.html.e.appendChild(o._.html.c);
			zs4.admin.util.addClass(o._.html.c,'hide');

			o._.html.toggleOff = function(){
				o._.html.expanded = false;
				zs4.admin.util.addClass(o._.html.e,'off');
				zs4.admin.util.removeClass(o._.html.e,'on');
				zs4.admin.util.addClass(o._.html.name,'off');
				zs4.admin.util.removeClass(o._.html.name,'on');
				zs4.admin.util.addClass(o._.html.head,'off');
				zs4.admin.util.removeClass(o._.html.head,'on');
				zs4.admin.util.addClass(o._.html.toggle,'off');
				zs4.admin.util.removeClass(o._.html.toggle,'on');
				zs4.admin.util.addClass(o._.html.c,'hide');
			};
			o._.html.toggleOn = function(){
				o._.html.expanded = true;
				zs4.admin.util.removeClass(o._.html.e,'off');
				zs4.admin.util.addClass(o._.html.e,'on');
				zs4.admin.util.removeClass(o._.html.name,'off');
				zs4.admin.util.addClass(o._.html.name,'on');
				zs4.admin.util.removeClass(o._.html.head,'off');
				zs4.admin.util.addClass(o._.html.head,'on');
				zs4.admin.util.removeClass(o._.html.toggle,'off');
				zs4.admin.util.addClass(o._.html.toggle,'on');
				zs4.admin.util.removeClass(o._.html.c,'hide');
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
			o._.html.toggleOff();
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

		function setObjectClass(o,c,tof){
			if (tof){
				zs4.admin.util.addClass(o._.html.e,c);
				zs4.admin.util.addClass(o._.html.toggle,c);
				zs4.admin.util.addClass(o._.html.head,c);
				zs4.admin.util.addClass(o._.html.name,c);
				zs4.admin.util.addClass(o._.html.c,c);
				zs4.admin.util.addClass(o._.html.error,c);
				zs4.admin.util.addClass(o._.html.result,c);
			}
			else {
				zs4.admin.util.removeClass(o._.html.e,c);
				zs4.admin.util.removeClass(o._.html.toggle,c);
				zs4.admin.util.removeClass(o._.html.head,c);
				zs4.admin.util.removeClass(o._.html.name,c);
				zs4.admin.util.removeClass(o._.html.c,c);
				zs4.admin.util.removeClass(o._.html.error,c);
				zs4.admin.util.removeClass(o._.html.result,c);
			}
		};

		setObjectClass(o,'api',o._.flags.get.api())

		if (o._.html.topElement==true)setObjectClass(o,'top',true);
		else setObjectClass(o,'top',false);


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

		zs4.admin.util.setClass(o._.html.e,'nodisplay',o._.flags.get.nodisplay());

		setObjectClass(o,'scope',o._.flags.get.scope())
		if (o._.flags.value & o._.flags.scope){
			//zs4.admin.util.addClass(o._.html.toggle,'scope');
			o._.scope = o;
			if (zs4.is.string(o._.value.zs4.admin.title) && o._.value.zs4.admin.title.length > 0){
				o._.html.name.textContent = o._.value.zs4.admin.title;
			}
			else {
				o._.html.name.textContent = o._.name;
			}
		}
		else{
			o._.scope = po._.scope;
			//zs4.admin.util.removeClass(o._.html.toggle,'scope');
		}

		setObjectClass(o,'arrayio',o._.flags.get.arrayio())

		if (o._.name == 'zs4'){
			setObjectClass(o,'settings',true);
		}
		else {
			setObjectClass(o,'settings',false);
		}

		if (o._.name == 'email'){
			setObjectClass(o,'email',true);
		}
		else {
			setObjectClass(o,'email',false);
		}

		if (o._.name == 'rsa'){
			setObjectClass(o,'rsa',true);
		}
		else {
			setObjectClass(o,'rsa',false);
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
        console.log (arr);
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

zs4.session = {};

zs4.css = zs4.loadcss('/style.css');
zs4.admin.type.object(null,zs4.location.get());
