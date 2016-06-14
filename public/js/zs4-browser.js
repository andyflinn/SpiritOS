////////////////////////////////////////////////////////////////////////"+"
'use strict';
var zs4 = {
	request:{
		ajax:function(u,cb){
			this.bindFunction=function(caller,o) {return function(){ return caller.apply(o,[o]);};};this.stateChange=function(o){if (this.request.readyState==4)this.cb(this.request.responseText);};this.getRequest=function(){if (window.ActiveXObject)return new ActiveXObject('Microsoft.XMLHTTP');else if(window.XMLHttpRequest)return new XMLHttpRequest();return false;};this.postBody=(arguments[2]||"");this.cb=cb;this.u=u;this.request=this.getRequest();if(this.request){var req=this.request;req.onreadystatechange=this.bindFunction(this.stateChange,this);if (this.postBody!==""){req.open("POST",u,true);req.setRequestHeader('Content-type','application/json');} else{req.open("GET",u,true);}req.send(this.postBody);}
		},
		get:function(u,cb){
			this.ajax(u,function(d){if(cb!=null)cb(d);});
			return ('this.ajax(\''+u+'\',cb)');
		},
		post:function(o,cb){
			this.ajax('/zs4/post',function(d){
				if(cb!=null){
					cb(JSON.parse(d));
				}else{
					console.log("no data");
				}
			},JSON.stringify(o)
			);
			//return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
		},
	},
	api:{
	},
	ui:{
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
		id:function(i){
			return document.getElementById(i);
		},
		login:function(p){
			var o = zs4.ui.toggle(p,'login');
					o.zs4.requestToken = function(){
						zs4.ui.root.eError.zs4.clearError();
						if (!zs4.is.email(i.value)){
								zs4.ui.root.eError.zs4.setError(i.value + ' is not a valid email address.');
								return;
						}

						zs4.request.ajax('/zs4/token',function(d){
								var r = JSON.parse(d);
								console.log(r);
						},JSON.stringify({user:i.value}));

					}
					if (zs4.session.user){o.style.display='none';return o;}
					o.zs4.setLabel('login');
					var i = zs4.ui.a(o.zs4.eContent,'input');
							i.placeholder = 'your.email@your.domain';
							i.onchange = function(){o.zs4.requestToken();};
					var b = zs4.ui.a(o.zs4.eContent,'button');
							b.type = 'button';
							b.textContent = 'login';
							b.onclick = function(){o.zs4.requestToken();};

					o.zs4.onopen = function(){i.focus();};
			//o.zs4.close();
			return o;
		},
		initialize:function(zs4element){

			var creatOptionsTab = function(){
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
						zs4.ui.html(options,'p','Click <a href="/zs4/logout">here</a> to log out.');
					}

					var h = zs4.ui.a(options,'h1');

			};

		// attach to the zs4-initialize element
			var conn = zs4.ui.root = zs4element;
			conn.zs4 = zs4.ui.root = {ui:zs4.ui,e:conn,zc:[],uc:[]};

			// create header entities
			var header = zs4.ui.root.eHeader = zs4.ui.a(conn,'zs4-header');
					var brand = zs4.ui.a(header,'zs4-brand');
					var slogan = zs4.ui.a(header,'zs4-slogan');
					var user = zs4.ui.a(header,'zs4-user');
					var options = zs4.ui.root.eUserOptions = zs4.ui.a(header,'zs4-user-options');
							options.textContent = '?';
							options.onclick = function(){creatOptionsTab()};

			var error = zs4.ui.root.eError = zs4.ui.error(conn);
			var tabs = zs4.ui.root.zTabs = zs4.ui.tabs(conn,'main');

			// request more initialization data from server
			zs4.request.post({api:'initialize'},function(o){
				console.log(o);

				zs4.session.user = o.user;
				zs4.session.server = o.server;

				// populate header
				brand.textContent = o.server.public.name;
				slogan.textContent = o.server.public.slogan;
				if (o.user != null){
					user.textContent = o.user.email;
				}else{
					zs4.ui.login(header);
				}

				delete zs4.initialize;

				creatOptionsTab();
			});

		},



	},
	session:{

	},

};

var exports = {};
