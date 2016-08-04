////////////////////////////////////////////////////////////////////////"+"
'use strict';

zs4.ui = {
	a:function(p,n){
		var e = document.createElement(n);
		e.zs4 = {ui:zs4.ui,e:e,eParent:p,zc:[],uc:[]};
		p.zs4.uc.push(e);
		p.zs4.zc.push(e.zs4);
		p.appendChild(e);
		return e;
	},
	html:function(p,t,h){
		var e = zs4.ui.a(p,t);
		e.innerHTML = h;
		return e;
	},
	text:function(p,t,text){
		var e = zs4.ui.a(p,t);
		e.textContent = text;
		return e;
	},
	r:function(e){
		var p = e.zs4.eParent;
		p.removeChild(e);
		var found = false; var swap = null;
		for (var i = 0; i < p.zs4.uc.length;i++){
			if (p.zs4.uc[i]==e)found = true;
			if (found && i < (p.zs4.uc.length-1))
			{
				swap = p.zs4.uc[i]; p.zs4.uc[i]=p.zs4.uc[i+1];p.zs4.uc[i+1]=swap;
				swap = p.zs4.zc[i]; p.zs4.zc[i]=p.zs4.zc[i+1];p.zs4.zc[i+1]=swap;
			}
		}
		if (found){
				p.zs4.uc.pop();
				p.zs4.zc.pop();
		}
	},
	toggle:function(p,n){
		var en = 'zs4-o-'+n;
		var o = zs4.ui.a(p,en);
				o.zs4.styleDisplay = 'inline';
				o.zs4.textClosed = '+';
				o.zs4.textOpened = '-';
		var r = o.zs4.eLabel = zs4.ui.text(o,en + '-r',o.zs4.textClosed);
		r.onclick = function(){	o.zs4.toggle();};
		var c = o.zs4.eContent = zs4.ui.a(o,en + '-c');
		c.style.display = 'none';
		//r.onblur = function(){c.style.display = 'none';};
		o.zs4.onopen = function(){};
		o.zs4.onclose = function(){};
		o.zs4.setLabelClosed = function(lbl){
			o.zs4.textClosed = lbl;
			if (c.style.display == 'none'){r.textContent=lbl;}
		};
		o.zs4.setLabelOpened = function(lbl){
			o.zs4.textOpened = lbl;
			if (c.style.display != 'none'){r.textContent=lbl;}
		};
		o.zs4.setLabel = function(lbl){
			o.zs4.setLabelOpened(lbl);
			o.zs4.setLabelClosed(lbl);
			o.zs4.eLabel.textContent = lbl;
		};
		o.zs4.toggle = function(){
			if (c.style.display == 'none')this.open();
			else this.close();
		}
		o.zs4.close = function(){
				c.style.display = 'none';
				o.zs4.eLabel.textContent = o.zs4.textClosed;
		};
		o.zs4.open = function(){
				c.style.display = o.zs4.styleDisplay;
				o.zs4.eLabel.textContent = o.zs4.textOpened;
				o.zs4.onopen();
		};
		//o.zs4.close();
		return o;
	},
	tabs:function(p,n){
		var en = 'zs4-t-'+n;
		var t = zs4.ui.a(p,en);
		var arr = t.zs4.pane = [];
		var th = t.zs4.eHeaders = zs4.ui.a(t,en + '-th');
		var tp = t.zs4.ePanes = zs4.ui.a(t,en + '-tp');
		t.zs4.addTab = function(label){
			var tab = {
				h:zs4.ui.a(th,en + '-h'),
				p:zs4.ui.a(tp,en + '-p'),
				name:label,
				close:function(){
					var found = false; var found_idx = 0;
					for (var i = 0 ; i < arr.length ; i++){
						if (!found && arr[i] == this){
							found = true; found_idx = i;
						}

						if (found && i < (arr.length-1)){
							var swap = arr[i]; arr[i] = arr[i+1]; arr[i+1] = swap;
						}
					}
					zs4.ui.r(tab.h);
					zs4.ui.r(tab.p);
					arr.pop();

					if (found_idx >= arr.length)
						found_idx = arr.length - 1;

					if (found_idx >= 0)
					 	t.zs4.selectTab(arr[found_idx]);
				},
			}

			tab.h.onclick = function(){	t.zs4.selectTab(tab);	}

			tab.eLabel = zs4.ui.a(tab.h,en + '-tl');
			tab.eLabel.textContent = label;
			tab.eClose = zs4.ui.a(tab.h,en + '-tx');
			tab.eClose.textContent = 'x';
			tab.eClose.onclick = function(){tab.close();}

			t.zs4.pane.push(tab);
			t.zs4.selectTab(tab);
			return tab.p;
		}
		t.zs4.selectTab = function(tab){
			if (t.zs4.pane.indexOf(tab)== -1)
				return;

			for (var i = 0; i < t.zs4.pane.length ;i++){
				if (t.zs4.pane[i]==tab){
					t.zs4.pane[i].h.className = 'active';
					t.zs4.pane[i].p.style.display = 'block';
				}else{
					t.zs4.pane[i].h.className = 'hidden';
					t.zs4.pane[i].p.style.display = 'none';
				}
			}

		};
		return t;
	},
	error:function(p){
		var error = zs4.ui.a(p,'zs4-error');
				error.onclick = function(){
					this.zs4.clearError();
				};
				error.zs4.setError = function(text){
					error.zs4.errorText.textContent = text;
					error.className = 'zs4error';
				};
				error.zs4.clearError = function(text){
					error.zs4.errorText.textContent = '';
					error.className = '';
				};
				error.zs4.errorLabel = zs4.ui.a(error,'zs4-error-label');
						error.zs4.errorLabel.textContent = 'Error: ';
				error.zs4.errorText = zs4.ui.a(error,'zs4-error-text');
		return error;
	},
	response:function(p){
		var response = zs4.ui.a(p,'zs4-response');
				response.onclick = function(){
					this.zs4.clearResponse();
				};
				response.zs4.setResponse = function(text){
					response.zs4.responseText.textContent = text;
					response.className = 'zs4response';
				};
				response.zs4.clearResponse = function(text){
					response.zs4.responseText.textContent = '';
					response.className = '';
				};
				response.zs4.responseLabel = zs4.ui.a(response,'zs4-response-label');
						response.zs4.responseLabel.textContent = 'Response: ';
				response.zs4.responseText = zs4.ui.a(response,'zs4-response-text');
		return response;
	},
	id:function(i){
		return document.getElementById(i);
	},
	login:function(p){
		if (zs4.is.email(zs4.session.email)){
			var o = zs4.ui.text(p,'zs4-logout','logout');
			o.onclick = function(){
				if (window.confirm("Click Ok if you really want to log out.")){
					window.location = '/destroytoken';
				}
			}
			return o;
		}
		else{
			var o = zs4.ui.toggle(p,'login');
					o.zs4.requestToken = function(){
						zs4.ui.root.eError.zs4.clearError();
						zs4.ui.root.eResponse.zs4.clearResponse();
						if (!zs4.is.email(i.value)){
								zs4.ui.root.eError.zs4.setError(i.value + ' is not a valid email address.');
								return;
						}
						o.zs4.close();

						var req = new Object(); req['requesttoken']={email:i.value};
						zs4.server.request.post(req,function(r){
								if (zs4.is.error(r))zs4.ui.root.eError.zs4.setError(r.text);
								else zs4.ui.root.eResponse.zs4.setResponse(r.done.text);
								console.log(r);
						},JSON.stringify({user:i.value}));

					}
					if (zs4.session.user){o.style.display='none';return o;}
					o.zs4.setLabel('login');
					var i = o.zs4.eInput = zs4.ui.a(o.zs4.eContent,'input');
							i.placeholder = 'your.email@your.domain';
							i.onchange = function(){o.zs4.requestToken();};
					var b = o.zs4.eButton = zs4.ui.a(o.zs4.eContent,'button');
							b.type = 'button';
							b.textContent = 'login';
							b.onclick = function(){o.zs4.requestToken();};

					o.zs4.onopen = function(){i.style.display =   i.focus();};
			//o.zs4.close();
			return o;
		}
	},
	initialize:function(zs4element){

		function createAdminTab(){
			var options = zs4.ui.root.zTabs.zs4.addTab('admin');

			zs4.ui.text(options,'h3','Server Setup');

			zs4.ui.type.object(null,zs4.THIS);

		};

		function creatOptionsTab(){
				var options = zs4.ui.root.zTabs.zs4.addTab('options');

				zs4.ui.text(options,'h3','Introduction');
				zs4.ui.html(options,'p','You can get this information anytime by clicking on the question mark in the titlebar.');


				zs4.ui.text(options,'h3','Account');
				if (zs4.session.user == null){
					var login_p = zs4.ui.a(options,'p');
					zs4.ui.html(login_p,'span','You can also  ');
					var login_button = zs4.ui.login(login_p);
					zs4.ui.html(login_p,'span','.');
				}else{
					zs4.ui.html(options,'p','Click <a href="/zs4/login/quit">here</a> to log out.');
				}

				var h = zs4.ui.a(options,'h1');
		};

		// attach to the zs4-initialize element
		var conn = zs4.ui.root = zs4element;
		conn.zs4 = zs4.ui.root = {ui:zs4.ui,e:conn,zc:[],uc:[]};

		// create header entities
		var header = zs4.ui.root.eHeader = zs4.ui.a(conn,'zs4-header');
				var brand = zs4.ui.a(header,'zs4-brand'); brand.textContent = 'zs4'
				brand.onclick = function(){createAdminTab()};

				var user = zs4.ui.a(header,'zs4-user');
				if (zs4.is.email(zs4.session.email)){
					user.textContent = zs4.session.email;
				}
				var options = zs4.ui.root.eUserOptions = zs4.ui.a(header,'zs4-user-options');
						options.textContent = '?';
						options.onclick = function(){creatOptionsTab()};
				//var login_button = zs4.ui.login(header);

		var error = zs4.ui.root.eError = zs4.ui.error(conn);
		var response = zs4.ui.root.eResponse = zs4.ui.response(conn);
		var tabs = zs4.ui.root.zTabs = zs4.ui.tabs(conn,'main');

		createAdminTab();
	},
};

