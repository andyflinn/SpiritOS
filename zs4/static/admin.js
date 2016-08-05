////////////////////////////////////////////////////////////////////////"+"
'use strict';
zs4.ui = new Object();

zs4.ui.type = {
	unknown:function(po,o,typename){
		if (!zs4.is.object(o._.html))o._.html = new Object();
		if (o._.input==null)o._.input = (function(){return null;}).bind(o);
		if (o._.response==null)o._.response = (function(r){zs4.console.log(r);}).bind(o);

		if (o._.cleanup==null)o._.cleanup = (function(){
			zs4.console.log(this._.path + '._.cleanup()');
			zs4.console.log(o._.html.parentElement);
			zs4.console.log(o._.html.e);
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

				//zs4.ui.rootElementParent = po;
				zs4.ui.rootObject = o;
			}

		}
	},
	password:function(po,o){
		this.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-password-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute("type", "password");

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
		this.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;
			o._.html.name.style.display = 'block';

			o._.html.input = document.createElement('input');
			o._.html.e.appendChild(o._.html.input);
			//o._.html.input.style.display = 'block';
			//o._.html.input.setAttribute("type", "password");

			o._.input = (function(){
				if (o._.noset)return null;
				return this._.html.input.value;
			}).bind(o);
		}
		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		o._.html.input.value = po._.value[o._.name];
	},
	text:function(po,o){
		this.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.name==null){
			o._.html.e.style.display = 'block';

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;
			o._.html.name.style.display = 'block';

			o._.html.input = document.createElement('textarea');
			o._.html.e.appendChild(o._.html.input);
			//o._.html.input.style.display = 'block';
			//o._.html.input.setAttribute("type", "password");

			o._.input = (function(){
				if (o._.noset)return null;
				return this._.html.input.value;
			}).bind(o);
		}
		if (zs4.is.boolean(o._.noset))o._.html.input.readOnly = o._.noset;
		o._.html.input.value = po._.value[o._.name];
	},
	object:function(po,o){
		if (!zs4.is.type(o) || o._.typename!='object'){
			zs4.console.log('not a valid zs4 object');
			zs4.console.log(o);
			return null;
		}
		this.unknown(po,o);

		//console.log('checking ui for object '+o._.path);
		if (o._.html.toggle==null){
			//console.log('make ui for object '+o._.name);

			o._.html.e.style.display = 'block';


			o._.html.toggle = document.createElement('zs4-object-toggle');
			o._.html.e.appendChild(o._.html.toggle);
			o._.html.toggle.textContent = '-';
			o._.html.toggle.style.display = 'inline-block';
			o._.html.toggle.style.width = '1em';
			o._.html.toggle.style.height = '1em';
			o._.html.toggle.style.cursor = 'pointer';
			o._.html.toggle.style.border = 'thin dotted';
			o._.html.expanded = true;

			o._.html.name = document.createElement('zs4-object-name');
			o._.html.e.appendChild(o._.html.name);
			if (po == null) o._.html.name.textContent = 'zs4.THIS';
			else o._.html.name.textContent = o._.name;
			o._.html.name.style.cursor = 'pointer';
			o._.html.name.style.fontWeight = 'bold';
			o._.html.name.onclick = function(){
				var input = o._.input();
				if (input == null)return;

				var patharr = zs4.string.split.separators(o._.path,'.');
				if (patharr.length>0)for (var i = 0 ; i < patharr.length ; i++){
					var n = patharr[patharr.length-1-i];
					var wrap = new Object();
					wrap[n] = input;
					input = wrap;
				}
				console.log(input);

				zs4.post(input,function(ret){
					console.log('inside admin post callback')
					zs4.ui.type.object(zs4.ui.rootElementParent,zs4.ui.rootObject);
				});

			};

			o._.html.start = document.createElement('zs4-object-start');
			o._.html.e.appendChild(o._.html.start);
			o._.html.start.textContent = '{';

			o._.html.c = document.createElement('zs4-object-content');
			o._.html.e.appendChild(o._.html.c);
			o._.html.c.style.display = 'block';
			o._.html.c.style.paddingLeft = '1em';
			o._.html.c.style.borderLeft = 'thin dotted';
			//o._.html.content.textContent = 'blah blah';

			o._.html.end = document.createElement('zs4-object-end');
			o._.html.e.appendChild(o._.html.end);
			o._.html.end.textContent = '}';

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
					//if (zs4.is.name(n))zs4.console.log(n);
					if (!zs4.is.type(o[n])||!zs4.is.function(zs4.ui.type[o[n]._.typename]))continue;

					var prop = o[n]._.input();
					if (prop != null)ret[n]=prop;
				}

	      //zs4.console.log(ret);
				return ret;
	    }).bind(o);


		}

		for (var n in o){
			//if (zs4.is.name(n))zs4.console.log(n);
			if (!zs4.is.type(o[n])||!zs4.is.function(zs4.ui.type[o[n]._.typename]))continue;
			zs4.ui.type[o[n]._.typename](o,o[n]);
		}

	},
};


zs4.session = {};
