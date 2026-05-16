////////////////////////////////////////////////////////////////////////"+"
'use strict';


zs4.admin = new Object({debug:false,});

var UI;
zs4.admin.util = {
	clseps:' ',

	date:{
		fromInput:function(i){
			var d = new Date();

			var a = zs4.string.split.separators(i.value,"-");
			d.setFullYear(parseInt(a[0]),parseInt(a[1]),parseInt(a[2]));
			//console.log(d);
			//console.log(d.valueOf());

			return d.valueOf();
		},
		toInput:function(date,i){

			var datum = new Date();
			datum.setTime(date);

			if (i.readOnly){
			//	i.value = parseInt(date);
				return;
			}
			var s = datum.getFullYear()+'-';
			if (datum.getMonth()<10) {s+= '0'+datum.getMonth();} else {s+=datum.getMonth();}
			s += '-';
			if (datum.getDate()<10) {s+= '0'+datum.getDate();} else {s+=datum.getDate();}

			//console.log('date to input: '+s);
			//console.log('input string: '+s);
			i.value = s;
		},
	},

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
	userScope:function(){
		if (!UI.user())return null;
		return zs4.THIS._.resolvePath(zs4.THIS._.scopath);
	},
	setClass:function(e,c,tof){
		if (e==null||c==null)return;
		if (tof)return UI.addClass(e,c);
		else return UI.removeClass(e,c);
	},
	setIcon:function(e,icon){
		if (e==null||icon==null)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
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
		e.title = icon;
	},
	setAnimate:function(e,icon){
		if (e==null||icon==null)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
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
	setOnClick:function(e,foo){
		e.style.cursor = 'pointer';
		e.onclick = foo;
		return e;
	},
	addAttribute:function(e,a,c){
		if (e==null||c==null)return;
		var set = zs4.string.split.separators(c,UI.clseps);
		if  (set.length==0)return;
		var cls = zs4.string.split.separators(e[a],UI.clseps);
		for (var i = 0 ; i < set.length ; i++)zs4.string.array.add.new(cls,'zs4-'+set[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e[a] = ret;
	},
	removeAttribute:function(e,a,c){
		if (e==null||c==null)return;
		var rem = zs4.string.split.separators(c,UI.clseps);
		if  (rem.length==0)return;
		var cls = zs4.string.split.separators(e[a],UI.clseps);
		for (var i = 0 ; i < rem.length ; i++)zs4.string.array.remove.string(cls,'zs4-'+rem[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e[a] = ret;
	},
	addClass:function(e,c){
		if (e==null||c==null)return;
		var set = zs4.string.split.separators(c,UI.clseps);
		if  (set.length==0)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
		for (var i = 0 ; i < set.length ; i++)zs4.string.array.add.new(cls,'zs4-'+set[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	removeClass:function(e,c){
		if (e==null||c==null)return;
		var rem = zs4.string.split.separators(c,UI.clseps);
		if  (rem.length==0)return;
		var cls = zs4.string.split.separators(e.className,UI.clseps);
		for (var i = 0 ; i < rem.length ; i++)zs4.string.array.remove.string(cls,'zs4-'+rem[i]);
		var ret = ''; for (var i = 0 ; i < cls.length ; i++){
			if (i==0)ret = cls[0]; else ret += (' '+cls[i]);
		}
		e.className = ret;
	},
	addIconElement:function(p,icon){
		var ret = document.createElement('zs4-ielement');
		UI.setIcon(ret,icon);
		p.appendChild(ret);
		return ret;
	},
	addIconImage:function(p,icon){
		var ret = document.createElement('div');
		ret.style.display = 'inline-block';
		UI.addIconElement(ret,icon);
		p.appendChild(ret);
		return ret;
	},
	addTextSpan:function(p,text){
		var ret = document.createElement('span');
		ret.textContent = text;
		p.appendChild(ret);
		return ret;
	},
	addSpace:function(p,w,h){
		var ret = document.createElement('span');
		ret.innerHTML = '<svg width=\"0.5em\" height=\"1em\"></svg>';
		p.appendChild(ret);
		return ret;
	},

	createSearchSelect:function(o,s){
		var search = document.createElement('zs4-search-box');
		search.zs4 = new Object({
			s:s,
			value:'',
			getValue:function(){
				return search.zs4.value;
			},
			setValue:function(v){
				if (zs4.is.string(v)){
					search.zs4.value = v;
					search.zs4.selectedtitle.textContent = v;
				}
				else if (zs4.is.object(v)){
					search.zs4.value = v._.path;
					search.zs4.selectedtitle.textContent = v.zs4.head.title._.value;
					search.zs4.valuescope = v;
				}
			},
			getScope:function(){
				if (!zs4.is.object(search.zs4.valuescope))return null;
				return search.zs4.valuescope;
			},
			showResults:function(){
				if (search.zs4.results.length == 0){
					search.zs4.optionsAreVisible = false;
					return;
				}

				search.zs4.options.style.display = 'block';
				search.zs4.optionsAreVisible = true;
			},
			hideResults:function(){
				search.zs4.options.style.display = 'none';
				search.zs4.optionsAreVisible = false;
			},
			toggleResults:function(){
				if (search.zs4.optionsAreVisible){
					search.zs4.hideResults();
				}
				else {
					search.zs4.showResults();
				}
			},
			scopeTrueOrFalse:null,
			scopeIsIncluded:function(scope){
				//console.log(scope._.path+': owner ('+scope.zs4.head.owner._.value+')');
				if (zs4.is.string(search.zs4.s.owner)&&scope.zs4.head.owner._.value != search.zs4.s.owner){
					console.log(scope._.path+': bad owner ('+scope.zs4.head.owner._.value+')');
					return false;
				}
				if (zs4.is.string(search.zs4.s.type)&&search.zs4.s.type.length>0&&s.type!=scope.zs4.head.typename._.value){
					console.log(scope._.path+': bad type ('+scope.zs4.head.typename._.value+')');
					return false;
				}
				if (zs4.is.string(search.zs4.stringinput.value)&&search.zs4.stringinput.value!=''){
					if (!scope._.search(search.zs4.stringinput.value)){
						console.log(scope._.path+': did not find ('+search.zs4.stringinput.value+')');
						return false;
					}
				}
				if (zs4.is.function(search.zs4.scopeTrueOrFalse)){
					return search.zs4.scopeTrueOrFalse(scope);
				}
				return true;
			},
			refreshResults:function(){
				var a = search.zs4.results;
				for (var i = 0 ; i < a.length; i++){
					if (search.zs4.scopeIsIncluded(a[i].scope)){
						a[i].container.style.display = 'block';
						if (search.zs4.value == a[i].scope._.path){
							search.zs4.selectedtitle.textContent = a[i].scope.zs4.head.title._.value;
							search.zs4.valuescope = a[i].scope;
						}

					}
					else {
						a[i].container.style.display = 'none';
					}
				}
			},
			results:new Array(),
			result:function(scope){
				var RESULT = this;

				RESULT.scope = scope;
				RESULT.container = document.createElement('zs4-search-result');
				RESULT.container.style.display = 'block';
				RESULT.container.onclick = function(){
					search.zs4.setValue(RESULT.scope);
					search.zs4.hideResults();
					if (zs4.is.function(search.zs4.onchange)){
						search.zs4.onchange();
					}
				};

				RESULT.icon = UI.addIconElement(RESULT.container,scope.zs4.head.typename._.value);

				RESULT.title = document.createElement('zs4-search-result-title');
				RESULT.title.textContent = scope.zs4.head.title._.value;
				RESULT.container.appendChild(RESULT.title);

				RESULT.description = document.createElement('zs4-search-result-description');
				RESULT.description.textContent = scope.zs4.head.description._.value;
				RESULT.description.style.fontSize = '.7em';
				RESULT.description.style.display = 'block';
				RESULT.container.appendChild(RESULT.description);

				search.zs4.options.appendChild(RESULT.container);
				search.zs4.results.push(RESULT);
			},
			submit:function(cb){
				var req = new Object({
					value:search.zs4.stringinput.value,
					type:s.type,
					owner:s.owner,
				});

				var tq = null;
				if(req.type.length>0)
				tq=zs4.THIS._.resolvePath('zs4.type.'+req.type+'.method.query')

				console.log('resolvePath('+'zs4.type.'+req.type+'.method.query'+') = '+tq);

				UI.removeClass(o._.html.spin,'nodisplay');
				zs4.post(zs4.THIS.zs4.search._.wrapRequest(req),function(ret){
					UI.addClass(o._.html.spin,'nodisplay');
					//o._.html.refreshAll();

					var scopes = zs4.THIS._.getAllScopes();
					console.log(scopes);

					search.zs4.options.innerHTML = '';
					search.zs4.results = new Array();
					for (var i = 0 ; i < scopes.length; i++){
						var nu = new search.zs4.result(scopes[i]);
					}
					search.zs4.refreshResults();
					search.zs4.showResults();
					if (zs4.is.function(cb)) cb();
				});

			},
		});
		if (search != null){
				search.style.display = 'block';

				// add search icon and string input
				search.zs4.string = document.createElement('zs4-search-string');
				search.zs4.string.style.display = 'block';
				search.appendChild(search.zs4.string);

				search.zs4.stringicon = UI.addIconElement(search.zs4.string,'search');
				search.zs4.stringicon.onclick = search.zs4.submit;
				search.zs4.stringinput = document.createElement('input');
				search.zs4.stringinput.oninput = search.zs4.refreshResults;
				search.zs4.stringinput.onchange = search.zs4.submit;
				search.zs4.stringinput.type = 'search';
				search.zs4.string.appendChild(search.zs4.stringinput);

				// add search select input
				search.zs4.select = document.createElement('zs4-search-select');
				search.zs4.select.style.display = 'block';
				search.appendChild(search.zs4.select);

				search.zs4.selecticon = UI.addIconElement(search.zs4.select,'select');
				search.zs4.selecticon.onclick = search.zs4.toggleResults;
				search.zs4.selectedoption = document.createElement('zs4-search-selectedoption');
				search.zs4.select.appendChild(search.zs4.selectedoption);

				search.zs4.selectedtitle = document.createElement('zs4-search-selectedtitle');
				search.zs4.selectedtitle.style.fontWeight = 'bold';
				search.zs4.selectedtitle.onclick = search.zs4.toggleResults;
				search.zs4.select.appendChild(search.zs4.selectedtitle);

				// options container
				search.zs4.optionsAreVisible = true;
				search.zs4.options = document.createElement('zs4-search-options');
				search.zs4.options.style.display = 'block';
				search.appendChild(search.zs4.options);
		}
		return search;
	},
	createSelectScopeItem:function(o,s){
		if (s==null)s=zs4.THIS;
		var container = document.createElement('zs4-scope-item-select');
		var text = document.createElement('zs4-scope-item-path');
		container.appendChild(text);
		var select = document.createElement('select');
		container.appendChild(select);
		select.onchange = function(){
			select.zs4.setValue(select.value);
			console.log('createSelectScopeItem.onchange.value = '+select.value);
			if (zs4.is.function(select.zs4.onchange))select.zs4.onchange();
		}
		select.zs4 = new Object({
			container:container,
			text:text,
			scope:s,
			value:'',
			getValue:function(){
				return select.zs4.value;
			},
			setValue:function(v){
				select.value = v;
				select.zs4.value = v;
				select.zs4.text.textContent = v;
				select.zs4.refreshOptions();
			},
			setScope:function(s){
				select.zs4.scope = s;
				if (zs4.is.object(s))console.log('setScope() for item select... '+ s.zs4.head.typename._.value);
				else console.log('setScope() for item select... '+ s);
				select.zs4.refreshOptions();
			},
			showText:function(){
				text.style.display = 'inline';
			},
			hideText:function(){
				text.style.display = 'none';
			},
			showSelect:function(){
				select.style.display = 'inline';
			},
			hideSelect:function(){
				select.style.display = 'none';
			},
			refreshOptions:function(){
				select.innerHTML = '';
				if (select.zs4.scope==null){
					select.zs4.showText();
					select.zs4.hideSelect();
					return;
				}

				var a = select.zs4.scope._.getScopeItems();
				a.sort(function(a,b){
					return a.value.localeCompare(b.value);
				});
				select.zs4.options = a;

				var found = false;
				for (var i = 0 ; i < a.length; i++){
					if (zs4.is.function(select.zs4.itemTrueOrFalse)){
						//console.log('itemTrueOrFalse is a function');
						if (zs4.is.object(a[i].item)){
							if (!select.zs4.itemTrueOrFalse(a[i]))continue;
						}
					}
					a[i].opt = document.createElement('option');
					a[i].opt.textContent = a[i].value;
					a[i].opt.value = a[i].value;
					if (a[i].value = select.zs4.value){
						var found = true;
						a[i].opt.selected = true;
					}
					select.appendChild(a[i].opt);
				}
				select.value = select.zs4.value;
				if (found){
					select.zs4.hideText();
					select.zs4.showSelect();
				}
				else if (a.length > 0){
					select.zs4.showText();
					select.zs4.showSelect();
				}
				else {
					select.zs4.hideText();
					select.zs4.showSelect();
				}
			},
		});
		container.zs4 = select.zs4;
		if (select!=null){

		}
		return container;
	},
	app:function(scope,containerElement){
		//this.scope = scope;
		this.containerElement = containerElement;

		console.log(scope);

		this.internalRefresh = function(){
			// flag the first pass
			if (!zs4.is.boolean(this.uninitialized))this.uninitialized=true;
			else this.uninitialized=false;

				//console.log('refreshing app type: ' + this.scope.zs4.head.type._.value + ' ' + this.scope.zs4.head.bits._.value);

			if (zs4.is.function(this.refresh))this.refresh();

			//if (zs4.is.object(scope._.html.dialog.coins)){
				//console.log('updating balance from app.refreshInternal()');
				//scope._.html.dialog.coins.updateBalance();
			//}
		};
	},
	createValueElement:function(pe,v){
		//container
		var e = document.createElement('zs4-input-value');
		e.style.display = 'block';

		//label
		var l = document.createElement('zs4-input-label');
		l.textContent = v._.name;
		UI.setIcon(l,v._.name);
		e.appendChild(l);

		var i;
		// value READONLY
		if (v._.flags.get.noset()||!v._.flags.get.quickupdate()){
			i = document.createElement('zs4-input-noset');
			i.textContent = v._.value.toString();
			v._.onchange(function(){i.textContent = v._.value.toString();});
		}
		// value INPUT
		else if (v._.type==String){
			//var onchange = function(
			if (v._.type==String){
				if (zs4.is.array(v._.enum)&&v._.enum.length>0){
					i = document.createElement('select');
					for (var x = 0; x < v._.enum.length; x++){
						var opt = document.createElement('option');
						opt.value = opt.textContent = v._.enum[x];
						if (v._.enum[x]==v._.value)opt.selected = true;
						i.appendChild(opt);
					}
					i.onchange = function(){
						console.log(i.selectedIndex,i.value);
						if (v._.flags.get.local()){
							v._.value = v._.enum[i.selectedIndex];
						}
						else {
							UI.setIcon(l,'upload');
							zs4.post(v._.wrapRequest(v._.enum[i.selectedIndex]),function(ret){
								console.log(ret);
								UI.setIcon(l,v._.name);
							});
						}
					};
				}
				else {
					i = document.createElement('input');
					UI.addAttribute(i,'autocomplete',v._.name);
					UI.addAttribute(i,'autocomplete',v._.typename);
					i.maxLength = v._.maxlength;
					var typeAttr = 'text';
					if (v._.typename=='password')typeAttr='password';
					i.setAttribute('type', typeAttr);
					i.onchange = function(){
						//alert('++++++++++++++++++');
						if (v._.flags.get.local()){
							v._.value = i.value;
						}
						else {
							UI.setIcon(l,'upload');
							zs4.post(v._.wrapRequest(i.value),function(ret){
								UI.setIcon(l,v._.name);
							});
						}
					};
				}
				v._.onchange(function(){
					i.value = v._.value;
				});
				i.value = v._.value;
			}
			e.appendChild(i);
		}

		pe.appendChild(e);
		return e;
	},

	element:function(bitstring){
		var ELEMENT = this;

		var on = new Object();
		ELEMENT.hasEventHandler = function(name){
			if (!zs4.is.name(name))return false;
			if (!on.hasOwnProperty(name))return false;
			return true;
		};
		ELEMENT.trigger = function(name){
			if (!on.hasOwnProperty(name))return;

			var ON = on[name];
			for (var i = 0; i < ON.f.length;i++){
				ON.f[i](ON);
			}
		}
		ELEMENT.on = function(name,func,remove){
			if (!zs4.is.name(name))return false;
			if (!zs4.is.function(func))return false;
			var ON;
			if (on.hasOwnProperty(name)){
				ON = on[name];
			}
			else {
				if (remove) return false;
				ON = on[name] = new Object();
				ON.f = new Array();
			}

			var found = false;
			for (var i = 0; i < ON.f.length;i++){
				if (ON.f[i]==func){
					if (remove==true){
						ON.f.splice(i,1);
						if (ON.f.length==0){
							delete on[name];
						}
						return false;
					}
					found=true;
				}
			}
			if (!found)ON.f.push(func);

			return true;
		};

		ELEMENT.show = function(){
			if (ELEMENT.top != null){
				if (ELEMENT.bits.block.get())ELEMENT.top.style.display = 'block';
				else if (ELEMENT.bits.inlineblock.get())ELEMENT.top.style.display = 'inline-block';
				else if (ELEMENT.bits.inline.get())ELEMENT.top.style.display = 'inline';
				else ELEMENT.top.style.display = 'initial';
			}
		};
		ELEMENT.hide = function(){
			if (ELEMENT.top != null){
				ELEMENT.top.style.display = 'none';
			}
		};

		ELEMENT.element = null;

		ELEMENT.appendElement = function(e){
			if (zs4.is.string(e))e = document.createElement(e);
			ELEMENT.element.appendChild(e);
			return e;
		};

		ELEMENT.append = function(eObj){
			if (ELEMENT.element==null || eObj.top==null)return null;
			ELEMENT.element.appendChild(eObj.element);
			return eObj;
		}

		var current_bit = 0;
		function bits(){
			zs4.util.bits.call(this);
		}
		ELEMENT.bits = new bits();
		ELEMENT.addBit = function(name){
			ELEMENT.bits.addBit(name,current_bit);
			current_bit += 1;
		}

		ELEMENT.addBit('block');
		ELEMENT.addBit('inlineblock');
		ELEMENT.addBit('inline');
		ELEMENT.addBit('showing'); ELEMENT.bits.showing.true();

		ELEMENT.bgimage = function(img){
			if (ELEMENT.top==null)return false;
			if (img==null){
				zs4.style.type.bgimage(ELEMENT.top);
			}
			else {
				zs4.style.type.bgimage(ELEMENT.top,'/gfx/icons/'+img+'.svg');
			}

			return true;
		}
		ELEMENT.pointer = function(ptr){
			if (ELEMENT.element==null)return false;
			if (ptr==null) ELEMENT.element.style.cursor = 'initial';
			else ELEMENT.element.style.cursor = ptr;
			return ELEMENT.element.style.cursor;
		},
		ELEMENT.color = function(color){
			if (ELEMENT.top==null)return null;
			if (color==null)return ELEMENT.top.style.color;
			ELEMENT.top.style.color = color;
			return ELEMENT.top.style.color;
		};

		ELEMENT.setBits = function(str){ELEMENT.bits.setString(str);}
		if (zs4.is.string(bitstring))ELEMENT.setBits(bitstring);
		return ELEMENT;
	},
	div:function(pe){
		var DIV = this;
		UI.element.call(DIV,'block');
		DIV.top = DIV.element = document.createElement('div');
		pe.appendChild(DIV.top);
		DIV.show();
	},
	inline:function(pe){
		var INLINE = this;
		UI.element.call(INLINE,'inlineblock');
		INLINE.top = INLINE.element = document.createElement('div');
		pe.appendChild(INLINE.top);
		INLINE.show();
	},
	inputBoolean:function(pe,tof){
		var BOOL = this;
		UI.element.call(BOOL,'inlineblock');

		var div = BOOL.top = BOOL.element = document.createElement('div');
		div.style.width = div.style.height = '1em';
		pe.appendChild(div);

		var bool = false;
		var imgFalse = 'selectedfalse';
		var imgTrue = 'selectedtrue';

		function bg(icon){
			zs4.style.type.bgimage(div,'/gfx/icons/'+icon+'.svg');
		}

		function refresh(){
			if (bool) bg(imgTrue);
			else bg(imgFalse);
		}

		BOOL.imageFalse = function(icon){
			imgFalse = icon;
			refresh();
		};
		BOOL.imageTrue = function(icon){
			imgTrue = icon;
			refresh();
		};

		BOOL.value = function(v){
			if (v==null)return bool;
			if (v==true){
				bool=true;
			}
			else {
				bool=false;
			}
			refresh();
			return bool;
		}
		BOOL.value(tof);

		div.onclick = function(e){
			if (bool){
				bool = false;
			}
			else {
				bool = true;
			}
			refresh();
			BOOL.trigger('change');
			e.preventDefault();
			return false;
		}

		BOOL.show();
		refresh();
	},
	elementLink:function(pe,hr){
		var LINK = this;
		UI.element.call(LINK);

		var target = null;
		var href = null;

		var a = LINK.top = LINK.element = document.createElement('a');

		LINK.href = function(hr){
			a.href = hr;
		}

		if (zs4.is.string(hr)) LINK.href(hr);

		pe.appendChild(LINK.top);
	},
	elementLanguage:function(pe){
		var LANG = this;
		UI.element.call(LANG);
		var dft = zs4.userLanguage();
		var select = LANG.top = LANG.element = document.createElement('select');
		for (var i = 0; i < zs4.lang.length;i++){
			var opt = document.createElement('option');
			opt.value = zs4.lang[i];
			if (dft == zs4.lang[i])opt.selected = true;
			opt.textContent = zs4.lang[i];
			select.appendChild(opt);
		}
		select.onchange = function(){
			LANG.trigger('change');
		}
		LANG.value = function(lang){
			if (zs4.is.string(lang))select.value = lang;
			return select.value;
		}
		pe.appendChild(select);
	},
	meaning:new Array(),
	setUILanguage:function(lang,cb){
		if (!zs4.string.array.is.element(zs4.lang,lang)){
			return UI.refreshAllMeanings();
		}

		zs4.loadtranslations(function(){
			var a = UI.meaning;
			for (var i = 0 ; i < a.length; i++){
				a[i].ulang = lang;
				a[i].refresh();
			}
			if (zs4.is.function(cb)) cb();
		},lang);
	},
	refreshAllMeanings:function(){
		var a = UI.meaning;
		for (var i = 0 ; i < a.length; i++){
			a[i].refresh();
		}
	},
	elementMeaning:function(pe,meaningstring){
		var MEANING = this;
		var meaning = meaningstring;

		MEANING.object = zs4.meaning.find(meaning);
		MEANING.ulang = zs4.userLanguage();

		UI.element.call(MEANING,'inlineblock');
		UI.meaning.push(MEANING);
		var div = MEANING.top = document.createElement('div');
		div.style.display = 'inline-block';

		MEANING.addBit('noctrlclick');
		MEANING.addBit('nolinktranslator');

		var display = MEANING.element = document.createElement('div');
		var text = MEANING.text = meaning;
		display.style.cursor = 'help';
		div.appendChild(display);
		MEANING.icon = function(icon){
			UI.setIcon(display,icon);
		}
		MEANING.button = function(icon){
			zs4.style.type.button(display);
			if (zs4.is.string(icon)){MEANING.icon(icon);}
			MEANING.bold(true);
		}

		MEANING.addBit('bold');
		MEANING.bold = function(b){
			if (b==null)return MEANING.bits.bold.get();
			if (b==true) MEANING.bits.bold.true();
			else if (b==false) MEANING.bits.bold.false();

			if (MEANING.bold())MEANING.element.style.fontWeight = 'bold';
			else MEANING.element.style.fontWeight = 'initial';

			return MEANING.bits.bold.get();
		};
		MEANING.meaning = function(m){
			if (m==null)return meaning;
			meaning = m;
			MEANING.object = zs4.meaning.find(meaning);
			MEANING.refresh();
		}

		MEANING.refresh = (function(){
				var trans = zs4.meaning.find(meaning);
				if (trans == null) {
					MEANING.text = meaning;
				}
				else if (trans.hasOwnProperty(MEANING.ulang)){
					MEANING.text = trans[MEANING.ulang];
				}
				else if (trans.hasOwnProperty('en')){
					MEANING.text = trans.en;
				}
				else {
					MEANING.text = meaning;
				}
				MEANING.element.textContent = MEANING.text;

				if (MEANING.eLang)MEANING.eLang.value(MEANING.ulang);
		}).bind(MEANING);

		MEANING.tran = null;
		MEANING.shotran = null;

		var uscope = UI.userScope();
		if (uscope==null){
			MEANING.onclick = function(e){
				if (MEANING.hasEventHandler('click')){
					MEANING.trigger('click');
					return false;
				}
				console.log(e);
				return true;
			};
			display.onclick = MEANING.onclick;
		}
		else {
			MEANING.shotran = false;
			var ready = false;
			var lang; var text; var upload; var result;

			var tran = MEANING.tran = document.createElement('div');
			tran.style.display = 'none';
			div.appendChild(tran);
			function busy(){
				//MEANING.top.style.backgroundColor = 'blue';
				MEANING.top.style.backgroundImage = 'url("/gfx/icons/upload.svg")';
				MEANING.top.style.backgroundRepeat = 'no-repeat';
				MEANING.top.style.backgroundPosition = 'right';
			}
			function idle(){
				//MEANING.tran.style.backgroundColor = 'initial';
				MEANING.top.style.backgroundImage = 'initial';
			}

			MEANING.onclick = function(e){
				if (!MEANING.bits.noctrlclick.get()){
					if (!e.ctrlKey && !e.altKey){
						if (MEANING.hasEventHandler('click')){
							MEANING.trigger('click');
							return false;
						}
						return true;
					}
				}
				console.log(e);

				if (!ready){
					lang = MEANING.eLang = new UI.elementLanguage(tran);

					text = document.createElement('input');
					text.type = 'text';
					tran.appendChild(text);
					upload = UI.addIconImage(tran,'upload');
					result = document.createElement('div');
					result.style.display = 'none';
					tran.appendChild(result);

					if (!MEANING.bits.nolinktranslator.get()){
						var more = document.createElement('div');
						tran.appendChild(more);
						var link = new UI.elementLink(more,'/zs4.app.translator','Translator App');
					}

					upload.onclick = text.onchange = function(e){
						result.textContent = '';
						result.style.display = 'none';
						result.style.backgroundColor = 'initial';

						busy();
						zs4.THIS.zs4.language.translate._.call({
							meaning:meaning,
							lang:lang.value(),
							translation:text.value,
						},
						function(r){
							var t = zs4.path.resolve(r.request.callback,'zs4.language.translate');
							if (t != null){
								if (zs4.is.object(t.error)){
									result.textContent = t.error.text;
									result.style.backgroundColor = 'red';
									result.style.display = 'block';
								}
								else {
									var trans = zs4.meaning.find(meaning);
									if (trans != null){
										trans[lang.value()] = text.value;
										UI.refreshAllMeanings();
									}
									result.textContent = 'done!';
									result.style.backgroundColor = 'green';
									result.style.display = 'block';
								}
							}
							console.log(r);
							idle();
						});

						return false;
					};
					ready = true;
				}

				if (MEANING.shotran){
					MEANING.shotran = false;
					tran.style.display = 'none';
					MEANING.top.style.backgroundColor = 'initial';
				}
				else {
					MEANING.shotran = true;
					tran.style.display = 'initial';
					MEANING.top.style.backgroundColor = 'gray';

					for (var i = 0 ; i < UI.meaning.length; i++){
						var mean = UI.meaning[i];
						if (mean != MEANING && mean.tran != null){
							mean.tran.style.display = 'none';
							mean.top.style.backgroundColor = 'initial';
							mean.shotran = false;
						}
						else {
							mean.top.style.backgroundColor = 'gray';
						}
						mean.refresh();
					}
				}
				return false;
			};
			display.onclick = MEANING.onclick;
		}

		pe.appendChild(div);
		MEANING.show();
		MEANING.refresh();
	},
	toolElement:function(pe,icon){
		var TOOL = this;
		UI.element.call(TOOL,'block');

		var div = TOOL.top = document.createElement('div');
		zs4.style.type.toolbubble(div);
		zs4.style.type.bgimage(div,'/gfx/icons/'+icon+'.svg');

		var header = TOOL.header = document.createElement('div');
		zs4.style.type.toolheader(header);
		div.appendChild(header);

		UI.addIconElement(header,icon);
		UI.addSpace(header);
		var title = new UI.elementMeaning(header,icon);
		title.bold(true);
		title.pointer('pointer');

		var items = document.createElement('div');
		zs4.style.type.tooldetail(items);
		items.style.display = 'none';
		items.style.paddingLeft = '1em';
		//items.style.width = '90%';
		div.appendChild(items);
		TOOL.element = items;

		var showing = false;
		TOOL.expand = function(){
			showing = true;
			items.style.display = 'block';
		}
		TOOL.collapse = function(){
			showing = false;
			items.style.display = 'none';
		}

		header.onclick = function(){
			if (TOOL.hasEventHandler('click')){
				TOOL.trigger('click');
			}
			else {
				if (!showing) TOOL.expand();
				else TOOL.collapse();
			}
		};

		pe.appendChild(div);
	},
	toolLink:function(pe,icon,text,f){
		var LINK = this;
		if (icon==null)icon='link';

		UI.toolElement.call(LINK,pe,'link');
		UI.addSpace(LINK.header);
		var link = new UI.elementLink(LINK.header);
		LINK.element = link.element;
		var icon = UI.addIconElement(link.element,icon);
		UI.addSpace(link.element);
		var text = new UI.elementMeaning(link.element,text);
		text.pointer('pointer');
		LINK.on('click',f);
	},
	elementItem:function(pe,obj){
		var ITEM = this;
		UI.element.call(ITEM,'block');

		ITEM.value = obj;
		ITEM.top = document.createElement('div');
		ITEM.top.onclick = function(){ITEM.trigger('click');}

		var selected = ITEM.icon = new UI.inputBoolean(ITEM.top);

		var inline = new UI.inline(ITEM.top)
		ITEM.element = inline.element;

		pe.appendChild(ITEM.top);
		ITEM.show();
	},
	toolSelect:function(pe,icon){
		var SELECT = this;
		UI.toolElement.call(SELECT,pe,icon);
		var eHead = SELECT.header;
		var a = new Array();
		var value = null;
		SELECT.addBit('multiple');
		var colon = UI.addTextSpan(eHead,': ');
		colon.style.fontWeight = 'bold';

		//UI.addSpace(eHead);
		//SELECT.itemtype = new UI.elementMeaning(eHead,icon);
		//SELECT.itemtype.bold(true);
		//SELECT.itemtype.pointer('pointer');

		UI.addSpace(eHead);
		UI.addIconElement(eHead,'select');
		UI.addSpace(eHead);
		SELECT.title = new UI.elementMeaning(eHead,icon);
		SELECT.title.bold(true);
		SELECT.title.pointer('pointer');
		UI.addSpace(eHead);

		SELECT.header = new UI.inline(eHead).element;
		SELECT.tool = new UI.div(SELECT.element).element;
		SELECT.tool.style.backgroundColor = zs4.style.colorToolTitlebarBackground.css();
		SELECT.items = new UI.div(SELECT.element).element;
		SELECT.item = function(obj){
			var ITEM = this;
			UI.elementItem.call(this,SELECT.items,obj);
			if (!SELECT.bits.multiple.get()){
				ITEM.icon.imageFalse('empty');
			}
			else {

			}
			ITEM.search = '';
			ITEM.refresh = function(){
				if (!SELECT.bits.multiple.get()){
					if (value == ITEM.value){
						ITEM.icon.value(true);
					}
					else {
						ITEM.icon.value(false);
					}
				}
				else {

				}
			};
			ITEM.on('click',function(){
				if (!SELECT.bits.multiple.get()){
					SELECT.collapse();
				}
				if (value != ITEM.value){
					value = ITEM.value;
					SELECT.trigger('change');
				}
			});
			a.push(ITEM);
		};

		SELECT.forAllOptions = function(f){
			if (!zs4.is.function())return 0;
			for (var i = 0 ; i < a.length; i++){
				f(a[i]);
			}
			return a.length;
		}

		function sortDefault(a,b){
			if (zs4.is.string(a.search)&&zs4.is.string(b.search)){
				return a.search.localeCompare(b.search);
			}
			if (zs4.is.string(a.value)){
				return a.value.localeCompare(b.value);
			}
		}
		var sortFunction = sortDefault;
		function searchDefault(a){
			var string = '';
			if (zs4.is.string(a.value)){
				if (string.length > 0)string += ' ';
				string += a.value;
			}
			if (zs4.is.string(a.search)){
				if (string.length > 0)string += ' ';
				string += a.search;
			}

			return zs4.string.search(string,SELECT.searchstr.value);
		}
		var searchFunction = searchDefault;

		function refresh(){
			for (var i = 0 ; i < a.length; i++){
				var ITEM = a[i];
				ITEM.refresh();
				if (searchFunction(ITEM)){
					ITEM.top.style.display = 'block';
				}
				else {
					ITEM.top.style.display = 'none';
				}
			}
			a.sort(function(a,b){
				if (SELECT.sortswitch.value()){
					return -sortFunction(a,b);
				}
				else {
					return sortFunction(a,b);
				}
				sortFunction
			});
			for (var i = 0 ; i < (a.length-1) ; i++){
				var ITEM = a[i];
				SELECT.items.removeChild(ITEM.top);
				SELECT.items.insertBefore(ITEM.top,SELECT.items.childNodes[i]);
			}
		}

		SELECT.searchtool = new UI.div(SELECT.tool).element;
		UI.addIconElement(SELECT.searchtool,'search');
		UI.addSpace(SELECT.searchtool);
		new UI.elementMeaning(SELECT.searchtool,'search');
		SELECT.searchstr = document.createElement('input');
		SELECT.searchstr.type = 'text';
		SELECT.searchstr.oninput = refresh;
		SELECT.searchtool.appendChild(SELECT.searchstr);

		SELECT.sorttool = new UI.div(SELECT.tool).element;
		UI.addIconElement(SELECT.sorttool,'sort');
		UI.addSpace(SELECT.sorttool);
		new UI.elementMeaning(SELECT.sorttool,'sort');

		SELECT.sortswitch = new UI.inputBoolean(SELECT.sorttool);
		SELECT.sortswitch.imageFalse('down');
		SELECT.sortswitch.imageTrue('up');
		SELECT.sortswitch.on('change',refresh);

		SELECT.value = function(v){
			if (v==null)return value;
			value = v;
			refresh();
		};
		SELECT.on('change',refresh);
	},
	toolSelectUiLanguage:function(pe){
		var LANG = this;
		UI.toolSelect.call(LANG,pe,'language');

		function refreshItem(ITEM){
			ITEM.search = '';
			function add(s){if (ITEM.search!='')ITEM.search+=' '; ITEM.search+=s;}
			var m = zs4.meaning.find(ITEM.value);
			for (var n in m){
				if (zs4.is.string(m[n]))add(m[n]);
			}
			add(ITEM.value);
		}

		function language(lang){
			var ITEM = this;
			LANG.item.call(this,lang);

			UI.addSpace(ITEM.element);
			UI.addTextSpan(ITEM.element,'('+lang+')');
			UI.addSpace(ITEM.element);
			LANG.meaning = new UI.elementMeaning(ITEM.element,lang);
			LANG.meaning.pointer('pointer');
			refreshItem(ITEM);
		}

		for (var i = 0 ; i < zs4.lang.length; i++){
			new language(zs4.lang[i]);
		}

		LANG.refresh = function(){
			LANG.title.meaning(LANG.value());
			LANG.forAllOptions(refreshItem);
		};

		function onchange(){
			UI.setUILanguage(LANG.value(),function(){
				LANG.refresh();
			});
		};

		LANG.value(zs4.userLanguage());
		LANG.on('change',onchange);
		LANG.refresh();
	},
	toolLinkScope:function(pe,scope,f){
		var LINK = this;
		UI.toolElement.call(LINK,pe,'link');

		UI.addSpace(LINK.header);
		var link = new UI.elementLink(LINK.header);
		LINK.element = link.element;

		if (zs4.is.type(scope)){
			var si = 'home';
			var st = 'navhome';
			if (scope._.path==''){
				var icon = UI.addIconElement(link.element,si);
				UI.addSpace(link.element);
				var title = new UI.elementMeaning(link.element,st);
				title.pointer('pointer');
			}
			else {
				si = scope.zs4.head.typename._.value;
				st = scope.zs4.head.title._.value;

				var notitle = false;
				if (st.trim() == '') {
					notitle = true;
					st='notitle';
					UI.addTextSpan(link.element,'(');
				}
				var icon = UI.addIconElement(link.element,'link');
				if (notitle) {
					UI.addTextSpan(link.element,')');
				}
				UI.addSpace(link.element);
				var mean = new UI.elementMeaning(link.element,si);
				mean.pointer('pointer');
				UI.addSpace(link.element);
				var icon = UI.addIconElement(link.element,si);
				UI.addSpace(link.element);
				var title = new UI.elementMeaning(link.element,st);
				title.pointer('pointer');
			}

			LINK.on('click',f);
		}
	},
	loginoutElement:function(pe){
		var uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
		if (uscope && zs4.THIS._.scopath !== ''){
			new UI.toolLinkScope(pe,uscope,function(){zs4.navigate('/'+zs4.THIS._.scopath);});
		}
	},
		bowserElement:function(pe){
		var BOWSER = this;

		UI.toolElement.call(BOWSER,pe,'browser');

		var browser = 'browser';
		if (zs4.string.search(bowser.name,'Firefox'))browser = 'firefox';
		else if (zs4.string.search(bowser.name,'Chrome'))browser = 'chrome';
		else if (zs4.string.search(bowser.name,'Safari'))browser = 'safari';
		else if (zs4.string.search(bowser.name,'Edge'))browser = 'edge';

		if (browser != 'browser'){
			UI.addSpace(BOWSER.header);
			UI.addIconElement(BOWSER.header,browser);
		}


		var e = BOWSER.element;

		function addDeviceItem(name,value){
			var item = document.createElement('zs4-app-device-info-item');
			e.appendChild(item);

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

		{
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
		}
		if (bowser.osversion!=null)addBowserFlag('version',bowser.osversion);


		var hr = document.createElement('hr');
		e.appendChild(hr);

		addDeviceItem('appName',window.navigator.appName);
		addDeviceItem('appCodeName',window.navigator.appCodeName);
		addDeviceItem('product',window.navigator.product);
		addDeviceItem('platform',window.navigator.platform);

		hr = document.createElement('hr');
		e.appendChild(hr);

		addDeviceItem('screen',window.screen.width + 'x'+window.screen.height);

	},
	bitsElement:function(pe,bits){
		UI.element.call(this);
		var BITS = this;
		var a = new Array();
		var e = BITS.top = BITS.element = document.createElement('zs4-input-bits');
		e.style.display = 'inline-block';
		e.style.paddingLeft = '1em';
		//zs4.style.type.toolbubble(e);

		function bit(n){
			var BIT = this;
			var name = n.trim();

			BIT.meaning = new UI.elementMeaning(e,name);

			var b = BIT.meaning.element;
			//b.style.display='inline';
			b.style.marginLeft='0.25em';
			b.style.marginRight='0.25em';
			b.style.paddingLeft='0.25em';
			b.style.paddingRight='0.25em';
			b.style.border='0.05em solid black';
			b.style.borderRadius = '0.5em';

			//b.textContent = name;
			b.onclick = function(e){
				if (e.ctrlKey || e.altKey){
					if (zs4.is.function(BIT.meaning.element.onclick)){
						BIT.meaning.onclick(e);
					}
					return true;
				}

				if (bits[name].get()){
					bits[name].false();
					b.style.backgroundColor='initial';
				}
				else {
					bits[name].true();
					b.style.backgroundColor='gray';
				}
				BITS.trigger('change');
				return false;
			}

			BIT.refresh = function(){
				if (bits[name].get()){
					b.style.backgroundColor='gray';
				}
				else {
					b.style.backgroundColor='initial';
				}
			};

			a.push(BIT)
			//e.appendChild(b);
			UI.addTextSpan(e,' ');
		}

		for (var n in bits)if(zs4.is.object(bits[n])&&zs4.is.number(bits[n].m)){
			new bit(' '+n+' ');
		}

		BITS.refresh = function(){
			for (var i = 0; i < a.length; i++){
				a[i].refresh();
			}
		};
		BITS.refresh();

		pe.appendChild(e);
	},
	sliderElement:function(pe,hori,vert){
		UI.element.call(this);

		const BOUNDARY_DIVISOR = 10;
		const INCREMENT_SMALL = 0.01;
		const INCREMENT_BIG = 0.1;
		const SLIDERBACKGROUNDCOLOR = new zs4.color({r:.2,g:.2,b:.2,a:.2});
		const KNOBCOLOR = new zs4.color({r:.1,g:.1,b:0,a:.7});
		const KNOBBACKGROUNDCOLOR = new zs4.color({r:.8,g:.8,b:.8,a:.8});
		const TRACKCOLOR = new zs4.color({r:.4,g:.4,b:.4,a:.7});
		const VALUEBACKGROUNDCOLOR = new zs4.color({r:.6,g:.6,b:.6,a:.8});
		var v_value = 0.0;
		var h_value = 0.0;

		function sliderBits(){
			var SLIDERBITS = this;
			zs4.util.bits.call(this);
			SLIDERBITS.addBit('drawtrack',0);
			SLIDERBITS.drawtrack.true();
			SLIDERBITS.addBit('drawvalue',1);
			SLIDERBITS.drawvalue.true();
			SLIDERBITS.addBit('disabled',2);
		};

		var SLIDER = this;
		var bits = new sliderBits();

		var horizontal = true;
		if (hori==false)horizontal = false;
		var vertical = false;
		if (vert==true)vertical = true;
		if (!vertical && !horizontal) horizontal=true;

		var e = document.createElement('table');
		e.style.display = 'inline-block';
		e.style.backgroundColor = SLIDERBACKGROUNDCOLOR.css();
		e.style.fontSize = '0.5em';
		zs4.style.type.valueplain(e);

		var u; var d; var l; var r; var k;

		function drawUp(){
			var ctx = ctx = u.getContext("2d");
			var w = u.width;
			var h = u.height;

			ctx.beginPath();
			ctx.moveTo(w/2,0);
			ctx.lineTo(0,h);
			ctx.lineTo(w,h);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};
		function drawLeft(){
			var ctx = ctx = l.getContext("2d");
			var w = l.width;
			var h = l.height;

			ctx.beginPath();
			ctx.moveTo(0,h/2);
			ctx.lineTo(w,0);
			ctx.lineTo(w,h);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};
		function drawKnob(){
			var ctx = ctx = k.getContext("2d");
			var w = k.width;
			var h = k.height;

			ctx.clearRect(0,0,w,h);

			var kw = w; var kh = h; var kl = 0; var kt = 0;
			if (horizontal){
				kw = w/BOUNDARY_DIVISOR;
				kl = (w-kw) * h_value;
			}
			else {
				kw = w;
				kl = 0;
			}
			if (vertical){
				kh = h/BOUNDARY_DIVISOR;
				kt = (h-kh) * (1-v_value);
			}
			else {
				kh = h;
				kt = 0;
			}

			if (bits.drawvalue.get()){
				ctx.fillStyle = VALUEBACKGROUNDCOLOR.css();
				var left = kw/2;
				var top = kt+(kh*5/8);
				var width = kl+(kw*3/8)-left;
				var height = h - top - (kh/2);
				if (horizontal && vertical){
					ctx.fillRect(left,top,width,height);
				}
				else if (horizontal){
					ctx.fillRect(0,0,kl+(kw*3/8),h);
				}
				else {
					ctx.fillRect(0,top,w,height+(kh/2));
				}
			}
			if (bits.drawtrack.get()){
				ctx.fillStyle = TRACKCOLOR.css();
				if (horizontal){
					ctx.fillRect(kw/2,kt+(kh*3/8),w-kw,kh/4);
				}
				if (vertical){
					ctx.fillRect(kl+(kw*3/8),kh/2,kw/4,h-kh);
				}
			}

			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fillRect(kl,kt,kw,kh);
		};
		function drawRight(){
			var ctx = ctx = r.getContext("2d");
			var w = r.width;
			var h = r.height;

			ctx.beginPath();
			ctx.moveTo(w,h/2);
			ctx.lineTo(0,0);
			ctx.lineTo(0,h);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};
		function drawDown(){
			var ctx = ctx = d.getContext("2d");
			var w = d.width;
			var h = d.height;

			ctx.beginPath();
			ctx.moveTo(w/2,h);
			ctx.lineTo(0,0);
			ctx.lineTo(w,0);
			ctx.closePath();
			ctx.fillStyle = KNOBCOLOR.css();
			ctx.fill();
		};

		function redraw(){
			if (horizontal){
				drawLeft();
				drawRight();
			}
			if (vertical){
				drawUp();
				drawDown();
			}
			drawKnob();
		}
		// top row;
		if (vertical){
			var tru = document.createElement('tr');
			zs4.style.type.boxplain(tru);
			e.appendChild(tru);

			if (horizontal){
				var td = document.createElement('td');
				zs4.style.type.boxplain(td);
				tru.appendChild(td);
			}
			tdu = document.createElement('td');
			zs4.style.type.boxplain(tdu);
			tru.appendChild(tdu);

			u = document.createElement('canvas');
			u.style.height = '1em';
			tdu.appendChild(u);
			u.onclick = function(){SLIDER.vertical.value(v_value+INCREMENT_BIG);SLIDER.trigger('change');}
			//u.ondblclick = function(){SLIDER.vertical.value(v_value+INCREMENT_BIG);SLIDER.trigger('change');}

			if (horizontal){
				u.style.width = '5em';

				var td = document.createElement('td');
				zs4.style.type.boxplain(td);
				tru.appendChild(td);
			}
			else {
				u.style.width = '1em';
			}

			drawUp();
		}

		// center row;
		var trk = document.createElement('tr');
		zs4.style.type.boxplain(trk);
		e.appendChild(trk);

		if (horizontal){
			var tdl = document.createElement('td');
			zs4.style.type.boxplain(tdl);
			trk.appendChild(tdl)

			l = document.createElement('canvas');
			l.style.width = '1em';
			l.onclick = function(){SLIDER.horizontal.value(h_value-INCREMENT_BIG);SLIDER.trigger('change');}
			//l.ondblclick = function(){SLIDER.horizontal.value(h_value-INCREMENT_BIG);SLIDER.trigger('change');}
			tdl.appendChild(l);
			if (vertical)l.style.height = '5em';
			else l.style.height = '1em';
			drawLeft();
		}
		tdk = document.createElement('td');
		zs4.style.type.boxplain(tdk);
		trk.appendChild(tdk);

		var k = document.createElement('canvas');
		k.style.backgroundColor = KNOBBACKGROUNDCOLOR.css();
		zs4.style.type.valueplain(k);
		tdk.appendChild(k);
		if (horizontal && vertical){
			k.style.width = k.style.height = '5em';
		}
		else if (horizontal){
			k.style.width = '5em';
			k.style.height = '1em';
		}
		else {
			k.style.width = '1em';
			k.style.height = '5em';
		}

		drawKnob();

		var liveUpdate = false;
		function updateValue(e){
			var eRect = k.getBoundingClientRect();
			//console.log(eRect,e);
			//console.log(e.offsetX,e.offsetY);

			if (horizontal){
				var w = eRect.width;
				var wLimit = w/BOUNDARY_DIVISOR;
				if (e.offsetX <= wLimit) h_value = 0;
				else if (e.offsetX >= (w-wLimit)) h_value = 1;
				else h_value = (e.offsetX-wLimit)/(w-(2*wLimit));
				//console.log(h_value);
			}
			if (vertical){
				var h = eRect.height;
				var hLimit = h/BOUNDARY_DIVISOR;
				if (e.offsetY <= hLimit) v_value = 1;
				else if (e.offsetY >= (h-hLimit)) v_value = 0;
				else {
					var offset = h-e.offsetY;
					v_value = ((h-e.offsetY)-hLimit)/(h-(2*hLimit));
				}

				//console.log("SLIDER.trigger('update');",v_value);
			}
			e.preventDefault();
			SLIDER.trigger('update');
			drawKnob();
		}
		function mouseMoved(e){
			//console.log('mouseMoved',e);
			if (liveUpdate)updateValue(e);

		}
		function mouseDown(e){
			var eRect = k.getBoundingClientRect();
			if (e.offsetX>0 && e.offsetY>0 && e.offsetX<eRect.width && e.offsetY<eRect.height){
				liveUpdate = true;
				e.target.addEventListener("mousemove", mouseMoved, false);
				updateValue(e);
			}
			//console.log('mouseDown',e);
		}
		function mouseUp(e){
			if (liveUpdate){
				updateValue(e);
				liveUpdate = false;
				SLIDER.trigger('change');
				e.target.removeEventListener("mousemove", mouseMoved, false);
			}
			//console.log('mouseUp',e);
		}
		k.addEventListener("mousedown", mouseDown, false);
		k.addEventListener("mouseleave", mouseUp, false);
		k.addEventListener("mouseup", mouseUp, false);


		if (horizontal){
			tdr = document.createElement('td');
			zs4.style.type.boxplain(tdr);
			trk.appendChild(tdr);

			r = document.createElement('canvas');
			r.style.width = '1em';
			r.onclick = function(){SLIDER.horizontal.value(h_value+INCREMENT_BIG);SLIDER.trigger('change');}
			//r.ondblclick = function(){SLIDER.horizontal.value(h_value+INCREMENT_BIG);SLIDER.trigger('change');}
			tdr.appendChild(r);
			if (vertical)r.style.height = '5em';
			else r.style.height = '1em';
			drawRight();
		}

		// bottom ROW

		if (vertical){
			var trd = document.createElement('tr');
			zs4.style.type.boxplain(trd);
			e.appendChild(trd);

			if (horizontal){
				var td = document.createElement('td')
				zs4.style.type.boxplain(td);
				trd.appendChild(td);
			}

			var tdd = document.createElement('td');
			zs4.style.type.boxplain(tdd);
			trd.appendChild(tdd);

			d = document.createElement('canvas');
			d.style.height = '1em';
			d.onclick = function(){SLIDER.vertical.value(v_value-INCREMENT_BIG);SLIDER.trigger('change');}
			//d.ondblclick = function(){SLIDER.vertical.value(v_value-INCREMENT_BIG);SLIDER.trigger('change');}
			tdd.appendChild(d);

			if (horizontal){
				d.style.width = '5em';

				var td = document.createElement('td')
				zs4.style.type.boxplain(td);
				trd.appendChild(td);
			}
			else {
				d.style.width = '1em';
			}
			drawDown();
		}


		// external interface
		if (horizontal){
			SLIDER.horizontal = new Object({
				value:function(v){
					if (v==null)return h_value;
					if (zs4.is.number(v)){
						if (v<0)v = 0;
						else if (v>1)v=1;
						h_value = v;
						drawKnob();
					}
				},

			});
		}
		if (vertical){
			SLIDER.vertical = new Object({
				value:function(v){
					if (v==null)return v_value;
					if (zs4.is.number(v)){
						if (v<0)v = 0;
						else if (v>1)v=1;
						v_value = v;
						drawKnob();
					}
				},

			});

		}
		if (!vertical || !horizontal){
			if (horizontal){
				SLIDER.value = SLIDER.horizontal.value;
			}
			else {
				SLIDER.value = SLIDER.vertical.value;
			}
		}

		function addBit(n){
			n = n.trim();
			SLIDER[n] = function(v){
				if (v==null)return bits[n].get();
				if (v==true){
					bits[n].true();
				}
				else if (v==false){
					bits[n].false();
				}
				redraw();
			};

		}

		for (var n in bits)if (zs4.is.object(bits[n])){
			addBit(' '+n+' ');
		}
		pe.appendChild(e);
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
				else {o._.html.icon.off=o._.html.icon.on=o._.typename;}
			}
			else if (o._.flags.value & o._.flags.scope){
				if (o._.html.topElement){
					o._.html.icon.on = o.zs4.head.typename._.value;
					o._.html.icon.off = 'logo';
				}
				else if (zs4.string.startsWith(o._.path,'zs4.type.')){
					var a = zs4.string.split.words(o._.path);
					if (a.length == 5 && a[3]=='array'){
						o._.html.icon.on = a[2];
						o._.html.icon.off = a[2];
					}
					else {
						o._.html.icon.on = 'minus';
						o._.html.icon.off = o.zs4.head.typename._.value;
					}
				}
				else {
					o._.html.icon.on = 'minus';
					o._.html.icon.off = o.zs4.head.typename._.value;
				}
			}
			else {
				if (o._.flags.get.local()){
					o._.html.icon.off=o._.typename;
				}
				else {
					o._.html.icon.off=o._.name;
				}
				o._.html.icon.on='minus';
			}
		}

		if (o._.html.e==null){
			o._.html.e = document.createElement('zs4-'+o._.typename);
			UI.addClass(o._.html.e,'container');

			if (zs4.is.type(po)){
				po._.html.c.appendChild(o._.html.e);
				o._.html.parentElement = po._.html.c;
				UI.addClass(o._.html.e,'branch');
			}
			else {

				if (po==null)po=document.body;
				po.appendChild(o._.html.e);
				o._.html.parentElement = po;

				if (zs4.admin.rootElementParent==null)zs4.admin.rootElementParent = po;
				zs4.admin.rootObject = o;

				UI.addClass(o._.html.e,'top');
				o._.html.topElement=true;
				o._.html.top = new Object({value:{}});

				zs4.window.onresize.push(o._.html.refreshAll);
			}

			o._.html.genericRefresh = (function(){
				var add = '';
				var rem = '';

				function addrem(e){
					if (e==null)return;
					UI.addClass(e,add);
					UI.removeClass(e,rem);
				};
				//if (UI.am(o))add+=' am'; else rem+=' am';
				//if (UI.own(o))add+=' own'; else rem+=' own';


				if (o._.html.toolbarIsOpen){
					add+=' tbon'; rem+=' tboff';
					if (o._.html.expanded){
						UI.removeClass(o._.html.toolbarHeader,'nodisplay');
						UI.removeClass(o._.html.toolbar,'nodisplay');
						UI.setIcon(o._.html.toolbarToggle,'tool');
					}
					else if (o._.html.toolbar!=null){
						UI.addClass(o._.html.toolbarHeader,'nodisplay');
						UI.addClass(o._.html.toolbar,'nodisplay');
						UI.setIcon(o._.html.toolbarToggle,'tool');
					}
					if (o._.type==Object){
						if (o._.html.c != null)UI.addClass(o._.html.c,'nodisplay');
					}
					else {
						if (o._.html.input != null)UI.addClass(o._.html.input,'nodisplay');
					}
				}
				else{
					add+=' tboff';rem+=' tbon';
					if (o._.html.toolbar!=null){
						UI.addClass(o._.html.toolbarHeader,'nodisplay');
						UI.addClass(o._.html.toolbar,'nodisplay');
						UI.setIcon(o._.html.toolbarToggle,'tool');
					}
					if (o._.type==Object){
						if (o._.html.c != null)UI.addClass(o._.html.c,'nodisplay');
					}
					else {
						if (o._.html.input != null)UI.addClass(o._.html.input,'nodisplay');
					}
				}

				if (o._.html.expanded==true){
					add+=' on'; rem+=' off';
					if (o._.html.toolbarIsOpen){
						UI.setIcon(o._.html.toggle,'tostart');
					}
					else{
						if (o._.html.topElement)UI.setIcon(o._.html.toggle,'logo');
						else UI.setIcon(o._.html.toggle,o._.html.icon.on);
						if (o._.type==Object){
							if (o._.html.c != null)UI.removeClass(o._.html.c,'nodisplay');
						}
						else {
							if (o._.html.input != null)UI.removeClass(o._.html.input,'nodisplay');
						}
					}
					if (o._.html.toolbar != null){
						UI.removeClass(o._.html.toolbarToggle,'nodisplay');
					}
				}
				else{
					add+=' off';rem+=' on'
					UI.setIcon(o._.html.toggle,o._.html.icon.off);
					if (o._.html.toolbar != null){
						UI.addClass(o._.html.toolbarToggle,'nodisplay');
					}
				}

				if (o._.html.topElement==true){
					UI.setIcon(o._.html.toggle,'logo');
					var top = o._.html.top;
					add+=' top';
					if (o._.flags.get.authroot())add+=' root';else rem+=' root';
					var wtit = 'zs4';
					if (o.zs4.head.title._.value != '')wtit+= ':' + o.zs4.head.title._.value;
					if (top.value.utitle != '')wtit+=':'+top.value.utitle;
					if (document.title != wtit)document.title = wtit;

					if (o._.html.appIsOpen){
						if (o._.html.top.dialogActive)UI.setIcon(o._.html.toggle,'tostart');
						else UI.setIcon(o._.html.toggle,'logo');
						UI.removeClass(o._.html.dialogHeader,'nodisplay');
						UI.removeClass(o._.html.appElement,'nodisplay');
						UI.addClass(o._.html.c,'nodisplay');
						if (o._.html.toolbarToggle){
							UI.addClass(o._.html.toolbarToggle,'nodisplay');
						}
						if (zs4.is.object(top.app)){
							top.app.internalRefresh();
						}
					}
					else {
						UI.addClass(o._.html.dialogHeader,'nodisplay');
						UI.addClass(o._.html.appElement,'nodisplay');
						UI.removeClass(o._.html.c,'nodisplay');

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
				if (o._.flags.get.priced())add+=' priced';else rem+=' priced';

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

					if (o._.html.input != null)UI.setClass(o._.html.input,'noset',o._.flags.get.noset());
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

				UI.setClass(o._.html.e,'nodisplay',o._.flags.get.nodisplay());

				if (o._.cberror == null){
					UI.addClass(o._.html.error,'nodisplay');
				}
				else {
					o._.html.error.textContent = o._.cberror.text;
					UI.removeClass(o._.html.error,'nodisplay');
				}

				if (o._.cbresult == null){
					UI.addClass(o._.html.result,'nodisplay');
				}
				else {
					o._.html.result.textContent = '';
					UI.removeClass(o._.html.result,'nodisplay');
				}

			}).bind(o);

			if (o._.type == Object){
				o._.html.sort = (function(foo,descend){
					zs4.throttle.job(function(){
						var a = o._.sort(foo,descend);
						if (a.length > 1){
							for (var i = 0 ; i < (a.length-1) ; i++){
								if (zs4.is.object(a[i]._.html)){
									o._.html.c.removeChild(a[i]._.html.e);
									o._.html.c.insertBefore(a[i]._.html.e, o._.html.c.childNodes[i]);
								}
							}
						}
					});

				}).bind(o);
			}
		}

		if (o._.flags.get.scope()){
			UI.addClass(o._.html.e,'scope');
			o._.scope = o;
			//if (o.zs4.head.bits._.bits.plugin.get()){
				UI.addClass(o._.html.e,o.zs4.head.typename._.value);
			//}
		}
		else{
			if (zs4.is.type(po))o._.scope = po._.scope;
			UI.removeClass(o._.html.e,'scope');
		}

		UI.setClass(o._.html.e,'am',UI.am(o));
		UI.setClass(o._.html.e,'own',UI.own(o));

		if (o._.html.head==null){
			o._.html.head = document.createElement('zs4-object-head');
			o._.html.e.appendChild(o._.html.head);

			o._.html.toggle = document.createElement('zs4-object-toggle');
			//if (o._.flags.get.priced())UI.addClass('priced');
			o._.html.head.appendChild(o._.html.toggle);
			UI.setIcon(o._.html.toggle,'minus');
			UI.addClass(o._.html.toggle,o._.typename);
			o._.html.expanded = false;
			o._.html.toggleOff = function(){
				o._.html.expanded = false;
				o._.html.genericRefresh();
			};
			o._.html.expandTree = function(){
				o._.html.expanded = true;
				if (o._.type == Object){
					zs4.admin.type[o._.typename](po,o);
				}
				else {
					o._.html.genericRefresh();
				}
			};
			o._.html.toggleOn = function(){
				o._.html.expandTree();
			};
			o._.html.onToggle = function(){
				if (o._.html.toolbarIsOpen && o._.html.toolbar != null){
					o._.html.toolbarClose();
				}
				if (o._.html.topElement==true){
					o._.html.toggleOn()
					if (o._.html.appIsOpen){
						if (UI.root()||zs4.admin.debug){
							o._.html.appIsOpen=false;
							o._.html.toggleOn()
						}
						else if (zs4.admin.rootObject._.scope._.path!='' && !o._.html.top.dialogActive){
							if (UI.user()&&zs4.THIS._.scopath!=o._.path){
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

			o._.html.ePlugName = document.createElement('zs4-scope-type');
			o._.html.head.appendChild(o._.html.ePlugName);

			o._.html.name = document.createElement('zs4-name');
			o._.html.head.appendChild(o._.html.name);
			o._.html.name.textContent = o._.name;
			if (o._.flags.value & o._.flags.scope){
				o.zs4.head.title._.onchange(function(){
					//console.log('AUTOUPDATING SCOPE TITLE');
					o._.html.name.textContent = o.zs4.head.title._.value;
				});
			}

			o._.html.error = document.createElement('zs4-error');
			UI.setIcon(o._.html.error,'error');
			UI.addClass(o._.html.error,'nodisplay');
			o._.html.error.onclick = function(){
				UI.addClass(o._.html.error,'nodisplay');
			};
			o._.html.head.appendChild(o._.html.error);

			o._.html.result = document.createElement('zs4-result');
			UI.addClass(o._.html.result,'nodisplay');
			UI.setIcon(o._.html.result,'true');
			o._.html.head.appendChild(o._.html.result);
			o._.html.result.onclick = function(){
				if (o._.cbresult != null)console.log(o._.cbresult);
				o._.html.result.style.display = 'none';
			};

			o._.html.spin = document.createElement('zs4-spin');
			UI.setIcon(o._.html.spin,'spin');
			UI.setAnimate(o._.html.spin,'spin');
			UI.addClass(o._.html.spin,'nodisplay');
			o._.html.head.appendChild(o._.html.spin);

			o._.html.c == null;
			o._.html.input == null;
			o._.html.toolbar == null;
			o._.html.toolbarIsOpen = false;
			o._.html.defaultTool = null;

			o._.html.quickupdate = function(input,cb){
				if (input == null){
					if (zs4.is.function(cb))cb();
					return;
				}
				UI.removeClass(o._.html.spin,'nodisplay');
				zs4.post(o._.wrapRequest(input),function(ret){
					//o._.html.refreshAll();
					UI.addClass(o._.html.spin,'nodisplay');
					if (zs4.is.function(cb))cb();
				});

			};

			if (o._.type==Object){
				o._.html.form = document.createElement('form');
				o._.html.form.onsubmit = function(){return false;};
				o._.html.form.autocomplete = 'on';
				o._.html.form.id = o._.path;
				o._.html.e.appendChild(o._.html.form);

				o._.html.c = document.createElement('zs4-object-content');
				o._.html.form.appendChild(o._.html.c);

				if (!zs4.is.function(o._.html.submit)){
					o._.html.submit = (function(){
						var count = o._.countProperties();
						if (o._.flags.get.api()&&(o._.html.expanded||count==0)){
							var input = o._.input();
							if (input == null)return;
							UI.removeClass(o._.html.spin,'nodisplay');
							UI.addClass(o._.html.toolbarToggle,'nodisplay');
							zs4.post(o._.wrapRequest(input),function(ret){
								o._.html.refreshAll();
								UI.addClass(o._.html.spin,'nodisplay');
								UI.removeClass(o._.html.toolbarToggle,'nodisplay');
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

				o._.html.result.style.display = 'none';

				o._.html.appIsOpen = true;
				o._.html.dialog = new Object();

				if (!o._.html.dialogHeader){
					o._.html.dialogHeader= document.createElement('zs4-app-header');
					o._.html.head.appendChild(o._.html.dialogHeader);
				}
				if (!o._.html.appElement){
					o._.html.appElement = document.createElement('zs4-app');
					o._.html.e.appendChild(o._.html.appElement);
				}
				if (!o._.html.appUserInterface){
					o._.html.appUserInterface = document.createElement('zs4-app-ui');
					o._.html.appElement.appendChild(o._.html.appUserInterface);
				}
				if (!o._.html.appWindow){
					o._.html.appWindow = document.createElement('zs4-app-window');
					o._.html.appUserInterface.appendChild(o._.html.appWindow);
				}

				if (UI.own(o) || UI.am(o)){
					var titleBar = document.createElement('zs4-title-bar');
					o._.html.appWindow.appendChild(titleBar);
					var titleInput = o._.html.titleField = document.createElement('input');
					titleInput.type = 'text';
					titleInput.placeholder = '(title)';
					titleInput.value = o.zs4.head.title._.value;
					UI.addClass(titleInput,'scope-title');
					titleBar.appendChild(titleInput);
					o.zs4.head.title._.onchange(function(){
						titleInput.value = o.zs4.head.title._.value;
					});
					titleInput.onchange = function(){
						o.zs4.head.title._.call(titleInput.value, function(){});
					};
				}

				o._.html.docOptions = document.createElement('zs4-doc-options');
				o._.html.docOptions.style.display = 'block';

				if (zs4.plugin.list.hasOwnProperty(o.zs4.head.typename._.value)){
					var plugname = o.zs4.head.typename._.value;

					o._.html.ePlugName.textContent = plugname;

					o._.html.appWindowToolbar = document.createElement('zs4-app-toolbar');
					UI.addClass(o._.html.appWindowToolbar,plugname);
					o._.html.appWindow.appendChild(o._.html.appWindowToolbar);

					// Reload Button
					if (zs4.is.function(zs4.plugin.list[plugname].reload)){
						o._.html.appWindowReload = document.createElement('zs4-app-window-reload');
						//o._.html.appWindowReload.title = 'save';
						o._.html.appWindowReload.onclick = zs4.plugin.list[plugname].reload;
						UI.setIcon(o._.html.appWindowReload,'reload');
						UI.addClass(o._.html.appWindowReload,plugname);
						o._.html.head.appendChild(o._.html.appWindowReload);
					}

					// Create new Document BUtTON
					var nu = zs4.path.resolve(zs4.THIS,'zs4.type.'+plugname+'.method.new');
					if (UI.user()&&nu!=null){
						//console.log('MUST PUT NEW DOC OPTION!!!!'); // 'new'
						var block = document.createElement('div');
						o._.html.docOptions.appendChild(block);
						var icon = UI.addIconElement(block,'new');
						UI.addSpace(block);
						UI.addTextSpan(block,'new '+plugname+' document');
					 	icon.onclick = function(){
							UI.removeClass(o._.html.spin,'nodisplay');
							nu._.call({},function(){
								UI.addClass(o._.html.spin,'nodisplay');
								if (zs4.is.string(nu._.cbresult)){
									zs4.navigate(nu._.cbresult)
								}
							});
						};

						if (zs4.is.function(zs4.plugin.list[plugname].store)){
							var block = document.createElement('div');
							o._.html.docOptions.appendChild(block);
							var icon = UI.addIconElement(block,'clone');
							UI.addSpace(block);
							UI.addTextSpan(block,'clone this '+plugname+' document');
						 	icon.onclick = function(){
								var obj = zs4.plugin.list[plugname].store();
								obj.zs4.head.title = obj.zs4.head.title + ' (clone)';

								var bits = new zs4.type.scopebits({name:'temp'});
								bits._.value = obj.zs4.head.bits;
								bits._.bits.public.false();
								obj.zs4.head.bits = bits._.value;

								UI.removeClass(o._.html.spin,'nodisplay');
								nu._.call(obj,function(){
									UI.addClass(o._.html.spin,'nodisplay');
									if (zs4.is.string(nu._.cbresult)){
										zs4.navigate(nu._.cbresult)
									}
								});
							};
						}
					}

					// Save Button
					if (zs4.is.function(zs4.plugin.list[plugname].save)&&o._.flags.get.own()){
						if (o._.html.docOptions!=null){
							var block = document.createElement('div');
							o._.html.docOptions.appendChild(block);
							var icon = UI.addIconElement(block,'save');
							icon.onclick = zs4.plugin.list[plugname].save;
							UI.addSpace(block);
							UI.addTextSpan(block,'save document');
						}
					}

					zs4.plugin.list[plugname].ui(o._.html.appWindow,o);
				}
				else if (o.zs4.head.typename._.value === 'app'){
					if (zs4.app && zs4.app.launch) zs4.app.launch(o);
				}
				o._.html.top.dialogActive = false;
				o._.html.top.dialog = function(name){
					this.active = false;
					this.name = name;
					o._.html.dialog[name] = this;

					//o._.html.topElement=true;
					this.select = document.createElement('zs4-app-tab');
					o._.html.dialogHeader.appendChild(this.select);
					UI.setIcon(this.select,name);
					UI.removeClass(this.select,'current');
					//this.select.textContent = name;

					this.pane = document.createElement('zs4-app-dialog');
					//zs4.style.type.toolbubble(this.pane);
					o._.html.appUserInterface.appendChild(this.pane);
					//this.pane.textContent = 'dialog pane for '+name;
					UI.removeClass(this.pane,'current');
					UI.addClass(this.pane,'nodisplay');
					this.refreshDialog = function(){};
					this.refreshInternal = function(){
						//console.log('dialog('+this.name+').refreshInternal()');
						if (!zs4.is.boolean(this.uninitialized))this.uninitialized=true;
						else this.uninitialized=false;
						this.refreshDialog();
						//console.log(o._.html.dialog.coins);
						if (zs4.is.object(o._.html.dialog.coins)){
							//console.log('updating balance from refreshInternal()');
							o._.html.dialog.coins.updateBalance();
						}
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
							UI.removeClass(di.content,'nodisplay');
						};
						di.toggleOff = function(){
							di.toggleActive=false;
							UI.addClass(di.content,'nodisplay');
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
								UI.addClass(o._.html.dialog[n].select,'current');
								UI.addClass(o._.html.dialog[n].pane,'current');
							}
							else {
								//console.log('... IDLE: '+n);
								o._.html.dialog[n].active = false;
								UI.removeClass(o._.html.dialog[n].select,'current');
								UI.removeClass(o._.html.dialog[n].pane,'current');
							}

							if (o._.html.dialog[n].active){
								UI.removeClass(o._.html.dialog[n].pane,'nodisplay');
								UI.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
								this.refreshInternal();
							}
							else {
								UI.addClass(o._.html.dialog[n].pane,'nodisplay');
								UI.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
							}
						}
						if (active){
							o._.html.top.dialogActive = true;
							UI.addClass(o._.html.appWindow,'nodisplay');
						}
						else{
							o._.html.top.dialogActive = false;
							UI.removeClass(o._.html.appWindow,'nodisplay');
						}
						o._.html.refreshAll();
					}).bind(this);

				};
				o._.html.top.dialogTool = function(){
					var THIS = this;
					o._.html.top.dialog.call(this,'document');

					this.toolbar.appendChild(o._.html.docOptions);

					// TITLE
					this.titleblock = document.createElement('zs4-title-block');
					this.titleblock.style.display = 'block';
					this.toolbar.appendChild(this.titleblock);

					this.titleicon = UI.addIconElement(this.titleblock,'search');
					UI.addSpace(this.titleblock);

					this.title = document.createElement('input');
					this.title.type = 'text';
					UI.addClass(this.title,'scope-title');
					//UI.setIcon(this.title,'search');
					UI.addAttribute(this.title,'autocomplete','title');
					this.title.value = o.zs4.head.title._.value;
					o.zs4.head.title._.onchange(function(){
						//console.log('AUTOUPDATED DOC TITLE');
						THIS.title.value = o.zs4.head.title._.value;
					});
					this.title.maxLength = o.zs4.head.title._.maxlength;
					this.titleblock.appendChild(this.title);

					this.title.onchange = function(){
						UI.removeClass(o._.html.spin,'nodisplay');
						o.zs4.head.title._.call(THIS.title.value,function(){
							UI.addClass(o._.html.spin,'nodisplay');
							o._.html.refreshAll();
						});
					};

					// AUTHOR
					this.authorblock = document.createElement('zs4-author-block');
					this.authorblock.style.display = 'block';
					this.toolbar.appendChild(this.authorblock);

					this.authoricon = UI.addIconElement(this.authorblock,'author');

					this.author = document.createElement('input');
					this.author.type = 'text';
					UI.addAttribute(this.author,'autocomplete','author');
					UI.addClass(this.author,'scope-author');
					UI.setIcon(this.author,'search');
					this.author.value = o.zs4.head.author._.value;
					this.author.maxLength = o.zs4.head.author._.maxlength;
					this.authorblock.appendChild(this.author);

					this.author.onchange = function(){
						UI.removeClass(o._.html.spin,'nodisplay');
						o.zs4.head.author._.call(THIS.author.value,function(){
							UI.addClass(o._.html.spin,'nodisplay');
							o._.html.refreshAll();
						});
					};

					// LANGUAGE
					UI.createValueElement(this.toolbar,o.zs4.head.lang);

					// DESRIPTION
					this.descblock = document.createElement('zs4-desc-block');
					this.descblock.style.display = 'block';
					this.toolbar.appendChild(this.descblock);

					this.descicon = UI.addIconElement(this.descblock,'info');

					this.desc = document.createElement('textarea');
					//this.desc.type = 'text';
					UI.addClass(this.desc,'scope-desc');
					UI.setIcon(this.desc,'search');
					this.desc.value = o.zs4.head.description._.value;
					this.desc.maxLength = o.zs4.head.description._.maxlength;
					this.descblock.appendChild(this.desc);

					this.desc.onchange = function(){
						UI.removeClass(o._.html.spin,'nodisplay');
						o.zs4.head.description._.call(THIS.desc.value,function(){
							UI.addClass(o._.html.spin,'nodisplay');
							o._.html.refreshAll();
						});
					};

					// PUBLIC / PRIVATE
					if (o._.flags.get.own()||o._.flags.get.am()){
						this.isPublic = false;
						this.public = document.createElement('zs4-bit-public');
						UI.setIcon(this.public,'auth');
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

							UI.removeClass(o._.html.spin,'nodisplay');
							o.zs4.head.bits._.call(bits._.value,function(){
								UI.addClass(o._.html.spin,'nodisplay');
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

					// Media preview in document panel
					if (o.zs4.head.typename._.value === 'media'){
						var mediaPane = document.createElement('zs4-media-view');
						this.pane.appendChild(mediaPane);
						var _o = o;
						function buildMediaPreview(){
							mediaPane.innerHTML = '';
							var p = _o.path ? _o.path._.value : '';
							var mime = _o.mimetype ? _o.mimetype._.value : '';
							var name = _o.originalname ? _o.originalname._.value : p;
							if (!p) return;
							if (mime.indexOf('image/') === 0){
								var img = document.createElement('img');
								img.src = p;
								img.style.maxWidth = '100%';
								img.style.display = 'block';
								mediaPane.appendChild(img);
							} else if (mime.indexOf('audio/') === 0){
								var aud = document.createElement('audio');
								aud.src = p; aud.controls = true;
								aud.style.width = '100%';
								mediaPane.appendChild(aud);
							} else if (mime.indexOf('video/') === 0){
								var vid = document.createElement('video');
								vid.src = p; vid.controls = true;
								vid.style.maxWidth = '100%';
								vid.style.display = 'block';
								mediaPane.appendChild(vid);
							} else {
								var dl = document.createElement('a');
								dl.href = p; dl.textContent = name || p;
								dl.target = '_blank';
								mediaPane.appendChild(dl);
							}
						}
						buildMediaPreview();
						_o._.onchange(buildMediaPreview);
					}

					// App: show path info in document panel; launch happens in appWindow
					if (o.zs4.head.typename._.value === 'app'){
						var appFileInfo = document.createElement('div');
						appFileInfo.style.cssText = 'font-family:monospace;font-size:0.8em;color:gray;padding:0.3em 0;';
						appFileInfo.textContent = './apps/'+o._.name+'/main.js';
						this.pane.appendChild(appFileInfo);
					}

				};
				o._.html.top.dialogCoins = function(){
					var DIALOG = this;
					o._.html.top.dialog.call(this,'coins');
					DIALOG.uscope = zs4.THIS._.resolvePath(zs4.THIS._.scopath);
					DIALOG.updateBalance = function(){
						if (UI.root())return;
						if (DIALOG.uscope != null){
							DIALOG.balance.textContent = DIALOG.uscope.account.balance._.value;
							if (DIALOG.uscope.account.balance._.value >= 0){
								UI.addClass(DIALOG.balance,'positive');
								UI.removeClass(DIALOG.balance,'negative');
							}
							else {
								UI.addClass(DIALOG.balance,'negative');
								UI.removeClass(DIALOG.balance,'positive');
							}
							console.log('BALANCE UPDATED');
						}

					};
					this.balance = document.createElement('zs4-coins-header-balance');
					o._.html.dialogHeader.appendChild(this.balance);
					o._.onchange(DIALOG.updateBalance);

					DIALOG.updateBalance();

					DIALOG.refreshDialog = function(){

					};

				},
				o._.html.top.dialogUser = function(){
					var DIALOG = this;
					o._.html.top.dialog.call(this,'user');

					new UI.loginoutElement(this.pane);
					new UI.bowserElement(this.pane);

					/*
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
											UI.addClass(DIALOG.vfy0,'nodisplay');
											UI.addClass(DIALOG.new0,'nodisplay');
										}
										else {
											UI.removeClass(DIALOG.vfy0,'nodisplay');
											UI.removeClass(DIALOG.new0,'nodisplay');
										}
										UI.removeClass(DIALOG.setpwd,'nodisplay');
									}
									else {
										UI.addClass(DIALOG.setpwd,'nodisplay');
									}
								}
								else {

								}
							}
						}
						else {
							this.username.text = 'login';
							if (DIALOG.failcount > 2){
								UI.removeClass(this.etok,'nodisplay');
							}
						}

						if (this.loggedIn==true){
							UI.addClass(this.logoutArgs,'nodisplay');
							UI.addClass(this.bye,'nodisplay');
						}
					}).bind(this);
					*/

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
						UI.removeClass(o._.html.dialog[n].select,'current');
						UI.removeClass(o._.html.dialog[n].pane,'current');
						UI.addClass(o._.html.dialog[n].pane,'nodisplay');
						UI.setIcon(o._.html.dialog[n].select,o._.html.dialog[n].name);
					}
					o._.html.top.dialogActive = false;
					UI.removeClass(o._.html.appWindow,'nodisplay');

					o._.html.refreshAll();
				}

				if (o._.flags.get.scope()){
					if (o.zs4.head.typename._.value=='node'||o.zs4.head.typename._.value=='user'){
						top.app = new UI.app(o,o._.html.appWindow);
						top.app.toolbar = document.createElement('zs4-app-toolbar');
						top.app.containerElement.appendChild(top.app.toolbar);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){

								top.app.searchButton = document.createElement('zs4-app-search-icon');
								UI.setIcon(top.app.searchButton,'search');
								top.app.toolbar.appendChild(top.app.searchButton);
								top.app.searchButton.onclick = (function(){
									o._.html.top.deselectAll();
									this.requestItems();
								}).bind(top.app);

								top.app.search = document.createElement('input');
								top.app.search.type = 'search';
								UI.addClass(top.app.search,'search');
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
								UI.addClass(top.app.typeSelect,'app-type-select');
								top.app.type.appendChild(top.app.typeSelect);
								var option = document.createElement('option');
								option.value = '';
								option.text = 'all types';
								option.selected = true;
								top.app.typeSelect.add(option);
								for (var n in zs4.THIS.zs4.type)if (zs4.is.type(zs4.THIS.zs4.type[n])){
									if (n=='user'&&!UI.root())continue;
									option = document.createElement('option');
									option.text = option.value = (' '+n+' ').trim();
									UI.setIcon(option,option.value);
				          			top.app.typeSelect.add(option);
								}
								top.app.typeSelect.onchange = (function(){
									if (top.app.typeSelect.value != ''){
										var path = 'zs4.type.'+top.app.typeSelect.value+'.method.new';
										console.log('path for new option: '+path);
										var nu = zs4.THIS._.resolvePath(path);
										if (top.app.typeSelect.value === 'media'){
											UI.addClass(top.app.new,'nodisplay');
											UI.removeClass(top.app.uploadBtn,'nodisplay');
										} else if (nu != null){
											UI.removeClass(top.app.new,'nodisplay');
											UI.addClass(top.app.uploadBtn,'nodisplay');
										}
										else {
											UI.addClass(top.app.new,'nodisplay');
											UI.addClass(top.app.uploadBtn,'nodisplay');
										}
									}
									else {
										UI.addClass(top.app.new,'nodisplay');
										UI.addClass(top.app.uploadBtn,'nodisplay');
									}

									this.requestItems();
								}).bind(top.app);

								top.app.creator = document.createElement('zs4-app-creator');
								top.app.toolbar.appendChild(top.app.creator);

								top.app.searchForOwner = '';
								if (o._.flags.get.scope()&&o.zs4.head.typename._.value=='user'){
									top.app.searchForOwner = o._.path;
								}

								/*
								top.app.creatorSelect = document.createElement('select');
								UI.addClass(top.app.creatorSelect,'app-creator-select');
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
									UI.addClass(top.app.creator,'nodisplay');
								}
								*/

								top.app.sortFunction = new Object();
								top.app.sort = document.createElement('zs4-app-sort');
								top.app.toolbar.appendChild(top.app.sort);

								top.app.sortSelect = document.createElement('select');
								UI.addClass(top.app.sortSelect,'app-sort-select');
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

								if (zs4.is.string(zs4.THIS._.scopath)){// && o._.path==zs4.THIS._.scopath){
									top.app.new = document.createElement('zs4-app-new-item');
									top.app.new.textContent = 'new';
									UI.addClass(top.app.new,'nodisplay');
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

											UI.removeClass(o._.html.spin,'nodisplay');
											nu._.call({},function(){
												UI.addClass(o._.html.spin,'nodisplay');
												if (zs4.is.string(nu._.cbresult)){
													zs4.navigate(nu._.cbresult)
												}
											});

											//alert('NEW METHOD EXISTS!');
										}
									};
								}

								// Upload button — only shown when media type is selected
								top.app.uploadBtn = document.createElement('zs4-app-new-item');
								UI.setIcon(top.app.uploadBtn,'upload');
								UI.addClass(top.app.uploadBtn,'nodisplay');
								top.app.toolbar.appendChild(top.app.uploadBtn);

								top.app.uploadInput = document.createElement('input');
								top.app.uploadInput.type = 'file';
								top.app.uploadInput.style.display = 'none';
								top.app.toolbar.appendChild(top.app.uploadInput);

								top.app.uploadBtn.onclick = function(){
									top.app.uploadInput.value = '';
									top.app.uploadInput.click();
								};

								top.app.uploadInput.onchange = function(){
									var file = top.app.uploadInput.files[0];
									if (!file) return;
									var reader = new FileReader();
									reader.onload = function(e){
										var nu = zs4.THIS._.resolvePath('zs4.type.media.method.new');
										if (!nu) return;
										UI.removeClass(o._.html.spin,'nodisplay');
										nu._.call({
											filename: file.name,
											mimetype: file.type,
											filedata: e.target.result,
										}, function(){
											UI.addClass(o._.html.spin,'nodisplay');
											o._.html.refreshAll();
										});
									};
									reader.readAsDataURL(file);
								};

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
									this.element.style.display = 'block';
									top.app.content.appendChild(this.element);

									this.icon = document.createElement('zs4-app-item-icon');
									UI.setIcon(this.icon,scope.zs4.head.typename._.value);
									this.element.appendChild(this.icon);

									this.data = document.createElement('zs4-app-item-data');
									this.element.appendChild(this.data);

									this.title = document.createElement('a');
									this.title.text = scope.zs4.head.title._.value;
									if (scope.zs4.head.title._.value=='')this.title.text = '(untitled)';
									this.title.href = '/'+scope._.path;
									this.title.onclick = (function(e){
										e.preventDefault();
										zs4.navigate(scope._.path);
									}).bind(this);
									UI.addClass(this.title,'app-item-link');
									this.data.appendChild(this.title);

									if (scope._.flags.get.own()){
										if (scope.zs4.head.bits._.bits.public.get()){
											this.isPublic = true;
											this.ePublic = UI.addIconElement(this.data,'public');
										}
										else {
											this.isPublic = false;
											this.ePublic = UI.addIconElement(this.data,'private');
										}
										var epub = this.ePublic;
										this.ePublic.onclick = function(){
											var bits = new zs4.type.scopebits({name:'temp'});
											bits._.value = scope.zs4.head.bits._.value;

											if (scope.zs4.head.bits._.bits.public.get()){
												bits._.bits.public.false();
											}
											else {
												bits._.bits.public.true();
											}

											UI.removeClass(o._.html.spin,'nodisplay');
											scope.zs4.head.bits._.call(bits._.value,function(){
												UI.addClass(o._.html.spin,'nodisplay');
												if (scope.zs4.head.bits._.bits.public.get()){
														UI.setIcon(epub,'public');
												}
												else {
													UI.setIcon(epub,'private');
												}
												//scope._.html.refreshAll();
											});
										};

										this.delblock = document.createElement('zs4-app-item-delblock');
										this.delblock.style.display = 'inline-block';
										this.data.appendChild(this.delblock);

										this.delete = document.createElement('zs4-app-item-delete');
										UI.setIcon(this.delete,'delete');
										this.delblock.appendChild(this.delete);
										this.delete.onclick = function(){
											UI.removeClass(THIS.surdel,'nodisplay');
											UI.removeClass(THIS.sure,'nodisplay');
										};

										this.surdel = document.createElement('zs4-app-item-delete-sure');
										this.surdel.textContent = 'sure?';
										UI.addClass(this.surdel,'nodisplay');
										this.delblock.appendChild(this.surdel);

										this.sure = document.createElement('input');
										this.sure.type = 'checkbox';
										UI.addClass(this.sure,'nodisplay');
										this.delblock.appendChild(this.sure);
										this.sure.onchange = function(){
											if (THIS.sure.checked)UI.removeClass(THIS.reallydelete,'nodisplay');
											else UI.addClass(THIS.reallydelete,'nodisplay');
										};

										this.reallydelete = document.createElement('zs4-app-item-really-delete');
										UI.setIcon(this.reallydelete,'delete');
										UI.addClass(this.reallydelete,'nodisplay');
										this.delblock.appendChild(this.reallydelete);
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

											UI.removeClass(o._.html.spin,'nodisplay');
											delone._.call(THIS.scope._.name,function(){
												o._.html.refreshAll();
												UI.addClass(o._.html.spin,'nodisplay');
											});

										};
									}

									this.more = document.createElement('zs4-app-item-more');
									this.more.style.display = 'block';
									this.element.appendChild(this.more);

									this.description = document.createElement('zs4-app-item-desc');
									this.description.style.display = 'block';
									this.description.textContent = this.scope.zs4.head.description._.value;
									this.more.appendChild(this.description);

									if (this.scope.zs4.head.author._.value!=''){
										this.author = document.createElement('zs4-app-item-author');
										this.author.textContent = this.scope.zs4.head.author._.value;
										UI.setIcon(this.author,'author');
										this.more.appendChild(this.author);
									}

									this.listGap = document.createElement('zs4-app-item-gap');
									this.listGap.style.display = 'block';
									this.listGap.style.visibility = 'hidden';
									this.listGap.textContent = '|';
									this.element.appendChild(this.listGap);

								}).bind(top.app);

								top.app.findItem = (function(scope){
									for (var i = 0 ; i < top.app.array.length ; i++){
										if (top.app.array[i].scope==scope)return top.app.array[i];
									}
									return null;
								}).bind(top.app);

								top.app.setCurrentItem = (function(scope){
									for (var i = 0 ; i < top.app.array.length ; i++){
										if (top.app.array[i].scope==scope){
											return top.app.array[i];
										}
									}
									return null;
								}).bind(top.app);

								top.app.requestItems = (function(){
									var req = new Object();
									req.value = top.app.search.value;
									req.type = top.app.typeSelect.value;
									req.owner = top.app.searchForOwner;
									//req.owner = ''; //top.app.creatorSelect.value;
									//if (o._.flags.get.scope()&&o.zs4.head.typename._.value=='user'){
									//	req.owner = o._.path;
									//}

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

										UI.removeClass(o._.html.spin,'nodisplay');
										zs4.post(tq._.wrapRequest(query),function(ret){
											UI.addClass(o._.html.spin,'nodisplay');
											// install app icons when app type is queried
											if (req.type === 'app' && zs4.app){
												var arr = zs4.THIS.zs4.type.app.array;
												for (var n in arr){
													if (!zs4.is.type(arr[n])) continue;
													zs4.app.addIcon(arr[n]);
												}
											}
											o._.html.refreshAll();
										});
									}
									else {
										UI.removeClass(o._.html.spin,'nodisplay');
										zs4.post(zs4.THIS.zs4.search._.wrapRequest(req),function(ret){
											UI.addClass(o._.html.spin,'nodisplay');
											o._.html.refreshAll();
											// Sequential: after render settles, install app icons once per session
											if (zs4.app && !zs4.app._iconsLoaded){
												zs4.app._iconsLoaded = true;
												var _tq = zs4.THIS._.resolvePath('zs4.type.app.method.query');
												if (_tq) zs4.post(_tq._.wrapRequest({
													search:'',
													sort:{item:'zs4.head.title',descend:false},
													select:{sc:'all'},
												}), function(){
													var _arr = zs4.THIS.zs4.type.app.array;
													for (var _n in _arr){
														if (!zs4.is.type(_arr[_n])) continue;
														zs4.app.addIcon(_arr[_n]);
													}
												});
											}
										});
									}

								}).bind(top.app);

								top.app.requestItems();
							}

							//top.app.creatorRefresh();

							// get new objects
							var arr = o._.getAllScopes();
							for (var i = 0 ; i < arr.length  ; i++){
								var item = top.app.findItem(arr[i]);
								if (item != null){
									item.title.textContent = item.scope.zs4.head.title._.value || '(untitled)';
								}
								else {
									if (arr[i]._.path != '')item = new top.app.item(arr[i]);
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
									//UI.addClass(top.app.array[i].element,'nodisplay');
									top.app.array[i].element.style.display = 'none';
									continue;
								}

								if (top.app.array[i].scope._.flags.get.own()){
									UI.addClass(top.app.array[i].surdel,'nodisplay');
									UI.addClass(top.app.array[i].sure,'nodisplay');
									UI.addClass(top.app.array[i].reallydelete,'nodisplay');
								}

								if (top.app.search.value != ''){
									if (!top.app.array[i].scope._.search(top.app.search.value)){
										//UI.addClass(top.app.array[i].element,'nodisplay');
										top.app.array[i].element.style.display = 'none';
										continue;
									}
								}
								if (top.app.typeSelect.value != ''){
									if (top.app.array[i].scope.zs4.head.typename._.value!=top.app.typeSelect.value){
										//UI.addClass(top.app.array[i].element,'nodisplay');
										top.app.array[i].element.style.display = 'none';
										continue;
									}
								}
								if (top.app.searchForOwner != ''){
									console.log('compare '+top.app.searchForOwner+' to '+top.app.array[i].scope.zs4.head.owner._.value);
									if (top.app.array[i].scope.zs4.head.owner._.value!=top.app.searchForOwner){
										//UI.addClass(top.app.array[i].element,'nodisplay');
										top.app.array[i].element.style.display = 'none';
										continue;
									}
								}

								if (zs4.is.string(zs4.THIS._.token)
								&& zs4.is.string(zs4.THIS._.scopath)
								&& top.app.array[i].scope.zs4.head.owner._.value==zs4.THIS._.scopath){
									UI.addClass(top.app.array[i].element,'own');
									UI.addClass(top.app.array[i].icon,'own');
									UI.addClass(top.app.array[i].title,'own');
								}
								else if (zs4.is.string(zs4.THIS._.token)
								&& zs4.is.string(zs4.THIS._.scopath)
								&& top.app.array[i].scope._.path==zs4.THIS._.scopath){
									UI.addClass(top.app.array[i].element,'am');
									UI.addClass(top.app.array[i].icon,'am');
									UI.addClass(top.app.array[i].title,'am');
								}
								else {
									UI.removeClass(top.app.array[i].element,'own');
									UI.removeClass(top.app.array[i].icon,'own');
									UI.removeClass(top.app.array[i].title,'own');

									UI.removeClass(top.app.array[i].element,'am');
									UI.removeClass(top.app.array[i].icon,'am');
									UI.removeClass(top.app.array[i].title,'am');
								}

								//UI.removeClass(top.app.array[i].element,'nodisplay');
								top.app.array[i].element.style.display = 'block';
							}

							top.app.orderHtml();

						}).bind(top.app);
						top.app.internalRefresh();
					}
					else if (o.zs4.head.typename._.value=='price'){
						top.app = new UI.app(o,o._.html.appWindow);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){
								top.app.content = document.createElement('zs4-app-content');
								top.app.content.textContent = 'price editor';
								o._.html.appWindow.appendChild(top.app.content);

								top.app.searchdialog = UI.createSearchSelect(o,{type:'',owner:o.zs4.head.owner._.value,});
								top.app.searchdialog.zs4.setValue(o.scope._.value);
								top.app.searchdialog.zs4.scopeTrueOrFalse = function(scope){
									var styp = scope.zs4.head.typename._.value;
									if (styp=='user'||styp=='price')return false;
									return true;
								}
								top.app.searchdialog.zs4.onchange = function(){
									o.scope._.html.quickupdate(top.app.searchdialog.zs4.getValue(),function(){
										var s = top.app.searchdialog.zs4.getScope();
										if (zs4.is.object(s)){
											UI.setIcon(top.app.scopeitemicon,s.zs4.head.typename._.value);
											top.app.scopeitemselect.zs4.setScope(s);
										}
									});

								}
								top.app.content.appendChild(top.app.searchdialog);

								top.app.scopeitem = document.createElement('zs4-price-scopeitem');
								top.app.scopeitem.style.display = 'block';
								top.app.content.appendChild(top.app.scopeitem);

								top.app.scopeitemicon = UI.addIconElement(top.app.scopeitem,'item');
								top.app.scopeitemselect = UI.createSelectScopeItem(o,zs4.THIS);
								top.app.scopeitemselect.zs4.setValue(o.item._.value);
								top.app.scopeitemselect.zs4.itemTrueOrFalse = function(item){
									//console.log('testing item: '+item.value);
									if (zs4.string.startsWith(item.value,'zs4.type.price'))return false;
									return true;
								};
								top.app.scopeitemselect.zs4.onchange = function(){
									var val = top.app.scopeitemselect.zs4.getValue();
									//o.item._.html.quickupdate(val);
									var req = new Object({
										item:val,
										zs4:{head:{title:val}},
									});

									UI.removeClass(o._.html.spin,'nodisplay');
									o._.call(req,function(){
										UI.addClass(o._.html.spin,'nodisplay');

									});
									//o.zs4.head.title._.html.quickupdate(top.app.scopeitemselect.zs4.getValue());
								};
								top.app.content.appendChild(top.app.scopeitemselect);

								top.app.searchdialog.zs4.submit(top.app.searchdialog.zs4.hideResults);
							}



						}).bind(top.app);

						top.app.internalRefresh();
					}
					else {
						top.app = new UI.app(o,o._.html.appWindow);
						top.app.toolbar = document.createElement('zs4-app-toolbar');
						top.app.containerElement.appendChild(top.app.toolbar);
						top.app.refresh = (function(){
							if (top.app.uninitialized==true){
								//top.app.content = document.createElement('zs4-app-content');
								//top.app.content.textContent = o.zs4.head.typename._.value+' editor';
								//o._.html.appWindow.appendChild(top.app.content);
							}

						}).bind(top.app);
						top.app.internalRefresh();
					}


					if (o.zs4.head.bits._.bits.plugin.get()){
						var appClass = o.zs4.head.typename._.value;
						//window.alert(appClass);
						UI.addClass(o._.html.head,appClass);
						UI.addClass(o._.html.toggle,appClass);
						UI.addClass(o._.html.name,appClass);
						UI.addClass(o._.html.c,appClass);

						UI.addClass(o._.html.dialogHeader,appClass);
						UI.addClass(o._.html.appElement,appClass);
						UI.addClass(o._.html.appUserInterface,appClass);
						UI.addClass(o._.html.appWindow,appClass);

						UI.addClass(o._.html.top.app.toolbar,appClass);
						UI.addClass(o._.html.top.app.searchButton,appClass);
						UI.addClass(o._.html.top.app.search,appClass);
						UI.addClass(o._.html.top.app.content,appClass);
						//UI.addClass(,appClass);
						//UI.addClass(,appClass);
					}
				}

				var homeTab = document.createElement('zs4-app-tab');
				UI.setIcon(homeTab,'home');
				homeTab.onclick = function(){
					if (zs4.app) zs4.app.showHome();
				};
				o._.html.dialogHeader.appendChild(homeTab);

				// App system — only set up on the root scope; other scopes must not overwrite
				if (o.zs4.head.typename._.value==='node'||o.zs4.head.typename._.value==='user'){
				o._.html.appPanels = o._.html.appPanels || {};
				zs4.app = zs4.app || {};

				zs4.app.showHome = function(){
					for (var k in o._.html.appPanels)
						o._.html.appPanels[k].style.display = 'none';
					UI.removeClass(o._.html.appWindow,'nodisplay');
				};

				zs4.app.show = function(name){
					for (var k in o._.html.appPanels)
						o._.html.appPanels[k].style.display = 'none';
					UI.addClass(o._.html.appWindow,'nodisplay');
					if (o._.html.appPanels[name])
						o._.html.appPanels[name].style.display = 'block';
				};

				zs4.app.addIcon = function(appObj){
					var name = appObj._.name;
					if (o._.html.appPanels[name]) return;

					// private pane — lives for the session
					var pane = document.createElement('zs4-app-panel');
					pane.style.cssText = 'display:none;width:100%;height:100%;overflow:auto;padding:0.5em;box-sizing:border-box;';
					pane.code_executed = false;
					o._.html.appUserInterface.appendChild(pane);
					o._.html.appPanels[name] = pane;

					// toolbar icon
					var iconName = (appObj.icon && appObj.icon._.value) ? appObj.icon._.value : 'app';
					var tab = document.createElement('zs4-app-tab');
					tab.setAttribute('data-app', name);
					UI.setIcon(tab, iconName);
					tab.title = appObj.zs4.head.title._.value || name;
					tab.onclick = function(){ zs4.app.launch(appObj); };
					o._.html.dialogHeader.appendChild(tab);
				};

				zs4.app.launch = function(appObj){
					var name = appObj._.name;
					zs4.app.addIcon(appObj); // no-op if already exists
					var pane = o._.html.appPanels[name];
					if (!pane.code_executed){
						pane.code_executed = true;
						var code = appObj.code ? appObj.code._.value : '';
						if (code){
							try {
								var fn = new Function('return ('+code.trim()+')')();
								fn.call(appObj, appObj, pane);
							} catch(e){
								pane.textContent = 'Error in '+name+': '+e.message;
							}
						} else {
							pane.textContent = name+' — no code yet.';
						}
					}
					zs4.app.show(name);
				};
				} // end root-only zs4.app setup

				if (UI.am(o)||UI.own(o)){
					new o._.html.top.dialogTool();
				}
				new o._.html.top.dialogUser();
				if (UI.user()) {
					new o._.html.top.dialogCoins();
				}

				if (o._.html.docOptions != null){
					var block = document.createElement('div');
					o._.html.docOptions.appendChild(block);

					var icon = UI.addIconElement(o._.html.docOptions,'amppage');
					UI.addSpace(o._.html.docOptions);
					UI.addTextSpan(o._.html.docOptions,'view document as AMP page');

					icon.onclick = function(){
						if (o._.path=='') zs4.navigate('/amp');
						else zs4.navigate(o._.path + '.amp');
					}
				}

				o._.html.appInfo = document.createElement('zs4-app-info');
				o._.html.appElement.appendChild(o._.html.appInfo);

				o._.html.appInfoContent = document.createElement('zs4-app-info-content');
				o._.html.appInfo.appendChild(o._.html.appInfoContent);

				if (zs4.is.function(zs4.static)){
					//window.alert('asdfasddf');
					zs4.static(o._.html.appInfoContent);
				}
				else {
					o._.html.appInfoContent.innerHTML = 'zs4 toonsmith by Andy Flinn...';
				}

				// Auto-open document tab when navigating to an app scope
				if (o.zs4.head.typename._.value === 'app' && o._.html.dialog && o._.html.dialog['document']){
					o._.html.dialog['document'].select.onclick();
				}
			}

		}

	},

}
UI = zs4.admin.util;

zs4.admin.type = {
	array:function(po,o){
		zs4.admin.type.object(po,o);
	},
	bits:function(po,o){
		zs4.admin.type.integer(po,o);
	},
	boolean:function(po,o){
		UI.unknown(po,o);
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
			o._.onchange(function(ctx){
				o._.html.input.checked = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.expanded = true;
			o._.html.input.checked = o._.value;
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			//o._.html.input.readOnly = o._.flags.get.noset();
		}
	},
	bye:function(po,o){
		zs4.admin.type.object(po,o);
	},
	date:function(po,o){
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){
			if (o._.flags.get.noset()){
				o._.html.input = document.createElement('input-date-readonly');
				o._.html.e.appendChild(o._.html.input);

			}
			else {
				o._.html.input = document.createElement('input');
				o._.html.e.appendChild(o._.html.input);
				o._.html.input.setAttribute('type', 'date');
				UI.addAttribute(o._.html.input,'autocomplete',o._.name);
				UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
				o._.html.input.onchange = function(){
					console.log("o._.html.input.value: ",o._.html.input.value)
					console.log("UI.date.fromInput(o._.html.input): ",UI.date.fromInput(o._.html.input))
					if (o._.flags.get.local()){
						o._.value = UI.date.fromInput(o._.html.input);
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(UI.date.fromInput(o._.html.input));
					}
				};

				o._.input = (function(){
					if (o._.flags.get.noset())return null;
					return UI.date.fromInput(o._.html.input);
				}).bind(o);
			}
			o._.onchange(function(ctx){
				if (o._.flags.get.noset()){
					var d = new Date(o._.value);
					o._.html.input.textContent = ( d.toLocaleDateString() + ' ' + d.toLocaleTimeString() );
				}
				else {
					UI.date.toInput(o._.value,o._.html.input);
				}

			});
			o._.html.expanded = true;
			o._.html.input.readOnly = o._.flags.get.noset();
			o._.onchange_call();
			o._.html.genericRefresh();
		}

		//console.log('admin.date.type: ',o._.type)
		//console.log('admin.date.value: ',o._.value)


		//o._.html.genericRefresh();
	},
	download:function(po,o){
		zs4.admin.type.object(po,o);
	},
	enum:function(po,o){
		UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
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
					if (o._.value == o._.enum[i])option.selected=true;
					o._.html.input.add(option);
				}

			};

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

			o._.html.expanded = true;

			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.enumRefresh();
				o._.html.genericRefresh();
			});
			o._.html.input.value = o._.value;
			o._.html.enumRefresh();
			o._.html.genericRefresh();
    }
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
		//o.email._.html.
	},
	integer:function(po,o){
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			UI.addAttribute(o._.html.input,'autocomplete',o._.name);
			UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.parseInt(o._.html.input.value);
					o._.value = o._.parseInt(o._.html.input.value);
					o._.html.refreshAll();
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
			o._.onchange(function(ctx){
				o._.html.input.value = parseInt(o._.value);
				o._.html.genericRefresh();
			});
			//o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = parseInt(o._.value);
			o._.html.genericRefresh();
		}
	},
	lang:function(po,o){
		zs4.admin.type.enum(po,o);
	},
	name:function(po,o){
		zs4.admin.type.string(po,o);
	},
	names:function(po,o){
		zs4.admin.type.string(po,o);
	},
	number:function(po,o){
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('input');
			UI.addAttribute(o._.html.input,'autocomplete',o._.name);
			UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.setAttribute('type', 'number');
			o._.html.input.setAttribute('step', 0.000001);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.parseFloat(o._.html.input.value);
					o._.value = o._.parseFloat(o._.html.input.value);
					o._.html.refreshAll();
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
			o._.onchange(function(ctx){
				o._.html.input.value = parseFloat(o._.value);
				o._.html.genericRefresh();
			});
			//o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = parseFloat(o._.value);
			o._.html.genericRefresh();
		}
	},
	object:function(po,o){
		//if (!zs4.is.type(o) || o._.typename!='object'){
		if (!zs4.is.type(o)||o._.type!=Object){
			console.log('not a valid zs4 object');
			console.log(o);
			return null;
		}

		zs4.throttle.job(function(){
			UI.unknown(po,o);

			var kids = new Array();

			for (var n in o){
				var name = new String(n);
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
				kids.push(o[n]);
			}

			function makefoo(child){

			};
			for (var i = 0 ; i < kids.length; i++){
				if (o._.html.expanded){
					var child = kids[i]
					zs4.admin.type[new String(child._.typename)](o,child);
				}
			}

			zs4.throttle.job(function(){
				if (zs4.is.type(o.zs4)&&(o._.flags.value & o._.flags.scope)){

					o._.scope = o;
					if (zs4.is.string(o.zs4.head.title._.value) && o.zs4.head.title._.value.length > 0){
						o._.html.name.textContent = o.zs4.head.title._.value;
						o._.onchange(function(){
							o._.html.name.textContent = o.zs4.head.title._.value;
						});
					}
					else if (!o._.flags.get.notrans()){
						o._.html.name.textContent = o._.name + ' (untitled)';
					}
				}
				else{
					if (zs4.is.type(po))o._.scope = po._.scope;
				}
			});

			zs4.throttle.job(function(){o._.html.genericRefresh();});
			zs4.throttle.job(function(){o._.html.sort();});

		});

		//UI.addClass(e)



	},
	password:function(po,o){
		zs4.admin.type.string(po,o);
	},
	scope:function(po,o){
		zs4.admin.type.object(po,o);
	},
	scopebits:function(po,o){
		zs4.admin.type.bits(po,o);
	},
	scopeindex:function(po,o){
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
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
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
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
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
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
		UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
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
		UI.unknown(po,o);
		if (o._.html.input==null){
			o._.select = false;
			if (zs4.is.array(o._.enum)&&o._.enum.length>0){
				o._.select = true;
				o._.html.input = document.createElement('select');
				for (var i = 0; i < o._.enum.length; i++){
					var opt = document.createElement('option');
					opt.value = opt.textContent = o._.enum[i];
					if (i==0)opt.selected = true;
					o._.html.input.appendChild(opt);
				}
				o._.html.input.onchange = function(){
					console.log(o._.html.input.selectedIndex,o._.html.input.value);
					if (o._.flags.get.local()){
						o._.value = o._.enum[o._.html.input.selectedIndex];
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(o._.enum[o._.html.input.selectedIndex]);
					}
				};
				o._.html.e.appendChild(o._.html.input);

				o._.input = (function(){
					if (o._.flags.get.noset())return null;
					return o._.enum[o._.html.input.selectedIndex];
				}).bind(o);
			}
			else {
				o._.html.input = document.createElement('input');
				UI.addAttribute(o._.html.input,'autocomplete',o._.name);
				UI.addAttribute(o._.html.input,'autocomplete',o._.typename);
				o._.html.input.maxLength = o._.maxlength;
				o._.html.e.appendChild(o._.html.input);
				var typeAttr = 'text';
				if (o._.typename=='password')typeAttr='password';
				o._.html.input.setAttribute('type', typeAttr);
				o._.html.input.onchange = function(){
					//alert('++++++++++++++++++');
					if (o._.flags.get.local()){
						o._.value = o._.html.input.value;
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(o._.html.input.value);
					}
				};

				o._.input = (function(){
					if (o._.flags.get.noset())return null;
					return this._.html.input.value;
				}).bind(o);
			}
			o._.html.expanded = true;
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.input.value = o._.value;
			o._.html.genericRefresh();
		}
	},
	text:function(po,o){
		var THIS = this;
		UI.unknown(po,o);
		//console.log('checking ui for object '+o._.path);
		if (o._.html.input==null){

			o._.html.input = document.createElement('textarea');
			o._.html.input.maxLength = o._.maxlength;
			o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
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
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.value = o._.value;
			o._.html.genericRefresh();
		}
	},
	type:function(po,o){
		zs4.admin.type.object(po,o);
	},
	um:function(po,o){
    UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
			o._.html.input.onclick = function(){
				o._.html.refreshOptions(o);
			};
			o._.html.input.onblur = function(){
				o._.html.input.value = o._.value;
				//window.alert('onblur in um dropdown');
			};
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = o._.value;

			//console.log('refreshing read-only um dropdown');
			//o._.html.input.value = o._.value;
			o._.html.input.innerHTML = '';
			var option = document.createElement('option');
			option.text = o._.value;
			option.value = o._.value;
			option.selected = true;
			o._.html.input.appendChild(option);


      o._.html.e.appendChild(o._.html.input);
			if (!o._.flags.get.noset()){
				o._.html.input.onchange = function(){

					if (o._.flags.get.local()){
						o._.value = o._.html.input.value;
						o._.html.refreshAll();
					}
					else if (o._.flags.get.quickupdate()){
						o._.html.quickupdate(o._.html.input.value);
					}
				};
			}
			else {
				o._.html.input.onchange = function(){
				};
			}

      o._.input = (function(){
        if (o._.flags.get.noset())return null;
        return this._.html.input.value;
      }).bind(o);

			o._.html.umtable = null;
      o._.html.refreshOptions = function(o){
				if (zs4.is.array(o._.html.umtable))return;
				o._.html.input.innerHTML = '';
				var a = o._.html.umtable = zs4.um._array();

        for (var i = 0 ; i < a.length ; i++){
          var option = document.createElement('option');
					option.text = a[i];
					option.value = a[i];
					if (a[i]==o._.value)option.selected = true;
        	o._.html.input.appendChild(option);
        }
      }
			o._.html.expanded = true;
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
			});
			o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.value = o._.value;
			o._.html.genericRefresh();
    }
  },
	userscope:function(po,o){
		UI.unknown(po,o);
    if (o._.html.input==null){

      o._.html.input = document.createElement('select');
      o._.html.e.appendChild(o._.html.input);
			o._.html.input.onchange = function(){
				if (o._.flags.get.local()){
					o._.value = o._.html.input.value;
					o._.value = o._.html.input.value;
					o._.html.refreshAll();
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
			o._.onchange(function(ctx){
				o._.html.input.value = o._.value;
				o._.html.genericRefresh();
				o._.html.refreshOptions(o);
			});
			//o._.html.input.readOnly = o._.flags.get.noset();
			o._.html.input.readOnly = o._.html.input.disabled = o._.flags.get.noset();
			o._.html.input.value = o._.value;
			o._.html.refreshOptions(o);
			o._.html.genericRefresh();
    }
  },
	zs4:function(po,o){
		zs4.admin.type.object(po,o);
	},
	media:function(po,o){
		zs4.admin.type.object(po,o);
	},
	app:function(po,o){
		zs4.admin.type.object(po,o);
	},
};