zs4.ui.type = {
	unknown:function(po,o,typename){
		if (!zs4.is.object(o._.html))o._.html = new Object();
		if (o._.input==null)o._.input = (function(){return null;}).bind(o);
		if (o._.response==null)o._.response = (function(r){zs4.console.log(r);}).bind(o);
	},
	password:function(po,o){
		this.unknown(po,o);
		console.log('checking ui for object '+o._.path);
		if (o._.html.e==null){
			console.log('make ui for object '+o._.name);
			o._.html.e = document.createElement('zs4-password');
			o._.html.e.style.display = 'block';
			po._.html.c.appendChild(o._.html.e);

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
		console.log('checking ui for object '+o._.path);
		if (o._.html.e==null){
			console.log('make ui for object '+o._.name);
			o._.html.e = document.createElement('zs4-string');
			o._.html.e.style.display = 'block';
			po._.html.c.appendChild(o._.html.e);

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
		console.log('checking ui for object '+o._.path);
		if (o._.html.e==null){
			console.log('make ui for object '+o._.name);
			o._.html.e = document.createElement('zs4-text');
			o._.html.e.style.display = 'block';
			po._.html.c.appendChild(o._.html.e);

			o._.html.name = document.createElement('zs4-value-name');
			o._.html.e.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;
			o._.html.name.style.display = 'block';

			o._.html.input = document.createElement('textarea');
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.style.display = 'block';
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

		console.log('checking ui for object '+o._.path);
		if (o._.html.e==null){
			console.log('make ui for object '+o._.name);
			o._.html.e = document.createElement('zs4-object');
			o._.html.e.style.display = 'block';

			if (zs4.is.type(po)){
				po._.html.c.appendChild(o._.html.e);
			}
			else {
				if (po==null)po=document.body;

				//if (zs4.ui.rootElementParent==null){
					po.appendChild(o._.html.e);
				//}
				//else {
				//	po.replaceChild(o._.html.e,zs4.ui.rootObject._.html.e);
				//}
				zs4.ui.rootElementParent = po;
				zs4.ui.rootObject = o;
			}


			o._.html.toggle = document.createElement('zs4-object-toggle');
			o._.html.e.appendChild(o._.html.toggle);
			o._.html.toggle.textContent = '-';
			o._.html.toggle.style.display = 'inline-block';
			o._.html.toggle.style.width = '1em';
			o._.html.toggle.style.height = '1em';
			o._.html.toggle.style.cursor = 'pointer';
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

zs4.server ={
	request:{
		ajax:function(u,cb){
			this.bindFunction=function(caller,o) {return function(){ return caller.apply(o,[o]);};};this.stateChange=function(o){if (this.request.readyState==4)this.cb(this.request.responseText);};this.getRequest=function(){if (window.ActiveXObject)return new ActiveXObject('Microsoft.XMLHTTP');else if(window.XMLHttpRequest)return new XMLHttpRequest();return false;};this.postBody=(arguments[2]||"");this.cb=cb;this.u=u;this.request=this.getRequest();if(this.request){var req=this.request;req.onreadystatechange=this.bindFunction(this.stateChange,this);if (this.postBody!==""){req.open("POST",u,true);req.setRequestHeader('Content-type','application/json');} else{req.open("GET",u,true);}req.send(this.postBody);}
		},
		get:function(u,cb){
			this.ajax(u,function(d){if(cb!=null)cb(d);});
			return ('this.ajax(\''+u+'\',cb)');
		},
		post:function(o,cb){
			this.ajax('/',function(d){
				if(cb!=null){
					cb(JSON.parse(d));
				}else{
					zs4.console.log(d);
				}
			},JSON.stringify(o)
			);
			//return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
		},
	},
};

zs4.session = {};
