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
			}

		}
	},

	createCallback:function(THIS){
		THIS._.html.error = document.createElement('zs4-error');
		THIS._.html.error.style.display = 'none';
		THIS._.html.e.appendChild(THIS._.html.error);

		THIS._.html.result = document.createElement('zs4-result');
		THIS._.html.result.style.display = 'none';
		THIS._.html.e.appendChild(THIS._.html.result);
	},

	refreshCallback:function(THIS){
		//console.log('refreshCallback('+THIS._.path+')')
		if (THIS._.cberror == null){
			THIS._.html.error.textContent = '';
			THIS._.html.error.style.display = 'none';
		}
		else {
			THIS._.html.error.textContent = THIS._.cberror.text;
			THIS._.html.error.style.display = 'inline';
		}

		if (THIS._.cbresult == null){
			THIS._.html.result.textContent = '';
			THIS._.html.result.style.display = 'none';
		}
		else {
			THIS._.html.result.textContent = 'result!';
			THIS._.html.result.style.display = 'inline';
		}
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
						nu._.notrans = false;
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
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'checkbox');

			zs4.admin.util.createCallback(o);

			o._.input = (function(){
				if (o._.noset)return null;
				if (this._.html.input.checked==true)return true;
				return false;
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		o._.html.input.checked = po._.value[o._.name];
	},
	email:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'text');
			o._.html.input.autocomplete = 'on';

			zs4.admin.util.createCallback(o);

			o._.input = (function(){
				return this._.html.input.value;
			}).bind(o);
			o._.response = (function(r){
				if (zs4.is.string(r))this._.html.input.value = r;
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		o._.html.input.value = po._.value[o._.name];
	},
	integer:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			zs4.admin.util.createCallback(o);

			o._.input = (function(){
				if (o._.noset)return null;
				return parseInt(this._.html.input.value);
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		//console.log(o._.path);
		//console.log(po._.value[o._.name]);
		o._.html.input.value = parseInt(po._.value[o._.name]);
	},
	number:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');

			zs4.admin.util.createCallback(o);

			o._.input = (function(){
				if (o._.noset)return null;
				return parseFloat(this._.html.input.value);
			}).bind(o);
		}
		zs4.admin.util.refreshCallback(o);

		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		o._.html.input.value = parseFloat(po._.value[o._.name]);
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

			o._.html.e.style.display = 'block';
			if (o._.notrans){
				o._.html.e.style.opacity = 0.5;
			}

			o._.html.toggle = document.createElement('zs4-object-toggle');
			o._.html.e.appendChild(o._.html.toggle);
			o._.html.toggle.textContent = '+';
			o._.html.toggle.style.display = 'inline-block';
			o._.html.toggle.style.width = '1em';
			o._.html.toggle.style.height = '1em';
			o._.html.toggle.style.cursor = 'pointer';
			o._.html.toggle.style.border = 'thin dotted';
			o._.html.expanded = false;

			o._.html.name = document.createElement('zs4-object-name');
			o._.html.e.appendChild(o._.html.name);

			if (po != null) {
				o._.html.name.textContent = o._.name;
			}
			else {
				o._.html.treetitle = zs4.THIS.zs4.admin._.value.title;
			}

			if (o._.api){
				//o._.html.response = (function(res){window.alert(JSON.stringify(res))}).bind(o);
				o._.html.submit = (function(){
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
				}).bind(o);
				o._.html.name.style.cursor = 'pointer';
				o._.html.name.style.fontWeight = 'bold';
				o._.html.name.onclick = o._.html.submit;
			}

			o._.html.start = document.createElement('zs4-object-start');
			o._.html.e.appendChild(o._.html.start);
			if (o._.arrayio) o._.html.start.textContent = '[';
			else if (o._.api) o._.html.start.textContent = '(';
			else o._.html.start.textContent = '{';

			zs4.admin.util.createCallback(o);

			o._.html.c = document.createElement('zs4-object-content');
			o._.html.e.appendChild(o._.html.c);
			o._.html.c.style.display = 'none';
			o._.html.c.style.paddingLeft = '1em';
			o._.html.c.style.borderLeft = 'thin dotted';
			//o._.html.content.textContent = 'blah blah';

			o._.html.end = document.createElement('zs4-object-end');
			o._.html.e.appendChild(o._.html.end);
			if (o._.arrayio) o._.html.end.textContent = ']';
			else if (o._.api) o._.html.end.textContent = ')';
			else o._.html.end.textContent = '}';

			o._.html.onToggle = function(){
				if (o._.html.expanded){
					o._.html.expanded = false;
					o._.html.c.style.display = 'none';
					o._.html.toggle.textContent = '+';
				}
				else {
					o._.html.expanded = true;
					o._.html.c.style.display = 'block';
					o._.html.toggle.textContent = '-';
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
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute("type", "password");

			zs4.admin.util.createCallback(o);

			o._.input = (function(){
				return this._.html.input.value;
			}).bind(o);
			o._.response = (function(r){
				if (zs4.is.string(r))this._.html.input.value = r;
			}).bind(o);
		}
		o._.html.input.value = '';
	},
	string:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'text');
			o._.html.input.autocomplete = 'on';

			zs4.admin.util.createCallback(o);

			o._.input = (function(){
				if (o._.noset)return null;
				return this._.html.input.value;
			}).bind(o);
		}
		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		o._.html.input.value = po._.value[o._.name];
		//console.log(po._.value[o._.name]);
	},
	text:function(po,o){
		zs4.admin.util.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;
			o._.html.name.style.display = 'block';

			zs4.admin.util.createCallback(o);

			o._.html.input = document.createElement('textarea');
			o._.html.e.appendChild(o._.html.input);

			o._.input = (function(){
				if (o._.noset)return null;
				return this._.html.input.value;
			}).bind(o);
		}
		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		o._.html.input.value = po._.value[o._.name];
	},
};

zs4.session = {};

zs4.admin.type.object(null,zs4.THIS);
